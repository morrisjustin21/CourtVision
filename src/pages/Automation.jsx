import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

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

  async function toggleEnabled() {
    setSavingToggle(true)
    const next = !settings.auto_score_check_enabled
    await supabase.from('app_settings').update({ auto_score_check_enabled: next }).eq('id', 1)
    setSettings((s) => ({ ...s, auto_score_check_enabled: next }))
    setSavingToggle(false)
  }

  if (loading) return <p className="text-chalkdim">Loading…</p>

  return (
    <div>
      <h1 className="font-display text-4xl font-bold mb-1">Automation</h1>
      <p className="text-chalkdim text-sm mb-6">
        Automatically check tracked teams' OSSAA schedule pages once a day and flag newly completed
        games for your review — nothing gets added to your records without your approval.
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
        Pending score reviews ({reviews.length})
      </h3>
      {reviews.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-6 text-center text-chalkdim text-sm">
          Nothing waiting for review right now.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} allTeams={allTeams} onResolved={loadAll} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewCard({ review, allTeams, onResolved }) {
  const [opponentTeamId, setOpponentTeamId] = useState(review.matched_opponent_team_id || '')
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState(review.opponent_raw)
  const [busy, setBusy] = useState(false)

  async function createOpponentTeam() {
    setBusy(true)
    const { data } = await supabase.from('teams').insert({ name: newTeamName }).select().single()
    setBusy(false)
    if (data) {
      setOpponentTeamId(data.id)
      setCreatingTeam(false)
    }
  }

  async function approve() {
    if (!opponentTeamId) return
    setBusy(true)

    const homeTeamId = review.is_home ? review.team_id : opponentTeamId
    const awayTeamId = review.is_home ? opponentTeamId : review.team_id
    const homeScore = review.is_home ? review.team_score : review.opponent_score
    const awayScore = review.is_home ? review.opponent_score : review.team_score

    // Look for an existing game already logged for this matchup and date.
    const { data: existing } = await supabase
      .from('games')
      .select('id')
      .eq('game_date', review.game_date)
      .or(
        `and(home_team_id.eq.${homeTeamId},away_team_id.eq.${awayTeamId}),and(home_team_id.eq.${awayTeamId},away_team_id.eq.${homeTeamId})`
      )
      .maybeSingle()

    let gameId = existing?.id
    if (gameId) {
      await supabase.from('games').update({ home_score: homeScore, away_score: awayScore }).eq('id', gameId)
    } else {
      const { data: created } = await supabase
        .from('games')
        .insert({
          game_date: review.game_date,
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

    setBusy(false)
    onResolved()
  }

  async function reject() {
    setBusy(true)
    await supabase.from('pending_score_reviews').update({ status: 'rejected' }).eq('id', review.id)
    setBusy(false)
    onResolved()
  }

  return (
    <div className="bg-panel border border-red/40 rounded-lg p-4">
      <p className="font-medium mb-1">
        {review.team?.name} {review.is_home ? 'vs' : '@'} {review.opponent_raw}
        <span className="text-chalkdim text-sm font-normal"> · {review.game_date}</span>
      </p>
      <p className="text-sm mb-3">
        <span className="text-red font-semibold stat-figure">
          {review.team_score}-{review.opponent_score}
        </span>{' '}
        <span className="text-chalkdim">{review.result === 'W' ? 'Win' : 'Loss'}</span>
      </p>

      {!opponentTeamId && !creatingTeam && (
        <div className="mb-3">
          <p className="text-xs text-chalkdim mb-1.5">
            No team in CourtVision matches "{review.opponent_raw}" — pick one or add it as new:
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
            <button
              onClick={() => setCreatingTeam(true)}
              className="text-xs text-chalkdim hover:text-red"
            >
              or + add "{review.opponent_raw}" as a new team
            </button>
          </div>
        </div>
      )}

      {creatingTeam && (
        <div className="mb-3 flex items-center gap-2">
          <input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="bg-panel2 border border-line rounded-md px-2 py-1.5 text-sm focus:border-red outline-none"
          />
          <button
            onClick={createOpponentTeam}
            disabled={busy}
            className="text-xs bg-red text-white font-semibold rounded-md px-3 py-1.5 hover:bg-red/90 disabled:opacity-60"
          >
            {busy ? 'Adding…' : 'Add team'}
          </button>
          <button onClick={() => setCreatingTeam(false)} className="text-xs text-chalkdim hover:text-chalk">
            Cancel
          </button>
        </div>
      )}

      {opponentTeamId && (
        <p className="text-xs text-chalkdim mb-3">
          Opponent: {allTeams.find((t) => t.id === opponentTeamId)?.name}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={approve}
          disabled={busy || !opponentTeamId}
          className="text-xs bg-red text-white font-semibold rounded-md px-3 py-1.5 hover:bg-red/90 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Approve'}
        </button>
        <button
          onClick={reject}
          disabled={busy}
          className="text-xs bg-panel2 border border-line text-chalkdim rounded-md px-3 py-1.5 hover:border-alert hover:text-alert disabled:opacity-60"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
