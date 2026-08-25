// A rules-based insight engine, not a machine-learning model: every flag
// here is a specific, checkable threshold drawn from well-established
// basketball analytics principles (shot value, free-throw rate, ball
// security relative to usage), applied to a player's actual CourtVision
// data. Thresholds are set for a reasonable youth/high-school level of
// play, not NBA benchmarks — they're a starting point for a conversation,
// not a verdict. Every rule requires a minimum sample size before firing,
// so a single unlucky (or lucky) game can't produce a false flag.

const MIN_GAMES = 3
const MIN_ZONE_ATTEMPTS = 5
const MIN_FGA_FOR_RATE_RULES = 15

const CLOSE_2_ZONES = new Set([
  'left_baseline', 'left_short_corner', 'left_block',
  'right_block', 'right_short_corner', 'right_baseline',
])
const LONG_2_ZONES = new Set([
  'left_mid_range', 'left_elbow', 'right_elbow', 'right_mid_range',
])

function sumZones(shotAgg, zoneIds) {
  let made = 0
  let attempted = 0
  zoneIds.forEach((id) => {
    const z = shotAgg[id]
    if (z) {
      made += z.made || 0
      attempted += z.attempted || 0
    }
  })
  return { made, attempted }
}

const ZONE_LABELS = {
  left_baseline: 'the left baseline', left_short_corner: 'the left short corner',
  left_block: 'the left block', right_block: 'the right block',
  right_short_corner: 'the right short corner', right_baseline: 'the right baseline',
  left_mid_range: 'the left mid-range', left_elbow: 'the left elbow',
  right_elbow: 'the right elbow', right_mid_range: 'the right mid-range',
  left_corner_3: 'the left corner three', top_key_3: 'the top of the key three',
  deep_3: 'deep three-point range', right_corner_3: 'the right corner three',
}

