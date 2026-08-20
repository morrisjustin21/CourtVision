// Runs once a day on Vercel's schedule (see vercel.json). Checks every team
// with an OSSAA schedule URL for newly completed games, and drops any it
// finds into `pending_score_reviews` for manual approval in the app — this
// never writes directly into `games`, since a wrong auto-write is worse
// than a missed one.
//
// Requires two environment variables set in Vercel (Project Settings ->
// Environment Variables), NOT prefixed with VITE_ so they stay server-side:
//   SUPABASE_URL              - same value as VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY - the SECRET service_role key from Supabase's
//                               API settings. Never expose this to the browser.

import { createClient } from '@supabase/supabase-js'

const OSSAA_HOME = 'https://ossaarankings.com/Default.aspx'

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// ASP.NET WebForms sessions are gated by a session cookie. A one-shot
// request to a schedule URL gets silently redirected back to a generic
// page; hitting the homepage first to capture the cookie, then reusing it,
// gets the real content.
async function fetchWithSession(url) {
  const homeRes = await fetch(OSSAA_HOME)
  const setCookie = homeRes.headers.get('set-cookie') || ''
  const cookie = setCookie.split(';')[0] // just the ASP.NET_SessionId=... part

  const res = await fetch(url, {
    headers: {
      Cookie: cookie,
      Referer: OSSAA_HOME,
      'User-Agent': 'Mozilla/5.0 (compatible; CourtVisionBot/1.0)',
    },
  })
  return res.text()
}

// Parses the schedule table out of the page HTML. Looks for rows whose
// first cell is a date (MM/DD/YY) rather than relying on brittle CSS
// selectors, since ASP.NET GridViews use generated element IDs.
function parseScheduleRows(html) {
  const rows = []
  const trChunks = html.split(/<tr[\s>]/i).slice(1)
  for (const chunk of trChunks) {
    const cellMatches = [...chunk.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    if (cellMatches.length < 3) continue
    const cellText = (i) =>
      cellMatches[i][1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&#160;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()

    const dateCell = cellText(0)
    const dateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2})/.exec(dateCell)
    if (!dateMatch) continue

    const opponentCell = cellText(1)
    const resultsCell = cellText(2)

    const scoreMatch = /(\d+)\s*-\s*(\d+)\s*(W|L)/i.exec(resultsCell)
    if (!scoreMatch) continue // "No Score" or otherwise incomplete

    if (opponentCell.startsWith('TBA')) continue // tournament placeholder

    const isHome = !opponentCell.trim().startsWith('@')
    const opponentRaw = opponentCell
      .replace(/^@\s*/, '')
      .replace(/\s*\(\d[A-Z]?\)\s*\*{0,2}\s*$/i, '')
      .trim()

    const [, mm, dd, yy] = dateMatch
    const year = 2000 + parseInt(yy, 10)
    const gameDate = `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`

    rows.push({
      gameDate,
      opponentRaw,
      isHome,
      teamScore: parseInt(scoreMatch[1], 10),
      opponentScore: parseInt(scoreMatch[2], 10),
      result: scoreMatch[3].toUpperCase(),
    })
  }
  return rows
}

function normalizeName(name) {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export default async function handler(req, res) {
  // Vercel sends this header automatically on real cron invocations.
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = getSupabase()

  const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 1).single()
  if (!settings?.auto_score_check_enabled) {
    return res.status(200).json({ skipped: true, reason: 'auto_score_check_enabled is false' })
  }

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, ossaa_schedule_url')
    .not('ossaa_schedule_url', 'is', null)

  const { data: allTeams } = await supabase.from('teams').select('id, name')
  const teamByNormalizedName = new Map((allTeams || []).map((t) => [normalizeName(t.name), t.id]))

  let totalFound = 0
  let totalInserted = 0
  const errors = []

  for (const team of teams || []) {
    try {
      const html = await fetchWithSession(team.ossaa_schedule_url)
      const rows = parseScheduleRows(html)
      totalFound += rows.length

      for (const row of rows) {
        const matchedOpponentTeamId = teamByNormalizedName.get(normalizeName(row.opponentRaw)) || null

        const { error, data } = await supabase
          .from('pending_score_reviews')
          .insert({
            team_id: team.id,
            opponent_raw: row.opponentRaw,
            matched_opponent_team_id: matchedOpponentTeamId,
            game_date: row.gameDate,
            is_home: row.isHome,
            team_score: row.teamScore,
            opponent_score: row.opponentScore,
            result: row.result,
            status: 'pending',
          })
          .select()

        // Duplicate (already seen on a previous day's run) is expected and fine.
        if (!error && data) totalInserted += 1
      }
    } catch (err) {
      errors.push({ team: team.name, error: String(err) })
    }
  }

  await supabase.from('app_settings').update({ last_checked_at: new Date().toISOString() }).eq('id', 1)

  return res.status(200).json({
    teamsChecked: (teams || []).length,
    gamesFound: totalFound,
    newReviews: totalInserted,
    errors,
  })
}
