import { CORE_FIELD_TYPES, type CoreFieldType } from "@/engine/metadata"
import { toFieldKey, type SelectOption } from "@/engine/metadata"

/** Option row being edited; `value` is generated for new options. */
export interface OptionDraft {
  id: string
  value: string | null
  labelTr: string
  labelEn: string
  color: SelectOption["color"]
}

let draftSeq = 0
export const newDraftId = () => `draft-${++draftSeq}`

export function toOptionDrafts(
  options: readonly SelectOption[] = []
): OptionDraft[] {
  return options.map((option) => ({
    id: newDraftId(),
    value: option.value,
    labelTr: option.label.tr,
    labelEn: option.label.en,
    color: option.color,
  }))
}

/** Unique key from a label: "Yeni Alan" → "yeniAlan", then "yeniAlan2"… */
export function uniqueKey(
  label: string,
  taken: Iterable<string>,
  fallback = "item"
) {
  const used = new Set(taken)
  const base = toFieldKey(label) || fallback
  let key = base
  for (let index = 2; used.has(key); index++) key = `${base}${index}`
  return key
}

export function fromOptionDrafts(
  drafts: readonly OptionDraft[]
): SelectOption[] {
  const taken = new Set(
    drafts.flatMap((draft) => (draft.value ? [draft.value] : []))
  )
  return drafts.map((draft) => {
    const value = draft.value ?? uniqueKey(draft.labelTr, taken, "option")
    taken.add(value)
    return {
      value,
      label: {
        tr: draft.labelTr.trim(),
        en: draft.labelEn.trim() || draft.labelTr.trim(),
      },
      ...(draft.color ? { color: draft.color } : {}),
    }
  })
}

export function isCoreFieldType(type: string): type is CoreFieldType {
  return CORE_FIELD_TYPES.includes(type as CoreFieldType)
}
