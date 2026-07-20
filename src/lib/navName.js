export function splitStoreName(name, lineCount) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const n = Math.max(1, Math.min(lineCount, words.length))
  if (n === 1) return [words.join(' ')]

  const base = Math.floor(words.length / n)
  const extra = words.length % n
  const lines = []
  let idx = 0
  for (let i = 0; i < n; i += 1) {
    const count = base + (i < extra ? 1 : 0)
    lines.push(words.slice(idx, idx + count).join(' '))
    idx += count
  }
  return lines
}
