import {
  createEmptyContent,
  FIRST_STEP_ID,
  type FormContent,
  type FormField,
  type FormLogicRule,
} from "@/engine/forms"

export const tt = (tr: string, en = tr) => ({ tr, en })

/** Form field with readable defaults: id `f_<key>`, first step, full width. */
export function formField(
  key: string,
  type: string,
  extra: Partial<FormField> = {}
): FormField {
  return {
    id: `f_${key}`,
    key,
    type,
    stepId: FIRST_STEP_ID,
    label: tt(key),
    width: "full",
    ...extra,
  }
}

export const options = (...values: string[]) =>
  values.map((value) => ({ value, label: tt(value) }))

export function formContent(
  fields: FormField[],
  extra: Partial<FormContent> = {}
): FormContent {
  return { ...createEmptyContent(), fields, ...extra }
}

export function rule(
  id: string,
  extra: Partial<FormLogicRule> &
    Pick<FormLogicRule, "conditions" | "action" | "targets">
): FormLogicRule {
  return { id, match: "all", ...extra }
}
