import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentSeason } from '../useCurrentSeason'
import { ShotChartSvg } from './ShotChart'
import { generateInsights, PLAYER_METHODOLOGY } from '../basketballInsights'
import { generateMilestones } from '../milestones'

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-panel border border-line rounded-lg p-4">
      <p className="text-[10px] uppercase tracking-wide text-chalkdim mb-1">{label}</p>
      <p className="font-display text-3xl font-bold stat-figure">{value}</p>
      {sub && <p className="text-xs text-chalkdim mt-0.5">{sub}</p>}
    </div>
  )
}

function pct(made, att) {
  if (!att) return null
  return (made / att) * 100
}

function fmtPct(v) {
  return v == null ? '—' : `${v.toFixed(1)}%`
}

export default function PlayerDevelopment({ player, team, onBack, onPlayerUpdated }) {
  const [loading, setLoading] = useState(true)
  const [statsRows, setStatsRows] = useState([])
  const [strengths, setStrengths] = useState(player.strengths || '')
  const [weaknesses, setWeaknesses] = useState(player.weaknesses || '')
  const [growthNotes, setGrowthNotes] = useState(player.growth_notes || '')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const { season: currentSeason, loading: seasonLoading } = useCurrentSeason()
  const [seasonFilter, setSeasonFilter] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('player_game_stats')
        .select(
          '*, game:game_id(id, game_date, season, home_team_id, away_team_id, home_team:home_team_id(name), away_team:away_team_id(name))'
        )
        .eq('player_id', player.id)
      setStatsRows(data || [])
      setLoading(false)
    }
    load()
  }, [player.id])

  const [shotZoneRows, setShotZoneRows] = useState([])
  const [shotLoading, setShotLoading] = useState(true)

  useEffect(() => {
    async function loadShots() {
      setShotLoading(true)
      const { data } = await supabase.from('player_shot_zones').select('*').eq('player_id', player.id)
      setShotZoneRows(data || [])
      setShotLoading(false)
    }
    loadShots()
  }, [player.id])

  const shotAgg = useMemo(() => {
    const byZone = {}
    shotZoneRows.forEach((r) => {
      if (!byZone[r.zone]) byZone[r.zone] = { made: 0, attempted: 0 }
      byZone[r.zone].made += r.made || 0
      byZone[r.zone].attempted += r.attempted || 0
    })
    return byZone
  }, [shotZoneRows])

  const hasShotData = Object.values(shotAgg).some((z) => z.attempted > 0)
  const shotTotals = Object.values(shotAgg).reduce(
    (acc, z) => ({ made: acc.made + z.made, attempted: acc.attempted + z.attempted }),
    { made: 0, attempted: 0 }
  )

  useEffect(() => {
    if (!seasonLoading && seasonFilter === null) {
      setSeasonFilter(currentSeason || 'all')
    }
  }, [seasonLoading, currentSeason, seasonFilter])

  const seasons = useMemo(
    () => [...new Set(statsRows.map((r) => r.game?.season).filter(Boolean))].sort().reverse(),
    [statsRows]
  )

  const filteredStatsRows = useMemo(() => {
    if (!seasonFilter || seasonFilter === 'all') return statsRows
    return statsRows.filter((r) => r.game?.season === seasonFilter)
  }, [statsRows, seasonFilter])

  const summary = useMemo(() => {
    const games = filteredStatsRows.length
    const totals = filteredStatsRows.reduce(
      (acc, r) => {
        acc.points += r.points || 0
        acc.two_made += r.two_made || 0
        acc.two_att += r.two_att || 0
        acc.three_made += r.three_made || 0
        acc.three_att += r.three_att || 0
        acc.ft_made += r.ft_made || 0
        acc.ft_att += r.ft_att || 0
        acc.rebounds += r.rebounds || 0
        acc.assists += r.assists || 0
        acc.steals += r.steals || 0
        acc.blocks += r.blocks || 0
        acc.turnovers += r.turnovers || 0
        acc.fouls += r.fouls || 0
        acc.minutes += r.minutes || 0
        return acc
      },
      {
        points: 0, two_made: 0, two_att: 0, three_made: 0, three_att: 0,
        ft_made: 0, ft_att: 0, rebounds: 0, assists: 0, steals: 0,
        blocks: 0, turnovers: 0, fouls: 0, minutes: 0,
      }
    )
    const per = (n) => (games ? n / games : 0)
    return {
      games,
      ppg: per(totals.points),
      rpg: per(totals.rebounds),
      apg: per(totals.assists),
      spg: per(totals.steals),
      bpg: per(totals.blocks),
      topg: per(totals.turnovers),
      pfpg: per(totals.fouls),
      mpg: per(totals.minutes),
      astToRatio: totals.turnovers ? totals.assists / totals.turnovers : null,
      twoPct: pct(totals.two_made, totals.two_att),
      threePct: pct(totals.three_made, totals.three_att),
      ftPct: pct(totals.ft_made, totals.ft_att),
      totalPoints: totals.points,
      totalRebounds: totals.rebounds,
      totalAssists: totals.assists,
      totalTurnovers: totals.turnovers,
      totalFga: totals.two_att + totals.three_att,
      totalFta: totals.ft_att,
      totalFtMade: totals.ft_made,
      totalThreeAtt: totals.three_att,
      totalThreeMade: totals.three_made,
    }
  }, [filteredStatsRows])

  const insights = useMemo(() => generateInsights(summary, shotAgg), [summary, shotAgg])
  const milestones = useMemo(() => generateMilestones(filteredStatsRows, team.id), [filteredStatsRows, team.id])

  async function saveNotes() {
    setSaving(true)
    const { data } = await supabase
      .from('players')
      .update({ strengths, weaknesses, growth_notes: growthNotes })
      .eq('id', player.id)
      .select()
      .single()
    setSaving(false)
    setSavedAt(new Date())
    if (data && onPlayerUpdated) onPlayerUpdated(data)
  }

  return (
    <div>
      <div className="print:hidden">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <button onClick={onBack} className="text-sm text-chalkdim hover:text-chalk">
          ← {team.name} roster
        </button>
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => window.print()}
            className="bg-panel2 border border-line text-chalk font-medium text-sm rounded-md px-4 py-2 hover:border-red shrink-0"
          >
            Print report
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="font-display text-4xl font-bold">
          {player.jersey_number != null && (
            <span className="text-chalkdim stat-figure mr-2">#{player.jersey_number}</span>
          )}
          {player.name}
        </h1>
        <p className="text-chalkdim text-sm mt-1">
          {[player.position, team.name].filter(Boolean).join(' · ')}
        </p>
      </div>

      {loading ? (
        <p className="text-chalkdim">Loading…</p>
      ) : summary.games === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim mb-6">
          No box scores logged for {player.name}
          {seasonFilter && seasonFilter !== 'all' ? ` in ${seasonFilter}` : ''} yet. Once stats are
          entered for a game they play in, their season line will show up here.
        </div>
      ) : (
        <>
          <p className="text-chalkdim text-sm mb-4">
            {summary.games} game{summary.games === 1 ? '' : 's'} played
            {seasonFilter && seasonFilter !== 'all' ? ` in ${seasonFilter}` : ' (all seasons)'}.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="PPG" value={summary.ppg.toFixed(1)} sub={`${summary.totalPoints} total`} />
            <StatCard label="RPG" value={summary.rpg.toFixed(1)} sub={`${summary.totalRebounds} total`} />
            <StatCard label="APG" value={summary.apg.toFixed(1)} sub={`${summary.totalAssists} total`} />
            <StatCard label="MPG" value={summary.mpg.toFixed(1)} />
            <StatCard label="SPG" value={summary.spg.toFixed(1)} />
            <StatCard label="BPG" value={summary.bpg.toFixed(1)} />
            <StatCard label="TOPG" value={summary.topg.toFixed(1)} />
            <StatCard label="AST/TO" value={summary.astToRatio == null ? '—' : summary.astToRatio.toFixed(2)} />
          </div>

          <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
            Shooting
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard label="2PT%" value={fmtPct(summary.twoPct)} />
            <StatCard label="3PT%" value={fmtPct(summary.threePct)} />
            <StatCard label="FT%" value={fmtPct(summary.ftPct)} />
          </div>
        </>
      )}

      {(milestones.badges.length > 0 || milestones.seasonHighs.points) && (
        <>
          <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
            Milestones & Season Highs
          </h3>
          {milestones.badges.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {milestones.badges.map((badge) => (
                <span
                  key={badge.label}
                  title={badge.detail}
                  className="text-sm font-semibold bg-red text-white rounded-full px-4 py-1.5"
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {['points', 'rebounds', 'assists'].map((cat) => {
              const high = milestones.seasonHighs[cat]
              if (!high) return null
              const labels = { points: 'Points', rebounds: 'Rebounds', assists: 'Assists' }
              return (
                <div key={cat} className="bg-panel border border-line rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wide text-chalkdim mb-1">
                    Season High — {labels[cat]}
                  </p>
                  <p className="font-display text-3xl font-bold stat-figure">{high.value}</p>
                  <p className="text-xs text-chalkdim mt-0.5">
                    {[high.opponent && `vs ${high.opponent}`, high.date].filter(Boolean).join(' · ')}
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Shot Chart
      </h3>
      <div className="mb-6">
        {shotLoading ? (
          <p className="text-chalkdim">Loading…</p>
        ) : !hasShotData ? (
          <div className="border border-dashed border-line rounded-lg p-8 text-center text-chalkdim text-sm">
            No shot chart data imported yet for {player.name}. Import a Hudl shot chart PDF from any
            game they play in to see their zone tendencies here.
          </div>
        ) : (
          <div>
            <p className="text-chalkdim text-sm mb-3">
              {shotTotals.made}/{shotTotals.attempted} field goals (
              {((shotTotals.made / shotTotals.attempted) * 100).toFixed(1)}%) across every zone-mapped
              shot imported for {player.name}.
            </p>
            <ShotChartSvg aggregated={shotAgg} variant="dark" className="w-full max-w-sm mx-auto" />
          </div>
        )}
      </div>

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-2">
        Suggested Areas of Improvement
      </h3>
      <p className="text-xs text-chalkdim mb-3">
        Auto-generated from stats and shot chart data against general basketball analytics
        benchmarks — a starting point for a conversation, not a verdict. Your own judgment on this
        player always comes first.
      </p>
      <details className="mb-3 text-xs">
        <summary className="text-chalkdim hover:text-chalk cursor-pointer select-none">
          How these suggestions are calculated
        </summary>
        <div className="mt-2 space-y-2 border-l border-line pl-3">
          {PLAYER_METHODOLOGY.map((m) => (
            <div key={m.metric}>
              <p className="font-medium text-chalk">{m.metric}</p>
              <p className="text-chalkdim">{m.detail}</p>
            </div>
          ))}
        </div>
      </details>
      <div className="mb-6">
        {summary.games === 0 ? (
          <div className="border border-dashed border-line rounded-lg p-6 text-center text-chalkdim text-sm">
            No box scores logged yet for {player.name} — suggestions will appear once stats are entered.
          </div>
        ) : insights.length === 0 ? (
          <div className="border border-dashed border-line rounded-lg p-6 text-center text-chalkdim text-sm">
            No specific concerns flagged — {player.name}'s numbers look solid against every
            benchmark checked.
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, i) => (
              <div key={i} className="bg-panel border border-red/40 rounded-lg p-4">
                <p className="font-medium text-sm mb-1">{insight.title}</p>
                <p className="text-chalkdim text-sm">{insight.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Strengths
      </h3>
      <textarea
        value={strengths}
        onChange={(e) => setStrengths(e.target.value)}
        rows={4}
        placeholder="What this player does well right now…"
        className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm focus:border-red outline-none resize-y mb-6"
      />

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Weaknesses
      </h3>
      <textarea
        value={weaknesses}
        onChange={(e) => setWeaknesses(e.target.value)}
        rows={4}
        placeholder="Areas that need work…"
        className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm focus:border-red outline-none resize-y mb-6"
      />

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Expected Growth (Offseason)
      </h3>
      <textarea
        value={growthNotes}
        onChange={(e) => setGrowthNotes(e.target.value)}
        rows={4}
        placeholder="What to focus on before next season, workout plans, skill goals…"
        className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm focus:border-red outline-none resize-y mb-4"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={saveNotes}
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

      <div className="hidden print:block">
        <PrintablePlayerReport
          player={player}
          team={team}
          summary={summary}
          strengths={strengths}
          weaknesses={weaknesses}
          growthNotes={growthNotes}
          hasShotData={hasShotData}
          shotAgg={shotAgg}
          shotTotals={shotTotals}
          insights={insights}
          milestones={milestones}
        />
      </div>
    </div>
  )
}

function PrintablePlayerReport({ player, team, summary, strengths, weaknesses, growthNotes, hasShotData, shotAgg, shotTotals, insights, milestones }) {
  const today = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

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
            {player.jersey_number != null && `#${player.jersey_number} `}{player.name}
          </h1>
          <p className="text-xs text-gray-500">
            {[player.position, team.name].filter(Boolean).join(' · ') || 'Player development report'}
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p className="font-semibold text-black">Player Development Report</p>
          <p>{today}</p>
          <p>{summary.games} game{summary.games === 1 ? '' : 's'} played</p>
        </div>
      </div>

      {summary.games > 0 && (
        <>
          <div className="grid grid-cols-4 gap-x-4 mb-3">
            <div>{row('PPG', summary.ppg.toFixed(1))}{row('RPG', summary.rpg.toFixed(1))}</div>
            <div>{row('APG', summary.apg.toFixed(1))}{row('AST/TO', summary.astToRatio == null ? '—' : summary.astToRatio.toFixed(2))}</div>
            <div>{row('SPG', summary.spg.toFixed(1))}{row('BPG', summary.bpg.toFixed(1))}</div>
            <div>{row('TOPG', summary.topg.toFixed(1))}{row('MPG', summary.mpg.toFixed(1))}</div>
          </div>

          <div className="grid grid-cols-3 gap-x-4 mb-4">
            <div>{row('2PT%', fmtPct(summary.twoPct))}</div>
            <div>{row('3PT%', fmtPct(summary.threePct))}</div>
            <div>{row('FT%', fmtPct(summary.ftPct))}</div>
          </div>
        </>
      )}

      {milestones && (milestones.badges.length > 0 || milestones.seasonHighs.points) && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
            Milestones & Season Highs
          </p>
          {milestones.badges.length > 0 && (
            <p className="text-xs text-black mb-1">
              {milestones.badges.map((b) => b.label).join('  ·  ')}
            </p>
          )}
          <p className="text-xs text-gray-700">
            {['points', 'rebounds', 'assists']
              .map((cat) => {
                const high = milestones.seasonHighs[cat]
                if (!high) return null
                const labels = { points: 'PTS', rebounds: 'REB', assists: 'AST' }
                return `${high.value} ${labels[cat]} (${[high.opponent && `vs ${high.opponent}`, high.date].filter(Boolean).join(', ')})`
              })
              .filter(Boolean)
              .join('  ·  ')}
          </p>
        </div>
      )}

      {hasShotData && (
        <div className="mb-4 flex justify-center">
          <ShotChartSvg aggregated={shotAgg} variant="light" className="w-full max-w-[220px]" />
        </div>
      )}

      {insights && insights.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
            Suggested Areas of Improvement
          </p>
          <div className="space-y-1.5">
            {insights.map((insight, i) => (
              <p key={i} className="text-xs text-black leading-snug">
                <span className="font-semibold">{insight.title}:</span> {insight.detail}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
          Strengths
        </p>
        <p className="text-xs text-black whitespace-pre-wrap leading-snug">
          {strengths || '—'}
        </p>
      </div>

      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
          Weaknesses
        </p>
        <p className="text-xs text-black whitespace-pre-wrap leading-snug">
          {weaknesses || '—'}
        </p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
          Expected Growth (Offseason)
        </p>
        <p className="text-xs text-black whitespace-pre-wrap leading-snug">
          {growthNotes || '—'}
        </p>
      </div>
    </div>
  )
}
