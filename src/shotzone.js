// Shot zone geometry for Hudl's "Shot Chart Report" PDF export.
//
// Each player's mini half-court diagram in that report is built from the
// same 14 fixed zone shapes, always at the same relative position within
// that player's chart. These polygon points were extracted directly from
// the PDF's vector paths (not eyeballed), so they match Hudl's own shapes
// exactly, including the diagonal edges where the three-point arc cuts
// through a zone. Points are relative to a chart origin of (0,0) at the
// top-left of that player's court diagram; the chart is 187 units wide by
// 125.7 units tall (matching PDF points from the source report).

export const CHART_WIDTH = 187.03
export const CHART_HEIGHT = 125.7

export const SHOT_ZONES = [
  {
    id: 'left_baseline',
    label: 'Left Baseline',
    type: '2PT',
    points: [[27.67, 38.53], [27.67, 65.09], [27.7, 65.15], [27.51, 65.25], [0.0, 65.25], [0.0, 0.2], [0.16, 0.04], [27.67, 0.04]],
  },
  {
    id: 'left_short_corner',
    label: 'Left Short Corner',
    type: '2PT',
    points: [[62.98, 0.2], [62.98, 38.53], [27.67, 38.53], [27.67, 0.2], [27.67, 0.04], [62.98, 0.04]],
  },
  {
    id: 'left_block',
    label: 'Left Block',
    type: '2PT',
    points: [[93.52, 0.2], [93.52, 38.53], [62.98, 38.53], [62.98, 0.2], [62.98, 0.04], [93.52, 0.04]],
  },
  {
    id: 'right_block',
    label: 'Right Block',
    type: '2PT',
    points: [[123.73, 0.2], [123.73, 38.53], [93.52, 38.53], [93.52, 0.2], [93.52, 0.04], [123.73, 0.04]],
  },
  {
    id: 'right_short_corner',
    label: 'Right Short Corner',
    type: '2PT',
    points: [[159.04, 0.2], [159.04, 38.53], [123.73, 38.53], [123.73, 0.2], [123.73, 0.04], [159.04, 0.04]],
  },
  {
    id: 'right_baseline',
    label: 'Right Baseline',
    type: '2PT',
    points: [[187.03, 0.2], [187.03, 65.25], [158.97, 65.25], [159.04, 65.09], [159.04, 0.2], [159.04, 0.04], [187.03, 0.04]],
  },
  {
    id: 'left_mid_range',
    label: 'Left Mid-Range',
    type: '2PT',
    points: [[62.98, 76.7], [62.98, 99.46], [27.7, 65.15], [27.67, 65.09], [27.67, 38.53], [62.98, 38.53]],
  },
  {
    id: 'left_elbow',
    label: 'Left Elbow',
    type: '2PT',
    points: [[93.52, 76.54], [93.52, 76.7], [62.98, 76.7], [62.98, 38.53], [93.2, 38.53], [93.52, 38.53]],
  },
  {
    id: 'right_elbow',
    label: 'Right Elbow',
    type: '2PT',
    points: [[123.73, 38.53], [123.73, 76.7], [93.52, 76.7], [93.52, 76.54], [93.52, 38.53]],
  },
  {
    id: 'right_mid_range',
    label: 'Right Mid-Range',
    type: '2PT',
    points: [[159.04, 65.09], [158.97, 65.25], [123.73, 99.46], [123.73, 76.7], [123.73, 38.53], [158.88, 38.53], [159.04, 38.53]],
  },
  {
    id: 'left_corner_3',
    label: 'Left Corner 3',
    type: '3PT',
    points: [[62.98, 99.46], [62.98, 125.68], [0.0, 125.68], [0.0, 65.25], [27.51, 65.25], [27.7, 65.15]],
  },
  {
    id: 'top_key_3',
    label: 'Top of Key 3',
    type: '3PT',
    points: [[123.73, 76.7], [123.73, 99.46], [93.52, 105.69], [93.2, 105.69], [62.98, 99.46], [62.98, 76.7], [93.52, 76.7]],
  },
  {
    id: 'deep_3',
    label: 'Deep 3',
    type: '3PT',
    points: [[123.73, 99.46], [123.73, 125.68], [62.98, 125.68], [62.98, 99.46], [93.2, 105.69], [93.52, 105.69]],
  },
  {
    id: 'right_corner_3',
    label: 'Right Corner 3',
    type: '3PT',
    points: [[187.03, 65.25], [187.03, 125.68], [123.73, 125.68], [123.73, 99.46], [158.97, 65.25], [186.87, 65.25]],
  },
]

// Ray-casting point-in-polygon test.
function pointInPolygon(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// Finds which of the 14 zones a point (relative to the chart origin) falls
// within. Returns null if the point doesn't land in any zone (shouldn't
// normally happen for well-formed input, but imports are best-effort).
export function findZone(relX, relY) {
  for (const zone of SHOT_ZONES) {
    if (pointInPolygon(relX, relY, zone.points)) return zone
  }
  return null
}

export function zoneById(id) {
  return SHOT_ZONES.find((z) => z.id === id) || null
}
