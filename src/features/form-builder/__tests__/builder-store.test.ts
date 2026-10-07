import { afterEach, describe, expect, it, vi } from "vitest"

import { formContent, formField, tt } from "@/engine/__tests__/form-fixtures"

import { createBuilderStore, HISTORY_COALESCE_MS } from "../lib/builder-store"

function setup() {
  const store = createBuilderStore({
    name: "Form",
    content: formContent([
      formField("name", "text"),
      formField("email", "email"),
    ]),
  })
  const history = () => store.temporal.getState()
  return { store, history, state: () => store.getState() }
}

const labels = (store: ReturnType<typeof setup>["store"]) =>
  store.getState().content.fields.map((field) => field.label.tr)

describe("builder store (B4.2)", () => {
  afterEach(() => vi.useRealTimers())

  it("TC-4.2-03 undoes and redoes edits; selection is not history", () => {
    const { history, state } = setup()
    const id = state().addPaletteField("phone")
    expect(state().selectedId).toBe(id)
    expect(state().content.fields.map((field) => field.key)).toEqual([
      "name",
      "email",
      "phone",
    ])

    state().select("f_name")
    // Inserted below the selected field.
    state().addPaletteField("number")
    expect(state().content.fields.map((field) => field.key)).toEqual([
      "name",
      "number",
      "email",
      "phone",
    ])

    history().undo()
    expect(state().content.fields).toHaveLength(3)
    history().undo()
    expect(state().content.fields).toHaveLength(2)
    expect(history().pastStates).toHaveLength(0)
    history().redo()
    history().redo()
    expect(state().content.fields).toHaveLength(4)
    expect(history().futureStates).toHaveLength(0)
  })

  it("TC-4.2-03 coalesces rapid edits of the same property", () => {
    vi.useFakeTimers()
    const { store, history, state } = setup()
    state().updateField("f_name", { label: tt("A") }, "label")
    state().updateField("f_name", { label: tt("Ad") }, "label")
    state().updateField("f_name", { label: tt("Ad soyad") }, "label")
    expect(history().pastStates).toHaveLength(1)

    // Another property starts a new step.
    state().updateField("f_name", { required: true })
    expect(history().pastStates).toHaveLength(2)

    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1)
    state().updateField("f_name", { label: tt("Ad soyadınız") }, "label")
    expect(history().pastStates).toHaveLength(3)

    history().undo()
    history().undo()
    expect(labels(store)).toEqual(["Ad soyad", "email"])
    expect(state().content.fields[0]?.required).toBeUndefined()
    history().undo()
    expect(labels(store)).toEqual(["name", "email"])
  })

  it("keeps steps, theme, settings and restores in one place", () => {
    const { history, state } = setup()
    state().addStep(tt("Yük"))
    const second = state().activeStepId
    expect(state().content.steps).toHaveLength(2)
    state().addPaletteField("text")
    expect(state().content.fields.at(-1)?.stepId).toBe(second)
    state().updateStep(second, { title: tt("Yük ve rota") }, "title")
    state().moveStep(second, 0)
    expect(state().content.steps[0]?.id).toBe(second)
    state().removeStep(second)
    expect(state().content.steps).toHaveLength(1)
    expect(state().activeStepId).toBe("step1")

    state().updateTheme({ primaryColor: "#0f766e" }, "primary")
    state().updateSettings({ honeypot: false })
    state().setLogic([])
    state().setMapping({ ...state().content.mapping, ownerId: "usr_owner" })
    state().rename("Yeni ad")
    expect(state()).toMatchObject({
      name: "Yeni ad",
      content: {
        theme: { primaryColor: "#0f766e" },
        settings: { honeypot: false },
        mapping: { ownerId: "usr_owner" },
      },
    })

    state().duplicateField("f_name")
    expect(state().content.fields.map((field) => field.key)).toContain("name2")
    state().removeField(state().selectedId!)
    expect(state().selectedId).toBeNull()

    state().replaceContent(formContent([]))
    expect(state().content.fields).toEqual([])
    expect(history().pastStates).toHaveLength(0)
  })
})
