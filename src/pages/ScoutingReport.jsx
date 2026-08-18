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

function LeaderboardCard({ title, players, statKey, suffix }) {
  if (players.length === 0) return null
  return (
    <div className="bg-panel border border-line rounded-lg overflow-hidden">
      <p className="text-xs uppercase tracking-wide text-chalkdim px-4 pt-3 pb-2">{title}</p>
      <table className="w-full text-sm">
        <tbody>
          {players.map((p, i) => (
            <tr key={p.id} className="border-b border-line last:border-0">
              <td className="pl-4 pr-2 py-2 stat-figure text-chalkdim text-xs w-6">{i + 1}</td>
              <td className="px-2 py-2 font-medium whitespace-nowrap">
                {p.jersey_number != null && (
                  <span className="text-chalkdim stat-figure mr-1.5">#{p.jersey_number}</span>
                )}
                {p.name}
              </td>
              <td className="px-4 py-2 text-right stat-figure text-red font-semibold whitespace-nowrap">
                {p[statKey].toFixed(1)} {suffix}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
        acc.oreb += r.oreb || 0
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
        ft_made: 0, ft_att: 0, oreb: 0, rebounds: 0, assists: 0, steals: 0,
        blocks: 0, turnovers: 0, fouls: 0,
      }
    )
    const per = (n) => (gamesWithStats ? n / gamesWithStats : 0)
    const totalFga = totals.two_att + totals.three_att

    // Dean Oliver's possession estimate: FGA + 0.44*FTA + TOV - OREB.
    // Offensive rebounds are excluded because they extend the same possession
    // rather than starting a new one.
    const possessions = totalFga + 0.44 * totals.ft_att + totals.turnovers - totals.oreb
    const pace = gamesWithStats ? possessions / gamesWithStats : null
    const offRating = possessions > 0 ? (totals.points / possessions) * 100 : null

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
      pace,
      offRating,
    }
  }, [statsRows])

  const playerAgg = useMemo(() => {
    const byPlayer = {}
    statsRows.forEach((r) => {
      const p = r.player
      if (!p) return
      if (!byPlayer[p.id]) {
        byPlayer[p.id] = {
          id: p.id,
          name: p.name,
          jersey_number: p.jersey_number,
          games: 0,
          points: 0,
          rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          fgMade: 0,
          fgAtt: 0,
          ftMade: 0,
          ftAtt: 0,
        }
      }
      const agg = byPlayer[p.id]
      agg.games += 1
      agg.points += r.points || 0
      agg.rebounds += r.rebounds || 0
      agg.assists += r.assists || 0
      agg.steals += r.steals || 0
      agg.blocks += r.blocks || 0
      agg.turnovers += r.turnovers || 0
      agg.fgMade += (r.two_made || 0) + (r.three_made || 0)
      agg.fgAtt += (r.two_att || 0) + (r.three_att || 0)
      agg.ftMade += r.ft_made || 0
      agg.ftAtt += r.ft_att || 0
    })

    return Object.values(byPlayer).map((p) => {
      const missedFg = p.fgAtt - p.fgMade
      const missedFt = p.ftAtt - p.ftMade
      // Standard box-score efficiency rating: production minus missed shots and turnovers.
      const eff = p.points + p.rebounds + p.assists + p.steals + p.blocks - missedFg - missedFt - p.turnovers
      return {
        ...p,
        ppg: p.games ? p.points / p.games : 0,
        rpg: p.games ? p.rebounds / p.games : 0,
        apg: p.games ? p.assists / p.games : 0,
        spg: p.games ? p.steals / p.games : 0,
        bpg: p.games ? p.blocks / p.games : 0,
        effpg: p.games ? eff / p.games : 0,
      }
    })
  }, [statsRows])

  const topScorers = useMemo(
    () => [...playerAgg].sort((a, b) => b.ppg - a.ppg).slice(0, 5),
    [playerAgg]
  )
  const topRebounders = useMemo(
    () => [...playerAgg].sort((a, b) => b.rpg - a.rpg).slice(0, 5),
    [playerAgg]
  )
  const topAssists = useMemo(
    () => [...playerAgg].sort((a, b) => b.apg - a.apg).slice(0, 5),
    [playerAgg]
  )
  const topSteals = useMemo(
    () => [...playerAgg].sort((a, b) => b.spg - a.spg).slice(0, 5),
    [playerAgg]
  )
  const top3Players = useMemo(
    () => [...playerAgg].sort((a, b) => b.effpg - a.effpg).slice(0, 3),
    [playerAgg]
  )

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

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Pace & Efficiency
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Pace"
          value={summary.pace == null ? '—' : summary.pace.toFixed(1)}
          sub="est. possessions per game"
        />
        <StatCard
          label="Off. Rating"
          value={summary.offRating == null ? '—' : summary.offRating.toFixed(1)}
          sub="points per 100 possessions"
        />
      </div>

      {top3Players.length > 0 && (
        <>
          <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
            Top 3 Players
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {top3Players.map((p, i) => (
              <div key={p.id} className="bg-panel border border-red/40 rounded-lg p-4 relative overflow-hidden">
                <span className="absolute top-3 right-4 font-display text-4xl font-bold text-line select-none">
                  {i + 1}
                </span>
                <p className="font-medium mb-0.5">
                  {p.jersey_number != null && (
                    <span className="text-chalkdim stat-figure mr-1.5">#{p.jersey_number}</span>
                  )}
                  {p.name}
                </p>
                <p className="text-xs text-chalkdim mb-3">{p.games} GP</p>
                <p className="text-xs text-chalkdim">
                  <span className="text-red font-semibold stat-figure">{p.ppg.toFixed(1)}</span> PPG ·{' '}
                  <span className="text-red font-semibold stat-figure">{p.rpg.toFixed(1)}</span> RPG ·{' '}
                  <span className="text-red font-semibold stat-figure">{p.apg.toFixed(1)}</span> APG
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
        Leaders by category
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <LeaderboardCard title="Scoring" players={topScorers} statKey="ppg" suffix="PPG" />
        <LeaderboardCard title="Rebounding" players={topRebounders} statKey="rpg" suffix="RPG" />
        <LeaderboardCard title="Assists" players={topAssists} statKey="apg" suffix="APG" />
        <LeaderboardCard title="Steals" players={topSteals} statKey="spg" suffix="SPG" />
      </div>

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
