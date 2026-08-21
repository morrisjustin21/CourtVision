import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentSeason } from '../useCurrentSeason'

export default function TeamSchedule({ team }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const { season: currentSeason, loading: seasonLoading } = useCurrentSeason()
  const [seasonFilter, setSeasonFilter] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('games')
        .select(
          '*, home_team:home_team_id(id,name,color), away_team:away_team_id(id,name,color)'
        )
        .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
        .order('game_date')
      setGames(data || [])
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
    () => [...new Set(games.map((g) => g.season).filter(Boolean))].sort().reverse(),
    [games]
  )

  const filteredGames = useMemo(
    () => (!seasonFilter || seasonFilter === 'all' ? games : games.filter((g) => g.season === seasonFilter)),
    [games, seasonFilter]
  )

  const record = useMemo(() => {
    let wins = 0
    let losses = 0
    filteredGames.forEach((g) => {
      const isHome = g.home_team_id === team.id
      const us = isHome ? g.home_score : g.away_score
      const them = isHome ? g.away_score : g.home_score
      if (us == null || them == null) return
      if (us > them) wins += 1
      else if (them > us) losses += 1
    })
    return { wins, losses }
  }, [filteredGames, team.id])

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <p className="text-chalkdim text-sm">
          {filteredGames.length} game{filteredGames.length === 1 ? '' : 's'}
          {record.wins + record.losses > 0 && (
            <> · <span className="stat-figure text-chalk font-semibold">{record.wins}-{record.losses}</span></>
          )}
        </p>
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

      {loading ? (
        <p className="text-chalkdim mt-4">Loading…</p>
      ) : filteredGames.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim mt-4">
          No games logged for {team.name}{seasonFilter && seasonFilter !== 'all' ? ` in ${seasonFilter}` : ''} yet.
        </div>
      ) : (
        <div className="space-y-2 mt-4">
          {filteredGames.map((g) => {
            const isHome = g.home_team_id === team.id
            const opponent = isHome ? g.away_team : g.home_team
            const us = isHome ? g.home_score : g.away_score
            const them = isHome ? g.away_score : g.home_score
            const played = us != null && them != null
            const won = played && us > them

            return (
              <div
                key={g.id}
                className="bg-panel border border-line rounded-lg px-5 py-4 flex items-center justify-between flex-wrap gap-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-chalkdim w-24 shrink-0">{g.game_date}</span>
                  <span className="text-xs text-chalkdim w-8 shrink-0">{isHome ? 'vs' : '@'}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: opponent?.color || '#E31B23' }}
                  />
                  <span className="font-medium">{opponent?.name || 'Unknown'}</span>
                </div>
                {played ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                        won ? 'text-red border border-red/40' : 'text-chalkdim border border-line'
                      }`}
                    >
                      {won ? 'W' : 'L'}
                    </span>
                    <span className="stat-figure font-display text-lg font-bold">
                      {us}-{them}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs uppercase tracking-wide text-chalkdim border border-line rounded-full px-3 py-1">
                    Scheduled
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
