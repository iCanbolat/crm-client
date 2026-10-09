/** CSV export helpers (submissions inbox, reports). */

/** RFC 4180 field: quoted when it holds a delimiter, quote or newline. */
function escapeCsv(value: string) {
  // Leading = + - @ would run as a formula in spreadsheets.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",;\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(rows: readonly (readonly string[])[]) {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")
}

/** Saves text as a file (UTF-8 BOM so Excel reads Turkish characters). */
export function downloadText(
  filename: string,
  content: string,
  type = "text/csv"
) {
  const blob = new Blob(["﻿", content], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
