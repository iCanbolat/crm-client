import {
  ChevronDownIcon,
  GitBranchIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { EmptyState } from "@/components/common/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getFieldType } from "@/engine/field-types"
import {
  detectLogicCycles,
  findBrokenLogicRefs,
  findIncompleteRules,
  getAnswerFields,
  getLogicOperators,
  isInputField,
  LOGIC_ACTIONS,
  newFormElementId,
  toEngineFieldDef,
  type FormField,
  type FormLogicRule,
  type LogicAction,
  type LogicTarget,
} from "@/engine/forms"
import {
  getOperandKind,
  type Condition,
  type FilterOperator,
} from "@/engine/logic"
import { cn } from "@/lib/utils"

import { useBuilder } from "../../lib/builder-store"
import { useFieldTitle } from "../build/canvas"
import { useStepTitle } from "../build/step-tabs"

type ConditionValue = Condition["value"]

function OperandInput({
  id,
  field,
  op,
  value,
  label,
  onChange,
}: {
  id: string
  field: FormField
  op: FilterOperator
  value: ConditionValue
  label: string
  onChange: (value: ConditionValue) => void
}) {
  const kind = getOperandKind(op)
  if (kind === "none") return null
  const engineField = toEngineFieldDef(field, { required: true })
  // List operators pick several of the field's options.
  const operandField =
    kind === "list" ? { ...engineField, type: "multiselect" } : engineField
  const definition = getFieldType(operandField.type)
  return (
    <definition.Input
      id={id}
      field={operandField}
      ariaLabel={label}
      value={value ?? null}
      onChange={(next) => onChange(next === null ? undefined : next)}
    />
  )
}

function TargetsPicker({
  rule,
  onChange,
}: {
  rule: FormLogicRule
  onChange: (targets: LogicTarget[]) => void
}) {
  const { t } = useTranslation("forms")
  const content = useBuilder((state) => state.content)
  const fieldTitle = useFieldTitle()
  const stepTitle = useStepTitle()
  const conditionFields = new Set(
    rule.conditions.map((condition) => condition.field)
  )
  const fields = content.fields.filter(
    (field) =>
      !conditionFields.has(field.id) &&
      (rule.action === "require" ? isInputField(field) : true)
  )
  const has = (target: LogicTarget) =>
    rule.targets.some(
      (item) => item.kind === target.kind && item.id === target.id
    )
  const toggle = (target: LogicTarget, checked: boolean) =>
    onChange(
      checked
        ? [...rule.targets, target]
        : rule.targets.filter(
            (item) => !(item.kind === target.kind && item.id === target.id)
          )
    )
  const nameOf = (target: LogicTarget) => {
    if (target.kind === "step") {
      const step = content.steps.find((item) => item.id === target.id)
      return step ? stepTitle(step) : target.id
    }
    const field = content.fields.find((item) => item.id === target.id)
    return field ? fieldTitle(field) : target.id
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={t("logic.targets")}
            className={cn(
              "h-auto min-h-9 w-full justify-between py-1.5 font-normal",
              rule.targets.length === 0 && "text-muted-foreground"
            )}
          />
        }
      >
        <span className="flex flex-wrap gap-1">
          {rule.targets.length === 0
            ? t("logic.targetsPlaceholder")
            : rule.targets.map((target) => (
                <Badge key={`${target.kind}:${target.id}`} variant="secondary">
                  {nameOf(target)}
                </Badge>
              ))}
        </span>
        <ChevronDownIcon className="text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-80 min-w-64 overflow-y-auto"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("logic.targetFields")}</DropdownMenuLabel>
          {fields.map((field) => {
            const target = { kind: "field" as const, id: field.id }
            return (
              <DropdownMenuCheckboxItem
                key={field.id}
                checked={has(target)}
                onCheckedChange={(checked) => toggle(target, checked)}
              >
                {fieldTitle(field)}
              </DropdownMenuCheckboxItem>
            )
          })}
        </DropdownMenuGroup>
        {content.steps.length > 1 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("logic.targetSteps")}</DropdownMenuLabel>
              {content.steps.map((step) => {
                const target = { kind: "step" as const, id: step.id }
                return (
                  <DropdownMenuCheckboxItem
                    key={step.id}
                    checked={has(target)}
                    onCheckedChange={(checked) => toggle(target, checked)}
                  >
                    {stepTitle(step)}
                  </DropdownMenuCheckboxItem>
                )
              })}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RuleCard({
  rule,
  index,
  problem,
  onChange,
  onRemove,
}: {
  rule: FormLogicRule
  index: number
  problem: "broken" | "incomplete" | null
  onChange: (rule: FormLogicRule, coalesce?: string) => void
  onRemove: () => void
}) {
  const { t } = useTranslation(["forms", "engine"])
  const content = useBuilder((state) => state.content)
  const fieldTitle = useFieldTitle()
  const answerFields = getAnswerFields(content)
  const fieldItems = answerFields.map((field) => ({
    value: field.id,
    label: fieldTitle(field),
  }))
  const prefix = `rule-${rule.id}`

  const setCondition = (
    position: number,
    condition: Condition,
    coalesce?: string
  ) =>
    onChange(
      {
        ...rule,
        conditions: rule.conditions.map((item, i) =>
          i === position ? condition : item
        ),
      },
      coalesce
    )

  return (
    <li
      aria-labelledby={`${prefix}-title`}
      className={cn(
        "flex flex-col gap-4 rounded-3xl border bg-card p-4",
        problem && "border-amber-500/60"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id={`${prefix}-title`}
          className="flex items-center gap-2 font-medium"
        >
          <GitBranchIcon className="size-4 text-muted-foreground" aria-hidden />
          {t("logic.rule", { index: index + 1 })}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("logic.remove", { index: index + 1 })}
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {t("logic.if")}
          {rule.conditions.length > 1 ? (
            <Select
              items={(["all", "any"] as const).map((match) => ({
                value: match,
                label: t(`logic.match.${match}`),
              }))}
              value={rule.match}
              onValueChange={(match) =>
                onChange({ ...rule, match: match as FormLogicRule["match"] })
              }
            >
              <SelectTrigger size="sm" aria-label={t("logic.match.label")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["all", "any"] as const).map((match) => (
                  <SelectItem key={match} value={match}>
                    {t(`logic.match.${match}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        <ol className="flex flex-col gap-2">
          {rule.conditions.map((condition, position) => {
            const field = answerFields.find(
              (item) => item.id === condition.field
            )
            const operators = field ? getLogicOperators(field) : []
            const n = position + 1
            return (
              <li
                key={position}
                className="grid gap-2 rounded-2xl bg-muted/50 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)_minmax(0,1fr)_auto] sm:items-center"
              >
                <Select
                  items={fieldItems}
                  value={field ? condition.field : null}
                  onValueChange={(next) => {
                    const nextField = answerFields.find(
                      (item) => item.id === next
                    )
                    if (!nextField) return
                    setCondition(position, {
                      field: nextField.id,
                      op: getLogicOperators(nextField)[0] ?? "isNotEmpty",
                    })
                  }}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label={t("logic.field", { index: n })}
                  >
                    <SelectValue placeholder={t("logic.fieldPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  items={operators.map((op) => ({
                    value: op,
                    label: t(`engine:operators.${op}`),
                  }))}
                  value={condition.op}
                  onValueChange={(op) => {
                    const next = op as FilterOperator
                    const sameKind =
                      getOperandKind(next) === getOperandKind(condition.op)
                    setCondition(position, {
                      field: condition.field,
                      op: next,
                      ...(sameKind && condition.value !== undefined
                        ? { value: condition.value }
                        : {}),
                    })
                  }}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label={t("logic.operator", { index: n })}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op} value={op}>
                        {t(`engine:operators.${op}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="min-w-0">
                  {field ? (
                    <OperandInput
                      id={`${prefix}-value-${position}`}
                      field={field}
                      op={condition.op}
                      value={condition.value}
                      label={t("logic.value", { index: n })}
                      onChange={(value) =>
                        setCondition(
                          position,
                          { ...condition, value },
                          `condition.${position}.value`
                        )
                      }
                    />
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={rule.conditions.length === 1}
                  aria-label={t("logic.removeCondition", { index: n })}
                  onClick={() =>
                    onChange({
                      ...rule,
                      conditions: rule.conditions.filter(
                        (_, i) => i !== position
                      ),
                    })
                  }
                >
                  <XIcon />
                </Button>
              </li>
            )
          })}
        </ol>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            const first = answerFields[0]
            if (!first) return
            onChange({
              ...rule,
              conditions: [
                ...rule.conditions,
                {
                  field: first.id,
                  op: getLogicOperators(first)[0] ?? "isNotEmpty",
                },
              ],
            })
          }}
        >
          <PlusIcon data-icon="inline-start" />
          {t("logic.addCondition")}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,11rem)_minmax(0,1fr)] sm:items-center">
        <span className="text-sm font-medium">{t("logic.then")}</span>
        <Select
          items={LOGIC_ACTIONS.map((action) => ({
            value: action,
            label: t(`logic.actions.${action}`),
          }))}
          value={rule.action}
          onValueChange={(action) => {
            const next = action as LogicAction
            onChange({
              ...rule,
              action: next,
              // Steps can be shown or hidden; only inputs can be required.
              targets:
                next === "require"
                  ? rule.targets.filter((target) => {
                      if (target.kind === "step") return true
                      const field = content.fields.find(
                        (item) => item.id === target.id
                      )
                      return !!field && isInputField(field)
                    })
                  : rule.targets,
            })
          }}
        >
          <SelectTrigger className="w-full" aria-label={t("logic.action")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOGIC_ACTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {t(`logic.actions.${action}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TargetsPicker
          rule={rule}
          onChange={(targets) => onChange({ ...rule, targets })}
        />
      </div>

      {problem ? (
        <p className="flex items-center gap-1.5 text-sm text-amber-800 dark:text-amber-300">
          <TriangleAlertIcon className="size-4" aria-hidden />
          {t(`logic.${problem}`)}
        </p>
      ) : null}
    </li>
  )
}

/** "Mantık" tab (B4.4): show / hide / require rules. */
export function LogicPanel() {
  const { t } = useTranslation("forms")
  const content = useBuilder((state) => state.content)
  const setLogic = useBuilder((state) => state.setLogic)
  const fieldTitle = useFieldTitle()
  const answerFields = getAnswerFields(content)

  const { cycles, broken, incomplete } = useMemo(
    () => ({
      cycles: detectLogicCycles(content),
      broken: new Set(findBrokenLogicRefs(content).map((item) => item.ruleId)),
      incomplete: new Set(findIncompleteRules(content)),
    }),
    [content]
  )
  const titleOf = (id: string) => {
    const field = content.fields.find((item) => item.id === id)
    return field ? fieldTitle(field) : id
  }

  function addRule() {
    const first = answerFields[0]
    if (!first) return
    setLogic([
      ...content.logic,
      {
        id: newFormElementId("rule"),
        match: "all",
        conditions: [
          { field: first.id, op: getLogicOperators(first)[0] ?? "isNotEmpty" },
        ],
        action: "show",
        targets: [],
      },
    ])
  }

  return (
    <section
      aria-labelledby="logic-title"
      className="mx-auto flex max-w-4xl flex-col gap-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="logic-title" className="text-lg font-semibold">
            {t("logic.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("logic.description")}
          </p>
        </div>
        <Button
          type="button"
          disabled={answerFields.length === 0}
          onClick={addRule}
        >
          <PlusIcon data-icon="inline-start" />
          {t("logic.add")}
        </Button>
      </div>

      {cycles.length ? (
        <div
          role="alert"
          className="flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <TriangleAlertIcon
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden
          />
          <div className="flex flex-col gap-1">
            <p className="font-medium">{t("logic.cycleTitle")}</p>
            {cycles.map((cycle) => (
              <p key={cycle.join(">")}>
                {t("logic.cycle", {
                  fields: [...cycle, cycle[0]!].map(titleOf).join(" → "),
                })}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {content.logic.length === 0 ? (
        <EmptyState
          icon={GitBranchIcon}
          title={t("logic.empty")}
          description={
            answerFields.length ? t("logic.emptyHint") : t("logic.noFields")
          }
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {content.logic.map((rule, index) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              index={index}
              problem={
                broken.has(rule.id)
                  ? "broken"
                  : incomplete.has(rule.id)
                    ? "incomplete"
                    : null
              }
              onChange={(next, coalesce) =>
                setLogic(
                  content.logic.map((item) =>
                    item.id === rule.id ? next : item
                  ),
                  coalesce && `${rule.id}:${coalesce}`
                )
              }
              onRemove={() =>
                setLogic(content.logic.filter((item) => item.id !== rule.id))
              }
            />
          ))}
        </ol>
      )}
    </section>
  )
}
