import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getFieldType, useFieldServices } from "@/engine/field-types"
import type { Condition, FilterOperator } from "@/engine/logic"
import {
  getField,
  label,
  type FieldDef,
  type ObjectDef,
} from "@/engine/metadata"
import { getCurrentLanguage } from "@/lib/i18n"

import {
  getFilterableFields,
  getOperandKind,
  getOperators,
  isConditionComplete,
} from "../lib/conditions"

interface FilterEditorProps {
  objectDef: ObjectDef
  initial?: Condition
  onApply: (condition: Condition) => void
  onCancel: () => void
}

const DATE_TYPES = new Set(["date", "datetime"])
const NUMBER_TYPES = new Set(["number", "currency", "percent"])

function inputTypeOf(field: FieldDef) {
  if (DATE_TYPES.has(field.type)) return "date"
  if (NUMBER_TYPES.has(field.type)) return "number"
  return "text"
}

function toOperand(field: FieldDef, raw: string) {
  if (raw === "") return null
  return NUMBER_TYPES.has(field.type) ? Number(raw) : raw
}

/** Field → operator → operand, with operand inputs matching the field type. */
export function FilterEditor({
  objectDef,
  initial,
  onApply,
  onCancel,
}: FilterEditorProps) {
  const { t } = useTranslation(["records", "engine", "common"])
  const id = useId()
  const language = getCurrentLanguage()
  const services = useFieldServices()
  const fields = getFilterableFields(objectDef)
  const [condition, setCondition] = useState<Condition>(
    () =>
      initial ?? {
        field: fields[0]?.key ?? "",
        op: fields[0] ? getOperators(fields[0])[0]! : "eq",
      }
  )
  const field = getField(objectDef, condition.field)
  const operators = field ? getOperators(field) : []
  const kind = getOperandKind(condition.op)

  function changeField(key: string) {
    const next = getField(objectDef, key)
    if (!next) return
    setCondition({ field: key, op: getOperators(next)[0]! })
  }

  function changeOperator(op: FilterOperator) {
    // Keep a compatible operand (e.g. contains → eq), reset otherwise.
    const sameShape = getOperandKind(op) === kind
    setCondition((current) => ({
      field: current.field,
      op,
      ...(sameShape ? { value: current.value, label: current.label } : {}),
    }))
  }

  function renderOperand() {
    if (!field || kind === "none") return null

    if (kind === "list") {
      const options =
        getFieldType(field.type).getOptions?.(field, { language, services }) ??
        []
      const selected = Array.isArray(condition.value)
        ? (condition.value as string[])
        : []
      return (
        <fieldset className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          <legend className="sr-only">{t("records:filters.values")}</legend>
          {options.map((option) => {
            const optionId = `${id}-option-${option.value}`
            return (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={optionId}
                  checked={selected.includes(option.value)}
                  onCheckedChange={(checked) =>
                    setCondition((current) => ({
                      ...current,
                      value: checked
                        ? [...selected, option.value]
                        : selected.filter((item) => item !== option.value),
                    }))
                  }
                />
                <Label htmlFor={optionId} className="font-normal">
                  {option.label}
                </Label>
              </div>
            )
          })}
        </fieldset>
      )
    }

    if (field.type === "relation") {
      const Relation = getFieldType("relation").Input
      return (
        <Relation
          id={`${id}-value`}
          field={{ ...field, required: true }}
          value={typeof condition.value === "string" ? condition.value : null}
          refValue={
            typeof condition.value === "string" && condition.label
              ? { id: condition.value, label: condition.label }
              : null
          }
          ariaLabel={t("records:filters.value")}
          onRefChange={(ref) =>
            setCondition((current) => ({ ...current, label: ref?.label }))
          }
          onChange={(value) =>
            setCondition((current) => ({
              ...current,
              value: value ?? undefined,
            }))
          }
        />
      )
    }

    const type = inputTypeOf(field)
    if (kind === "range") {
      const [from = "", to = ""] = Array.isArray(condition.value)
        ? (condition.value as unknown[]).map((item) => (item ?? "") as string)
        : []
      const update = (index: 0 | 1, raw: string) =>
        setCondition((current) => {
          const range = Array.isArray(current.value)
            ? [...(current.value as unknown[])]
            : [null, null]
          range[index] = toOperand(field, raw)
          return { ...current, value: range }
        })
      return (
        <div className="flex items-center gap-2">
          <Input
            type={type}
            aria-label={t("records:filters.from")}
            value={String(from)}
            onChange={(event) => update(0, event.target.value)}
          />
          <span aria-hidden>–</span>
          <Input
            type={type}
            aria-label={t("records:filters.to")}
            value={String(to)}
            onChange={(event) => update(1, event.target.value)}
          />
        </div>
      )
    }

    return (
      <Input
        id={`${id}-value`}
        type={type}
        aria-label={t("records:filters.value")}
        value={String(condition.value ?? "")}
        onChange={(event) =>
          setCondition((current) => ({
            ...current,
            value: toOperand(field, event.target.value) ?? undefined,
          }))
        }
      />
    )
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (isConditionComplete(condition)) onApply(condition)
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-field`}>{t("records:filters.field")}</Label>
        <Select
          items={fields.map((item) => ({
            value: item.key,
            label: label(item.label, language),
          }))}
          value={condition.field}
          onValueChange={(value) => {
            if (typeof value === "string") changeField(value)
          }}
        >
          <SelectTrigger id={`${id}-field`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fields.map((item) => (
              <SelectItem key={item.key} value={item.key}>
                {label(item.label, language)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-operator`}>
          {t("records:filters.operator")}
        </Label>
        <Select
          items={operators.map((op) => ({
            value: op,
            label: t(`engine:operators.${op}`),
          }))}
          value={condition.op}
          onValueChange={(value) => {
            if (typeof value === "string")
              changeOperator(value as FilterOperator)
          }}
        >
          <SelectTrigger id={`${id}-operator`} className="w-full">
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
      </div>
      {renderOperand()}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("common:actions.cancel")}
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!isConditionComplete(condition)}
        >
          {t("common:actions.apply")}
        </Button>
      </div>
    </form>
  )
}
