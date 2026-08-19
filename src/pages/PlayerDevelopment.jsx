import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

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

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('player_game_stats')
        .select('*, game:game_id(id, game_date, season)')
        .eq('player_id', player.id)
      setStatsRows(data || [])
      setLoading(false)
    }
    load()
  }, [player.id])

  const summary = useMemo(() => {
    const games = statsRows.length
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
    }
  }, [statsRows])

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
      <button onClick={onBack} className="text-sm text-chalkdim hover:text-chalk mb-4">
        ← {team.name} roster
      </button>

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
          No box scores logged for {player.name} yet. Once stats are entered for a game they play in,
          their season line will show up here.
        </div>
      ) : (
        <>
          <p className="text-chalkdim text-sm mb-4">
            {summary.games} game{summary.games === 1 ? '' : 's'} played this season.
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
  )
}
