import { useQuery } from "@tanstack/react-query"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  RadarIcon,
  WandSparklesIcon,
} from "lucide-react"
import { useId, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DUPLICATE_STRATEGIES,
  getAnswerFields,
  getMappableTargets,
  getRequiredTargets,
  newFormElementId,
  suggestMapping,
  validateMapping,
  type DuplicateStrategy,
  type FormField,
} from "@/engine/forms"
import { label } from "@/engine/metadata"
import { directoryQueries, useObjectDef } from "@/features/records"
import { getCurrentLanguage } from "@/lib/i18n"

import type { Form } from "../../api/forms.schemas"
import { useBuilder } from "../../lib/builder-store"
import { TRACKING_FIELDS } from "../../lib/defaults"
import { useFieldTitle } from "../build/canvas"
import { FieldKindIcon, useFieldKindLabel } from "../build/field-kinds"

const NONE = "__none"

/** "CRM eşleme" tab (B4.5): form answers → lead fields. */
export function MappingPanel({ form }: { form: Form }) {
  const { t } = useTranslation("forms")
  const id = useId()
  const language = getCurrentLanguage()
  const content = useBuilder((state) => state.content)
  const setMapping = useBuilder((state) => state.setMapping)
  const addFields = useBuilder((state) => state.addFields)
  const fieldTitle = useFieldTitle()
  const kindLabel = useFieldKindLabel()
  const objectDef = useObjectDef(content.mapping.objectKey)
  const { data: users } = useQuery(directoryQueries.users())
  const mapping = content.mapping
  const answers = getAnswerFields(content)

  const issues = useMemo(
    () => (objectDef ? validateMapping(content, objectDef) : []),
    [content, objectDef]
  )
  if (!objectDef) return null

  const objectName = label(objectDef.label, language)
  const targetName = (key: string) => {
    const target = objectDef.fields.find((item) => item.key === key)
    return target ? label(target.label, language) : key
  }
  const used = new Set(Object.values(mapping.fields))
  const sourceOf = (targetKey: string) =>
    answers.find((field) => mapping.fields[field.id] === targetKey)
  const rowIssue = (field: FormField) =>
    issues.find((issue) => issue.fieldId === field.id)
  const hasEmail = answers.some(
    (field) =>
      field.type === "email" &&
      objectDef.fields.find((target) => target.key === mapping.fields[field.id])
        ?.type === "email"
  )
  const missingTracking = TRACKING_FIELDS.filter(
    (tracking) => !content.fields.some((field) => field.key === tracking.key)
  )

  function mapField(field: FormField, target: string | null) {
    const fields = { ...mapping.fields }
    if (target) fields[field.id] = target
    else delete fields[field.id]
    setMapping({ ...mapping, fields })
  }

  function addTracking() {
    const lastStep = content.steps.at(-1)!
    addFields(
      missingTracking.map((tracking): FormField => ({
        id: newFormElementId("fld"),
        key: tracking.key,
        type: "hidden",
        stepId: lastStep.id,
        label: tracking.label,
        width: "full",
        prefill: tracking.param
          ? { kind: "query", param: tracking.param }
          : { kind: "referrer" },
      })),
      { stepId: lastStep.id }
    )
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="mx-auto flex max-w-5xl flex-col gap-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {t("mapping.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("mapping.description", { object: objectName })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setMapping({
              ...mapping,
              fields: suggestMapping(content, objectDef),
            })
          }
        >
          <WandSparklesIcon data-icon="inline-start" />
          {t("mapping.auto")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("mapping.required.title", { object: objectName })}
          </CardTitle>
          <CardDescription>{t("mapping.required.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {getRequiredTargets(objectDef).map((target) => {
              const source = sourceOf(target.key)
              const optional = issues.some(
                (issue) =>
                  issue.code === "requiredTargetOptional" &&
                  issue.target === target.key
              )
              const ok = !!source && !optional
              return (
                <li
                  key={target.key}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  {ok ? (
                    <CircleCheckIcon
                      className="size-4 text-emerald-600"
                      aria-hidden
                    />
                  ) : (
                    <CircleAlertIcon
                      className="size-4 text-destructive"
                      aria-hidden
                    />
                  )}
                  <span className="font-medium">
                    {label(target.label, language)}
                  </span>
                  <span
                    className={
                      ok ? "text-muted-foreground" : "text-destructive"
                    }
                  >
                    {!source
                      ? t("mapping.required.missing")
                      : optional
                        ? t("mapping.required.optional", {
                            field: fieldTitle(source),
                          })
                        : t("mapping.required.from", {
                            field: fieldTitle(source),
                          })}
                  </span>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="relative overflow-x-auto rounded-3xl border">
        <Table aria-label={t("mapping.table")}>
          <TableHeader>
            <TableRow>
              <TableHead>{t("mapping.columns.field")}</TableHead>
              <TableHead>{t("mapping.columns.type")}</TableHead>
              <TableHead className="min-w-56">
                {t("mapping.columns.target", { object: objectName })}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {answers.map((field) => {
              const current = mapping.fields[field.id] ?? null
              const targets = getMappableTargets(field, objectDef).filter(
                (target) => target.key === current || !used.has(target.key)
              )
              const items = [
                { value: NONE, label: t("mapping.none") },
                ...targets.map((target) => ({
                  value: target.key,
                  label: label(target.label, language),
                })),
              ]
              const issue = rowIssue(field)
              const title = fieldTitle(field)
              return (
                <TableRow key={field.id}>
                  <TableCell className="font-medium">{title}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <FieldKindIcon type={field.type} className="size-3.5" />
                      {kindLabel(field)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Select
                        items={
                          issue &&
                          current &&
                          !targets.some((item) => item.key === current)
                            ? [
                                ...items,
                                { value: current, label: targetName(current) },
                              ]
                            : items
                        }
                        value={current ?? NONE}
                        onValueChange={(value) =>
                          mapField(
                            field,
                            value === NONE || typeof value !== "string"
                              ? null
                              : value
                          )
                        }
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-label={t("mapping.target", { field: title })}
                          aria-invalid={issue ? true : undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {issue ? (
                        <p className="text-xs text-destructive">
                          {t(`mapping.issues.${issue.code}`, {
                            target: issue.target
                              ? targetName(issue.target)
                              : "",
                          })}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("mapping.unmappedHint")}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("mapping.duplicate.title")}</CardTitle>
            <CardDescription>
              {t("mapping.duplicate.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              aria-label={t("mapping.duplicate.title")}
              value={mapping.duplicate}
              onValueChange={(value) =>
                setMapping({
                  ...mapping,
                  duplicate: value as DuplicateStrategy,
                })
              }
            >
              {DUPLICATE_STRATEGIES.map((strategy) => {
                const disabled = strategy === "linkContactByEmail" && !hasEmail
                return (
                  <Field
                    key={strategy}
                    orientation="horizontal"
                    data-disabled={disabled || undefined}
                  >
                    <RadioGroupItem
                      value={strategy}
                      id={`${id}-${strategy}`}
                      disabled={disabled}
                      aria-describedby={`${id}-${strategy}-hint`}
                    />
                    <div className="flex flex-col gap-0.5">
                      <FieldLabel
                        htmlFor={`${id}-${strategy}`}
                        className="font-normal"
                      >
                        {t(`mapping.duplicate.${strategy}`)}
                      </FieldLabel>
                      <FieldDescription id={`${id}-${strategy}-hint`}>
                        {disabled
                          ? t("mapping.duplicate.needsEmail")
                          : t(`mapping.duplicate.${strategy}Hint`)}
                      </FieldDescription>
                    </div>
                  </Field>
                )
              })}
            </RadioGroup>
            {issues.some((issue) => issue.code === "duplicateNeedsEmail") ? (
              <p className="mt-2 text-xs text-destructive">
                {t("mapping.issues.duplicateNeedsEmail")}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("mapping.assignment.title")}</CardTitle>
            <CardDescription>
              {t("mapping.assignment.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor={`${id}-owner`}>
                {t("mapping.assignment.owner")}
              </FieldLabel>
              <Select
                items={[
                  {
                    value: NONE,
                    label: t("mapping.assignment.formOwner", {
                      name: form.ownerName ?? "",
                    }),
                  },
                  ...(users?.data ?? [])
                    .filter((user) => user.role !== "viewer")
                    .map((user) => ({ value: user.id, label: user.name })),
                ]}
                value={mapping.ownerId ?? NONE}
                onValueChange={(value) =>
                  setMapping({
                    ...mapping,
                    ownerId:
                      value === NONE || typeof value !== "string"
                        ? null
                        : value,
                  })
                }
              >
                <SelectTrigger id={`${id}-owner`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    {t("mapping.assignment.formOwner", {
                      name: form.ownerName ?? "",
                    })}
                  </SelectItem>
                  {(users?.data ?? [])
                    .filter((user) => user.role !== "viewer")
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                {t("mapping.tracking.title")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("mapping.tracking.description")}
              </p>
              <div className="flex flex-wrap gap-1">
                {TRACKING_FIELDS.map((tracking) => (
                  <Badge
                    key={tracking.key}
                    variant={
                      missingTracking.includes(tracking)
                        ? "outline"
                        : "secondary"
                    }
                  >
                    {tracking.param ?? "referrer"}
                  </Badge>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="self-start"
                disabled={missingTracking.length === 0}
                onClick={addTracking}
              >
                <RadarIcon data-icon="inline-start" />
                {missingTracking.length
                  ? t("mapping.tracking.add")
                  : t("mapping.tracking.added")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
