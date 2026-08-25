import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { usePlayerShotZoneData, ShotChartSvg } from './ShotChart'

export default function TeamShotCharts({ team }) {
  const { loading, byPlayer, reload } = usePlayerShotZoneData(team)

  return (
    <div>
      <p className="text-chalkdim text-sm mb-6">
        Each player's individual shot chart, from every game you've imported for them. Toggle a
        player off to leave them out of the combined chart shown on the Scouting Report and its
        printout.
      </p>

      {loading ? (
        <p className="text-chalkdim">Loading…</p>
      ) : byPlayer.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim">
          No shot chart data imported yet for {team.name}. Import a Hudl shot chart PDF from any of
          their logged games to see individual player charts here.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {byPlayer.map((entry) => (
            <PlayerShotCard key={entry.player.id} entry={entry} onToggled={reload} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlayerShotCard({ entry, onToggled }) {
  const { player, aggregated, made, attempted } = entry
  const [saving, setSaving] = useState(false)
  const included = player.include_in_scouting_report

  async function toggle() {
    setSaving(true)
    await supabase
      .from('players')
      .update({ include_in_scouting_report: !included })
      .eq('id', player.id)
    setSaving(false)
    onToggled()
  }

  return (
    <div className={`bg-panel border rounded-lg p-4 ${included ? 'border-line' : 'border-line opacity-50'}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-sm">
          {player.jersey_number != null && (
            <span className="text-chalkdim stat-figure mr-1.5">#{player.jersey_number}</span>
          )}
          {player.name}
        </p>
        <span className="stat-figure text-xs text-chalkdim">
          {made}/{attempted} ({((made / attempted) * 100).toFixed(0)}%)
        </span>
      </div>
      <ShotChartSvg aggregated={aggregated} variant="dark" className="w-full" />
      <button
        onClick={toggle}
        disabled={saving}
        className={`w-full mt-3 text-xs font-semibold rounded-md px-3 py-1.5 disabled:opacity-60 ${
          included
            ? 'bg-panel2 border border-line text-chalkdim hover:border-alert hover:text-alert'
            : 'bg-red text-white hover:bg-red/90'
        }`}
      >
        {saving ? 'Saving…' : included ? 'Included in Scouting Report — click to exclude' : 'Excluded — click to include'}
      </button>
    </div>
  )
}
