import { useNavigate } from "@tanstack/react-router"
import { Trash2Icon, XIcon } from "lucide-react"
import { useId, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_TRIGGER_TYPES,
  automationRuleInputSchema,
  triggerObjectKey,
  type AutomationAction,
  type AutomationActionType,
  type AutomationRuleInput,
  type AutomationTrigger,
  type AutomationTriggerType,
} from "@/engine/automation"
import { label } from "@/engine/metadata"
import { useSession } from "@/features/auth"
import { FilterBar } from "@/features/records"
import { getErrorMessage } from "@/lib/api"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"
import { can } from "@/lib/rbac"

import {
  useCreateAutomationMutation,
  useDeleteAutomationMutation,
  useUpdateAutomationMutation,
} from "../api/automation.mutations"
import type { AutomationRule } from "../api/automation.schemas"
import { useAutomationLabels } from "../hooks/use-automation-labels"
import { defaultAction, defaultTrigger, describeTrigger } from "../lib/describe"
import { AutomationRuns } from "./automation-runs"

const ANY = "__any"
const OWNER = "owner"

const EMPTY_RULE: AutomationRuleInput = {
  name: "",
  enabled: true,
  trigger: { type: "submission.created", formId: null },
  conditions: [],
  actions: [],
}

interface Option {
  value: string
  label: string
}

