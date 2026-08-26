import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

function todayLocalISO() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 10)
}

export default function NeedsStats() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const today = todayLocalISO()

      const { data: pastGames } = await supabase
        .from('games')
        .select('*, home_team:home_team_id(id,name,color), away_team:away_team_id(id,name,color)')
        .lte('game_date', today)
        .order('game_date', { ascending: false })

      const gameIds = (pastGames || []).map((g) => g.id)
      let gameIdsWithStats = new Set()
      if (gameIds.length > 0) {
        const { data: statRows } = await supabase
          .from('player_game_stats')
          .select('game_id')
          .in('game_id', gameIds)
        gameIdsWithStats = new Set((statRows || []).map((r) => r.game_id))
      }

      setGames((pastGames || []).filter((g) => !gameIdsWithStats.has(g.id)))
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <h1 className="font-display text-4xl font-bold mb-1">Needs Stats</h1>
      <p className="text-chalkdim text-sm mb-6">
        Games that have already happened but don't have a box score entered yet, oldest first.
      </p>

      {loading ? (
        <p className="text-chalkdim">Loading…</p>
      ) : games.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim">
          Nothing here — every past game has stats entered.
        </div>
      ) : (
        <div className="space-y-2">
          {games.map((g) => (
            <div
              key={g.id}
              className="bg-panel border border-alert/40 rounded-lg px-5 py-4 flex items-center justify-between flex-wrap gap-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-chalkdim w-24 shrink-0">{g.game_date}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: g.away_team?.color || '#E31B23' }}
                />
                <span className="font-medium">{g.away_team?.name}</span>
                <span className="text-chalkdim">@</span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: g.home_team?.color || '#E31B23' }}
                />
                <span className="font-medium">{g.home_team?.name}</span>
              </div>
              {g.home_score != null && g.away_score != null ? (
                <span className="stat-figure font-display text-lg font-bold">
                  {g.away_score} – {g.home_score}
                </span>
              ) : (
                <span className="text-xs uppercase tracking-wide text-alert border border-alert/40 rounded-full px-3 py-1">
                  No score either
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
