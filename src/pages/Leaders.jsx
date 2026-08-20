import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentSeason } from '../useCurrentSeason'

const SORTABLE = [
  { key: 'ppg', label: 'PPG' },
  { key: 'rpg', label: 'RPG' },
  { key: 'apg', label: 'APG' },
  { key: 'spg', label: 'SPG' },
  { key: 'bpg', label: 'BPG' },
]

export default function Leaders() {
  const [rawRows, setRawRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState('ppg')
  const [seasonFilter, setSeasonFilter] = useState(null)
  const { season: currentSeason, loading: seasonLoading } = useCurrentSeason()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('player_game_stats')
        .select('*, player:player_id(id,name,jersey_number,team:team_id(id,name,color)), game:game_id(id,season)')
      setLoading(false)
      setRawRows(data || [])
    }
    load()
  }, [])

  useEffect(() => {
    if (!seasonLoading && seasonFilter === null) {
      setSeasonFilter(currentSeason || 'all')
    }
  }, [seasonLoading, currentSeason, seasonFilter])

  const seasons = useMemo(
    () => [...new Set(rawRows.map((r) => r.game?.season).filter(Boolean))].sort().reverse(),
    [rawRows]
  )

  const rows = useMemo(() => {
    const filtered =
      !seasonFilter || seasonFilter === 'all' ? rawRows : rawRows.filter((r) => r.game?.season === seasonFilter)

    const byPlayer = {}
    filtered.forEach((row) => {
      const p = row.player
      if (!p) return
      if (!byPlayer[p.id]) {
        byPlayer[p.id] = {
          id: p.id,
          name: p.name,
          jersey_number: p.jersey_number,
          team: p.team?.name,
          teamColor: p.team?.color,
          games: 0,
          points: 0,
          rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
        }
      }
      const agg = byPlayer[p.id]
      agg.games += 1
      agg.points += row.points || 0
      agg.rebounds += row.rebounds || 0
      agg.assists += row.assists || 0
      agg.steals += row.steals || 0
      agg.blocks += row.blocks || 0
    })

    return Object.values(byPlayer).map((p) => ({
      ...p,
      ppg: p.games ? p.points / p.games : 0,
      rpg: p.games ? p.rebounds / p.games : 0,
      apg: p.games ? p.assists / p.games : 0,
      spg: p.games ? p.steals / p.games : 0,
      bpg: p.games ? p.blocks / p.games : 0,
    }))
  }, [rawRows, seasonFilter])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b[sortKey] - a[sortKey]),
    [rows, sortKey]
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display text-4xl font-bold">League Leaders</h1>
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="flex gap-1 bg-panel border border-line rounded-md p-1">
            {SORTABLE.map((s) => (
              <button
                key={s.key}
                onClick={() => setSortKey(s.key)}
                className={`text-xs font-medium px-3 py-1.5 rounded ${
                  sortKey === s.key ? 'bg-red text-white' : 'text-chalkdim hover:text-chalk'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-chalkdim">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim">
          {rawRows.length === 0
            ? 'No stats logged yet. Enter box scores from a game to see leaders here.'
            : 'No stats logged for this season.'}
        </div>
      ) : (
        <div className="bg-panel border border-line rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-chalkdim text-xs uppercase tracking-wide border-b border-line">
                <th className="text-left px-4 py-3 font-medium">Rank</th>
                <th className="text-left px-4 py-3 font-medium">Player</th>
                <th className="text-left px-4 py-3 font-medium">Team</th>
                <th className="px-3 py-3 font-medium text-center">GP</th>
                {SORTABLE.map((s) => (
                  <th key={s.key} className="px-3 py-3 font-medium text-center">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 stat-figure text-chalkdim">{i + 1}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {p.jersey_number != null && (
                      <span className="text-chalkdim stat-figure mr-1.5">#{p.jersey_number}</span>
                    )}
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-chalkdim">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ backgroundColor: p.teamColor || '#E31B23' }}
                    />
                    {p.team}
                  </td>
                  <td className="px-3 py-3 text-center stat-figure text-chalkdim">{p.games}</td>
                  {SORTABLE.map((s) => (
                    <td
                      key={s.key}
                      className={`px-3 py-3 text-center stat-figure ${
                        sortKey === s.key ? 'text-red font-semibold' : ''
                      }`}
                    >
                      {p[s.key].toFixed(1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
