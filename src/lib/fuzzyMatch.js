// Scores how well `query` matches `name`: an exact substring beats a fuzzy
// (typo-tolerant) subsequence match, so close-but-imperfect spellings still
// surface in search results. Returns -1 when there's no match at all.
export function matchScore(name, query) {
  const n = (name || '').toLowerCase()
  const q = (query || '').toLowerCase().trim()
  if (!q) return 0
  if (n.includes(q)) return 100 - Math.abs(n.length - q.length)

  let qi = 0
  for (let i = 0; i < n.length && qi < q.length; i++) {
    if (n[i] === q[qi]) qi++
  }
  return qi === q.length ? 50 - Math.abs(n.length - q.length) * 0.1 : -1
}

export function fuzzyFilter(list, query, getName) {
  if (!query.trim()) return list
  return list
    .map((item) => ({ item, score: matchScore(getName(item), query) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item)
}