function SelectField({
  label: text,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <Field>
      {/* The trigger carries the name (`aria-label`); Base UI's Select has no labelable input. */}
      <span className="text-sm leading-snug font-medium">{text}</span>
      <Select
        items={options}
        value={value}
        disabled={disabled}
        onValueChange={(next) => next !== null && onChange(String(next))}
      >
        <SelectTrigger aria-label={text} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}

/**
 * Rule editor (B7.3): when (trigger) → for which records (conditions, the
 * list filter editor) → do what (ordered actions). Read-only for managers.
 */
export function AutomationEditorPage({ rule }: { rule?: AutomationRule }) {
  const { t } = useTranslation("automation")
  const language = getCurrentLanguage()
  const id = useId()
  const navigate = useNavigate()
  const { subject } = useSession()
  const canManage = can(subject, "manage", "automation")
  const { labels, objects, forms, members, templates } = useAutomationLabels()
  const [draft, setDraft] = useState<AutomationRuleInput>(() =>
    rule
      ? {
          name: rule.name,
          enabled: rule.enabled,
          trigger: rule.trigger,
          conditions: rule.conditions,
          actions: rule.actions,
        }
      : EMPTY_RULE
  )
  const [invalid, setInvalid] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const create = useCreateAutomationMutation()
  const update = useUpdateAutomationMutation(rule?.id ?? "")
  const remove = useDeleteAutomationMutation()
  const pending = create.isPending || update.isPending

  const conditionObject = objects.find(
    (item) => item.key === triggerObjectKey(draft.trigger)
  )
  const hasQuotes = objects.some((item) => item.key === "quote")
  const pipelineObjects = objects.filter((item) => item.pipeline)
  const people: Option[] = [
    { value: OWNER, label: t("actions.owner") },
    ...members.map((user) => ({ value: user.id, label: user.name })),
  ]
  const objectOptions = (list: typeof objects): Option[] =>
    list.map((item) => ({
      value: item.key,
      label: label(item.label, language),
    }))

  const setTrigger = (trigger: AutomationTrigger) =>
    // Other trigger, other object: the old conditions no longer apply.
    setDraft((current) => ({
      ...current,
      trigger,
      conditions:
        triggerObjectKey(trigger) === triggerObjectKey(current.trigger)
          ? current.conditions
          : [],
    }))
  const setAction = (index: number, action: AutomationAction) =>
    setDraft((current) => ({
      ...current,
      actions: current.actions.map((item, i) => (i === index ? action : item)),
    }))

  async function save() {
    const parsed = automationRuleInputSchema.safeParse(draft)
    setInvalid(!parsed.success)
    if (!parsed.success) return
    try {
      if (rule) {
        await update.mutateAsync(parsed.data)
        toast.success(t("editor.saved"))
      } else {
        const created = await create.mutateAsync(parsed.data)
        toast.success(t("editor.created"))
        await navigate({
          to: "/settings/automations/$ruleId",
          params: { ruleId: created.id },
          replace: true,
        })
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const triggerTypes = AUTOMATION_TRIGGER_TYPES.filter(
    (type) => type !== "quote.noResponse" || hasQuotes
  )

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={rule ? rule.name : t("editor.newTitle")}
        description={describeTrigger(draft.trigger, t, labels)}
      />
      {canManage ? null : (
        <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
      )}

      <fieldset disabled={!canManage} className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Field
              className="flex-1"
              data-invalid={invalid && !draft.name.trim() ? true : undefined}
            >
              <FieldLabel htmlFor={`${id}-name`}>{t("editor.name")}</FieldLabel>
              <Input
                id={`${id}-name`}
                value={draft.name}
                maxLength={120}
                aria-invalid={invalid && !draft.name.trim() ? true : undefined}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </Field>
            <label className="flex items-center gap-2 pb-2 text-sm font-medium">
              <Switch
                checked={draft.enabled}
                disabled={!canManage}
                onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
              />
              {t("editor.enabled")}
            </label>
          </CardContent>
        </Card>

        <Section title={t("editor.when")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t("triggers.type")}
              value={draft.trigger.type}
              disabled={!canManage}
              options={triggerTypes.map((type) => ({
                value: type,
                label: t(
                  `triggers.types.${type}` as "triggers.types.record.created"
                ),
              }))}
              onChange={(type) =>
                setTrigger(defaultTrigger(type as AutomationTriggerType))
              }
            />
            <TriggerFields
              trigger={draft.trigger}
              disabled={!canManage}
              onChange={setTrigger}
              forms={forms.map((form) => ({
                value: form.id,
                label: form.name,
              }))}
              objects={objectOptions(objects)}
              pipelineObjects={objectOptions(pipelineObjects)}
              stages={(objectKey) =>
                objects
                  .find((item) => item.key === objectKey)
                  ?.pipeline?.stages.map((stage) => ({
                    value: stage.key,
                    label: label(stage.label, language),
                  })) ?? []
              }
            />
          </div>
        </Section>

        <Section title={t("editor.which")} description={t("editor.whichHint")}>
          {conditionObject ? (
            <FilterBar
              objectDef={conditionObject}
              filters={draft.conditions}
              onChange={(conditions) => setDraft({ ...draft, conditions })}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("editor.noFields")}
            </p>
          )}
        </Section>

        <Section title={t("editor.what")} description={t("editor.whatHint")}>
          {draft.actions.length ? (
            <ol className="flex flex-col gap-3">
              {draft.actions.map((action, index) => {
                const typeLabel = t(`actions.types.${action.type}`)
                return (
                  <li
                    key={index}
                    className="flex flex-col gap-3 rounded-3xl border p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {index + 1}. {typeLabel}
                      </span>
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("editor.removeAction", {
                            action: typeLabel,
                          })}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              actions: draft.actions.filter(
                                (_, i) => i !== index
                              ),
                            })
                          }
                        >
                          <XIcon />
                        </Button>
                      ) : null}
                    </div>
                    <ActionFields
                      action={action}
                      disabled={!canManage}
                      invalid={invalid}
                      onChange={(next) => setAction(index, next)}
                      members={members.map((user) => ({
                        value: user.id,
                        label: user.name,
                      }))}
                      people={people}
                      templates={templates.map((template) => ({
                        value: template.id,
                        label: resolveI18nText(template.label, language),
                      }))}
                    />
                  </li>
                )
              })}
            </ol>
          ) : null}
          {canManage && draft.actions.length < 5 ? (
            <div className="max-w-xs">
              <SelectField
                label={t("editor.addAction")}
                value=""
                options={AUTOMATION_ACTION_TYPES.filter(
                  (type) => type !== "sendWhatsAppTemplate" || templates.length
                ).map((type) => ({
                  value: type,
                  label: t(`actions.types.${type}`),
                }))}
                onChange={(type) =>
                  setDraft({
                    ...draft,
                    actions: [
                      ...draft.actions,
                      defaultAction(type as AutomationActionType, {
                        templateId: templates[0]?.id,
                      }),
                    ],
                  })
                }
              />
            </div>
          ) : null}
        </Section>
      </fieldset>

      {invalid ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {t("editor.invalid")}
        </p>
      ) : null}

      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void save()} disabled={pending}>
            {rule ? t("editor.save") : t("editor.create")}
          </Button>
          <Button
            variant="outline"
            onClick={() => void navigate({ to: "/settings/automations" })}
          >
            {t("editor.cancel")}
          </Button>
          {rule ? (
            <Button
              variant="destructive"
              className="sm:ml-auto"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2Icon aria-hidden />
              {t("editor.delete")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {rule ? <AutomationRuns ruleId={rule.id} /> : null}

      {rule ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("editor.deleteTitle")}
          description={t("editor.deleteDescription", { name: rule.name })}
          confirmLabel={t("editor.delete")}
          variant="destructive"
          isPending={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync(rule.id)
            toast.success(t("editor.deleted"))
            await navigate({ to: "/settings/automations" })
          }}
        />
      ) : null}
    </div>
  )
}

