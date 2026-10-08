import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  ArrowUpRightIcon,
  CheckIcon,
  CircleAlertIcon,
  InboxIcon,
  ShieldAlertIcon,
  UserPlusIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { ErrorState } from "@/components/common/error-state"
import { LoadingSkeleton } from "@/components/common/loading-skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { usePermission } from "@/features/auth"
import { formatDate } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"

import {
  useConvertSubmission,
  useUpdateSubmission,
} from "../api/submissions.mutations"
import { submissionQueries } from "../api/submissions.queries"
import { UTM_KEYS, type Submission } from "../api/submissions.schemas"
import { SubmissionStatusBadge } from "./submission-status-badge"

function Details({ submission }: { submission: Submission }) {
  const { t } = useTranslation("submissions")
  const canUpdate = usePermission("update", "submission")
  const canConvert = usePermission("manage", "submission")
  const update = useUpdateSubmission(submission.id)
  const convert = useConvertSubmission(submission.id)
  const utm = UTM_KEYS.filter((key) => submission.utm[key])
  const busy = update.isPending || convert.isPending

  return (
    <>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <div className="flex items-center gap-2">
          <SubmissionStatusBadge status={submission.status} />
        </div>

        <section
          aria-labelledby="submission-record"
          className="flex flex-col gap-2"
        >
          <h3 id="submission-record" className="text-sm font-medium">
            {t("detail.record")}
          </h3>
          {submission.record ? (
            <Link
              to="/o/$objectKey/$recordId"
              params={{
                objectKey: submission.record.objectKey,
                recordId: submission.record.id,
              }}
              className={buttonVariants({
                variant: "outline",
                className: "self-start",
              })}
            >
              {submission.record.title}
              <ArrowUpRightIcon data-icon="inline-end" />
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("detail.noRecord")}
            </p>
          )}
          {submission.error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
            >
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">{t("detail.error")}</p>
                <p className="break-words">{submission.error.message}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section
          aria-labelledby="submission-answers"
          className="flex flex-col gap-2"
        >
          <h3 id="submission-answers" className="text-sm font-medium">
            {t("detail.answers")}
          </h3>
          <dl className="divide-y rounded-2xl border">
            {submission.answers.map((answer) => (
              <div
                key={answer.key}
                className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]"
              >
                <dt className="text-sm text-muted-foreground">
                  {answer.label}
                </dt>
                <dd className="text-sm break-words whitespace-pre-wrap">
                  {answer.value || (
                    <span className="text-muted-foreground">
                      {t("detail.empty")}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="submission-tracking"
          className="flex flex-col gap-2"
        >
          <h3 id="submission-tracking" className="text-sm font-medium">
            {t("detail.tracking")}
          </h3>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">{t("detail.channel")}</dt>
            <dd>
              {submission.embedded ? t("detail.embedded") : t("detail.hosted")}
            </dd>
            {utm.map((key) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">
                  {t(`detail.utm.${key}`)}
                </dt>
                <dd className="break-all">{submission.utm[key]}</dd>
              </div>
            ))}
            {submission.referrer ? (
              <>
                <dt className="text-muted-foreground">
                  {t("detail.referrer")}
                </dt>
                <dd className="break-all">{submission.referrer}</dd>
              </>
            ) : null}
            {submission.pageUrl ? (
              <>
                <dt className="text-muted-foreground">{t("detail.pageUrl")}</dt>
                <dd className="break-all">{submission.pageUrl}</dd>
              </>
            ) : null}
          </dl>
        </section>
      </div>

      {canUpdate || canConvert ? (
        <SheetFooter className="flex-row flex-wrap border-t">
          {canConvert && !submission.record ? (
            <Button
              type="button"
              disabled={busy}
              onClick={() => convert.mutate()}
            >
              <UserPlusIcon data-icon="inline-start" />
              {t("detail.convert")}
            </Button>
          ) : null}
          {canUpdate && submission.status === "new" ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => update.mutate({ status: "processed" })}
            >
              <CheckIcon data-icon="inline-start" />
              {t("detail.markProcessed")}
            </Button>
          ) : null}
          {canUpdate && submission.status === "spam" ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => update.mutate({ status: "new" })}
            >
              <InboxIcon data-icon="inline-start" />
              {t("detail.markNew")}
            </Button>
          ) : null}
          {canUpdate && submission.status !== "spam" ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => update.mutate({ status: "spam" })}
            >
              <ShieldAlertIcon data-icon="inline-start" />
              {t("detail.markSpam")}
            </Button>
          ) : null}
        </SheetFooter>
      ) : null}
    </>
  )
}

/** Raw answers, tracking and actions of one submission (B5.6). */
export function SubmissionSheet({
  submissionId,
  onClose,
}: {
  submissionId: string | null
  onClose: () => void
}) {
  const { t } = useTranslation("submissions")
  const language = getCurrentLanguage()
  const query = useQuery({
    ...submissionQueries.detail(submissionId ?? ""),
    enabled: !!submissionId,
  })
  const submission = query.data

  return (
    <Sheet
      open={!!submissionId}
      onOpenChange={(open) => (open ? null : onClose())}
    >
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>
            {submission?.contactLabel ?? t("detail.title")}
          </SheetTitle>
          <SheetDescription>
            {submission
              ? t("detail.description", {
                  form: submission.formName,
                  version: submission.formVersion,
                  date: formatDate(submission.createdAt, language, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })
              : t("detail.title")}
          </SheetDescription>
        </SheetHeader>
        {query.isPending ? (
          <div className="p-6">
            <LoadingSkeleton variant="list" />
          </div>
        ) : query.isError ? (
          <div className="p-6">
            <ErrorState
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          </div>
        ) : (
          <Details submission={query.data} />
        )}
      </SheetContent>
    </Sheet>
  )
}
