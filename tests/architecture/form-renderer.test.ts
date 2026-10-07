import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

import { describe, expect, it } from "vitest"

const root = resolve(import.meta.dirname, "../..")
const rendererDir = resolve(root, "src/features/form-renderer")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return name === "__tests__" ? [] : sourceFiles(path)
    }
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe("form renderer isolation (Faz 5 public bundle)", () => {
  it("TC-4.1-04 the renderer core imports no feature or module code", () => {
    const offending = sourceFiles(rendererDir).flatMap((file) => {
      const code = readFileSync(file, "utf8")
      const imports = [
        ...code.matchAll(
          /from\s+["'](@\/(?:features|modules|mocks|app)\/[^"']*)["']/g
        ),
      ]
      return imports.map((match) => `${relative(root, file)} → ${match[1]}`)
    })
    expect(offending).toEqual([])
  })
})
