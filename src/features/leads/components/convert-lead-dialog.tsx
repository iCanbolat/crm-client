import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getFieldType } from "@/engine/field-types"
import {
  getRecordTitle,
  type CrmRecord,
  type FieldDef,
} from "@/engine/metadata"
import { getLeadConversion } from "@/engine/modules"
import { matchesConditions } from "@/engine/records"
import { useObjectDef, useOptionalObjectDef } from "@/features/records"
import { useWorkspace } from "@/features/workspace"
import { resolveI18nText } from "@/lib/i18n-text"

import { leadQueries } from "../api/leads.queries"
import { useConvertLead } from "../api/leads.mutations"
import type { ConversionMatch, ConvertLeadInput } from "../api/leads.schemas"

const PICK = "__pick"
const NEW = "__new"
const NONE = "__none"

interface ConvertLeadDialogProps {
  lead: CrmRecord | null
  onOpenChange: (open: boolean) => void
}

/**
 * Lead conversion (B3.3): company + contact (+ deal, + draft quote). Sector
 * modules may make the company optional and add their own records (B8.4).
 */
export function ConvertLeadDialog({
  lead,
  onOpenChange,
}: ConvertLeadDialogProps) {
  return (
    <Dialog open={lead !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {lead ? (
          <ConvertLeadForm
            key={lead.id}
            lead={lead}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function relationField(objectKey: string, label: string): FieldDef {
  return {
    key: `${objectKey}Pick`,
    label: { tr: label, en: label },
    type: "relation",
    relation: { objectKey, displayField: "name" },
    required: true,
  }
}

interface ChoiceProps {
  legend: string
  name: string
  value: string
  onChange: (value: string) => void
  matches: ConversionMatch[]
  options: { value: string; label: string }[]
}

function Choice({
  legend,
  name,
  value,
  onChange,
  matches,
  options,
}: ChoiceProps) {
  const { t } = useTranslation("leads")
  const id = useId()
  const items = [
    ...matches.map((match) => ({
      value: match.id,
      label: t("convert.existing", { label: match.label }),
      hint: `${t("convert.suggested")} · ${t(`convert.reason.${match.reason}`)}`,
    })),
    ...options.map((item) => ({ ...item, hint: null })),
  ]
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <RadioGroup
        name={name}
        value={value}
        onValueChange={(next) => onChange(String(next))}
        aria-label={legend}
      >
        {items.map((item) => (
          <Field key={item.value} orientation="horizontal">
            <RadioGroupItem value={item.value} id={`${id}-${item.value}`} />
            <FieldLabel htmlFor={`${id}-${item.value}`} className="font-normal">
              <span className="flex flex-col">
                <span>{item.label}</span>
                {item.hint ? (
                  <span className="text-xs text-muted-foreground">
                    {item.hint}
                  </span>
                ) : null}
              </span>
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
    </FieldSet>
  )
}

function ConvertLeadForm({
  lead,
  onDone,
}: {
  lead: CrmRecord
  onDone: () => void
}) {
  const { t, i18n } = useTranslation(["leads", "common"])
  const navigate = useNavigate()
  const id = useId()
  const leadDef = useObjectDef("lead")!
  const quoteDef = useOptionalObjectDef("quote")
  const workspace = useWorkspace()
  const conversion = getLeadConversion(workspace.modules)
  const language = i18n.language === "en" ? "en" : "tr"
  const suggestions = useQuery(leadQueries.suggestions(lead.id))
  const mutation = useConvertLead(lead.id)

  const companyName = String(lead.values.companyName ?? "").trim()
  const leadName = getRecordTitle(leadDef, lead)
  const companyMatches = suggestions.data?.companies ?? []
  const contactMatches = suggestions.data?.contacts ?? []

  // Until the user picks, the best suggestion (or "new") is preselected.
  const [companyChoice, setCompanyChoice] = useState<string | null>(null)
  const [contactChoice, setContactChoice] = useState<string | null>(null)
  const company =
    companyChoice ??
    companyMatches[0]?.id ??
    (conversion.companyOptional && !companyName ? NONE : NEW)
  const contact = contactChoice ?? contactMatches[0]?.id ?? NEW
  const [pickedCompany, setPickedCompany] = useState<string | null>(null)
  const [pickedContact, setPickedContact] = useState<string | null>(null)
  const [newCompanyName, setNewCompanyName] = useState(companyName || leadName)
  const [newContactName, setNewContactName] = useState(leadName)
  const [createDeal, setCreateDeal] = useState(conversion.targets.length === 0)
  const [targets, setTargets] = useState<string[]>(() =>
    conversion.targets
      .filter(
        (target) =>
          target.defaultWhen &&
          matchesConditions(leadDef, lead.values, target.defaultWhen)
      )
      .map((target) => target.objectKey)
  )
  const [dealName, setDealName] = useState(
    t("convert.dealNameDefault", { company: companyName || leadName })
  )
  const [createQuote, setCreateQuote] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const canQuote = !!quoteDef?.createPath

  const RelationInput = getFieldType("relation").Input
  const companyMissing =
    (company === PICK && !pickedCompany) ||
    (company === NEW && !newCompanyName.trim())
  const contactMissing =
    (contact === PICK && !pickedContact) ||
    (contact === NEW && !newContactName.trim())
  const dealMissing = createDeal && !dealName.trim()
  const personMissing = company === NONE && contact === NONE

  function buildInput(): ConvertLeadInput {
    return {
      company:
        company === NONE
          ? { mode: "none" }
          : company === NEW
            ? { mode: "new", name: newCompanyName }
            : {
                mode: "existing",
                id: company === PICK ? pickedCompany! : company,
              },
      contact:
        contact === NONE
          ? { mode: "none" }
          : contact === NEW
            ? { mode: "new", name: newContactName }
            : {
                mode: "existing",
                id: contact === PICK ? pickedContact! : contact,
              },
      deal: createDeal ? { create: true, name: dealName } : { create: false },
      targets,
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (companyMissing || contactMissing || dealMissing || personMissing) {
      return
    }
    const result = await mutation.mutateAsync(buildInput()).catch(() => null)
    if (!result) return
    onDone()
    if (canQuote && createQuote && quoteDef?.createPath) {
      await navigate({
        to: quoteDef.createPath,
        search: {
          leadId: lead.id,
          ...(result.dealId ? { dealId: result.dealId } : {}),
        },
      } as never)
    } else if (result.targets[0]) {
      await navigate({
        to: "/o/$objectKey/$recordId",
        params: {
          objectKey: result.targets[0].objectKey,
          recordId: result.targets[0].id,
        },
      })
    } else if (result.dealId) {
      await navigate({
        to: "/o/$objectKey/$recordId",
        params: { objectKey: "deal", recordId: result.dealId },
      })
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{t("convert.title")}</DialogTitle>
        <DialogDescription>
          {t("convert.description", { name: leadName })}
        </DialogDescription>
      </DialogHeader>

      {suggestions.isPending ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("convert.searching")}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <Choice
          legend={t("convert.company")}
          name="company"
          value={company}
          onChange={setCompanyChoice}
          matches={companyMatches}
          options={[
            { value: PICK, label: t("convert.searchExisting") },
            { value: NEW, label: t("convert.newCompany") },
            ...(conversion.companyOptional
              ? [{ value: NONE, label: t("convert.noCompany") }]
              : []),
          ]}
        />
        {company === PICK ? (
          <Field data-invalid={submitted && companyMissing ? true : undefined}>
            <FieldLabel htmlFor={`${id}-company`} id={`${id}-company-label`}>
              {t("convert.existingPicker")}
            </FieldLabel>
            <RelationInput
              id={`${id}-company`}
              labelId={`${id}-company-label`}
              field={relationField("company", t("convert.company"))}
              value={pickedCompany}
              onChange={setPickedCompany}
              invalid={submitted && companyMissing}
            />
            {submitted && companyMissing ? (
              <FieldError>{t("convert.pickRequired")}</FieldError>
            ) : null}
          </Field>
        ) : null}
        {company === NEW ? (
          <Field>
            <FieldLabel htmlFor={`${id}-company-name`}>
              {t("convert.name")}
            </FieldLabel>
            <Input
              id={`${id}-company-name`}
              value={newCompanyName}
              required
              aria-invalid={submitted && companyMissing ? true : undefined}
              onChange={(event) => setNewCompanyName(event.target.value)}
            />
          </Field>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <Choice
          legend={t("convert.contact")}
          name="contact"
          value={contact}
          onChange={setContactChoice}
          matches={contactMatches}
          options={[
            { value: PICK, label: t("convert.searchExistingContact") },
            { value: NEW, label: t("convert.newContact") },
            { value: NONE, label: t("convert.noContact") },
          ]}
        />
        {contact === PICK ? (
          <Field data-invalid={submitted && contactMissing ? true : undefined}>
            <FieldLabel htmlFor={`${id}-contact`} id={`${id}-contact-label`}>
              {t("convert.existingPicker")}
            </FieldLabel>
            <RelationInput
              id={`${id}-contact`}
              labelId={`${id}-contact-label`}
              field={relationField("contact", t("convert.contact"))}
              value={pickedContact}
              onChange={setPickedContact}
              invalid={submitted && contactMissing}
            />
            {submitted && contactMissing ? (
              <FieldError>{t("convert.pickRequired")}</FieldError>
            ) : null}
          </Field>
        ) : null}
        {contact === NEW ? (
          <Field>
            <FieldLabel htmlFor={`${id}-contact-name`}>
              {t("convert.name")}
            </FieldLabel>
            <Input
              id={`${id}-contact-name`}
              value={newContactName}
              required
              aria-invalid={submitted && contactMissing ? true : undefined}
              onChange={(event) => setNewContactName(event.target.value)}
            />
          </Field>
        ) : null}
        {submitted && personMissing ? (
          <p role="alert" className="text-sm text-destructive">
            {t("convert.personRequired")}
          </p>
        ) : null}
      </div>

      {conversion.targets.length > 0 ? (
        <FieldSet>
          <FieldLegend variant="label">{t("convert.targets")}</FieldLegend>
          {conversion.targets.map((target) => (
            <Field key={target.objectKey} orientation="horizontal">
              <Checkbox
                id={`${id}-target-${target.objectKey}`}
                checked={targets.includes(target.objectKey)}
                onCheckedChange={(checked) =>
                  setTargets((current) =>
                    checked === true
                      ? [...current, target.objectKey]
                      : current.filter((key) => key !== target.objectKey)
                  )
                }
              />
              <FieldLabel
                htmlFor={`${id}-target-${target.objectKey}`}
                className="font-normal"
              >
                {resolveI18nText(target.label, language)}
              </FieldLabel>
            </Field>
          ))}
        </FieldSet>
      ) : null}

      <FieldSet>
        <FieldLegend variant="label">{t("convert.deal")}</FieldLegend>
        <Field orientation="horizontal">
          <Checkbox
            id={`${id}-deal`}
            checked={createDeal}
            onCheckedChange={(checked) => setCreateDeal(checked === true)}
          />
          <FieldLabel htmlFor={`${id}-deal`} className="font-normal">
            {t("convert.createDeal")}
          </FieldLabel>
        </Field>
        {createDeal ? (
          <Field>
            <FieldLabel htmlFor={`${id}-deal-name`}>
              {t("convert.dealName")}
            </FieldLabel>
            <Input
              id={`${id}-deal-name`}
              value={dealName}
              required
              aria-invalid={submitted && dealMissing ? true : undefined}
              onChange={(event) => setDealName(event.target.value)}
            />
          </Field>
        ) : null}
        {canQuote ? (
          <Field orientation="horizontal">
            <Checkbox
              id={`${id}-quote`}
              checked={createQuote}
              onCheckedChange={(checked) => setCreateQuote(checked === true)}
            />
            <FieldLabel htmlFor={`${id}-quote`} className="font-normal">
              {t("convert.createQuote")}
            </FieldLabel>
          </Field>
        ) : null}
      </FieldSet>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t("common:actions.cancel")}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {t("convert.submit")}
        </Button>
      </DialogFooter>
    </form>
  )
}
