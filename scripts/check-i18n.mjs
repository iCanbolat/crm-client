// i18n completeness (B7.4, TC-7.4-01): TR and EN define the same namespaces
// and keys, no value is empty, both languages use the same {{variables}},
// and every literal `t("namespace:key")` in the source exists.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const LANGUAGES = ["tr", "en"]
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function flatten(value, prefix = "", out = new Map()) {
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out)
    }
  } else {
    out.set(prefix, value)
  }
  return out
}

const variables = (text) =>
  [...String(text).matchAll(/\{\{\s*([\w.]+)\s*(?:,[^}]*)?\}\}/g)]
    .map((match) => match[1])
    .sort()
    .join(",")

function loadLocales(localesDir) {
  const locales = {}
  for (const language of LANGUAGES) {
    locales[language] = {}
    for (const file of readdirSync(join(localesDir, language))) {
      if (!file.endsWith(".json")) continue
      const namespace = file.slice(0, -".json".length)
      locales[language][namespace] = flatten(
        JSON.parse(readFileSync(join(localesDir, language, file), "utf8"))
      )
    }
  }
  return locales
}

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry !== "__tests__" && entry !== "locales") yield* sourceFiles(path)
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      yield path
    }
  }
}

/** Returns human readable problems; empty when the locales are complete. */
export function checkI18n(root) {
  const problems = []
  const locales = loadLocales(join(root, "src/locales"))
  const [base, other] = LANGUAGES
  const namespaces = new Set([
    ...Object.keys(locales[base]),
    ...Object.keys(locales[other]),
  ])

  for (const namespace of [...namespaces].sort()) {
    const a = locales[base][namespace]
    const b = locales[other][namespace]
    if (!a || !b) {
      problems.push(`${namespace}: missing in ${a ? other : base}`)
      continue
    }
    for (const [key, value] of a) {
      if (!b.has(key)) problems.push(`${other}:${namespace}:${key} missing`)
      else if (variables(value) !== variables(b.get(key))) {
        problems.push(
          `${namespace}:${key} variables differ (${base}: ${variables(value) || "-"}, ${other}: ${variables(b.get(key)) || "-"})`
        )
      }
    }
    for (const key of b.keys()) {
      if (!a.has(key)) problems.push(`${base}:${namespace}:${key} missing`)
    }
    for (const language of LANGUAGES) {
      for (const [key, value] of locales[language][namespace]) {
        if (value === "") problems.push(`${language}:${namespace}:${key} empty`)
      }
    }
  }

  // Literal `t("ns:key")` calls (dynamic keys are covered by the tests).
  const known = locales[base]
  const exists = (namespace, key) => {
    const keys = known[namespace]
    if (keys.has(key)) return true
    // Plural forms (`count_one`) and objects (`types.task`) are valid too.
    for (const candidate of keys.keys()) {
      if (candidate.replace(PLURAL_SUFFIX, "") === key) return true
      if (candidate.startsWith(`${key}.`)) return true
    }
    return false
  }
  for (const file of sourceFiles(join(root, "src"))) {
    const code = readFileSync(file, "utf8")
    for (const match of code.matchAll(
      /(?:\bt|i18n\.t)\(\s*["'`]([a-z]+):([\w.]+)["'`]/g
    )) {
      const [, namespace, key] = match
      if (!known[namespace] || key.endsWith(".")) continue
      if (!exists(namespace, key)) {
        problems.push(`${relative(root, file)}: unknown key ${namespace}:${key}`)
      }
    }
  }
  return problems
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, "..")
  const problems = checkI18n(root)
  if (problems.length) {
    console.error(problems.join("\n"))
    console.error(`✗ i18n: ${problems.length} problem(s)`)
    process.exit(1)
  }
  console.log("✓ i18n: TR and EN complete")
}
