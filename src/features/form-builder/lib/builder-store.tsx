import { createContext, use, type ReactNode } from "react"
import { temporal, type TemporalState } from "zundo"
import { createStore, useStore, type StoreApi } from "zustand"
import { useShallow } from "zustand/react/shallow"

import {
  newFormElementId,
  type FormBlockDef,
  type FormContent,
  type FormField,
  type FormLogicRule,
  type FormMapping,
  type FormPaletteType,
  type FormSettings,
  type FormStep,
  type FormTheme,
} from "@/engine/forms"
import type { Language } from "@/lib/i18n"

import { createPaletteField } from "./defaults"
import * as ops from "./form-ops"

/** The undoable part of the builder: what autosave sends. */
export interface BuilderDoc {
  name: string
  content: FormContent
}

interface InsertAt {
  stepId?: string
  index?: number
}

export interface BuilderState extends BuilderDoc {
  selectedId: string | null
  activeStepId: string
  /** Language the canvas and previews show the form in. */
  language: Language
  select: (id: string | null) => void
  setLanguage: (language: Language) => void
  setActiveStep: (id: string) => void
  rename: (name: string) => void
  addPaletteField: (type: FormPaletteType, at?: InsertAt) => string
  addBlock: (block: FormBlockDef, at?: InsertAt) => void
  addFields: (fields: FormField[], at?: InsertAt) => void
  /** `coalesce`: edits with the same key within a second undo as one. */
  updateField: (
    id: string,
    patch: Partial<Omit<FormField, "id">>,
    coalesce?: string
  ) => void
  moveField: (id: string, to: { stepId: string; index: number }) => void
  duplicateField: (id: string) => void
  removeField: (id: string) => void
  addStep: (title: FormStep["title"]) => void
  updateStep: (
    id: string,
    patch: Partial<Omit<FormStep, "id">>,
    coalesce?: string
  ) => void
  removeStep: (id: string) => void
  moveStep: (id: string, index: number) => void
  setLogic: (logic: FormLogicRule[], coalesce?: string) => void
  setMapping: (mapping: FormMapping, coalesce?: string) => void
  updateTheme: (patch: Partial<FormTheme>, coalesce?: string) => void
  updateSettings: (patch: Partial<FormSettings>, coalesce?: string) => void
  /** Replaces the draft (version restore): history starts over. */
  replaceContent: (content: FormContent) => void
}

export type BuilderStore = StoreApi<BuilderState> & {
  temporal: StoreApi<TemporalState<BuilderDoc>>
}

/** Consecutive edits with the same key within this window undo together. */
export const HISTORY_COALESCE_MS = 1000

