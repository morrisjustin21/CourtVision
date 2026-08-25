import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { SHOT_ZONES, CHART_WIDTH, CHART_HEIGHT } from '../shotZones'

function centroid(points) {
  const x = points.reduce((s, p) => s + p[0], 0) / points.length
  const y = points.reduce((s, p) => s + p[1], 0) / points.length
  return [x, y]
}

export function useShotZoneData(team) {
  const [loading, setLoading] = useState(true)
  const [zoneRows, setZoneRows] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: players } = await supabase
        .from('players')
        .select('id')
        .eq('team_id', team.id)
        .eq('include_in_scouting_report', true)
      const playerIds = (players || []).map((p) => p.id)
      let rows = []
      if (playerIds.length > 0) {
        const { data } = await supabase.from('player_shot_zones').select('*').in('player_id', playerIds)
        rows = data || []
      }
      setZoneRows(rows)
      setLoading(false)
    }
    load()
  }, [team.id])

  const aggregated = useMemo(() => {
    const byZone = {}
    zoneRows.forEach((r) => {
      if (!byZone[r.zone]) byZone[r.zone] = { made: 0, attempted: 0 }
      byZone[r.zone].made += r.made || 0
      byZone[r.zone].attempted += r.attempted || 0
    })
    return byZone
  }, [zoneRows])

  const hasData = Object.values(aggregated).some((z) => z.attempted > 0)
  const totals = Object.values(aggregated).reduce(
    (acc, z) => ({ made: acc.made + z.made, attempted: acc.attempted + z.attempted }),
    { made: 0, attempted: 0 }
  )

  return { loading, aggregated, hasData, totals }
}

// Per-player shot zone data for every player on the roster (regardless of
// their include/exclude toggle — that filter only applies to the combined
// team chart, not this per-player browsing view).
export function usePlayerShotZoneData(team) {
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState([])
  const [zoneRows, setZoneRows] = useState([])

  async function load() {
    setLoading(true)
    const { data: playersData } = await supabase
      .from('players')
      .select('id, name, jersey_number, include_in_scouting_report')
      .eq('team_id', team.id)
      .order('jersey_number')
    const playerIds = (playersData || []).map((p) => p.id)
    let rows = []
    if (playerIds.length > 0) {
      const { data } = await supabase.from('player_shot_zones').select('*').in('player_id', playerIds)
      rows = data || []
    }
    setPlayers(playersData || [])
    setZoneRows(rows)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [team.id])

  const byPlayer = useMemo(() => {
    const map = {}
    players.forEach((p) => {
      map[p.id] = { player: p, aggregated: {}, made: 0, attempted: 0 }
    })
    zoneRows.forEach((r) => {
      const entry = map[r.player_id]
      if (!entry) return
      if (!entry.aggregated[r.zone]) entry.aggregated[r.zone] = { made: 0, attempted: 0 }
      entry.aggregated[r.zone].made += r.made || 0
      entry.aggregated[r.zone].attempted += r.attempted || 0
      entry.made += r.made || 0
      entry.attempted += r.attempted || 0
    })
    return Object.values(map).filter((e) => e.attempted > 0)
  }, [players, zoneRows])

  return { loading, byPlayer, reload: load }
}

const PALETTES = {
  dark: { stroke: '#2B2E35', empty: 'rgba(255,255,255,0.03)', emptyText: '#F5F5F3' },
  light: { stroke: '#D1D5DB', empty: 'rgba(0,0,0,0.02)', emptyText: '#000000' },
}

// Dark blue (ice cold) -> light blue -> light red -> bright red (hot). A
// three-point shot and a two-point shot at the "same" percentage mean very
// different things — 35% is a fine three-point rate but a poor two-point
// rate — so each shot type gets its own scale rather than one universal
// 0-100% gradient.
const DEEP_BLUE = [30, 64, 175]
const LIGHT_BLUE = [147, 197, 253]
const LIGHT_RED = [252, 165, 165]
const HOT_RED = [220, 38, 38]

const THREE_PT_STOPS = [
  [0, DEEP_BLUE], [20, DEEP_BLUE], [28, LIGHT_BLUE], [35, LIGHT_BLUE], [40, LIGHT_RED], [45, HOT_RED],
]
const TWO_PT_STOPS = [
  [0, DEEP_BLUE], [30, DEEP_BLUE], [40, LIGHT_BLUE], [50, LIGHT_RED], [60, HOT_RED],
]

function heatColor(pct, zoneType) {
  const stops = zoneType === '3PT' ? THREE_PT_STOPS : TWO_PT_STOPS
  if (pct <= stops[0][0]) return stops[0][1]
  if (pct >= stops[stops.length - 1][0]) return stops[stops.length - 1][1]
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i]
    const [p1, c1] = stops[i + 1]
    if (pct >= p0 && pct <= p1) {
      const t = p1 !== p0 ? (pct - p0) / (p1 - p0) : 0
      return c0.map((c, j) => Math.round(c + (c1[j] - c) * t))
    }
  }
  return stops[stops.length - 1][1]
}

// Picks readable text color (near-black or near-white) against a given
// fill, since the heat map spans both light and dark, saturated fills
// within the same chart — a single fixed text color per chart no longer
// stays legible on every zone.
function textColorFor([r, g, b]) {
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance > 150 ? '#141416' : '#FFFFFF'
}

export function ShotChartSvg({ aggregated, variant = 'dark', className = '' }) {
  const palette = PALETTES[variant]
  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className={className}>
      {SHOT_ZONES.map((zone) => {
        const stat = aggregated[zone.id] || { made: 0, attempted: 0 }
        const pct = stat.attempted > 0 ? (stat.made / stat.attempted) * 100 : null
        const rgb = pct == null ? null : heatColor(pct, zone.type)
        const fill = rgb == null ? palette.empty : `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
        const textColor = rgb == null ? palette.emptyText : textColorFor(rgb)
        const points = zone.points.map(([x, y]) => `${x},${y}`).join(' ')
        const [cx, cy] = centroid(zone.points)
        return (
          <g key={zone.id}>
            <polygon points={points} fill={fill} stroke={palette.stroke} strokeWidth="0.6" />
            {stat.attempted > 0 && (
              <>
                <text x={cx} y={cy - 2.5} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={textColor}>
                  {pct.toFixed(0)}%
                </text>
                <text x={cx} y={cy + 5.5} textAnchor="middle" fontSize="5.5" fill={textColor} fillOpacity="0.85">
                  {stat.made}/{stat.attempted}
                </text>
              </>
            )}
          </g>
        )
      })}
      {/* Hoop marker for orientation */}
      <circle cx={CHART_WIDTH / 2} cy="2" r="2.2" fill="none" stroke={palette.stroke} strokeWidth="0.8" />
    </svg>
  )
}

export default function ShotChart({ team }) {
  const { loading, aggregated, hasData, totals } = useShotZoneData(team)

  if (loading) return <p className="text-chalkdim">Loading…</p>

  if (!hasData) {
    return (
      <div className="border border-dashed border-line rounded-lg p-8 text-center text-chalkdim text-sm">
        No shot chart data imported yet for {team.name}. Import a Hudl shot chart PDF from any of
        their logged games (on the game's box score screen) to see zone tendencies here.
      </div>
    )
  }

  return (
    <div>
      <p className="text-chalkdim text-sm mb-3">
        {totals.made}/{totals.attempted} field goals ({((totals.made / totals.attempted) * 100).toFixed(1)}%)
        across every zone-mapped shot imported for {team.name}.
      </p>
      <ShotChartSvg aggregated={aggregated} variant="dark" className="w-full max-w-md mx-auto" />
    </div>
  )
}
