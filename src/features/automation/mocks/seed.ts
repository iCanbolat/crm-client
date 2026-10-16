import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"

import type { AutomationRow } from "./types"

/**
 * Acme starts with two rules: the web form round-robin (off, the Faz 7 demo
 * switches it on) and an unanswered quote follow-up (on). Time based rules
 * only consider quotes sent after `enabledAt`, so there is no backlog.
 */
export function seedAutomations(
  now = new Date().toISOString()
): AutomationRow[] {
  const base = {
    workspaceId: WORKSPACE_IDS.acme,
    lastAssigneeId: null,
    createdBy: SEED_USERS.owner.id,
    createdAt: now,
    updatedAt: now,
  }
  return [
    {
      ...base,
      id: "aut_acme_webform",
      name: "Web formundan gelen navlun taleplerini dağıt",
      enabled: false,
      enabledAt: null,
      trigger: { type: "submission.created", formId: "form_freight" },
      conditions: [],
      actions: [
        {
          type: "assignRoundRobin",
          userIds: [SEED_USERS.manager.id, SEED_USERS.agent.id],
        },
        {
          type: "createTask",
          title: "Navlun talebini 24 saat içinde ara",
          dueInDays: 1,
          assignee: "owner",
        },
      ],
    },
    {
      ...base,
      id: "aut_acme_quote_followup",
      name: "Yanıtsız teklif takibi",
      enabled: true,
      enabledAt: now,
      trigger: { type: "quote.noResponse", afterDays: 2 },
      conditions: [],
      actions: [
        {
          type: "createTask",
          title: "Teklif takibi: müşteriyi ara",
          dueInDays: 0,
          assignee: "owner",
        },
        { type: "notify", to: "owner" },
      ],
    },
    ...seedAtlasAutomations(now),
  ]
}

/** Atlas Yurtdışı Eğitim (Faz 8): enquiry routing and offer follow-up. */
function seedAtlasAutomations(now: string): AutomationRow[] {
  const base = {
    workspaceId: WORKSPACE_IDS.atlas,
    lastAssigneeId: null,
    createdBy: SEED_USERS.atlasOwner.id,
    createdAt: now,
    updatedAt: now,
  }
  return [
    {
      ...base,
      id: "aut_atlas_study_form",
      name: "Eğitim formundan gelen talepleri dağıt",
      enabled: true,
      enabledAt: now,
      trigger: { type: "submission.created", formId: "form_atlas_study" },
      conditions: [],
      actions: [
        {
          type: "assignRoundRobin",
          userIds: [SEED_USERS.atlasEducation.id, SEED_USERS.atlasManager.id],
        },
        {
          type: "createTask",
          title: "24 saat içinde ön görüşme yap",
          dueInDays: 1,
          assignee: "owner",
        },
      ],
    },
    {
      ...base,
      id: "aut_atlas_offer_deposit",
      name: "Kesin kabul gelince depozito takibi",
      enabled: true,
      enabledAt: now,
      trigger: {
        type: "record.stageChanged",
        objectKey: "enrollment",
        stage: "unconditional_offer",
      },
      conditions: [],
      actions: [
        {
          type: "createTask",
          title: "Depozito ödemesini ve CAS / I-20 sürecini takip et",
          dueInDays: 3,
          assignee: "owner",
        },
        { type: "notify", to: "owner" },
      ],
    },
    {
      ...base,
      id: "aut_atlas_visa_approved",
      name: "Vize onayında WhatsApp tebriği",
      enabled: false,
      enabledAt: null,
      trigger: {
        type: "record.stageChanged",
        objectKey: "visaApplication",
        stage: "approved",
      },
      conditions: [],
      actions: [
        {
          type: "sendWhatsAppTemplate",
          templateId: "visa-education.visaApproved",
        },
      ],
    },
  ]
}
