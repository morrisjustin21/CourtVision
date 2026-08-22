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

const MIN_GAMES_OPTIONS = [
  { value: 1, label: 'Any games played' },
  { value: 3, label: 'At least 3 games' },
  { value: 5, label: 'At least 5 games' },
  { value: 10, label: 'At least 10 games' },
]

export default function Leaders() {
  const [rawRows, setRawRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState('ppg')
  const [seasonFilter, setSeasonFilter] = useState(null)
  const [districtFilter, setDistrictFilter] = useState('all')
  const [minGames, setMinGames] = useState(3)
  const { season: currentSeason, loading: seasonLoading } = useCurrentSeason()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('player_game_stats')
        .select(
          '*, player:player_id(id,name,jersey_number,team:team_id(id,name,color,district)), game:game_id(id,season)'
        )
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

  const districts = useMemo(
    () =>
      [...new Set(rawRows.map((r) => r.player?.team?.district).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    [rawRows]
  )

  const rows = useMemo(() => {
    let filtered =
      !seasonFilter || seasonFilter === 'all' ? rawRows : rawRows.filter((r) => r.game?.season === seasonFilter)
    if (districtFilter !== 'all') {
      filtered = filtered.filter((r) => r.player?.team?.district === districtFilter)
    }

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

    return Object.values(byPlayer)
      .filter((p) => p.games >= minGames)
      .map((p) => ({
        ...p,
        ppg: p.games ? p.points / p.games : 0,
        rpg: p.games ? p.rebounds / p.games : 0,
        apg: p.games ? p.assists / p.games : 0,
        spg: p.games ? p.steals / p.games : 0,
        bpg: p.games ? p.blocks / p.games : 0,
      }))
  }, [rawRows, seasonFilter, districtFilter, minGames])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b[sortKey] - a[sortKey]),
    [rows, sortKey]
  )

  const podium = sorted.slice(0, 3)
  const rest = sorted.slice(3)
  const activeLabel = SORTABLE.find((s) => s.key === sortKey)?.label

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
          {districts.length > 0 && (
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="bg-panel2 border border-line rounded-md px-3 py-2 text-sm focus:border-red outline-none"
            >
              <option value="all">All districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
          <select
            value={minGames}
            onChange={(e) => setMinGames(parseInt(e.target.value, 10))}
            className="bg-panel2 border border-line rounded-md px-3 py-2 text-sm focus:border-red outline-none"
          >
            {MIN_GAMES_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-1 bg-panel border border-line rounded-md p-1 mb-6 w-fit">
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

      {loading ? (
        <p className="text-chalkdim">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim">
          {rawRows.length === 0
            ? 'No stats logged yet. Enter box scores from a game to see leaders here.'
            : 'No players match these filters. Try lowering the games-played minimum.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {podium.map((p, i) => (
              <PodiumCard key={p.id} player={p} rank={i + 1} statKey={sortKey} statLabel={activeLabel} />
            ))}
          </div>

          {rest.length > 0 && (
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
                  {rest.map((p, i) => (
                    <tr key={p.id} className="border-b border-line last:border-0 hover:bg-panel2/50">
                      <td className="px-4 py-3 stat-figure text-chalkdim">{i + 4}</td>
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
        </>
      )}
    </div>
  )
}

function PodiumCard({ player, rank, statKey, statLabel }) {
  const isFirst = rank === 1
  return (
    <div
      className={`relative rounded-lg p-5 overflow-hidden ${
        isFirst
          ? 'bg-panel border-2 border-red sm:order-2 sm:scale-105'
          : rank === 2
          ? 'bg-panel border border-line sm:order-1'
          : 'bg-panel border border-line sm:order-3'
      }`}
    >
      <span
        className={`font-display font-bold select-none absolute top-2 right-4 ${
          isFirst ? 'text-6xl text-red/25' : 'text-5xl text-line'
        }`}
      >
        {rank}
      </span>
      <p className="font-medium mb-0.5 relative">
        {player.jersey_number != null && (
          <span className="text-chalkdim stat-figure mr-1.5">#{player.jersey_number}</span>
        )}
        {player.name}
      </p>
      <p className="text-xs text-chalkdim mb-4 flex items-center gap-1.5">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: player.teamColor || '#E31B23' }}
        />
        {player.team} · {player.games} GP
      </p>
      <p className={`font-display font-bold stat-figure ${isFirst ? 'text-5xl text-red' : 'text-3xl text-chalk'}`}>
        {player[statKey].toFixed(1)}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-chalkdim">{statLabel}</p>
    </div>
  )
}
