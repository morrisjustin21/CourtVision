import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

function todayLocalISO() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 10)
}

export default function Dashboard({ setView }) {
  const [loading, setLoading] = useState(true)
  const [nextGame, setNextGame] = useState(null)
  const [needsStatsCount, setNeedsStatsCount] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [recentResults, setRecentResults] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const today = todayLocalISO()
      const teamCols = '*, home_team:home_team_id(id,name,color), away_team:away_team_id(id,name,color)'

      const [{ data: upcoming }, { data: pastGames }, { count: pendingCount }, { data: recent }] =
        await Promise.all([
          supabase.from('games').select(teamCols).gte('game_date', today).order('game_date').limit(1),
          supabase.from('games').select('id, game_date, home_score, away_score').lte('game_date', today),
          supabase.from('pending_score_reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase
            .from('games')
            .select(teamCols)
            .not('home_score', 'is', null)
            .not('away_score', 'is', null)
            .order('game_date', { ascending: false })
            .limit(5),
        ])

      setNextGame((upcoming || [])[0] || null)
      setReviewCount(pendingCount || 0)
      setRecentResults(recent || [])

      const gameIds = (pastGames || []).map((g) => g.id)
      let idsWithStats = new Set()
      if (gameIds.length > 0) {
        const { data: statRows } = await supabase.from('player_game_stats').select('game_id').in('game_id', gameIds)
        idsWithStats = new Set((statRows || []).map((r) => r.game_id))
      }
      setNeedsStatsCount((pastGames || []).filter((g) => !idsWithStats.has(g.id)).length)

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p className="text-chalkdim">Loading…</p>

  return (
    <div>
      <h1 className="font-display text-4xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-panel border border-line rounded-lg p-5 sm:col-span-2">
          <p className="text-[10px] uppercase tracking-wide text-chalkdim mb-2">Next Game</p>
          {nextGame ? (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: nextGame.away_team?.color || '#E31B23' }}
                />
                <span className="font-medium text-lg">{nextGame.away_team?.name}</span>
                <span className="text-chalkdim">@</span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: nextGame.home_team?.color || '#E31B23' }}
                />
                <span className="font-medium text-lg">{nextGame.home_team?.name}</span>
              </div>
              <span className="text-sm text-chalkdim">{nextGame.game_date}</span>
            </div>
          ) : (
            <p className="text-chalkdim text-sm">No upcoming games scheduled.</p>
          )}
        </div>

        <button
          onClick={() => setView('needsstats')}
          className={`text-left bg-panel border rounded-lg p-5 hover:border-red transition ${
            needsStatsCount > 0 ? 'border-alert/40' : 'border-line'
          }`}
        >
          <p className="text-[10px] uppercase tracking-wide text-chalkdim mb-1">Needs Stats</p>
          <p className="font-display text-3xl font-bold stat-figure">{needsStatsCount}</p>
          <p className="text-xs text-chalkdim mt-0.5">
            {needsStatsCount === 0 ? 'All caught up' : 'games missing a box score'}
          </p>
        </button>

        <button
          onClick={() => setView('automation')}
          className={`text-left bg-panel border rounded-lg p-5 hover:border-red transition ${
            reviewCount > 0 ? 'border-alert/40' : 'border-line'
          }`}
        >
          <p className="text-[10px] uppercase tracking-wide text-chalkdim mb-1">Automation Review Queue</p>
          <p className="font-display text-3xl font-bold stat-figure">{reviewCount}</p>
          <p className="text-xs text-chalkdim mt-0.5">
            {reviewCount === 0 ? 'Nothing waiting' : 'items waiting for your approval'}
          </p>
        </button>
      </div>

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Recent Results
      </h3>
      {recentResults.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-8 text-center text-chalkdim text-sm">
          No completed games logged yet.
        </div>
      ) : (
        <div className="space-y-2">
          {recentResults.map((g) => (
            <div
              key={g.id}
              className="bg-panel border border-line rounded-lg px-5 py-3.5 flex items-center justify-between flex-wrap gap-2"
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
              <span className="stat-figure font-display text-lg font-bold">
                {g.away_score} – {g.home_score}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
