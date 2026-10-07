import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { LoadingSkeleton } from "@/components/common/loading-skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { FormContent } from "@/engine/forms"
import {
  FormRenderer,
  FormThemeScope,
  type FormDevice,
} from "@/features/form-renderer"
import type { Language } from "@/lib/i18n"

import { formQueries } from "../api/forms.queries"
import { PreviewControls } from "./preview-controls"

/** UTM values the preview pretends to come with (hidden fields show them). */
const PREVIEW_CONTEXT = {
  search: "?utm_source=preview&utm_medium=builder",
  referrer: "https://www.example.com/",
}

/** Live, interactive form on a device frame; nothing is submitted. */
export function FormPreview({
  content,
  device,
  language,
  className,
}: {
  content: FormContent
  device: FormDevice
  language: Language
  className?: string
}) {
  return (
    <FormThemeScope theme={content.theme} device={device} className={className}>
      <FormRenderer
        // A fresh form when the definition or language changes.
        key={`${language}:${JSON.stringify(content)}`}
        content={content}
        language={language}
        mode="preview"
        context={PREVIEW_CONTEXT}
      />
    </FormThemeScope>
  )
}

interface PreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  content: FormContent | undefined
}

export function PreviewDialog({
  open,
  onOpenChange,
  name,
  content,
}: PreviewDialogProps) {
  const { t } = useTranslation("forms")
  const [device, setDevice] = useState<FormDevice>("desktop")
  const [language, setLanguage] = useState<Language | null>(null)
  const languages = content?.settings.languages ?? []
  const shown =
    language && languages.includes(language)
      ? language
      : (content?.settings.defaultLanguage ?? "tr")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-3xl">
        <DialogHeader className="pr-10">
          <DialogTitle>{t("preview.title", { name })}</DialogTitle>
          <DialogDescription>{t("preview.description")}</DialogDescription>
          {content ? (
            <PreviewControls
              device={device}
              onDeviceChange={setDevice}
              language={shown}
              languages={languages}
              onLanguageChange={setLanguage}
            />
          ) : null}
        </DialogHeader>
        <div className="-mx-6 overflow-y-auto bg-muted/40 px-3 py-4 sm:px-6">
          {content ? (
            <FormPreview content={content} device={device} language={shown} />
          ) : (
            <LoadingSkeleton variant="card" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Preview of a saved form, loaded on demand (form list). */
export function FormPreviewDialog({
  formId,
  name,
  onClose,
}: {
  formId: string | null
  name: string
  onClose: () => void
}) {
  const { data } = useQuery({
    ...formQueries.detail(formId ?? ""),
    enabled: !!formId,
  })
  return (
    <PreviewDialog
      open={!!formId}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      name={name}
      content={formId ? data?.content : undefined}
    />
  )
}
