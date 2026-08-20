import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

function todayLocalISO() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 10)
}

export default function TonightsMatchups() {
  const [date, setDate] = useState(todayLocalISO())
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('games')
        .select('*, home_team:home_team_id(id,name,color), away_team:away_team_id(id,name,color)')
        .eq('game_date', date)
        .order('created_at')
      setGames(data || [])
      setLoading(false)
    }
    load()
  }, [date])

  const isToday = date === todayLocalISO()

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <h1 className="font-display text-4xl font-bold">Tonight's Matchups</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-panel2 border border-line rounded-md px-3 py-2 text-sm focus:border-red outline-none"
        />
      </div>
      <p className="text-chalkdim text-sm mb-6">
        Games on {date}{isToday && ' (today)'} between teams already in CourtVision.
      </p>

      {loading ? (
        <p className="text-chalkdim">Loading…</p>
      ) : games.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim">
          No games logged for this date.
        </div>
      ) : (
        <div className="space-y-2">
          {games.map((g) => (
            <div
              key={g.id}
              className="bg-panel border border-line rounded-lg px-5 py-4 flex items-center justify-between flex-wrap gap-2"
            >
              <div className="flex items-center gap-3">
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
                <span className="stat-figure font-display text-xl font-bold">
                  {g.away_score} – {g.home_score}
                </span>
              ) : (
                <span className="text-xs uppercase tracking-wide text-chalkdim border border-line rounded-full px-3 py-1">
                  Scheduled
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
