import {
  evaluateOperator,
  isConditionComplete,
  type Condition,
  type FilterOperator,
} from "../logic/conditions"
import {
  getAnswerType,
  getEngineType,
  getStepFields,
  isAnswerField,
} from "./kinds"
import type {
  FormAnswers,
  FormContent,
  FormField,
  FormLogicRule,
} from "./schemas"

/**
 * Conditional logic of forms (B4.4) on top of the shared condition
 * evaluator (`engine/logic`). A target is visible when no `show` rule
 * targets it or one of them matches, and no `hide` rule matches. Answers of
 * hidden fields count as empty for the rules that depend on them.
 */

/** Operators offered by the rule editor, in display order. */
export const FORM_LOGIC_OPERATORS: readonly FilterOperator[] = [
  "eq",
  "neq",
  "in",
  "notIn",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "before",
  "after",
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
]

/** Operators a rule may use on the field (by its answer type). */
export function getLogicOperators(field: FormField): FilterOperator[] {
  const available = new Set<FilterOperator>(
    getAnswerType(field).filterOperators
  )
  // A single choice reads naturally as "mode = Air".
  if (getEngineType(field.type) === "select") {
    available.add("eq")
    available.add("neq")
  }
  return FORM_LOGIC_OPERATORS.filter((op) => available.has(op))
}

export interface FormLogicState {
  /** Ids of fields not shown (own rules or a hidden step). */
  hiddenFields: Set<string>
  hiddenSteps: Set<string>
  /** Ids of fields a matching `require` rule makes mandatory. */
  requiredFields: Set<string>
}

function conditionHolds(
  fields: Map<string, FormField>,
  answers: FormAnswers,
  hidden: Set<string>,
  condition: Condition
) {
  const field = fields.get(condition.field)
  // Unfinished draft conditions never match.
  if (!field || !isAnswerField(field) || !isConditionComplete(condition)) {
    return false
  }
  const value = hidden.has(field.id) ? null : answers[field.key]
  return evaluateOperator(
    condition.op,
    getAnswerType(field).toComparable(value),
    condition.value
  )
}

export function ruleMatches(
  rule: FormLogicRule,
  fields: Map<string, FormField>,
  answers: FormAnswers,
  hidden: Set<string> = new Set()
) {
  const results = rule.conditions.map((condition) =>
    conditionHolds(fields, answers, hidden, condition)
  )
  return rule.match === "all" ? results.every(Boolean) : results.some(Boolean)
}

function targetsOf(rules: FormLogicRule[], kind: "field" | "step") {
  const byTarget = new Map<string, FormLogicRule[]>()
  for (const rule of rules) {
    for (const target of rule.targets) {
      if (target.kind !== kind) continue
      byTarget.set(target.id, [...(byTarget.get(target.id) ?? []), rule])
    }
  }
  return byTarget
}

function isShown(
  rules: FormLogicRule[] | undefined,
  matches: (rule: FormLogicRule) => boolean
) {
  if (!rules?.length) return true
  const show = rules.filter((rule) => rule.action === "show")
  const hide = rules.filter((rule) => rule.action === "hide")
  return (show.length === 0 || show.some(matches)) && !hide.some(matches)
}

/**
 * Visibility and logic-driven requirements for the current answers. Chains
 * (A shows B, B shows C) settle within as many passes as the chain is long;
 * cyclic rules cannot be published (`detectLogicCycles`), the pass limit only
 * keeps a draft from looping.
 */
