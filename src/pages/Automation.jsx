import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { nameWords, findTeamMatch } from '../teamMatching'

// The same game can be reported by both teams' schedule pages (or twice with the
// opponent spelled differently, like "Elgin" and "Elgin Owls"). Collapse those into
// one entry so you only review each game once.
function groupReviews(reviews, allTeams) {
  const groups = new Map()
  reviews.forEach((r) => {
    const oppId = r.matched_opponent_team_id || findTeamMatch(r.opponent_raw, allTeams)?.id || null
    const pair = [r.team_id, oppId || `raw:${nameWords(r.opponent_raw).join('')}`].sort().join('~')
    const key = `${r.game_date}|${pair}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  })
  return [...groups.values()].map((list) => ({ review: list[0], duplicates: list.slice(1) }))
}

export default function Automation() {
  const [settings, setSettings] = useState(null)
  const [trackedTeams, setTrackedTeams] = useState([])
  const [allTeams, setAllTeams] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingToggle, setSavingToggle] = useState(false)

  async function loadAll() {
    setLoading(true)
    const [{ data: settingsData }, { data: teamsData }, { data: reviewsData }] = await Promise.all([
      supabase.from('app_settings').select('*').eq('id', 1).single(),
      supabase.from('teams').select('*').order('name'),
      supabase
        .from('pending_score_reviews')
        .select('*, team:team_id(id,name)')
        .eq('status', 'pending')
        .order('game_date', { ascending: false }),
    ])
    setSettings(settingsData)
    setAllTeams(teamsData || [])
    setTrackedTeams((teamsData || []).filter((t) => t.ossaa_schedule_url))
    setReviews(reviewsData || [])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  function handleTeamCreated(team) {
    setAllTeams((prev) => [...prev, team].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function toggleEnabled() {
    setSavingToggle(true)
    const next = !settings.auto_score_check_enabled
    await supabase.from('app_settings').update({ auto_score_check_enabled: next }).eq('id', 1)
    setSettings((s) => ({ ...s, auto_score_check_enabled: next }))
    setSavingToggle(false)
  }

  if (loading) return <p className="text-chalkdim">Loading…</p>

  const scoreGroups = groupReviews(reviews.filter((r) => r.entry_type === 'score'), allTeams)
  const scheduleGroups = groupReviews(reviews.filter((r) => r.entry_type === 'schedule'), allTeams)

  return (
    <div>
      <h1 className="font-display text-4xl font-bold mb-1">Automation</h1>
      <p className="text-chalkdim text-sm mb-6">
        Automatically check tracked teams' OSSAA schedule pages once a day — new upcoming games get
        added to the schedule, and completed games get flagged with a score. Nothing gets added to
        your records without your approval.
      </p>

      <div className="bg-panel border border-line rounded-lg p-5 mb-8 flex items-center justify-between">
        <div>
          <p className="font-medium mb-1">Daily score checking</p>
          <p className="text-xs text-chalkdim">
            {settings?.auto_score_check_enabled ? 'On — runs once a day.' : 'Off — nothing runs.'}
            {settings?.last_checked_at && (
              <> Last checked {new Date(settings.last_checked_at).toLocaleString()}.</>
            )}
          </p>
        </div>
        <button
          onClick={toggleEnabled}
          disabled={savingToggle}
          className={`text-sm font-semibold rounded-md px-4 py-2 disabled:opacity-60 ${
            settings?.auto_score_check_enabled
              ? 'bg-panel2 border border-alert/40 text-alert hover:border-alert'
              : 'bg-red text-white hover:bg-red/90'
          }`}
        >
          {savingToggle ? 'Saving…' : settings?.auto_score_check_enabled ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Tracked teams ({trackedTeams.length})
      </h3>
      {trackedTeams.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-6 text-center text-chalkdim text-sm mb-8">
          No teams have an OSSAA schedule URL set yet. Add one from a team's "Edit team" screen on
          the Roster tab.
        </div>
      ) : (
        <div className="bg-panel border border-line rounded-lg overflow-hidden mb-8">
          <table className="w-full text-sm">
            <tbody>
              {trackedTeams.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-chalkdim text-xs truncate max-w-xs">
                    {t.ossaa_schedule_url}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Pending schedule updates ({scheduleGroups.length})
      </h3>
      {scheduleGroups.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-6 text-center text-chalkdim text-sm mb-8">
          Nothing waiting for review right now.
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {scheduleGroups.map(({ review, duplicates }) => (
            <ReviewCard
              key={review.id}
              review={review}
              duplicates={duplicates}
              allTeams={allTeams}
              onResolved={loadAll}
              onTeamCreated={handleTeamCreated}
            />
          ))}
        </div>
      )}

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Pending score reviews ({scoreGroups.length})
      </h3>
      {scoreGroups.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-6 text-center text-chalkdim text-sm">
          Nothing waiting for review right now.
        </div>
      ) : (
        <div className="space-y-3">
          {scoreGroups.map(({ review, duplicates }) => (
            <ReviewCard
              key={review.id}
              review={review}
              duplicates={duplicates}
              allTeams={allTeams}
              onResolved={loadAll}
              onTeamCreated={handleTeamCreated}
            />
          ))}
        </div>
      )}
    </div>
  )
}


// OSSAA lists teams in ALL CAPS; start from a normal-looking name the coach can edit.
// Same rule the Games screen uses to label a game's season (July onward starts a new one).
function guessSeason(dateStr) {
  if (!dateStr) return null
  const [year, month] = dateStr.split('-').map(Number)
  if (month >= 7) return `${year}-${String(year + 1).slice(2)}`
  return `${year - 1}-${String(year).slice(2)}`
}

function titleCase(s) {
  return (s || '').toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase())
}

function ReviewCard({ review, duplicates = [], allTeams, onResolved, onTeamCreated }) {
  const [opponentTeamId, setOpponentTeamId] = useState(
    review.matched_opponent_team_id || findTeamMatch(review.opponent_raw, allTeams)?.id || ''
  )
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState(titleCase(review.opponent_raw))
  const [teamError, setTeamError] = useState('')
  const [skipped, setSkipped] = useState(false)
  const [busy, setBusy] = useState(false)

  const opponentTeam = allTeams.find((t) => t.id === opponentTeamId)

  // Both teams' pages should report the same score. Flag it if they don't.
  const scoreDisagreement =
    review.entry_type === 'score' &&
    duplicates.some((d) => {
      const sameSide = d.team_id === review.team_id
      const theirs = sameSide ? d.team_score : d.opponent_score
      const theirOpp = sameSide ? d.opponent_score : d.team_score
      return theirs !== review.team_score || theirOpp !== review.opponent_score
    })

  async function createOpponentTeam() {
    const name = newTeamName.trim()
    if (!name) return
    setTeamError('')

    // If a team with the same name is already in CourtVision, link to it
    // instead of creating a duplicate.
    const existing = findTeamMatch(name, allTeams)
    if (existing) {
      setOpponentTeamId(existing.id)
      setCreatingTeam(false)
      return
    }

    setBusy(true)
    const { data, error } = await supabase.from('teams').insert({ name }).select().single()
    setBusy(false)
    if (error || !data) {
      setTeamError("Couldn't add that team. Please try again.")
      return
    }
    onTeamCreated(data)
    setOpponentTeamId(data.id)
    setCreatingTeam(false)
  }

  async function approve() {
    if (!opponentTeamId) return
    setBusy(true)

    const homeTeamId = review.is_home ? review.team_id : opponentTeamId
    const awayTeamId = review.is_home ? opponentTeamId : review.team_id
    const isScore = review.entry_type === 'score'
    const homeScore = isScore ? (review.is_home ? review.team_score : review.opponent_score) : null
    const awayScore = isScore ? (review.is_home ? review.opponent_score : review.team_score) : null

    // Look for an existing game already logged for this matchup and date.
    const { data: existing } = await supabase
      .from('games')
      .select('id, season')
      .eq('game_date', review.game_date)
      .or(
        `and(home_team_id.eq.${homeTeamId},away_team_id.eq.${awayTeamId}),and(home_team_id.eq.${awayTeamId},away_team_id.eq.${homeTeamId})`
      )
      .maybeSingle()

    let gameId = existing?.id
    if (gameId) {
      // Update the score if this is a score entry, and fill in the season if the
      // game doesn't have one (never overwrite a season that's already set).
      const updates = {}
      if (isScore) {
        updates.home_score = homeScore
        updates.away_score = awayScore
      }
      if (!existing.season) updates.season = guessSeason(review.game_date)
      if (Object.keys(updates).length > 0) {
        await supabase.from('games').update(updates).eq('id', gameId)
      }
    } else {
      const { data: created } = await supabase
        .from('games')
        .insert({
          game_date: review.game_date,
          season: guessSeason(review.game_date),
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_score: homeScore,
          away_score: awayScore,
        })
        .select()
        .single()
      gameId = created?.id
    }

    await supabase
      .from('pending_score_reviews')
      .update({ status: 'approved', matched_opponent_team_id: opponentTeamId, resolved_game_id: gameId })
      .eq('id', review.id)

    // The same game reported by the other team's page (or spelled differently) is
    // handled by this one approval.
    for (const d of duplicates) {
      await supabase
        .from('pending_score_reviews')
        .update({
          status: 'approved',
          matched_opponent_team_id: d.team_id === review.team_id ? opponentTeamId : review.team_id,
          resolved_game_id: gameId,
        })
        .eq('id', d.id)
    }

    setBusy(false)
    onResolved()
  }

  async function reject() {
    setBusy(true)
    await supabase
      .from('pending_score_reviews')
      .update({ status: 'rejected' })
      .in('id', [review.id, ...duplicates.map((d) => d.id)])
    setBusy(false)
    onResolved()
  }

  // Skipped cards collapse to one line and come back the next time the page loads.
  if (skipped) {
    return (
      <div className="bg-panel border border-line rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-chalkdim">
        <span>
          Skipped: {review.team?.name} {review.is_home ? 'vs' : '@'} {review.opponent_raw} · {review.game_date}
        </span>
        <button onClick={() => setSkipped(false)} className="hover:text-chalk shrink-0">
          Undo
        </button>
      </div>
    )
  }

  return (
    <div className="bg-panel border border-red/40 rounded-lg p-4">
      <p className="font-medium mb-1">
        {review.team?.name} {review.is_home ? 'vs' : '@'} {review.opponent_raw}
        <span className="text-chalkdim text-sm font-normal"> · {review.game_date}</span>
      </p>
      {duplicates.length > 0 && (
        <p className="text-xs text-chalkdim mb-2">
          Also listed on {[...new Set(duplicates.map((d) => d.team?.name).filter(Boolean))].join(', ') || 'another schedule'}
          's page — approving or dismissing this handles all of them.
        </p>
      )}
      {scoreDisagreement && (
        <p className="text-xs text-alert mb-2">
          The schedule pages don't agree on this score (
          {[review, ...duplicates]
            .map((r) => `${r.team?.name}: ${r.team_score}-${r.opponent_score}`)
            .join(' · ')}
          ). Double-check before approving.
        </p>
      )}
      {review.entry_type === 'score' ? (
        <p className="text-sm mb-3">
          <span className="text-red font-semibold stat-figure">
            {review.team_score}-{review.opponent_score}
          </span>{' '}
          <span className="text-chalkdim">{review.result === 'W' ? 'Win' : 'Loss'}</span>
        </p>
      ) : (
        <p className="text-sm text-chalkdim mb-3">New game on the schedule — no score yet.</p>
      )}

      {!opponentTeamId && !creatingTeam && (
        <div className="mb-3">
          <p className="text-xs text-chalkdim mb-2">
            No team in CourtVision matches "{review.opponent_raw}". Pick an existing team, or add it:
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={opponentTeamId}
              onChange={(e) => setOpponentTeamId(e.target.value)}
              className="bg-panel2 border border-line rounded-md px-2 py-1.5 text-sm focus:border-red outline-none"
            >
              <option value="">— Select existing team —</option>
              {allTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <span className="text-xs text-chalkdim">or</span>
            <button
              onClick={() => setCreatingTeam(true)}
              className="text-xs font-semibold bg-panel2 border border-red/60 text-chalk rounded-md px-3 py-1.5 hover:border-red"
            >
              + Add "{titleCase(review.opponent_raw)}" as a new team
            </button>
          </div>
        </div>
      )}

      {creatingTeam && (
        <div className="mb-3">
          <p className="text-xs text-chalkdim mb-1.5">
            New team name. Just the school name is best ("Elgin", not "Elgin Owls"), though either will match later:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="bg-panel2 border border-line rounded-md px-2 py-1.5 text-sm focus:border-red outline-none"
            />
            <button
              onClick={createOpponentTeam}
              disabled={busy || !newTeamName.trim()}
              className="text-xs bg-red text-white font-semibold rounded-md px-3 py-1.5 hover:bg-red/90 disabled:opacity-60"
            >
              {busy ? 'Adding…' : 'Add team'}
            </button>
            <button
              onClick={() => {
                setCreatingTeam(false)
                setTeamError('')
              }}
              className="text-xs text-chalkdim hover:text-chalk"
            >
              Cancel
            </button>
          </div>
          {teamError && <p className="text-alert text-xs mt-1.5">{teamError}</p>}
        </div>
      )}

      {opponentTeamId && (
        <p className="text-xs text-chalkdim mb-3">
          Opponent: <span className="text-chalk font-medium">{opponentTeam?.name || '…'}</span>{' '}
          <button
            onClick={() => setOpponentTeamId('')}
            className="ml-1 underline hover:text-chalk"
          >
            Change
          </button>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={approve}
          disabled={busy || !opponentTeamId}
          className="text-xs bg-red text-white font-semibold rounded-md px-3 py-1.5 hover:bg-red/90 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Approve'}
        </button>
        <button
          onClick={() => setSkipped(true)}
          disabled={busy}
          className="text-xs bg-panel2 border border-line text-chalk rounded-md px-3 py-1.5 hover:border-red disabled:opacity-60"
        >
          Skip for now
        </button>
        <button
          onClick={reject}
          disabled={busy}
          className="text-xs bg-panel2 border border-line text-chalkdim rounded-md px-3 py-1.5 hover:border-alert hover:text-alert disabled:opacity-60"
        >
          Dismiss
        </button>
      </div>
      <p className="text-[11px] text-chalkdim mt-2">
        Skip for now keeps it in the queue for later. Dismiss removes it for good.
      </p>
    </div>
  )
}