// summary: the per-player stat summary already computed in PlayerDevelopment
//   (expects games, ppg, apg, mpg, rpg plus raw totals: totalFga, totalFta,
//   totalFtMade, totalThreeAtt, totalThreeMade, totalTurnovers, totalAssists)
// shotAgg: { [zoneId]: { made, attempted } } from the player's shot chart data
export function generateInsights(summary, shotAgg = {}) {
  const insights = []
  if (!summary || summary.games < MIN_GAMES) return insights

  const { games, totalFga = 0, totalFta = 0, totalFtMade = 0, totalThreeAtt = 0,
    totalThreeMade = 0, totalTurnovers = 0, totalAssists = 0, ppg, apg, mpg, rpg } = summary

  // --- Shot selection: long twos vs. everything else ---
  // The long two (mid-range/elbow, inside the arc but away from the rim) is
  // the lowest-value shot in the sport per possession — worth less than a
  // three and generally lower-percentage than a shot at the rim. A player
  // leaning on it heavily, without shooting it well, is giving up value on
  // every one of those possessions.
  const closeTwos = sumZones(shotAgg, [...CLOSE_2_ZONES])
  const longTwos = sumZones(shotAgg, [...LONG_2_ZONES])
  const totalTwoAtt = closeTwos.attempted + longTwos.attempted
  if (totalTwoAtt >= MIN_ZONE_ATTEMPTS && longTwos.attempted >= MIN_ZONE_ATTEMPTS) {
    const longTwoShare = longTwos.attempted / totalTwoAtt
    const longTwoPct = (longTwos.made / longTwos.attempted) * 100
    if (longTwoShare >= 0.4 && longTwoPct < 38) {
      insights.push({
        title: 'Leaning on the long two-pointer',
        detail: `${(longTwoShare * 100).toFixed(0)}% of two-point attempts are mid-range/elbow shots, made at ${longTwoPct.toFixed(0)}%. This is the lowest-value shot in basketball — work on either attacking closer to the rim or extending out to the three-point line.`,
      })
    }
  }

  // --- Cold zones with real volume ---
  // Only flags a zone if there's enough volume for the percentage to mean
  // something (5+ attempts), and the percentage is meaningfully below a
  // sustainable rate for that shot type.
  Object.entries(shotAgg).forEach(([zoneId, stat]) => {
    if (!stat || stat.attempted < MIN_ZONE_ATTEMPTS) return
    const zonePct = (stat.made / stat.attempted) * 100
    const isThree = ['left_corner_3', 'top_key_3', 'deep_3', 'right_corner_3'].includes(zoneId)
    const threshold = isThree ? 28 : 40
    if (zonePct < threshold) {
      insights.push({
        title: `Cold zone: ${ZONE_LABELS[zoneId] || zoneId}`,
        detail: `${stat.made}/${stat.attempted} (${zonePct.toFixed(0)}%) from this spot — real volume, but well below a sustainable rate. Worth extra reps from this exact area.`,
      })
    }
  })

  // --- Three-point volume vs. efficiency ---
  if (totalThreeAtt >= MIN_ZONE_ATTEMPTS && totalFga >= MIN_FGA_FOR_RATE_RULES) {
    const threeShare = totalThreeAtt / totalFga
    const threePct = (totalThreeMade / totalThreeAtt) * 100
    if (threeShare >= 0.3 && threePct < 28) {
      insights.push({
        title: 'High three-point volume, low efficiency',
        detail: `Threes make up ${(threeShare * 100).toFixed(0)}% of shot attempts but are only falling at ${threePct.toFixed(0)}%. Prioritize shot mechanics and shot selection on threes before adding more volume.`,
      })
    }
  }

  // --- Free throw rate (how often they get to the line) ---
  // A low free-throw rate relative to real scoring volume usually means a
  // player is settling for jumpers rather than putting pressure on the rim.
  if (totalFga >= MIN_FGA_FOR_RATE_RULES && ppg >= 8) {
    const ftRate = totalFta / totalFga
    if (ftRate < 0.2) {
      insights.push({
        title: 'Low free-throw rate for a primary scorer',
        detail: `Only drawing ${(ftRate * 100).toFixed(0)} free throw attempts per 100 shots attempted, despite averaging ${ppg.toFixed(1)} PPG. Attacking the rim more and drawing contact would add efficient, low-risk points.`,
      })
    }
  }

  // --- Free throw shooting itself ---
  if (totalFta >= 10) {
    const ftPct = (totalFtMade / totalFta) * 100
    if (ftPct < 65) {
      insights.push({
        title: 'Free throw percentage below expectations',
        detail: `${totalFtMade}/${totalFta} (${ftPct.toFixed(0)}%) at the line. This is one of the most trainable skills in basketball — dedicated reps here convert directly into points without needing a single new possession.`,
      })
    }
  }

  // --- Ball security relative to playmaking ---
  // Turnovers alone are a weak signal (a high-usage ball-handler will
  // naturally have more of them). Pairing turnover volume with a low
  // assist total is a better indicator of live-ball ball-security issues
  // rather than simply "this player handles the ball a lot."
  const topg = totalTurnovers / games
  if (topg >= 2.5 && apg < 2) {
    insights.push({
      title: 'Turnover rate high relative to playmaking',
      detail: `Averaging ${topg.toFixed(1)} turnovers per game without a high assist total (${apg.toFixed(1)} APG) suggests these are more often live-ball/handling turnovers than playmaking risk. Ball-security fundamentals — strong hands, protecting the ball in traffic — would show up quickly here.`,
    })
  }

  // --- Rebounding relative to minutes played ---
  if (mpg >= 20 && rpg < 2) {
    insights.push({
      title: 'Rebounding involvement is low for the minutes played',
      detail: `${rpg.toFixed(1)} RPG across ${mpg.toFixed(0)} minutes per game is light. Box-out positioning and pursuing long rebounds are learnable habits that add extra possessions without needing more athleticism.`,
    })
  }

  return insights
}