export function createBuilderStore(doc: BuilderDoc): BuilderStore {
  // Coalescing key of the edit being applied (set right before `set`).
  let pendingKey: string | undefined
  let lastKey: string | undefined
  let lastAt = 0

  const store = createStore<BuilderState>()(
    temporal(
      (set, get) => {
        const edit = (
          recipe: (content: FormContent) => FormContent,
          coalesce?: string
        ) => {
          pendingKey = coalesce
          set((state) => ({ content: recipe(state.content) }))
        }
        const insertAt = (at: InsertAt = {}) => {
          const { content, activeStepId, selectedId } = get()
          const stepId = at.stepId ?? activeStepId
          if (at.index !== undefined) return { stepId, index: at.index }
          // Below the selected field of the step, else at the end.
          const inStep = ops.stepFields(content, stepId)
          const selected = inStep.findIndex((field) => field.id === selectedId)
          return { stepId, index: selected === -1 ? undefined : selected + 1 }
        }

        return {
          ...doc,
          selectedId: null,
          activeStepId: doc.content.steps[0]!.id,
          language: doc.content.settings.defaultLanguage,
          select: (id) => set({ selectedId: id }),
          setLanguage: (language) => set({ language }),
          setActiveStep: (id) => set({ activeStepId: id, selectedId: null }),
          rename: (name) => {
            pendingKey = "name"
            set({ name })
          },
          addPaletteField: (type, at) => {
            const target = insertAt(at)
            const field = createPaletteField(type, {
              stepId: target.stepId,
              takenKeys: ops.takenKeys(get().content),
            })
            edit((content) => ops.insertFields(content, [field], target))
            set({ selectedId: field.id })
            return field.id
          },
          addBlock: (block, at) => {
            const target = insertAt(at)
            const { content, ids } = ops.addBlock(get().content, block, target)
            edit(() => content)
            set({ selectedId: ids[0] ?? null })
          },
          addFields: (fields, at) => {
            const target = insertAt(at)
            edit((content) => ops.insertFields(content, fields, target))
          },
          updateField: (id, patch, coalesce) =>
            edit(
              (content) => ops.updateField(content, id, patch),
              coalesce && `${id}:${coalesce}`
            ),
          moveField: (id, to) =>
            edit((content) => ops.moveField(content, id, to)),
          duplicateField: (id) => {
            const result = ops.duplicateField(get().content, id)
            edit(() => result.content)
            if (result.id) set({ selectedId: result.id })
          },
          removeField: (id) => {
            edit((content) => ops.removeField(content, id))
            if (get().selectedId === id) set({ selectedId: null })
          },
          addStep: (title) => {
            const step = { id: newFormElementId("step"), title }
            edit((content) => ops.addStep(content, step))
            set({ activeStepId: step.id, selectedId: null })
          },
          updateStep: (id, patch, coalesce) =>
            edit(
              (content) => ops.updateStep(content, id, patch),
              coalesce && `${id}:${coalesce}`
            ),
          removeStep: (id) => {
            const before = get().content
            edit((content) => ops.removeStep(content, id))
            const { content, activeStepId } = get()
            if (content !== before && activeStepId === id) {
              const index = before.steps.findIndex((step) => step.id === id)
              set({ activeStepId: content.steps[Math.max(0, index - 1)]!.id })
            }
          },
          moveStep: (id, index) =>
            edit((content) => ops.moveStep(content, id, index)),
          setLogic: (logic, coalesce) =>
            edit(
              (content) => ({ ...content, logic }),
              coalesce && `logic:${coalesce}`
            ),
          setMapping: (mapping, coalesce) =>
            edit(
              (content) => ({ ...content, mapping }),
              coalesce && `mapping:${coalesce}`
            ),
          updateTheme: (patch, coalesce) =>
            edit(
              (content) => ({
                ...content,
                theme: { ...content.theme, ...patch },
              }),
              coalesce && `theme:${coalesce}`
            ),
          updateSettings: (patch, coalesce) =>
            edit(
              (content) => ({
                ...content,
                settings: { ...content.settings, ...patch },
              }),
              coalesce && `settings:${coalesce}`
            ),
          replaceContent: (content) => {
            set({
              content,
              selectedId: null,
              activeStepId: content.steps[0]!.id,
            })
            store.temporal.getState().clear()
          },
        }
      },
      {
        partialize: ({ name, content }): BuilderDoc => ({ name, content }),
        equality: (past, current) =>
          past.name === current.name && past.content === current.content,
        limit: 100,
        handleSet: (handleSet) => {
          // zundo passes its internal recorder, typed as `setState`.
          const record = handleSet as unknown as (...args: unknown[]) => void
          return (...args) => {
            const key = pendingKey
            pendingKey = undefined
            const now = Date.now()
            const merge =
              !!key && key === lastKey && now - lastAt < HISTORY_COALESCE_MS
            lastKey = key
            lastAt = now
            if (!merge) record(...args)
          }
        },
      }
    )
  ) as BuilderStore
  return store
}

const BuilderStoreContext = createContext<BuilderStore | null>(null)

export function BuilderStoreProvider({
  store,
  children,
}: {
  store: BuilderStore
  children: ReactNode
}) {
  return <BuilderStoreContext value={store}>{children}</BuilderStoreContext>
}

export function useBuilderStore() {
  const store = use(BuilderStoreContext)
  if (!store) throw new Error("useBuilderStore outside BuilderStoreProvider")
  return store
}

export function useBuilder<T>(selector: (state: BuilderState) => T) {
  return useStore(useBuilderStore(), selector)
}

export function useBuilderHistory() {
  const store = useBuilderStore()
  return useStore(
    store.temporal,
    useShallow((state) => ({
      canUndo: state.pastStates.length > 0,
      canRedo: state.futureStates.length > 0,
      undo: state.undo,
      redo: state.redo,
    }))
  )
}

/** Field being edited, if it still exists (undo may remove it). */
export function useSelectedField() {
  return useBuilder((state) =>
    state.selectedId
      ? (state.content.fields.find((field) => field.id === state.selectedId) ??
        null)
      : null
  )
}

/** Step shown on the canvas; falls back to the first one after undo. */
export function useActiveStep() {
  return useBuilder(
    (state) =>
      state.content.steps.find((step) => step.id === state.activeStepId) ??
      state.content.steps[0]!
  )
}
