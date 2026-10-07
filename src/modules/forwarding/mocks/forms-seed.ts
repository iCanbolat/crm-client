import type { FormBlockDef, FormContent, FormField } from "@/engine/forms"
import { createStarterContent } from "@/features/form-builder"
import { seedVersion } from "@/features/form-builder/mocks/seed"
import type { FormRow, FormSeed } from "@/features/form-builder/mocks/types"
import { MOCK_REFERENCE_DATE } from "@/mocks/db/faker"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"

import { forwardingFormBlocks } from "../form-blocks"
import { PIECE_MODES, t } from "../lib/constants"

const daysAgo = (days: number) =>
  new Date(MOCK_REFERENCE_DATE.getTime() - days * 86_400_000).toISOString()

const block = (id: string) =>
  forwardingFormBlocks.find((item) => item.id === `forwarding.${id}`)!

/** Block fields with readable ids (`fld_<key>`) and their mapping. */
function place(content: FormContent, def: FormBlockDef, stepId: string) {
  for (const { mapTo, width, ...field } of def.fields) {
    const placed: FormField = {
      ...structuredClone(field),
      id: `fld_${field.key}`,
      stepId,
      width: width ?? "full",
      blockId: def.id,
    }
    content.fields.push(placed)
    if (mapTo) content.mapping.fields[placed.id] = mapTo
  }
}

/**
 * Freight quote form in three published versions: route only (v1), cargo
 * added (v2), containers / incoterm / ready date and conditional logic (v3).
 */
function freightQuoteContent(version: 1 | 2 | 3): FormContent {
  const content = createStarterContent()
  content.steps = [
    { id: "step1", title: t("İletişim bilgileri", "Contact details") },
    { id: "step2", title: t("Yük ve rota", "Cargo & route") },
  ]
  const consent = content.fields.find((field) => field.type === "consent")!
  content.fields = content.fields.filter(
    (field) => field.type !== "consent" && field.key !== "message"
  )
  place(content, block("route"), "step2")
  if (version >= 2) place(content, block("cargo"), "step2")
  if (version >= 3) {
    place(content, block("containers"), "step2")
    place(content, block("incoterm"), "step2")
    place(content, block("readyDate"), "step2")
    const fcl = [
      { field: "fld_transportMode", op: "eq" as const, value: "SEA_FCL" },
    ]
    content.logic = [
      {
        id: "rule_dimensions",
        match: "all",
        conditions: [
          { field: "fld_transportMode", op: "in", value: [...PIECE_MODES] },
        ],
        action: "show",
        targets: [{ kind: "field", id: "fld_dimensions" }],
      },
      {
        id: "rule_containers",
        match: "all",
        conditions: fcl,
        action: "show",
        targets: [{ kind: "field", id: "fld_containers" }],
      },
      {
        id: "rule_containers_required",
        match: "all",
        conditions: fcl,
        action: "require",
        targets: [{ kind: "field", id: "fld_containers" }],
      },
    ]
  }
  content.fields.push({ ...consent, stepId: "step2" })
  content.settings.successMessage = t(
    "Teşekkürler! Navlun teklifiniz 24 saat içinde e-postanıza gönderilecek.",
    "Thank you! Your freight quote will be e-mailed within 24 hours."
  )
  content.settings.submitLabel = t("Teklif iste", "Request a quote")
  content.settings.notifyEmails = ["satis@acme.test"]
  content.theme.primaryColor = "#0f766e"
  return content
}

/** Forwarding forms of the demo workspaces (Faz 4 seed). */
export function seedForwardingForms(): FormSeed {
  const acme: FormRow = {
    id: "form_freight",
    workspaceId: WORKSPACE_IDS.acme,
    name: "Navlun Teklif Formu",
    slug: "navlun-teklif",
    status: "published",
    publishedVersion: 3,
    draft: freightQuoteContent(3),
    ownerId: SEED_USERS.owner.id,
    createdAt: daysAgo(200),
    updatedAt: daysAgo(30),
    views: 3420,
    submissions: 164,
  }

  const english = freightQuoteContent(2)
  english.settings.defaultLanguage = "en"
  const marmara: FormRow = {
    id: "form_marmara_quote",
    workspaceId: WORKSPACE_IDS.marmara,
    name: "Get a Freight Quote",
    slug: "freight-quote",
    status: "published",
    publishedVersion: 1,
    draft: english,
    ownerId: SEED_USERS.owner.id,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(90),
    views: 300,
    submissions: 21,
  }

  return {
    forms: [acme, marmara],
    versions: [
      seedVersion(acme, 1, freightQuoteContent(1), 200),
      seedVersion(acme, 2, freightQuoteContent(2), 120, SEED_USERS.admin.id),
      seedVersion(acme, 3, freightQuoteContent(3), 30),
      seedVersion(marmara, 1, english, 90),
    ],
  }
}
