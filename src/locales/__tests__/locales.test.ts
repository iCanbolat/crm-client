import { describe, expect, it } from "vitest"

import { resources, supportedLanguages } from "@/locales"

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix]
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  )
}

describe("locales", () => {
  const namespaces = Object.keys(resources.tr) as (keyof typeof resources.tr)[]

  it.each(supportedLanguages)(
    "TC-0.2-05 %s defines every namespace",
    (language) => {
      expect(Object.keys(resources[language]).sort()).toEqual(
        [...namespaces].sort()
      )
    }
  )

  it.each(namespaces)(
    "TC-0.2-05 '%s' has identical keys in TR and EN",
    (namespace) => {
      expect(flattenKeys(resources.en[namespace]).sort()).toEqual(
        flattenKeys(resources.tr[namespace]).sort()
      )
    }
  )

  it.each(namespaces)(
    "TC-0.2-05 '%s' has no empty translations",
    (namespace) => {
      for (const language of supportedLanguages) {
        const empty = flattenKeys(resources[language][namespace]).filter(
          (key) =>
            key
              .split(".")
              .reduce<unknown>(
                (node, part) => (node as Record<string, unknown>)[part],
                resources[language][namespace]
              ) === ""
        )
        expect(empty, `${language}:${namespace}`).toEqual([])
      }
    }
  )
})
