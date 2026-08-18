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

export default function ScoutingReport({ team, notes, setNotes, onSaveNotes, savingNotes, savedAt }) {
  const [loading, setLoading] = useState(true)
  const [statsRows, setStatsRows] = useState([])
  const [gamesCount, setGamesCount] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: teamGames } = await supabase
        .from('games')
        .select('id')
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

      setGamesCount((teamGames || []).length)
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
        ft_made: 0, ft_att: 0, rebounds: 0, assists: 0, steals: 0,
        blocks: 0, turnovers: 0, fouls: 0,
      }
    )
    const per = (n) => (gamesWithStats ? n / gamesWithStats : 0)
    const totalFga = totals.two_att + totals.three_att

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
    }
  }, [statsRows])

  const topPerformers = useMemo(() => {
    const byPlayer = {}
    statsRows.forEach((r) => {
      const p = r.player
      if (!p) return
      if (!byPlayer[p.id]) {
        byPlayer[p.id] = { id: p.id, name: p.name, jersey_number: p.jersey_number, games: 0, points: 0 }
      }
      byPlayer[p.id].games += 1
      byPlayer[p.id].points += r.points || 0
    })
    return Object.values(byPlayer)
      .map((p) => ({ ...p, ppg: p.games ? p.points / p.games : 0 }))
      .sort((a, b) => b.ppg - a.ppg)
      .slice(0, 5)
  }, [statsRows])

  if (loading) return <p className="text-chalkdim">Loading…</p>

  if (summary.gamesWithStats === 0) {
    return (
      <div>
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim mb-6">
          No box scores logged for {team.name} yet. Once you enter stats for a game involving this
          team, tendencies and shooting splits will show up here automatically.
          {gamesCount > 0 && (
            <p className="mt-2 text-xs">
              ({gamesCount} game{gamesCount === 1 ? '' : 's'} logged, but no stats entered yet.)
            </p>
          )}
        </div>
        <NotesSection notes={notes} setNotes={setNotes} onSave={onSaveNotes} saving={savingNotes} savedAt={savedAt} />
      </div>
    )
  }

  return (
    <div>
      <p className="text-chalkdim text-sm mb-4">
        Based on {summary.gamesWithStats} game{summary.gamesWithStats === 1 ? '' : 's'} with stats entered.
      </p>

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

      {topPerformers.length > 0 && (
        <>
          <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
            Top scorers
          </h3>
          <div className="bg-panel border border-line rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm">
              <tbody>
                {topPerformers.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                      {p.jersey_number != null && (
                        <span className="text-chalkdim stat-figure mr-1.5">#{p.jersey_number}</span>
                      )}
                      {p.name}
                    </td>
                    <td className="px-4 py-2.5 text-right stat-figure text-red font-semibold">
                      {p.ppg.toFixed(1)} PPG
                    </td>
                    <td className="px-4 py-2.5 text-right stat-figure text-chalkdim text-xs w-20">
                      {p.games} GP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <NotesSection notes={notes} setNotes={setNotes} onSave={onSaveNotes} saving={savingNotes} savedAt={savedAt} />
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
