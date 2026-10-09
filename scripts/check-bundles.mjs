// Bundle budgets (plan B5.1 / B7.4, TC-5.1-03): what a visitor downloads
// before the first screen renders — the entry chunk plus the app chunk and
// its static imports (lazy routes and admin locales are not counted).
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { gzipSync } from "node:zlib"

// Public: react-dom, zod, Base UI, date-fns, react-hook-form and the core
// locales are ~300 KB gz; admin namespaces load with the admin app (B7.4).
// Admin: shell, router, query client, UI kit and the feature barrels the
// shell imports (breadcrumbs, bell); recharts loads with charts only.
// Measured 2026-10-09: public 317 KB, admin 547 KB — budgets guard regressions.
const BUDGETS_KB = {
  "src/app/public-app.tsx": 325,
  "src/app/admin-app.tsx": 560,
}

const dist = resolve(import.meta.dirname, "../dist")
const manifest = JSON.parse(
  readFileSync(resolve(dist, ".vite/manifest.json"), "utf8")
)

function measure(entry) {
  if (!manifest[entry]) {
    console.error(`${entry} chunk not found in the build manifest`)
    process.exit(1)
  }
  const files = new Set()
  const collect = (key) => {
    const chunk = manifest[key]
    if (!chunk || files.has(chunk.file)) return
    files.add(chunk.file)
    for (const css of chunk.css ?? []) files.add(css)
    for (const child of chunk.imports ?? []) collect(child)
  }
  collect("index.html")
  collect(entry)
  let total = 0
  const rows = [...files].map((file) => {
    const size = gzipSync(readFileSync(resolve(dist, file))).length
    total += size
    return { file, kb: (size / 1024).toFixed(1) }
  })
  rows.sort((a, b) => Number(b.kb) - Number(a.kb))
  return { rows, kb: total / 1024 }
}

let failed = false
for (const [entry, budget] of Object.entries(BUDGETS_KB)) {
  const { rows, kb } = measure(entry)
  if (process.argv.includes("--verbose")) console.table(rows)
  const ok = kb <= budget
  console.log(
    `${ok ? "✓" : "✗"} ${entry}: ${kb.toFixed(1)} KB gz (budget ${budget} KB)`
  )
  failed ||= !ok
}
if (failed) {
  console.error("A bundle exceeds its budget")
  process.exit(1)
}
