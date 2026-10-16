/** "ENR-2026-0042" style numbers, sequential per prefix and year. */
export function formatFileNumber(
  prefix: string,
  year: number,
  sequence: number
) {
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`
}

export function nextFileNumber(
  prefix: string,
  existing: readonly unknown[],
  year: number
) {
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`)
  let max = 0
  for (const value of existing) {
    const match = typeof value === "string" ? pattern.exec(value) : null
    if (match) max = Math.max(max, Number(match[1]))
  }
  return formatFileNumber(prefix, year, max + 1)
}