function TriggerFields({
  trigger,
  disabled,
  onChange,
  forms,
  objects,
  pipelineObjects,
  stages,
}: {
  trigger: AutomationTrigger
  disabled: boolean
  onChange: (trigger: AutomationTrigger) => void
  forms: Option[]
  objects: Option[]
  pipelineObjects: Option[]
  stages: (objectKey: string) => Option[]
}) {
  const { t } = useTranslation("automation")
  const id = useId()
  switch (trigger.type) {
    case "submission.created":
      return (
        <SelectField
          label={t("triggers.form")}
          value={trigger.formId ?? ANY}
          disabled={disabled}
          options={[{ value: ANY, label: t("triggers.anyForm") }, ...forms]}
          onChange={(value) =>
            onChange({ ...trigger, formId: value === ANY ? null : value })
          }
        />
      )
    case "record.created":
      return (
        <SelectField
          label={t("triggers.object")}
          value={trigger.objectKey}
          disabled={disabled}
          options={objects}
          onChange={(objectKey) => onChange({ ...trigger, objectKey })}
        />
      )
    case "record.stageChanged":
      return (
        <>
          <SelectField
            label={t("triggers.object")}
            value={trigger.objectKey}
            disabled={disabled}
            options={pipelineObjects}
            onChange={(objectKey) =>
              onChange({ ...trigger, objectKey, stage: null })
            }
          />
          <SelectField
            label={t("triggers.stage")}
            value={trigger.stage ?? ANY}
            disabled={disabled}
            options={[
              { value: ANY, label: t("triggers.anyStage") },
              ...stages(trigger.objectKey),
            ]}
            onChange={(stage) =>
              onChange({ ...trigger, stage: stage === ANY ? null : stage })
            }
          />
        </>
      )
    case "quote.noResponse":
      return (
        <Field>
          <FieldLabel htmlFor={`${id}-days`}>
            {t("triggers.afterDays")}
          </FieldLabel>
          <Input
            id={`${id}-days`}
            type="number"
            min={1}
            max={30}
            value={trigger.afterDays}
            onChange={(event) =>
              onChange({
                ...trigger,
                afterDays: Math.round(Number(event.target.value)) || 1,
              })
            }
          />
        </Field>
      )
  }
}

function ActionFields({
  action,
  disabled,
  invalid,
  onChange,
  members,
  people,
  templates,
}: {
  action: AutomationAction
  disabled: boolean
  invalid: boolean
  onChange: (action: AutomationAction) => void
  members: Option[]
  people: Option[]
  templates: Option[]
}) {
  const { t } = useTranslation("automation")
  const id = useId()
  switch (action.type) {
    case "assignRoundRobin":
      return (
        <fieldset
          className="flex flex-col gap-2"
          aria-invalid={invalid && !action.userIds.length ? true : undefined}
        >
          <legend className="mb-2 text-sm font-medium">
            {t("actions.users")}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {members.map((member) => (
              <label
                key={member.value}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={action.userIds.includes(member.value)}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    onChange({
                      ...action,
                      userIds: checked
                        ? [...action.userIds, member.value]
                        : action.userIds.filter((id) => id !== member.value),
                    })
                  }
                />
                {member.label}
              </label>
            ))}
          </div>
        </fieldset>
      )
    case "createTask":
      return (
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem_14rem]">
          <Field
            data-invalid={invalid && !action.title.trim() ? true : undefined}
          >
            <FieldLabel htmlFor={`${id}-title`}>
              {t("actions.taskTitle")}
            </FieldLabel>
            <Input
              id={`${id}-title`}
              value={action.title}
              maxLength={200}
              aria-invalid={invalid && !action.title.trim() ? true : undefined}
              onChange={(event) =>
                onChange({ ...action, title: event.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-due`}>
              {t("actions.dueInDays")}
            </FieldLabel>
            <Input
              id={`${id}-due`}
              type="number"
              min={0}
              max={30}
              value={action.dueInDays}
              onChange={(event) =>
                onChange({
                  ...action,
                  dueInDays: Math.max(
                    0,
                    Math.round(Number(event.target.value)) || 0
                  ),
                })
              }
            />
          </Field>
          <SelectField
            label={t("actions.assignee")}
            value={action.assignee}
            disabled={disabled}
            options={people}
            onChange={(assignee) => onChange({ ...action, assignee })}
          />
        </div>
      )
    case "sendWhatsAppTemplate":
      return templates.length ? (
        <SelectField
          label={t("actions.template")}
          value={action.templateId}
          disabled={disabled}
          options={templates}
          onChange={(templateId) => onChange({ ...action, templateId })}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("actions.noTemplates")}
        </p>
      )
    case "notify":
      return (
        <div className="max-w-xs">
          <SelectField
            label={t("actions.to")}
            value={action.to}
            disabled={disabled}
            options={people}
            onChange={(to) => onChange({ ...action, to })}
          />
        </div>
      )
  }
}
