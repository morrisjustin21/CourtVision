import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentSeason } from '../useCurrentSeason'
import { useShotZoneData } from './ShotChart'
import { generateTeamInsights, TEAM_METHODOLOGY } from '../basketballInsights'

export default function AdditionalStats({ team }) {
  const [loading, setLoading] = useState(true)
  const [statsRows, setStatsRows] = useState([])
  const { season: currentSeason, loading: seasonLoading } = useCurrentSeason()
  const [seasonFilter, setSeasonFilter] = useState(null)
  const { loading: shotLoading, aggregated: shotAgg } = useShotZoneData(team)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: players } = await supabase.from('players').select('id').eq('team_id', team.id)
      const playerIds = (players || []).map((p) => p.id)
      let rows = []
      if (playerIds.length > 0) {
        const { data } = await supabase
          .from('player_game_stats')
          .select('*, game:game_id(id, season)')
          .in('player_id', playerIds)
        rows = data || []
      }
      setStatsRows(rows)
      setLoading(false)
    }
    load()
  }, [team.id])

  useEffect(() => {
    if (!seasonLoading && seasonFilter === null) {
      setSeasonFilter(currentSeason || 'all')
    }
  }, [seasonLoading, currentSeason, seasonFilter])

  const seasons = useMemo(
    () => [...new Set(statsRows.map((r) => r.game?.season).filter(Boolean))].sort().reverse(),
    [statsRows]
  )

  const teamSummary = useMemo(() => {
    const filtered =
      !seasonFilter || seasonFilter === 'all' ? statsRows : statsRows.filter((r) => r.game?.season === seasonFilter)
    const games = new Set(filtered.map((r) => r.game_id)).size
    const totals = filtered.reduce(
      (acc, r) => {
        acc.totalRebounds += r.rebounds || 0
        acc.totalOreb += r.oreb || 0
        acc.totalAssists += r.assists || 0
        acc.totalTurnovers += r.turnovers || 0
        acc.totalFtMade += r.ft_made || 0
        acc.totalFta += r.ft_att || 0
        acc.totalFga += (r.two_att || 0) + (r.three_att || 0)
        acc.totalThreeMade += r.three_made || 0
        acc.totalThreeAtt += r.three_att || 0
        return acc
      },
      {
        totalRebounds: 0, totalOreb: 0, totalAssists: 0, totalTurnovers: 0,
        totalFtMade: 0, totalFta: 0, totalFga: 0, totalThreeMade: 0, totalThreeAtt: 0,
      }
    )
    return { games, ...totals }
  }, [statsRows, seasonFilter])

  const { strengths, weaknesses } = useMemo(
    () => generateTeamInsights(teamSummary, shotAgg),
    [teamSummary, shotAgg]
  )

  const isReady = !loading && !shotLoading

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <h1 className="font-display text-2xl font-semibold text-chalkdim uppercase tracking-wide text-sm">
          Team Strengths & Weaknesses
        </h1>
        {seasons.length > 0 && (
          <select
            value={seasonFilter || 'all'}
            onChange={(e) => setSeasonFilter(e.target.value)}
            className="bg-panel2 border border-line rounded-md px-3 py-2 text-sm focus:border-red outline-none"
          >
            <option value="all">All seasons</option>
            {seasons.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>
      <p className="text-chalkdim text-sm mb-3">
        Auto-generated from {team.name}'s stats and shot chart data against general basketball
        analytics benchmarks — a scouting starting point, not the final word. Weaknesses are framed
        as ideas for how to attack this team; strengths are things to respect and defend carefully.
      </p>
      <details className="mb-6 text-xs">
        <summary className="text-chalkdim hover:text-chalk cursor-pointer select-none">
          How these are calculated
        </summary>
        <div className="mt-2 space-y-2 border-l border-line pl-3 max-w-2xl">
          {TEAM_METHODOLOGY.map((m) => (
            <div key={m.metric}>
              <p className="font-medium text-chalk">{m.metric}</p>
              <p className="text-chalkdim">{m.detail}</p>
            </div>
          ))}
        </div>
      </details>

      {!isReady ? (
        <p className="text-chalkdim">Loading…</p>
      ) : teamSummary.games === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim">
          No box scores logged yet for {team.name}
          {seasonFilter && seasonFilter !== 'all' ? ` in ${seasonFilter}` : ''} — insights will
          appear once stats are entered.
        </div>
      ) : strengths.length === 0 && weaknesses.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim">
          Nothing clearly stands out yet against the benchmarks checked — {team.name}'s numbers are
          fairly balanced across the board.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
              Strengths ({strengths.length})
            </h3>
            {strengths.length === 0 ? (
              <p className="text-chalkdim text-sm">Nothing flagged as a clear strength yet.</p>
            ) : (
              <div className="space-y-3">
                {strengths.map((s, i) => (
                  <div key={i} className="bg-panel border border-line rounded-lg p-4">
                    <p className="font-medium text-sm mb-1">{s.title}</p>
                    <p className="text-chalkdim text-sm">{s.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
              Weaknesses — Areas to Attack ({weaknesses.length})
            </h3>
            {weaknesses.length === 0 ? (
              <p className="text-chalkdim text-sm">Nothing flagged as a clear weakness yet.</p>
            ) : (
              <div className="space-y-3">
                {weaknesses.map((w, i) => (
                  <div key={i} className="bg-panel border border-red/40 rounded-lg p-4">
                    <p className="font-medium text-sm mb-1">{w.title}</p>
                    <p className="text-chalkdim text-sm">{w.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
