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

    if (opponentCell.startsWith('TBA')) continue // tournament placeholder

    const [, mm, dd, yy] = dateMatch
    const year = 2000 + parseInt(yy, 10)
    const gameDate = `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    const isHome = !opponentCell.trim().startsWith('@')
    const opponentRaw = opponentCell
      .replace(/^@\s*/, '')
      .replace(/\s*\(\d[A-Z]?\)\s*\*{0,2}\s*$/i, '')
      .trim()

    const scoreMatch = /(\d+)\s*-\s*(\d+)\s*(W|L)/i.exec(resultsCell)
    if (scoreMatch) {
      rows.push({
        type: 'score',
        gameDate,
        opponentRaw,
        isHome,
        teamScore: parseInt(scoreMatch[1], 10),
        opponentScore: parseInt(scoreMatch[2], 10),
        result: scoreMatch[3].toUpperCase(),
      })
    } else if (/^no score$/i.test(resultsCell)) {
      rows.push({
        type: 'schedule',
        gameDate,
        opponentRaw,
        isHome,
      })
    }
    // Anything else (unrecognized results text) is skipped rather than guessed at.
  }
  return rows
}

// ---- Team name matching ----
// Kept identical in src/teamMatching.js and api/cron/check-scores.js.
// OSSAA (and coaches) sometimes include a mascot — "Elgin Owls" — where
// CourtVision just has "Elgin". Names match when one is the same as, or
// begins with, the other, compared word by word. "Elgin Owls" matches
// "Elgin"; "Southeast" does NOT match "South".
function nameWords(name) {
  return (name || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
}

function isWordPrefix(shorter, longer) {
  return shorter.length > 0 && shorter.length <= longer.length && shorter.every((w, i) => w === longer[i])
}

function matchScore(rawWords, teamWords) {
  if (rawWords.length === 0 || teamWords.length === 0) return 0
  if (rawWords.join('') === teamWords.join('')) return 1000 // same name (ignoring spacing/punctuation)
  if (isWordPrefix(teamWords, rawWords)) return teamWords.length * 10 // raw has extra words (a mascot)
  if (isWordPrefix(rawWords, teamWords)) return rawWords.length * 10 - 1 // our team name has extra words
  return 0
}

// Returns the single best matching team, or null if nothing matches or two
// teams tie (better to ask than to guess).
function findTeamMatch(raw, teams) {
  const rawWords = nameWords(raw)
  let best = null
  let bestScore = 0
  let tie = false
  for (const team of teams || []) {
    const score = matchScore(rawWords, nameWords(team.name))
    if (score === 0) continue
    if (score > bestScore) {
      best = team
      bestScore = score
      tie = false
    } else if (score === bestScore) {
      tie = true
    }
  }
  return best && !tie ? best : null
}

function namesMatch(a, b) {
  return matchScore(nameWords(a), nameWords(b)) > 0
}
// ---- end team name matching ----

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

  // Everything already known, so a game that shows up on BOTH teams' schedule
  // pages (or is already in CourtVision) doesn't produce a second entry.
  const cutoff = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: existingReviews } = await supabase
    .from('pending_score_reviews')
    .select('team_id, matched_opponent_team_id, opponent_raw, game_date, entry_type')
    .gte('game_date', cutoff)
  const { data: existingGames } = await supabase
    .from('games')
    .select('id, game_date, home_team_id, away_team_id, home_score, away_score')
    .gte('game_date', cutoff)
  const knownReviews = [...(existingReviews || [])]

  function alreadyCovered(team, row, oppId) {
    // A score review also covers a schedule entry for the same game.
    const typeCovers = (t) => t === row.type || (row.type === 'schedule' && t === 'score')

    const hasReview = knownReviews.some((r) => {
      if (r.game_date !== row.gameDate || !typeCovers(r.entry_type)) return false
      const rOpp = r.matched_opponent_team_id || findTeamMatch(r.opponent_raw, allTeams || [])?.id || null
      // Same team's own page, opponent spelled differently ("Elgin" vs "Elgin Owls")
      const sameSide =
        r.team_id === team.id && (oppId ? rOpp === oppId : namesMatch(r.opponent_raw, row.opponentRaw))
      // The OTHER team's page reporting this same game
      const otherSide = oppId && r.team_id === oppId && rOpp === team.id
      return sameSide || otherSide
    })
    if (hasReview) return true

    if (oppId) {
      const game = (existingGames || []).find(
        (g) =>
          g.game_date === row.gameDate &&
          ((g.home_team_id === team.id && g.away_team_id === oppId) ||
            (g.home_team_id === oppId && g.away_team_id === team.id))
      )
      if (game) {
        // Already scheduled: nothing to add. Already scored the same way: nothing to change.
        if (row.type === 'schedule') return true
        const ours = game.home_team_id === team.id ? game.home_score : game.away_score
        const theirs = game.home_team_id === team.id ? game.away_score : game.home_score
        if (ours === row.teamScore && theirs === row.opponentScore) return true
      }
    }
    return false
  }

  let totalFound = 0
  let totalInserted = 0
  let skippedDuplicates = 0
  const errors = []

  for (const team of teams || []) {
    try {
      const html = await fetchWithSession(team.ossaa_schedule_url)
      const rows = parseScheduleRows(html)
      totalFound += rows.length

      for (const row of rows) {
        const opp = findTeamMatch(row.opponentRaw, allTeams || [])
        const oppId = opp && opp.id !== team.id ? opp.id : null

        if (alreadyCovered(team, row, oppId)) {
          skippedDuplicates += 1
          continue
        }

        const { error, data } = await supabase
          .from('pending_score_reviews')
          .insert({
            team_id: team.id,
            opponent_raw: row.opponentRaw,
            matched_opponent_team_id: oppId,
            game_date: row.gameDate,
            is_home: row.isHome,
            entry_type: row.type,
            team_score: row.type === 'score' ? row.teamScore : null,
            opponent_score: row.type === 'score' ? row.opponentScore : null,
            result: row.type === 'score' ? row.result : null,
            status: 'pending',
          })
          .select()

        // Same-run duplicates (Duncan's page, then Newcastle's) are caught because
        // each new entry is remembered here immediately.
        if (!error && data) {
          totalInserted += 1
          knownReviews.push({
            team_id: team.id,
            matched_opponent_team_id: oppId,
            opponent_raw: row.opponentRaw,
            game_date: row.gameDate,
            entry_type: row.type,
          })
        }
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
    skippedDuplicates,
    errors,
  })
}
