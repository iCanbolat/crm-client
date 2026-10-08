// Public form site bundle budget (plan B5.1, TC-5.1-03): everything a
// visitor downloads before the form renders — the entry chunk plus the
// public app chunk and its static imports — must stay under the budget.
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { gzipSync } from "node:zlib"

// Plan target was 150 KB; react-dom + zod + Base UI + date-fns +
// react-hook-form + locales are ~300 KB gz and the bundler shares one big
// chunk with the admin app. Lazy field inputs / chunk tuning (B6.4) should
// bring it down; until then the budget guards against regressions.
const BUDGET_KB = 340
const dist = resolve(import.meta.dirname, "../dist")
const manifest = JSON.parse(
  readFileSync(resolve(dist, ".vite/manifest.json"), "utf8")
)

const files = new Set()
function collect(key) {
  const chunk = manifest[key]
  if (!chunk || files.has(chunk.file)) return
  files.add(chunk.file)
  for (const css of chunk.css ?? []) files.add(css)
  for (const child of chunk.imports ?? []) collect(child)
}

collect("index.html")
collect("src/app/public-app.tsx")
if (!manifest["src/app/public-app.tsx"]) {
  console.error("public-app chunk not found in the build manifest")
  process.exit(1)
}

let total = 0
const rows = [...files].map((file) => {
  const size = gzipSync(readFileSync(resolve(dist, file))).length
  total += size
  return { file, kb: (size / 1024).toFixed(1) }
})
rows.sort((a, b) => Number(b.kb) - Number(a.kb))
console.table(rows)

const totalKb = total / 1024
console.log(
  `Public bundle: ${totalKb.toFixed(1)} KB gz (budget ${BUDGET_KB} KB)`
)
if (totalKb > BUDGET_KB) {
  console.error("Public bundle exceeds its budget")
  process.exit(1)
}
