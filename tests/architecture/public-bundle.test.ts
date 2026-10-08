import { existsSync, readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"

import { describe, expect, it } from "vitest"

const root = resolve(import.meta.dirname, "../..")
const src = resolve(root, "src")
const entry = resolve(src, "app/public-app.tsx")

const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]

function resolveImport(from: string, specifier: string): string | null {
  let base: string
  if (specifier.startsWith("@/")) base = resolve(src, specifier.slice(2))
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier)
  else return null // package
  for (const extension of EXTENSIONS) {
    const candidate = base + extension
    if (existsSync(candidate) && /\.(ts|tsx)$/.test(candidate)) return candidate
  }
  return null // json, css, assets
}

/** Static (non-`import()`) dependency graph of the public app entry. */
function collectGraph(start: string) {
  const seen = new Set<string>()
  const queue = [start]
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const code = readFileSync(file, "utf8")
    const specifiers = [
      ...code.matchAll(
        /(?:^|\n)\s*(?:import|export)[^"';]*?from\s+["']([^"']+)["']/g
      ),
      ...code.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g),
    ].map((match) => match[1]!)
    for (const specifier of specifiers) {
      // Type-only imports are erased at build time.
      const resolved = resolveImport(file, specifier)
      if (resolved) queue.push(resolved)
    }
  }
  return [...seen].map((file) => relative(root, file))
}

/** Admin-only code that must stay out of the public chunk. */
const FORBIDDEN = [
  /^src\/routes\//,
  /^src\/mocks\//,
  /^src\/app\/(admin-app|router|modules)\.tsx?$/,
  /^src\/features\/(?!public-site|form-renderer)[^/]+\//,
  /^src\/modules\/[^/]+\/(manifest|components|widgets|mocks)/,
]

describe("public bundle (B5.1)", () => {
  it("TC-5.1-03 the public app imports no admin modules", () => {
    const graph = collectGraph(entry)
    expect(graph).toContain("src/modules/forwarding/field-types/location.tsx")
    const offending = graph.filter((file) =>
      FORBIDDEN.some((pattern) => pattern.test(file))
    )
    expect(offending).toEqual([])
  })
})
