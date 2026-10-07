import { useQuery } from "@tanstack/react-query"
import { CircleCheckIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  hasBlockingIssues,
  validateFormForPublish,
  type FormIssue,
} from "@/engine/forms"
import { useObjectDef } from "@/features/records"
import { isApiError } from "@/lib/api"

import { usePublishForm } from "../../api/forms.mutations"
import { formQueries } from "../../api/forms.queries"
import { publishErrorDetailsSchema, type Form } from "../../api/forms.schemas"
import { useBuilder } from "../../lib/builder-store"
import type { BuilderTab } from "../form-builder-page"
import { EmbedOptions } from "./embed-options"
import { IssueList } from "./issue-list"

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: Form
  /** Saves pending draft edits; `false` when saving failed. */
  flush: () => Promise<boolean>
  onFix: (tab: BuilderTab, fieldId?: string) => void
}

/**
 * Publish flow (B4.7): the draft is checked here first (errors block,
 * warnings are confirmed), the server repeats the check, and the new
 * version's embed code is offered right away.
 */
export function PublishDialog({
  open,
  onOpenChange,
  form,
  flush,
  onFix,
}: PublishDialogProps) {
  const { t } = useTranslation("forms")
  const content = useBuilder((state) => state.content)
  const objectDef = useObjectDef(content.mapping.objectKey)
  const { data: versions } = useQuery({
    ...formQueries.versions(form.id),
    enabled: open,
  })
  const mutation = usePublishForm(form.id)
  const [published, setPublished] = useState<Form | null>(null)
  const [serverIssues, setServerIssues] = useState<FormIssue[] | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)

  const localIssues = useMemo(
    () => validateFormForPublish(content, objectDef),
    [content, objectDef]
  )
  const issues = serverIssues ?? localIssues
  const blocked = hasBlockingIssues(issues)
  const nextVersion = (versions?.data[0]?.version ?? 0) + 1

  function close(next: boolean) {
    if (!next) {
      setPublished(null)
      setServerIssues(null)
      setSaveFailed(false)
      mutation.reset()
    }
    onOpenChange(next)
  }

  async function publish() {
    setServerIssues(null)
    if (!(await flush())) {
      setSaveFailed(true)
      return
    }
    setSaveFailed(false)
    try {
      setPublished(await mutation.mutateAsync())
    } catch (error) {
      const details = isApiError(error)
        ? publishErrorDetailsSchema.safeParse(error.details)
        : null
      if (details?.success) setServerIssues(details.data.issues as FormIssue[])
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        {published ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CircleCheckIcon
                  className="size-5 text-emerald-600"
                  aria-hidden
                />
                {t("publish.done", { version: published.publishedVersion })}
              </DialogTitle>
              <DialogDescription>
                {t("publish.doneDescription")}
              </DialogDescription>
            </DialogHeader>
            <EmbedOptions form={published} />
            <DialogFooter>
              <Button type="button" onClick={() => close(false)}>
                {t("publish.close")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("publish.title", { version: nextVersion })}
              </DialogTitle>
              <DialogDescription>{t("publish.description")}</DialogDescription>
            </DialogHeader>
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 text-sm">
                <CircleCheckIcon
                  className="size-4 text-emerald-600"
                  aria-hidden
                />
                {t("publish.ready")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">
                  {blocked ? t("publish.blocked") : t("publish.warnings")}
                </p>
                <IssueList
                  issues={issues}
                  onFix={(tab, fieldId) => {
                    close(false)
                    onFix(tab, fieldId)
                  }}
                />
              </div>
            )}
            {saveFailed ? (
              <p role="alert" className="text-sm text-destructive">
                {t("publish.saveFailed")}
              </p>
            ) : null}
            {mutation.isError && !serverIssues ? (
              <p role="alert" className="text-sm text-destructive">
                {t("publish.failed")}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => close(false)}
              >
                {t("publish.cancel")}
              </Button>
              <Button
                type="button"
                disabled={blocked || mutation.isPending}
                onClick={() => void publish()}
              >
                {t("publish.confirm", { version: nextVersion })}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
