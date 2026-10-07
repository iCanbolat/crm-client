import { useBlocker } from "@tanstack/react-router"
import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { Form } from "../api/forms.schemas"
import { useAutosave } from "../hooks/use-autosave"
import { useBuilderShortcuts } from "../hooks/use-builder-shortcuts"
import {
  BuilderStoreProvider,
  createBuilderStore,
  useBuilder,
} from "../lib/builder-store"
import { BuildPanel } from "./build/build-panel"
import { BuilderHeader } from "./builder-header"
import { LogicPanel } from "./logic/logic-panel"
import { MappingPanel } from "./mapping/mapping-panel"
import { PreviewDialog } from "./preview-dialog"

export const BUILDER_TABS = ["build", "logic", "mapping"] as const
export type BuilderTab = (typeof BUILDER_TABS)[number]

interface FormBuilderPageProps {
  form: Form
  tab: BuilderTab
  onTabChange: (tab: BuilderTab) => void
}

function BuilderScreen({ form, tab, onTabChange }: FormBuilderPageProps) {
  const { t } = useTranslation("forms")
  const autosave = useAutosave(form.id)
  const name = useBuilder((state) => state.name)
  const content = useBuilder((state) => state.content)
  const [previewOpen, setPreviewOpen] = useState(false)
  useBuilderShortcuts({ fieldShortcuts: tab === "build" })

  // Leaving the editor saves pending edits first; only a failed save asks.
  const blocker = useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      if (current.pathname === next.pathname) return false
      return !(await autosave.flush())
    },
    enableBeforeUnload: () => autosave.isDirty(),
    withResolver: true,
  })

  const panels: Record<BuilderTab, ReactNode> = {
    build: <BuildPanel />,
    logic: <LogicPanel />,
    mapping: <MappingPanel form={form} />,
  }

  return (
    <div data-builder-root className="flex flex-col gap-4">
      <BuilderHeader
        formId={form.id}
        saveStatus={autosave.status}
        onRetrySave={() => void autosave.flush()}
        onPreview={() => setPreviewOpen(true)}
      />
      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as BuilderTab)}
      >
        <TabsList
          aria-label={t("builder.tabs.label")}
          className="max-w-full overflow-x-auto"
        >
          {BUILDER_TABS.map((item) => (
            <TabsTrigger key={item} value={item}>
              {t(`builder.tabs.${item}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {BUILDER_TABS.map((item) => (
          <TabsContent key={item} value={item} className="pt-2">
            {panels[item]}
          </TabsContent>
        ))}
      </Tabs>

      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        name={name}
        content={content}
      />
      <ConfirmDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
        title={t("builder.leave.title")}
        description={t("builder.leave.description")}
        confirmLabel={t("builder.leave.confirm")}
        cancelLabel={t("builder.leave.cancel")}
        variant="destructive"
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  )
}

/** Form editor (`/forms/$formId/edit`, B4.2). */
export function FormBuilderPage(props: FormBuilderPageProps) {
  const [store] = useState(() =>
    createBuilderStore({ name: props.form.name, content: props.form.content })
  )
  return (
    <BuilderStoreProvider store={store}>
      <BuilderScreen {...props} />
    </BuilderStoreProvider>
  )
}