export function evaluateFormLogic(
  content: FormContent,
  answers: FormAnswers
): FormLogicState {
  const fields = new Map(content.fields.map((field) => [field.id, field]))
  const visibilityRules = content.logic.filter(
    (rule) => rule.action !== "require"
  )
  const fieldRules = targetsOf(visibilityRules, "field")
  const stepRules = targetsOf(visibilityRules, "step")

  let hiddenFields = new Set<string>()
  let hiddenSteps = new Set<string>()
  const maxPasses = content.fields.length + content.steps.length + 1

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const hidden = hiddenFields
    const cache = new Map<string, boolean>()
    const matches = (rule: FormLogicRule) => {
      let result = cache.get(rule.id)
      if (result === undefined) {
        result = ruleMatches(rule, fields, answers, hidden)
        cache.set(rule.id, result)
      }
      return result
    }

    const nextSteps = new Set(
      content.steps
        .filter((step) => !isShown(stepRules.get(step.id), matches))
        .map((step) => step.id)
    )
    const nextFields = new Set(
      content.fields
        .filter(
          (field) =>
            nextSteps.has(field.stepId) ||
            !isShown(fieldRules.get(field.id), matches)
        )
        .map((field) => field.id)
    )

    const stable =
      sameSet(nextFields, hiddenFields) && sameSet(nextSteps, hiddenSteps)
    hiddenFields = nextFields
    hiddenSteps = nextSteps
    if (stable) break
  }

  const requiredFields = new Set<string>()
  for (const rule of content.logic) {
    if (rule.action !== "require") continue
    if (!ruleMatches(rule, fields, answers, hiddenFields)) continue
    for (const target of rule.targets) {
      const ids =
        target.kind === "field"
          ? [target.id]
          : getStepFields(content, target.id).map((field) => field.id)
      for (const id of ids) requiredFields.add(id)
    }
  }

  return { hiddenFields, hiddenSteps, requiredFields }
}

function sameSet(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((item) => b.has(item))
}

/** Field ids a show/hide rule's targets cover (a step covers its fields). */
function targetFieldIds(content: FormContent, rule: FormLogicRule) {
  return rule.targets.flatMap((target) =>
    target.kind === "field"
      ? [target.id]
      : getStepFields(content, target.id).map((field) => field.id)
  )
}

/**
 * Cycles among show/hide rules (A hides B while B shows A, a field hiding
 * itself, …). Each cycle is listed once as the field ids along it.
 */
export function detectLogicCycles(content: FormContent): string[][] {
  const edges = new Map<string, Set<string>>()
  for (const rule of content.logic) {
    if (rule.action === "require") continue
    const targets = targetFieldIds(content, rule)
    for (const condition of rule.conditions) {
      const next = edges.get(condition.field) ?? new Set<string>()
      for (const target of targets) next.add(target)
      edges.set(condition.field, next)
    }
  }

  const cycles: string[][] = []
  const seen = new Set<string>()
  const state = new Map<string, "visiting" | "done">()
  const path: string[] = []

  function visit(node: string) {
    state.set(node, "visiting")
    path.push(node)
    for (const next of edges.get(node) ?? []) {
      const nextState = state.get(next)
      if (nextState === "visiting") {
        const cycle = path.slice(path.indexOf(next))
        const signature = [...cycle].sort().join("|")
        if (!seen.has(signature)) {
          seen.add(signature)
          cycles.push(cycle)
        }
      } else if (nextState === undefined) {
        visit(next)
      }
    }
    path.pop()
    state.set(node, "done")
  }

  for (const node of edges.keys()) {
    if (!state.has(node)) visit(node)
  }
  return cycles
}

export interface BrokenLogicRef {
  ruleId: string
  /** Missing (or non-answer) field / step id. */
  ref: string
  kind: "condition" | "target"
}

/** Rule references to deleted fields/steps or to layout blocks. */
export function findBrokenLogicRefs(content: FormContent): BrokenLogicRef[] {
  const fields = new Map(content.fields.map((field) => [field.id, field]))
  const steps = new Set(content.steps.map((step) => step.id))
  const broken: BrokenLogicRef[] = []
  for (const rule of content.logic) {
    for (const condition of rule.conditions) {
      const field = fields.get(condition.field)
      if (!field || !isAnswerField(field)) {
        broken.push({
          ruleId: rule.id,
          ref: condition.field,
          kind: "condition",
        })
      }
    }
    for (const target of rule.targets) {
      const exists =
        target.kind === "field" ? fields.has(target.id) : steps.has(target.id)
      if (!exists) {
        broken.push({ ruleId: rule.id, ref: target.id, kind: "target" })
      }
    }
  }
  return broken
}

/** Draft rules not ready to publish: no target or an unfinished condition. */
export function findIncompleteRules(content: FormContent): string[] {
  return content.logic
    .filter(
      (rule) =>
        rule.targets.length === 0 ||
        rule.conditions.some((condition) => !isConditionComplete(condition))
    )
    .map((rule) => rule.id)
}
