import {
  instantiateBlock,
  newFormElementId,
  uniqueAnswerKey,
  type FormBlockDef,
  type FormContent,
  type FormField,
  type FormLogicRule,
  type FormStep,
} from "@/engine/forms"

/**
 * Pure edits of a form draft (B4.2). The builder store applies them; every
 * function returns new content and keeps rules and mapping consistent.
 */

export function takenKeys(content: FormContent, exceptId?: string) {
  return new Set(
    content.fields
      .filter((field) => field.id !== exceptId)
      .map((field) => field.key)
  )
}

export function stepFields(content: FormContent, stepId: string) {
  return content.fields.filter((field) => field.stepId === stepId)
}

/** Inserts `fields` into a step before its `index`-th field (end if omitted). */
export function insertFields(
  content: FormContent,
  fields: FormField[],
  { stepId, index }: { stepId: string; index?: number }
): FormContent {
  const placed = fields.map((field) => ({ ...field, stepId }))
  const inStep = stepFields(content, stepId)
  const before = index === undefined ? undefined : inStep[index]
  const all = [...content.fields]
  if (before) {
    all.splice(all.indexOf(before), 0, ...placed)
  } else if (inStep.length) {
    all.splice(all.indexOf(inStep[inStep.length - 1]!) + 1, 0, ...placed)
  } else {
    // Empty step: keep step order in the flat list.
    const stepIndex = content.steps.findIndex((step) => step.id === stepId)
    const next = all.findIndex(
      (field) =>
        content.steps.findIndex((step) => step.id === field.stepId) > stepIndex
    )
    all.splice(next === -1 ? all.length : next, 0, ...placed)
  }
  return { ...content, fields: all }
}

export function updateField(
  content: FormContent,
  id: string,
  patch: Partial<Omit<FormField, "id">>
): FormContent {
  return {
    ...content,
    fields: content.fields.map((field) =>
      field.id === id ? { ...field, ...patch } : field
    ),
  }
}

/** Moves a field to `index` of a step (index counted without the field). */
export function moveField(
  content: FormContent,
  id: string,
  { stepId, index }: { stepId: string; index: number }
): FormContent {
  const field = content.fields.find((item) => item.id === id)
  if (!field) return content
  const rest = {
    ...content,
    fields: content.fields.filter((item) => item.id !== id),
  }
  return insertFields(rest, [field], { stepId, index })
}

/** Copy right below the original: new id and key, no mapping or rules. */
export function duplicateField(
  content: FormContent,
  id: string,
  createId: () => string = () => newFormElementId("fld")
): { content: FormContent; id: string | null } {
  const field = content.fields.find((item) => item.id === id)
  if (!field) return { content, id: null }
  const copy: FormField = {
    ...structuredClone(field),
    id: createId(),
    key: uniqueAnswerKey(field.key, takenKeys(content)),
  }
  const index = stepFields(content, field.stepId).indexOf(field) + 1
  return {
    content: insertFields(content, [copy], { stepId: field.stepId, index }),
    id: copy.id,
  }
}

/** Rules without references to removed fields/steps (empty rules dropped). */
function pruneLogic(
  logic: FormLogicRule[],
  removedFields: ReadonlySet<string>,
  removedSteps: ReadonlySet<string> = new Set()
) {
  return logic.flatMap((rule) => {
    const conditions = rule.conditions.filter(
      (condition) => !removedFields.has(condition.field)
    )
    const targets = rule.targets.filter((target) =>
      target.kind === "field"
        ? !removedFields.has(target.id)
        : !removedSteps.has(target.id)
    )
    return conditions.length && targets.length
      ? [{ ...rule, conditions, targets }]
      : []
  })
}

export function removeField(content: FormContent, id: string): FormContent {
  const { [id]: _removed, ...mapped } = content.mapping.fields
  return {
    ...content,
    fields: content.fields.filter((field) => field.id !== id),
    logic: pruneLogic(content.logic, new Set([id])),
    mapping: { ...content.mapping, fields: mapped },
  }
}

/**
 * Inserts a module block (B4.2): its fields plus their suggested mapping,
 * unless another field already feeds that CRM field.
 */
export function addBlock(
  content: FormContent,
  block: FormBlockDef,
  {
    stepId,
    index,
    createId,
  }: { stepId: string; index?: number; createId?: () => string }
): { content: FormContent; ids: string[] } {
  const { fields, mapping } = instantiateBlock(block, {
    stepId,
    takenKeys: takenKeys(content),
    createId,
  })
  const usedTargets = new Set(Object.values(content.mapping.fields))
  const added = Object.fromEntries(
    Object.entries(mapping).filter(([, target]) => !usedTargets.has(target))
  )
  const next = insertFields(content, fields, { stepId, index })
  return {
    content: {
      ...next,
      mapping: {
        ...next.mapping,
        fields: { ...next.mapping.fields, ...added },
      },
    },
    ids: fields.map((field) => field.id),
  }
}

export function addStep(content: FormContent, step: FormStep): FormContent {
  return { ...content, steps: [...content.steps, step] }
}

export function updateStep(
  content: FormContent,
  id: string,
  patch: Partial<Omit<FormStep, "id">>
): FormContent {
  return {
    ...content,
    steps: content.steps.map((step) =>
      step.id === id ? { ...step, ...patch } : step
    ),
  }
}

/**
 * Removes a step; its fields move to the previous step (the next one for
 * the first step). The last remaining step cannot be removed.
 */
export function removeStep(content: FormContent, id: string): FormContent {
  if (content.steps.length <= 1) return content
  const index = content.steps.findIndex((step) => step.id === id)
  if (index === -1) return content
  const steps = content.steps.filter((step) => step.id !== id)
  const heir = steps[Math.max(0, index - 1)]!
  const moved = stepFields(content, id).map((field) => ({
    ...field,
    stepId: heir.id,
  }))
  let next: FormContent = {
    ...content,
    steps,
    fields: content.fields.filter((field) => field.stepId !== id),
    logic: pruneLogic(content.logic, new Set(), new Set([id])),
  }
  next = insertFields(next, moved, { stepId: heir.id })
  return next
}

export function moveStep(
  content: FormContent,
  id: string,
  index: number
): FormContent {
  const step = content.steps.find((item) => item.id === id)
  if (!step) return content
  const steps = content.steps.filter((item) => item.id !== id)
  steps.splice(Math.max(0, Math.min(index, steps.length)), 0, step)
  // Keep the flat field list in step order (insertion relies on it).
  const fields = steps.flatMap((item) => stepFields(content, item.id))
  return { ...content, steps, fields }
}
