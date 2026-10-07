import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import type { FormIssue } from "@/engine/forms"
import { label } from "@/engine/metadata"
import { useObjectDef } from "@/features/records"
import { getCurrentLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { useBuilder } from "../../lib/builder-store"
import { useFieldTitle } from "../build/canvas"
import type { BuilderTab } from "../form-builder-page"

/** Where an issue is fixed. */
export function issueTab(issue: Pick<FormIssue, "code">): BuilderTab {
  switch (issue.code) {
    case "noInputs":
    case "duplicateKey":
    case "missingTranslation":
      return "build"
    case "logicCycle":
    case "logicBroken":
    case "logicIncomplete":
      return "logic"
    case "invalidRedirect":
    case "lowContrast":
      return "design"
    default:
      return "mapping"
  }
}

/** Publish blockers and warnings with "fix" links (B4.7). */
export function IssueList({
  issues,
  onFix,
}: {
  issues: FormIssue[]
  onFix: (tab: BuilderTab, fieldId?: string) => void
}) {
  const { t } = useTranslation("forms")
  const content = useBuilder((state) => state.content)
  const fieldTitle = useFieldTitle()
  const objectDef = useObjectDef(content.mapping.objectKey)
  const language = getCurrentLanguage()
  const fieldName = (id?: string) => {
    const field = content.fields.find((item) => item.id === id)
    return field ? fieldTitle(field) : ""
  }
  const targetName = (key?: string) => {
    const target = objectDef?.fields.find((item) => item.key === key)
    return target ? label(target.label, language) : (key ?? "")
  }
  const ruleNumber = (id?: string) =>
    content.logic.findIndex((rule) => rule.id === id) + 1

  if (issues.length === 0) return null
  return (
    <ul className="flex flex-col gap-2">
      {issues.map((issue, index) => {
        const error = issue.severity === "error"
        const Icon = error ? CircleAlertIcon : TriangleAlertIcon
        return (
          <li
            key={`${issue.code}-${index}`}
            className={cn(
              "flex items-start gap-2 rounded-2xl border p-3 text-sm",
              error
                ? "border-destructive/40 bg-destructive/5"
                : "border-amber-500/40 bg-amber-500/5"
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                error
                  ? "text-destructive"
                  : "text-amber-700 dark:text-amber-300"
              )}
              aria-hidden
            />
            <span className="flex-1">
              <span className="sr-only">
                {error ? t("publish.error") : t("publish.warning")}:{" "}
              </span>
              {t(`publish.issues.${issue.code}`, {
                field: fieldName(issue.fieldId),
                target: targetName(issue.target),
                rule: ruleNumber(issue.ruleId),
                count: issue.count ?? 0,
              })}
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => onFix(issueTab(issue), issue.fieldId)}
            >
              {t("publish.fix")}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
