export function normalizeColumnWidths(widths: number[] | undefined, count: number): number[] {
  const values = Array.from({ length: count }, (_, i) => {
    const value = widths?.[i]
    return value && Number.isFinite(value) && value > 0 ? value : 100 / count
  })
  const total = values.reduce((sum, value) => sum + value, 0)
  return values.map(value => value / total * 100)
}

export function resizeColumnBoundary(widths: number[], column: number, delta: number, minimum: number): number[] {
  const next = [...widths]
  const pair = widths[column] + widths[column + 1]
  const min = Math.min(minimum, pair / 2)
  next[column] = Math.max(min, Math.min(pair - min, widths[column] + delta))
  next[column + 1] = pair - next[column]
  return next
}
