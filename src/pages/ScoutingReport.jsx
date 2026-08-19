import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

function pct(made, att) {
  if (!att) return null
  return (made / att) * 100
}

function fmtPct(v) {
  return v == null ? '—' : `${v.toFixed(1)}%`
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-panel border border-line rounded-lg p-4">
      <p className="text-[10px] uppercase tracking-wide text-chalkdim mb-1">{label}</p>
      <p className="font-display text-3xl font-bold stat-figure">{value}</p>
      {sub && <p className="text-xs text-chalkdim mt-0.5">{sub}</p>}
    </div>
  )
}

function LeaderboardCard({ title, players, statKey, suffix }) {
  if (players.length === 0) return null
  return (
    <div className="bg-panel border border-line rounded-lg overflow-hidden">
      <p className="text-xs uppercase tracking-wide text-chalkdim px-4 pt-3 pb-2">{title}</p>
      <table className="w-full text-sm">
        <tbody>
          {players.map((p, i) => (
            <tr key={p.id} className="border-b border-line last:border-0">
              <td className="pl-4 pr-2 py-2 stat-figure text-chalkdim text-xs w-6">{i + 1}</td>
              <td className="px-2 py-2 font-medium whitespace-nowrap">
                {p.jersey_number != null && (
                  <span className="text-chalkdim stat-figure mr-1.5">#{p.jersey_number}</span>
                )}
                {p.name}
              </td>
              <td className="px-4 py-2 text-right stat-figure text-red font-semibold whitespace-nowrap">
                {p[statKey].toFixed(1)} {suffix}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ScoutingReport({
  team,
  notes,
  setNotes,
  onSaveNotes,
  savingNotes,
  savedAt,
  opponentRoster,
  myTeamRoster,
  matchupPlan,
  setMatchupPlan,
  onSaveMatchup,
  savingMatchup,
  matchupSavedAt,
}) {
  const [loading, setLoading] = useState(true)
  const [statsRows, setStatsRows] = useState([])
  const [teamGames, setTeamGames] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: teamGamesData } = await supabase
        .from('games')
        .select('id, home_team_id, away_team_id, home_score, away_score')
        .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)

      const { data: players } = await supabase
        .from('players')
        .select('id')
        .eq('team_id', team.id)

      const playerIds = (players || []).map((p) => p.id)
      let stats = []
      if (playerIds.length > 0) {
        const { data } = await supabase
          .from('player_game_stats')
          .select('*, player:player_id(id,name,jersey_number)')
          .in('player_id', playerIds)
        stats = data || []
      }

      setTeamGames(teamGamesData || [])
      setStatsRows(stats)
      setLoading(false)
    }
    load()
  }, [team.id])

  const summary = useMemo(() => {
    const gamesWithStats = new Set(statsRows.map((r) => r.game_id)).size
    const totals = statsRows.reduce(
      (acc, r) => {
        acc.points += r.points || 0
        acc.two_made += r.two_made || 0
        acc.two_att += r.two_att || 0
        acc.three_made += r.three_made || 0
        acc.three_att += r.three_att || 0
        acc.ft_made += r.ft_made || 0
        acc.ft_att += r.ft_att || 0
        acc.oreb += r.oreb || 0
        acc.rebounds += r.rebounds || 0
        acc.assists += r.assists || 0
        acc.steals += r.steals || 0
        acc.blocks += r.blocks || 0
        acc.turnovers += r.turnovers || 0
        acc.fouls += r.fouls || 0
        return acc
      },
      {
        points: 0, two_made: 0, two_att: 0, three_made: 0, three_att: 0,
        ft_made: 0, ft_att: 0, oreb: 0, rebounds: 0, assists: 0, steals: 0,
        blocks: 0, turnovers: 0, fouls: 0,
      }
    )
    const per = (n) => (gamesWithStats ? n / gamesWithStats : 0)
    const totalFga = totals.two_att + totals.three_att

    // Dean Oliver's possession estimate: FGA + 0.44*FTA + TOV - OREB.
    // Offensive rebounds are excluded because they extend the same possession
    // rather than starting a new one.
    const possessions = totalFga + 0.44 * totals.ft_att + totals.turnovers - totals.oreb
    const pace = gamesWithStats ? possessions / gamesWithStats : null
    const offRating = possessions > 0 ? (totals.points / possessions) * 100 : null

    // Defensive rating needs "points allowed" (the opponent's final score)
    // paired with a possession estimate from the same games, so we only use
    // games where both a final score was recorded AND stats were entered —
    // otherwise the two halves of the ratio would come from different game
    // samples and the number would be misleading.
    const gamesWithStatsSet = new Set(statsRows.map((r) => r.game_id))
    const pointsAllowedByGame = {}
    teamGames.forEach((g) => {
      const isHome = g.home_team_id === team.id
      const oppScore = isHome ? g.away_score : g.home_score
      if (oppScore != null && gamesWithStatsSet.has(g.id)) {
        pointsAllowedByGame[g.id] = oppScore
      }
    })
    const defGameIds = new Set(Object.keys(pointsAllowedByGame))
    const gamesForDef = defGameIds.size
    const totalPointsAllowed = Object.values(pointsAllowedByGame).reduce((a, b) => a + b, 0)
    const defTotals = statsRows
      .filter((r) => defGameIds.has(r.game_id))
      .reduce(
        (acc, r) => {
          acc.fga += (r.two_att || 0) + (r.three_att || 0)
          acc.fta += r.ft_att || 0
          acc.tov += r.turnovers || 0
          acc.oreb += r.oreb || 0
          return acc
        },
        { fga: 0, fta: 0, tov: 0, oreb: 0 }
      )
    const defPossessions = defTotals.fga + 0.44 * defTotals.fta + defTotals.tov - defTotals.oreb
    const defRating = gamesForDef > 0 && defPossessions > 0 ? (totalPointsAllowed / defPossessions) * 100 : null
    const netRating = offRating != null && defRating != null ? offRating - defRating : null

    return {
      gamesWithStats,
      ppg: per(totals.points),
      rpg: per(totals.rebounds),
      apg: per(totals.assists),
      spg: per(totals.steals),
      bpg: per(totals.blocks),
      topg: per(totals.turnovers),
      pfpg: per(totals.fouls),
      astToRatio: totals.turnovers ? totals.assists / totals.turnovers : null,
      twoPct: pct(totals.two_made, totals.two_att),
      threePct: pct(totals.three_made, totals.three_att),
      ftPct: pct(totals.ft_made, totals.ft_att),
      threeRate: totalFga ? (totals.three_att / totalFga) * 100 : null,
      pace,
      offRating,
      defRating,
      netRating,
      gamesForDef,
    }
  }, [statsRows, teamGames, team.id])

  const playerAgg = useMemo(() => {
    const byPlayer = {}
    statsRows.forEach((r) => {
      const p = r.player
      if (!p) return
      if (!byPlayer[p.id]) {
        byPlayer[p.id] = {
          id: p.id,
          name: p.name,
          jersey_number: p.jersey_number,
          games: 0,
          points: 0,
          rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          fgMade: 0,
          fgAtt: 0,
          ftMade: 0,
          ftAtt: 0,
        }
      }
      const agg = byPlayer[p.id]
      agg.games += 1
      agg.points += r.points || 0
      agg.rebounds += r.rebounds || 0
      agg.assists += r.assists || 0
      agg.steals += r.steals || 0
      agg.blocks += r.blocks || 0
      agg.turnovers += r.turnovers || 0
      agg.fgMade += (r.two_made || 0) + (r.three_made || 0)
      agg.fgAtt += (r.two_att || 0) + (r.three_att || 0)
      agg.ftMade += r.ft_made || 0
      agg.ftAtt += r.ft_att || 0
    })

    return Object.values(byPlayer).map((p) => {
      const missedFg = p.fgAtt - p.fgMade
      const missedFt = p.ftAtt - p.ftMade
      // Standard box-score efficiency rating: production minus missed shots and turnovers.
      const eff = p.points + p.rebounds + p.assists + p.steals + p.blocks - missedFg - missedFt - p.turnovers
      return {
        ...p,
        ppg: p.games ? p.points / p.games : 0,
        rpg: p.games ? p.rebounds / p.games : 0,
        apg: p.games ? p.assists / p.games : 0,
        spg: p.games ? p.steals / p.games : 0,
        bpg: p.games ? p.blocks / p.games : 0,
        effpg: p.games ? eff / p.games : 0,
      }
    })
  }, [statsRows])

  const topScorers = useMemo(
    () => [...playerAgg].sort((a, b) => b.ppg - a.ppg).slice(0, 5),
    [playerAgg]
  )
  const topRebounders = useMemo(
    () => [...playerAgg].sort((a, b) => b.rpg - a.rpg).slice(0, 5),
    [playerAgg]
  )
  const topAssists = useMemo(
    () => [...playerAgg].sort((a, b) => b.apg - a.apg).slice(0, 5),
    [playerAgg]
  )
  const topSteals = useMemo(
    () => [...playerAgg].sort((a, b) => b.spg - a.spg).slice(0, 5),
    [playerAgg]
  )
  const top3Players = useMemo(
    () => [...playerAgg].sort((a, b) => b.effpg - a.effpg).slice(0, 3),
    [playerAgg]
  )

  if (loading) return <p className="text-chalkdim">Loading…</p>

  if (summary.gamesWithStats === 0) {
    return (
      <div>
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim mb-6">
          No box scores logged for {team.name} yet. Once you enter stats for a game involving this
          team, tendencies and shooting splits will show up here automatically.
          {teamGames.length > 0 && (
            <p className="mt-2 text-xs">
              ({teamGames.length} game{teamGames.length === 1 ? '' : 's'} logged, but no stats entered yet.)
            </p>
          )}
        </div>
        {!team.is_my_team && (
          <MatchupSection
            opponentRoster={opponentRoster}
            myTeamRoster={myTeamRoster}
            matchupPlan={matchupPlan}
            setMatchupPlan={setMatchupPlan}
            onSave={onSaveMatchup}
            saving={savingMatchup}
            savedAt={matchupSavedAt}
          />
        )}
        <NotesSection notes={notes} setNotes={setNotes} onSave={onSaveNotes} saving={savingNotes} savedAt={savedAt} />
      </div>
    )
  }

  return (
    <div>
      <div className="print:hidden">
      <div className="flex items-center justify-between mb-4">
        <p className="text-chalkdim text-sm">
          Based on {summary.gamesWithStats} game{summary.gamesWithStats === 1 ? '' : 's'} with stats entered.
        </p>
        <button
          onClick={() => window.print()}
          className="bg-panel2 border border-line text-chalk font-medium text-sm rounded-md px-4 py-2 hover:border-red shrink-0"
        >
          Print report
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="PPG" value={summary.ppg.toFixed(1)} />
        <StatCard label="RPG" value={summary.rpg.toFixed(1)} />
        <StatCard label="APG" value={summary.apg.toFixed(1)} />
        <StatCard label="AST/TO" value={summary.astToRatio == null ? '—' : summary.astToRatio.toFixed(2)} />
        <StatCard label="SPG" value={summary.spg.toFixed(1)} />
        <StatCard label="BPG" value={summary.bpg.toFixed(1)} />
        <StatCard label="TOPG" value={summary.topg.toFixed(1)} />
        <StatCard label="PFPG" value={summary.pfpg.toFixed(1)} />
      </div>

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Shooting
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="2PT%" value={fmtPct(summary.twoPct)} />
        <StatCard label="3PT%" value={fmtPct(summary.threePct)} />
        <StatCard label="FT%" value={fmtPct(summary.ftPct)} />
        <StatCard
          label="3PA Rate"
          value={fmtPct(summary.threeRate)}
          sub="share of shots taken from three"
        />
      </div>

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Pace & Efficiency
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-1">
        <StatCard
          label="Pace"
          value={summary.pace == null ? '—' : summary.pace.toFixed(1)}
          sub="est. possessions per game"
        />
        <StatCard
          label="Off. Rating"
          value={summary.offRating == null ? '—' : summary.offRating.toFixed(1)}
          sub="points scored per 100 poss."
        />
        <StatCard
          label="Def. Rating"
          value={summary.defRating == null ? '—' : summary.defRating.toFixed(1)}
          sub="points allowed per 100 poss."
        />
        <StatCard
          label="Net Rating"
          value={summary.netRating == null ? '—' : (summary.netRating > 0 ? '+' : '') + summary.netRating.toFixed(1)}
          sub="off. rating minus def. rating"
        />
      </div>
      {summary.defRating != null && summary.gamesForDef < summary.gamesWithStats && (
        <p className="text-xs text-chalkdim mb-6">
          Def./Net rating based on {summary.gamesForDef} game{summary.gamesForDef === 1 ? '' : 's'} with a
          final score recorded — the rest of this section uses all {summary.gamesWithStats}.
        </p>
      )}
      {summary.defRating == null && (
        <p className="text-xs text-chalkdim mb-6">
          Def./Net rating needs at least one game with both a final score and stats entered.
        </p>
      )}

      {top3Players.length > 0 && (
        <>
          <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
            Top 3 Players
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {top3Players.map((p, i) => (
              <div key={p.id} className="bg-panel border border-red/40 rounded-lg p-4 relative overflow-hidden">
                <span className="absolute top-3 right-4 font-display text-4xl font-bold text-line select-none">
                  {i + 1}
                </span>
                <p className="font-medium mb-0.5">
                  {p.jersey_number != null && (
                    <span className="text-chalkdim stat-figure mr-1.5">#{p.jersey_number}</span>
                  )}
                  {p.name}
                </p>
                <p className="text-xs text-chalkdim mb-3">{p.games} GP</p>
                <p className="text-xs text-chalkdim">
                  <span className="text-red font-semibold stat-figure">{p.ppg.toFixed(1)}</span> PPG ·{' '}
                  <span className="text-red font-semibold stat-figure">{p.rpg.toFixed(1)}</span> RPG ·{' '}
                  <span className="text-red font-semibold stat-figure">{p.apg.toFixed(1)}</span> APG
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Leaders by category
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <LeaderboardCard title="Scoring" players={topScorers} statKey="ppg" suffix="PPG" />
        <LeaderboardCard title="Rebounding" players={topRebounders} statKey="rpg" suffix="RPG" />
        <LeaderboardCard title="Assists" players={topAssists} statKey="apg" suffix="APG" />
        <LeaderboardCard title="Steals" players={topSteals} statKey="spg" suffix="SPG" />
      </div>

      {!team.is_my_team && (
        <MatchupSection
          opponentRoster={opponentRoster}
          myTeamRoster={myTeamRoster}
          matchupPlan={matchupPlan}
          setMatchupPlan={setMatchupPlan}
          onSave={onSaveMatchup}
          saving={savingMatchup}
          savedAt={matchupSavedAt}
        />
      )}

      <NotesSection notes={notes} setNotes={setNotes} onSave={onSaveNotes} saving={savingNotes} savedAt={savedAt} />
      </div>

      <div className="hidden print:block">
        <PrintableReport
          team={team}
          summary={summary}
          top3Players={top3Players}
          topScorers={topScorers}
          topRebounders={topRebounders}
          topAssists={topAssists}
          topSteals={topSteals}
          notes={notes}
          matchupPlan={matchupPlan}
          opponentRoster={opponentRoster}
          myTeamRoster={myTeamRoster}
        />
      </div>
    </div>
  )
}

function MatchupSection({ opponentRoster, myTeamRoster, matchupPlan, setMatchupPlan, onSave, saving, savedAt }) {
  function updateSlot(i, field, value) {
    setMatchupPlan((prev) => prev.map((slot, idx) => (idx === i ? { ...slot, [field]: value } : slot)))
  }

  return (
    <div className="mb-6 print:hidden">
      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Starting 5 Matchups
      </h3>

      {myTeamRoster.length === 0 && (
        <p className="text-xs text-chalkdim mb-3">
          Mark one of your teams as "My team" (via Edit team) to enable defender assignments.
        </p>
      )}

      <div className="bg-panel border border-line rounded-lg overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.4fr] gap-px bg-line text-xs uppercase tracking-wide text-chalkdim">
          <div className="bg-panel px-3 py-2 hidden sm:block">Their starter</div>
          <div className="bg-panel px-3 py-2 hidden sm:block">Guarded by</div>
          <div className="bg-panel px-3 py-2 hidden sm:block">Matchup notes</div>
        </div>
        {matchupPlan.map((slot, i) => (
          <div
            key={i}
            className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.4fr] gap-2 sm:gap-px bg-line sm:bg-line"
          >
            <div className="bg-panel px-3 py-2">
              <select
                value={slot.opponentPlayerId}
                onChange={(e) => updateSlot(i, 'opponentPlayerId', e.target.value)}
                className="w-full bg-panel2 border border-line rounded-md px-2 py-1.5 text-sm focus:border-red outline-none"
              >
                <option value="">— Select player —</option>
                {opponentRoster.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.jersey_number != null ? `#${p.jersey_number} ` : ''}{p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-panel px-3 py-2">
              <select
                value={slot.defenderPlayerId}
                onChange={(e) => updateSlot(i, 'defenderPlayerId', e.target.value)}
                disabled={myTeamRoster.length === 0}
                className="w-full bg-panel2 border border-line rounded-md px-2 py-1.5 text-sm focus:border-red outline-none disabled:opacity-50"
              >
                <option value="">— Select defender —</option>
                {myTeamRoster.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.jersey_number != null ? `#${p.jersey_number} ` : ''}{p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-panel px-3 py-2">
              <input
                value={slot.notes}
                onChange={(e) => updateSlot(i, 'notes', e.target.value)}
                placeholder="e.g. shades left, closes out hard on 3s"
                className="w-full bg-panel2 border border-line rounded-md px-2 py-1.5 text-sm focus:border-red outline-none"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-red text-white font-semibold text-sm rounded-md px-4 py-2 hover:bg-red/90 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save matchups'}
        </button>
        {savedAt && !saving && (
          <span className="text-xs text-chalkdim">Saved {savedAt.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  )
}

function PrintableReport({
  team,
  summary,
  top3Players,
  topScorers,
  topRebounders,
  topAssists,
  topSteals,
  notes,
  matchupPlan,
  opponentRoster,
  myTeamRoster,
}) {
  const today = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  function playerLabel(roster, id) {
    const p = roster.find((r) => r.id === id)
    if (!p) return null
    return `${p.jersey_number != null ? `#${p.jersey_number} ` : ''}${p.name}`
  }

  const activeMatchups = (matchupPlan || []).filter((s) => s.opponentPlayerId || s.defenderPlayerId || s.notes)

  const row = (label, value) => (
    <div className="flex justify-between border-b border-gray-200 py-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-black">{value}</span>
    </div>
  )

  return (
    <div className="text-black text-sm">
      <div className="flex items-baseline justify-between border-b-2 border-red pb-2 mb-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-black leading-tight">
            {team.name}
          </h1>
          <p className="text-xs text-gray-500">
            {[team.league, team.division].filter(Boolean).join(' · ') || 'Scouting report'}
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p className="font-semibold text-black">Scouting Report</p>
          <p>{today}</p>
          <p>{summary.gamesWithStats} game{summary.gamesWithStats === 1 ? '' : 's'} tracked</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-x-4 mb-3">
        <div>{row('PPG', summary.ppg.toFixed(1))}{row('RPG', summary.rpg.toFixed(1))}</div>
        <div>{row('APG', summary.apg.toFixed(1))}{row('AST/TO', summary.astToRatio == null ? '—' : summary.astToRatio.toFixed(2))}</div>
        <div>{row('SPG', summary.spg.toFixed(1))}{row('BPG', summary.bpg.toFixed(1))}</div>
        <div>{row('TOPG', summary.topg.toFixed(1))}{row('PFPG', summary.pfpg.toFixed(1))}</div>
      </div>

      <div className="grid grid-cols-4 gap-x-4 mb-3">
        <div>{row('2PT%', fmtPct(summary.twoPct))}</div>
        <div>{row('3PT%', fmtPct(summary.threePct))}</div>
        <div>{row('FT%', fmtPct(summary.ftPct))}</div>
        <div>{row('3PA Rate', fmtPct(summary.threeRate))}</div>
      </div>

      <div className="grid grid-cols-4 gap-x-4 mb-4">
        <div>{row('Pace', summary.pace == null ? '—' : summary.pace.toFixed(1))}</div>
        <div>{row('Off. Rating', summary.offRating == null ? '—' : summary.offRating.toFixed(1))}</div>
        <div>{row('Def. Rating', summary.defRating == null ? '—' : summary.defRating.toFixed(1))}</div>
        <div>{row('Net Rating', summary.netRating == null ? '—' : (summary.netRating > 0 ? '+' : '') + summary.netRating.toFixed(1))}</div>
      </div>

      {top3Players.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
            Top 3 Players
          </p>
          <div className="grid grid-cols-3 gap-3">
            {top3Players.map((p, i) => (
              <div key={p.id} className="border border-gray-300 rounded px-2.5 py-2">
                <p className="font-semibold text-black text-xs">
                  {i + 1}. {p.jersey_number != null && `#${p.jersey_number} `}{p.name}
                </p>
                <p className="text-[11px] text-gray-600">
                  {p.ppg.toFixed(1)} PPG · {p.rpg.toFixed(1)} RPG · {p.apg.toFixed(1)} APG
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
          Leaders by category
        </p>
        <div className="grid grid-cols-4 gap-3 text-[11px]">
          <PrintLeaderList title="Scoring" players={topScorers} statKey="ppg" suffix="PPG" />
          <PrintLeaderList title="Rebounding" players={topRebounders} statKey="rpg" suffix="RPG" />
          <PrintLeaderList title="Assists" players={topAssists} statKey="apg" suffix="APG" />
          <PrintLeaderList title="Steals" players={topSteals} statKey="spg" suffix="SPG" />
        </div>
      </div>

      {activeMatchups.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
            Starting 5 Matchups
          </p>
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-300">
                <th className="font-semibold py-1 pr-2">Their starter</th>
                <th className="font-semibold py-1 pr-2">Guarded by</th>
                <th className="font-semibold py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {activeMatchups.map((slot, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-1 pr-2 text-black">
                    {playerLabel(opponentRoster, slot.opponentPlayerId) || '—'}
                  </td>
                  <td className="py-1 pr-2 text-black">
                    {playerLabel(myTeamRoster, slot.defenderPlayerId) || '—'}
                  </td>
                  <td className="py-1 text-gray-700">{slot.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {notes && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
            Game plan notes
          </p>
          <p className="text-xs text-black whitespace-pre-wrap leading-snug">{notes}</p>
        </div>
      )}
    </div>
  )
}

function PrintLeaderList({ title, players, statKey, suffix }) {
  if (players.length === 0) return null
  return (
    <div>
      <p className="font-semibold text-black mb-0.5">{title}</p>
      {players.slice(0, 3).map((p) => (
        <p key={p.id} className="text-gray-700">
          {p.name} — {p[statKey].toFixed(1)} {suffix}
        </p>
      ))}
    </div>
  )
}

function NotesSection({ notes, setNotes, onSave, saving, savedAt }) {
  return (
    <div>
      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Game plan notes
      </h3>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={8}
        placeholder="Defensive keys, matchup notes, plays to watch for, inbound tendencies…"
        className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm focus:border-red outline-none resize-y"
      />
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-red text-white font-semibold text-sm rounded-md px-4 py-2 hover:bg-red/90 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save notes'}
        </button>
        {savedAt && !saving && (
          <span className="text-xs text-chalkdim">Saved {savedAt.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  )
}
