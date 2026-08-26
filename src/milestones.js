// Computes celebratory milestones from a player's game log — separate from
// basketballInsights.js, which is about corrective feedback. This is pure
// computation over stats already in CourtVision, not a new data source.

const STAT_CATEGORIES = ['points', 'rebounds', 'assists', 'steals', 'blocks']
const POINT_MILESTONES = [50, 100, 150, 200, 250, 300, 350, 400, 500, 600, 750, 1000]

function opponentName(row, teamId) {
  const g = row.game
  if (!g) return null
  return g.home_team_id === teamId ? g.away_team?.name : g.home_team?.name
}

function highestGame(rows, field) {
  let best = null
  rows.forEach((row) => {
    if (!best || (row[field] || 0) > (best[field] || 0)) best = row
  })
  return best
}

// statsRows: player_game_stats rows, each with a joined `game` object
//   containing { game_date, home_team_id, away_team_id, home_team, away_team }
// teamId: the player's own team id, used to determine the opponent's name
export function generateMilestones(statsRows, teamId) {
  if (!statsRows || statsRows.length === 0) {
    return { badges: [], seasonHighs: {} }
  }

  let doubleDoubles = 0
  let tripleDoubles = 0
  statsRows.forEach((row) => {
    const doubleDigitCount = STAT_CATEGORIES.filter((c) => (row[c] || 0) >= 10).length
    if (doubleDigitCount >= 3) tripleDoubles += 1
    else if (doubleDigitCount === 2) doubleDoubles += 1
  })

  const totalPoints = statsRows.reduce((sum, r) => sum + (r.points || 0), 0)
  const highestMilestone = [...POINT_MILESTONES].reverse().find((m) => totalPoints >= m) || null

  const badges = []
  if (tripleDoubles > 0) {
    badges.push({
      label: `${tripleDoubles} Triple-Double${tripleDoubles > 1 ? 's' : ''}`,
      detail: 'At least 10 in three different statistical categories in a single game.',
    })
  }
  if (doubleDoubles > 0) {
    badges.push({
      label: `${doubleDoubles} Double-Double${doubleDoubles > 1 ? 's' : ''}`,
      detail: 'At least 10 in two different statistical categories in a single game.',
    })
  }
  if (highestMilestone) {
    badges.push({
      label: `${highestMilestone}+ Points`,
      detail: `${totalPoints} total points scored.`,
    })
  }

  function seasonHighEntry(field) {
    const row = highestGame(statsRows, field)
    if (!row || !(row[field] > 0)) return null
    return { value: row[field], opponent: opponentName(row, teamId), date: row.game?.game_date }
  }

  return {
    badges,
    seasonHighs: {
      points: seasonHighEntry('points'),
      rebounds: seasonHighEntry('rebounds'),
      assists: seasonHighEntry('assists'),
    },
  }
}
