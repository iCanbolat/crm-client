import { useBlocker } from "@tanstack/react-router"
import { RocketIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { usePermission } from "@/features/auth"

import type { Form } from "../api/forms.schemas"
import { useAutosave } from "../hooks/use-autosave"
import { useBuilderShortcuts } from "../hooks/use-builder-shortcuts"
import {
  BuilderStoreProvider,
  createBuilderStore,
  useBuilder,
  useBuilderStore,
} from "../lib/builder-store"
import { BuildPanel } from "./build/build-panel"
import { BuilderHeader } from "./builder-header"
import { DesignPanel } from "./design/design-panel"
import { LogicPanel } from "./logic/logic-panel"
import { MappingPanel } from "./mapping/mapping-panel"
import { PublishDialog } from "./publish/publish-dialog"
import { PublishPanel } from "./publish/publish-panel"
import { PreviewDialog } from "./preview-dialog"

export const BUILDER_TABS = [
  "build",
  "logic",
  "mapping",
  "design",
  "publish",
] as const
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
  const store = useBuilderStore()
  const canPublish = usePermission("manage", "form")
  const [previewOpen, setPreviewOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  useBuilderShortcuts({ fieldShortcuts: tab === "build" })

  /** "Fix" links of publish issues: open the tab, select the field. */
  function fix(next: BuilderTab, fieldId?: string) {
    onTabChange(next)
    const field = store
      .getState()
      .content.fields.find((item) => item.id === fieldId)
    if (next === "build" && field) {
      store.getState().setActiveStep(field.stepId)
      store.getState().select(field.id)
    }
  }

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
    design: <DesignPanel form={form} />,
    publish: (
      <PublishPanel form={form} onPublish={() => setPublishOpen(true)} />
    ),
  }

  return (
    <div data-builder-root className="flex flex-col gap-4">
      <BuilderHeader
        formId={form.id}
        saveStatus={autosave.status}
        onRetrySave={() => void autosave.flush()}
        onPreview={() => setPreviewOpen(true)}
        actions={
          canPublish ? (
            <Button type="button" onClick={() => setPublishOpen(true)}>
              <RocketIcon data-icon="inline-start" />
              {t("builder.publish")}
            </Button>
          ) : null
        }
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

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        form={form}
        flush={autosave.flush}
        onFix={fix}
      />
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
