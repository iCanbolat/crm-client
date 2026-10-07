import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  CheckIcon,
  CloudAlertIcon,
  EyeIcon,
  LoaderIcon,
  Redo2Icon,
  Undo2Icon,
} from "lucide-react"
import { useId, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import type { Language } from "@/lib/i18n"

import { formQueries } from "../api/forms.queries"
import { formNameSchema, type Form } from "../api/forms.schemas"
import type { SaveStatus } from "../hooks/use-autosave"
import { useBuilder, useBuilderHistory } from "../lib/builder-store"
import { FormStatusBadge } from "./form-status-badge"

const isMac = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

function SaveIndicator({
  status,
  onRetry,
}: {
  status: SaveStatus
  onRetry: () => void
}) {
  const { t } = useTranslation("forms")
  let content: ReactNode = null
  if (status === "pending" || status === "saving") {
    content = (
      <>
        <LoaderIcon className="size-4 animate-spin" aria-hidden />
        {t("builder.save.saving")}
      </>
    )
  } else if (status === "saved") {
    content = (
      <>
        <CheckIcon className="size-4" aria-hidden />
        {t("builder.save.saved")}
      </>
    )
  } else if (status === "error") {
    content = (
      <>
        <CloudAlertIcon className="size-4 text-destructive" aria-hidden />
        <span className="text-destructive">{t("builder.save.error")}</span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={onRetry}
        >
          {t("builder.save.retry")}
        </Button>
      </>
    )
  }
  return (
    <p
      role="status"
      className="flex min-h-5 items-center gap-1.5 text-sm text-muted-foreground"
    >
      {content}
    </p>
  )
}

function NameInput() {
  const { t } = useTranslation("forms")
  const id = useId()
  const name = useBuilder((state) => state.name)
  const rename = useBuilder((state) => state.rename)
  const [draft, setDraft] = useState(name)
  const [source, setSource] = useState(name)
  if (source !== name) {
    setSource(name)
    setDraft(name)
  }
  const invalid = !formNameSchema.safeParse(draft).success

  return (
    <div className="flex min-w-0 flex-col">
      <Input
        id={id}
        value={draft}
        aria-label={t("builder.nameLabel")}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className="h-9 border-transparent bg-transparent px-2 font-heading text-xl font-semibold shadow-none hover:border-input focus-visible:border-ring sm:w-80"
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          if (formNameSchema.safeParse(next).success) {
            setSource(next.trim())
            rename(next.trim())
          }
        }}
        onBlur={() => setDraft(name)}
      />
      {invalid ? (
        <p id={`${id}-error`} className="px-2 text-xs text-destructive">
          {t("builder.nameInvalid")}
        </p>
      ) : null}
    </div>
  )
}

/** Language the canvas shows texts in (B4.3). */
function CanvasLanguage() {
  const { t } = useTranslation("forms")
  const languages = useBuilder((state) => state.content.settings.languages)
  const language = useBuilder((state) => state.language)
  const setLanguage = useBuilder((state) => state.setLanguage)
  if (languages.length < 2) return null
  return (
    <ToggleGroup
      variant="outline"
      spacing={0}
      aria-label={t("builder.canvasLanguage")}
      value={[language]}
      onValueChange={(value) => {
        const next = value[0] as Language | undefined
        if (next) setLanguage(next)
      }}
    >
      {languages.map((item) => (
        <ToggleGroupItem
          key={item}
          value={item}
          aria-label={t(`languages.${item}`)}
          className="px-3 uppercase"
        >
          {item}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function HistoryButton({
  label,
  shortcut,
  keyshortcuts,
  disabled,
  onClick,
  children,
}: {
  label: string
  shortcut: string
  keyshortcuts: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            aria-keyshortcuts={keyshortcuts}
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label} <Kbd>{shortcut}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

interface BuilderHeaderProps {
  formId: string
  saveStatus: SaveStatus
  onRetrySave: () => void
  onPreview: () => void
  actions?: ReactNode
}

/** Name, status, autosave state, undo/redo and the form actions (B4.2). */
export function BuilderHeader({
  formId,
  saveStatus,
  onRetrySave,
  onPreview,
  actions,
}: BuilderHeaderProps) {
  const { t } = useTranslation("forms")
  const { data: form } = useQuery(formQueries.detail(formId))
  const history = useBuilderHistory()
  const mod = isMac() ? "⌘" : "Ctrl "

  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("builder.back")}
          render={<Link to="/forms" />}
          nativeButton={false}
        >
          <ArrowLeftIcon />
        </Button>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="sr-only">{form?.name}</h1>
          <NameInput />
          <div className="flex flex-wrap items-center gap-3 px-2">
            {form ? <FormStatusBadge form={form as Form} /> : null}
            <SaveIndicator status={saveStatus} onRetry={onRetrySave} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CanvasLanguage />
        <HistoryButton
          label={t("builder.undo")}
          shortcut={`${mod}Z`}
          keyshortcuts="Meta+Z Control+Z"
          disabled={!history.canUndo}
          onClick={() => history.undo()}
        >
          <Undo2Icon />
        </HistoryButton>
        <HistoryButton
          label={t("builder.redo")}
          shortcut={isMac() ? "⇧⌘Z" : "Ctrl Y"}
          keyshortcuts="Meta+Shift+Z Control+Y"
          disabled={!history.canRedo}
          onClick={() => history.redo()}
        >
          <Redo2Icon />
        </HistoryButton>
        <Button type="button" variant="outline" onClick={onPreview}>
          <EyeIcon data-icon="inline-start" />
          {t("builder.preview")}
        </Button>
        {actions}
      </div>
    </header>
  )
}
