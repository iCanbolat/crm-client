import { resolve } from "node:path"

import { ESLint } from "eslint"
import { beforeAll, describe, expect, it } from "vitest"

const root = resolve(import.meta.dirname, "../..")
const BOUNDARY_RULE = "boundaries/dependencies"

let eslint: ESLint

/** Lints `code` as if it lived at `file` and returns boundary violations. */
async function violations(file: string, code: string) {
  const [result] = await eslint.lintText(code, {
    filePath: resolve(root, file),
  })
  return (result?.messages ?? []).filter(
    (message) => message.ruleId === BOUNDARY_RULE
  )
}

describe("architecture boundaries (eslint-plugin-boundaries)", () => {
  beforeAll(() => {
    eslint = new ESLint({ cwd: root })
  })

  it("TC-0.3-03 forbids deep imports into another feature", async () => {
    const result = await violations(
      "src/features/leads/components/lead-list.tsx",
      'import { fetchExamples } from "@/features/_example/api/example.api"\nexport const x = fetchExamples\n'
    )

    expect(result).toHaveLength(1)
    expect(result[0]?.message).toMatch(/Architecture boundary/)
  })

  it("TC-0.3-03 allows another feature's public API (index.ts)", async () => {
    expect(
      await violations(
        "src/features/leads/components/lead-list.tsx",
        'import { exampleQueries } from "@/features/_example"\nexport const x = exampleQueries\n'
      )
    ).toEqual([])
  })

  it("TC-0.3-03 allows relative imports inside the same feature", async () => {
    expect(
      await violations(
        "src/features/_example/components/new-widget.tsx",
        'import { exampleKeys } from "../api/example.keys"\nexport const x = exampleKeys\n'
      )
    ).toEqual([])
  })

  it("TC-0.3-03 forbids shared layers from importing features", async () => {
    const fromComponents = await violations(
      "src/components/common/widget.tsx",
      'import { ExamplesCard } from "@/features/_example"\nexport const x = ExamplesCard\n'
    )
    const fromLib = await violations(
      "src/lib/helper.ts",
      'import { ThemeToggle } from "@/components/common/theme-toggle"\nexport const x = ThemeToggle\n'
    )

    expect(fromComponents).toHaveLength(1)
    expect(fromLib).toHaveLength(1)
  })

  it("TC-0.3-03 forbids routes from importing feature internals or mocks", async () => {
    const result = await violations(
      "src/routes/leads.tsx",
      [
        'import { ExampleList } from "@/features/_example/components/example-list"',
        'import { db } from "@/mocks/db"',
        "export const x = [ExampleList, db]",
        "",
      ].join("\n")
    )

    expect(result).toHaveLength(2)
  })

  it("TC-0.3-03 lets feature mocks reach their own feature and the mock toolkit", async () => {
    expect(
      await violations(
        "src/features/_example/mocks/extra-handlers.ts",
        [
          'import { createExampleInputSchema } from "../api/example.schemas"',
          'import { db } from "@/mocks/db"',
          "export const x = [createExampleInputSchema, db]",
          "",
        ].join("\n")
      )
    ).toEqual([])
  })

  it("TC-0.3-03 keeps app code free of mock internals", async () => {
    const result = await violations(
      "src/features/_example/components/new-widget.tsx",
      'import { db } from "@/mocks/db"\nexport const x = db\n'
    )

    expect(result).toHaveLength(1)
  })

  it("TC-0.3-03 lets test files import anything", async () => {
    expect(
      await violations(
        "src/features/leads/__tests__/lead-list.test.tsx",
        [
          'import { exampleKeys } from "@/features/_example/api/example.keys"',
          'import { db } from "@/mocks/db"',
          'import { renderRoute } from "@/test/render"',
          "export const x = [exampleKeys, db, renderRoute]",
          "",
        ].join("\n")
      )
    ).toEqual([])
  })

  it("keeps features unaware of concrete modules (registry only)", async () => {
    const fromFeature = await violations(
      "src/features/shell/components/nav.tsx",
      'import { forwardingModule } from "@/modules/forwarding"\nexport const x = forwardingModule\n'
    )
    const viaRegistry = await violations(
      "src/features/shell/components/nav.tsx",
      'import { getModules } from "@/engine/modules"\nexport const x = getModules\n'
    )
    const fromApp = await violations(
      "src/app/modules.ts",
      'import { forwardingModule } from "@/modules/forwarding"\nexport const x = forwardingModule\n'
    )

    expect(fromFeature).toHaveLength(1)
    expect(viaRegistry).toEqual([])
    expect(fromApp).toEqual([])
  })

  it("keeps modules out of each other and out of the engine", async () => {
    const crossModule = await violations(
      "src/modules/visa-education/manifest.ts",
      'import { forwardingModule } from "@/modules/forwarding"\nexport const x = forwardingModule\n'
    )
    const fromEngine = await violations(
      "src/engine/modules/registry.ts",
      'import { forwardingModule } from "@/modules/forwarding"\nexport const x = forwardingModule\n'
    )

    expect(crossModule).toHaveLength(1)
    expect(fromEngine).toHaveLength(1)
  })

  it("keeps the CRM engine free of features (services are injected)", async () => {
    const result = await violations(
      "src/engine/field-types/core/reference.tsx",
      'import { recordQueries } from "@/features/records"\nexport const x = recordQueries\n'
    )
    expect(result).toHaveLength(1)
  })

  it("lets features build on each other only through public APIs", async () => {
    const deep = await violations(
      "src/features/pipelines/components/board.tsx",
      'import { useMoveStage } from "@/features/records/api/records.mutations"\nexport const x = useMoveStage\n'
    )
    const viaIndex = await violations(
      "src/features/pipelines/components/board.tsx",
      'import { useMoveStage } from "@/features/records"\nexport const x = useMoveStage\n'
    )
    expect(deep).toHaveLength(1)
    expect(viaIndex).toEqual([])
  })

  it("TC-3.1-04 keeps module mocks (seed + handlers) out of the module's runtime code", async () => {
    const fromMocks = await violations(
      "src/modules/forwarding/mocks/handlers.ts",
      [
        'import { db } from "@/mocks/db"',
        'import { calcCbm } from "../lib/cargo"',
        'import { recordsOf } from "@/features/records/mocks/store"',
        "export const x = [db, calcCbm, recordsOf]",
        "",
      ].join("\n")
    )
    const fromModule = await violations(
      "src/modules/forwarding/components/card.tsx",
      'import { seedQuotes } from "../mocks/seed"\nexport const x = seedQuotes\n'
    )
    const fromOtherModuleMocks = await violations(
      "src/modules/visa-education/mocks/handlers.ts",
      'import { calcCbm } from "@/modules/forwarding/lib/cargo"\nexport const x = calcCbm\n'
    )
    const fromMockToolkit = await violations(
      "src/mocks/handlers.ts",
      'import { forwardingHandlers } from "@/modules/forwarding/mocks/handlers"\nexport const x = forwardingHandlers\n'
    )

    expect(fromMocks).toEqual([])
    expect(fromModule).toHaveLength(1)
    expect(fromOtherModuleMocks).toHaveLength(1)
    expect(fromMockToolkit).toEqual([])
  })
})
