// ---- Team name matching ----
// Kept identical in src/teamMatching.js and api/cron/check-scores.js.
// OSSAA (and coaches) sometimes include a mascot — "Elgin Owls" — where
// CourtVision just has "Elgin". Names match when one is the same as, or
// begins with, the other, compared word by word. "Elgin Owls" matches
// "Elgin"; "Southeast" does NOT match "South".
function nameWords(name) {
  return (name || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
}

function isWordPrefix(shorter, longer) {
  return shorter.length > 0 && shorter.length <= longer.length && shorter.every((w, i) => w === longer[i])
}

function matchScore(rawWords, teamWords) {
  if (rawWords.length === 0 || teamWords.length === 0) return 0
  if (rawWords.join('') === teamWords.join('')) return 1000 // same name (ignoring spacing/punctuation)
  if (isWordPrefix(teamWords, rawWords)) return teamWords.length * 10 // raw has extra words (a mascot)
  if (isWordPrefix(rawWords, teamWords)) return rawWords.length * 10 - 1 // our team name has extra words
  return 0
}

// Returns the single best matching team, or null if nothing matches or two
// teams tie (better to ask than to guess).
function findTeamMatch(raw, teams) {
  const rawWords = nameWords(raw)
  let best = null
  let bestScore = 0
  let tie = false
  for (const team of teams || []) {
    const score = matchScore(rawWords, nameWords(team.name))
    if (score === 0) continue
    if (score > bestScore) {
      best = team
      bestScore = score
      tie = false
    } else if (score === bestScore) {
      tie = true
    }
  }
  return best && !tie ? best : null
}

function namesMatch(a, b) {
  return matchScore(nameWords(a), nameWords(b)) > 0
}
// ---- end team name matching ----

export { nameWords, findTeamMatch, namesMatch }
