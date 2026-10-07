import type { FormBlockDef, FormField } from "./schemas"

/** Random id of a form element (`fld_…`, `rule_…`, `step_…`). */
export function newFormElementId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

/** `base`, or `base2`, `base3`… when taken (answer keys stay unique). */
export function uniqueAnswerKey(base: string, taken: ReadonlySet<string>) {
  let key = base
  for (let n = 2; taken.has(key); n += 1) key = `${base}${n}`
  return key
}

export interface InstantiateBlockOptions {
  stepId: string
  /** Answer keys already used by the form. */
  takenKeys: ReadonlySet<string>
  createId?: () => string
}

/**
 * Fields of a module block ready to insert (B4.2): unique keys and ids,
 * tagged with the block, plus their suggested CRM mapping (field id →
 * target field key).
 */
export function instantiateBlock(
  block: FormBlockDef,
  {
    stepId,
    takenKeys,
    createId = () => newFormElementId("fld"),
  }: InstantiateBlockOptions
) {
  const taken = new Set(takenKeys)
  const mapping: Record<string, string> = {}
  const fields = block.fields.map(({ mapTo, width, ...field }): FormField => {
    const key = uniqueAnswerKey(field.key, taken)
    taken.add(key)
    const id = createId()
    if (mapTo) mapping[id] = mapTo
    return {
      ...structuredClone(field),
      id,
      key,
      stepId,
      width: width ?? "full",
      blockId: block.id,
    }
  })
  return { fields, mapping }
}
