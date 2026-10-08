import {
  TEMPLATE_LANGUAGES,
  templateToText,
  type MessageTemplateDef,
} from "@/engine/messaging"
import { seedRecords } from "@/features/records/mocks/factory"
import { MOCK_REFERENCE_DATE } from "@/mocks/db/faker"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { getActiveManifests } from "@/mocks/modules"

import type {
  ConversationRow,
  MessageRow,
  WaChannelRow,
  WaSettingsRow,
  WaTemplateRow,
} from "./types"

/**
 * Acme Lojistik starts connected with every forwarding template approved and
 * a lived-in inbox; Marmara is not connected (empty states, Faz 6 E2E).
 */
export const SEED_CHANNEL = {
  wabaId: "104857600012345",
  phoneNumberId: "109876543210987",
  displayPhoneNumber: "+90 850 321 09 87",
} as const

const CONNECTED_AT = new Date(
  MOCK_REFERENCE_DATE.getTime() - 60 * 86_400_000
).toISOString()

export function seedWaChannels(): WaChannelRow[] {
  return [
    {
      id: `wa_${WORKSPACE_IDS.acme}`,
      workspaceId: WORKSPACE_IDS.acme,
      wabaId: SEED_CHANNEL.wabaId,
      phoneNumberId: SEED_CHANNEL.phoneNumberId,
      displayPhoneNumber: SEED_CHANNEL.displayPhoneNumber,
      verifiedName: "Acme Lojistik",
      qualityRating: "GREEN",
      messagingLimitTier: "TIER_1K",
      // Mock only — see WaChannelRow.accessToken.
      accessToken: "EAAGmockSeedAccessTokenForAcmeLojistik7f3k",
      appSecret: "0123456789abcdef0123456789abcdef",
      tokenUpdatedAt: CONNECTED_AT,
      connectedAt: CONNECTED_AT,
    },
  ]
}

export function seedWaSettings(): WaSettingsRow[] {
  return [WORKSPACE_IDS.acme, WORKSPACE_IDS.marmara].map((workspaceId) => ({
    id: `was_${workspaceId}`,
    workspaceId,
    verifyToken: `vt_${workspaceId.replace("ws_", "")}_9c41e2`,
    triggers: {},
  }))
}

const forwardingTemplates = () =>
  getActiveManifests(["forwarding"]).flatMap(
    (manifest) => manifest.messageTemplates ?? []
  )

export function seedWaTemplates(): WaTemplateRow[] {
  return forwardingTemplates().flatMap((def) =>
    TEMPLATE_LANGUAGES.map((language) => ({
      id: `wat_acme_${def.name}_${language}`,
      workspaceId: WORKSPACE_IDS.acme,
      templateId: def.id,
      moduleId: "forwarding",
      name: def.name,
      language,
      status: "approved" as const,
      rejectionReason: null,
      submittedAt: CONNECTED_AT,
      updatedAt: CONNECTED_AT,
    }))
  )
}

/* ----------------------------------------------------------- conversations */

type Line = ["in" | "out", string]

/** Short threads; the customer always writes last (window still open). */
const THREADS: { template?: boolean; lines: Line[] }[] = [
  {
    template: true,
    lines: [
      ["in", "Teşekkürler. Konteyner numarasını paylaşabilir misiniz?"],
      ["out", "Tabii, MSCU 482193-7. Takip linkini e-postayla da ilettim."],
      ["in", "Aldım, varışta gümrük için hangi belgeler gerekiyor?"],
    ],
  },
  {
    lines: [
      [
        "in",
        "Merhaba, İzmir'den Rotterdam'a 2x40HC için fiyat alabilir miyiz?",
      ],
      ["out", "Merhaba, yük hazır tarihi ve emtia nedir?"],
      ["in", "Ekim ortası, tekstil ürünleri. Yaklaşık 18 ton."],
    ],
  },
  {
    template: true,
    lines: [["in", "ETA değişti mi? Müşterimiz soruyor."]],
  },
  {
    lines: [
      ["out", "Merhaba, faturanız sisteme yüklendi."],
      ["in", "Teşekkür ederim, ödeme talimatını bugün veriyoruz."],
    ],
  },
  {
    lines: [
      ["in", "Hava kargo için ölçüleri gönderiyorum: 120x80x110 cm, 4 palet."],
      ["out", "Teşekkürler, ücretli ağırlığı hesaplayıp teklif hazırlıyorum."],
      ["in", "Bu hafta çıkış mümkün mü?"],
    ],
  },
  {
    template: true,
    lines: [
      ["in", "Teslimat adresi değişti, yeni adresi nereye iletebilirim?"],
    ],
  },
]

const DEPARTED_PARAMS = [
  "",
  "SHP-2026-0031",
  "28.09.2026",
  "İstanbul (TRIST)",
  "12.10.2026",
]

const UNKNOWN_NUMBERS = [
  {
    phone: "+4915112345678",
    profileName: "Jonas Weber",
    text: "Hello, do you handle LCL to Hamburg?",
  },
  {
    phone: "+905301112233",
    profileName: "Hakan",
    text: "Merhaba, gümrükleme hizmetiniz var mı?",
  },
]

function pad(value: number) {
  return String(value).padStart(2, "0")
}

/**
 * 18 conversations with Acme contacts + 2 unknown numbers. Times are
 * relative to the real "now" so the 24 h window demo stays meaningful:
 * 0–5 fresh (window open, some unread), 6–11 stale (window closed),
 * 12–15 closed, 16–17 assigned stale threads of the agent.
 */
export function seedConversations(now = Math.floor(Date.now() / 1000) * 1000) {
  const conversations: ConversationRow[] = []
  const messages: MessageRow[] = []
  const departed = forwardingTemplates().find(
    (def) => def.id === "forwarding.shipmentDeparted"
  ) as MessageTemplateDef
  const contacts = seedRecords().filter(
    (row) =>
      row.workspaceId === WORKSPACE_IDS.acme &&
      row.objectKey === "contact" &&
      typeof row.values.phone === "string" &&
      row.values.whatsappOptIn === true
  )
  const assignees = [
    null,
    SEED_USERS.agent.id,
    SEED_USERS.owner.id,
    SEED_USERS.manager.id,
  ]

  for (let index = 0; index < 18; index++) {
    const contact = contacts[(index * 7) % contacts.length]!
    const phone = String(contact.values.phone)
    const name = String(contact.values.name)
    const thread = THREADS[index % THREADS.length]!
    const kind =
      index < 6 ? "fresh" : index < 12 || index >= 16 ? "stale" : "closed"
    const id = `cnv_acme_${pad(index + 1)}`
    const minute = 60_000
    const end =
      kind === "fresh"
        ? now - (5 + index * 23) * minute
        : kind === "stale"
          ? now - (2 + (index % 5)) * 86_400_000
          : now - (8 + index) * 86_400_000
    const step = kind === "fresh" ? 9 * minute : 3 * 60 * minute

    const lines: {
      direction: "inbound" | "outbound"
      body: string
      template?: boolean
    }[] = []
    if (thread.template) {
      const params = [...DEPARTED_PARAMS]
      params[0] = name.split(" ")[0]!
      lines.push({
        direction: "outbound",
        body: templateToText({ body: departed.content.tr.body }, params),
        template: true,
      })
    }
    for (const [direction, body] of thread.lines) {
      lines.push({
        direction: direction === "in" ? "inbound" : "outbound",
        body,
      })
    }
    if (kind !== "fresh") {
      lines.push({
        direction: "outbound",
        body: "Bilgi için teşekkürler, iyi çalışmalar.",
      })
    }

    let lastInboundAt: string | null = null
    lines.forEach((line, position) => {
      const at = new Date(
        end - (lines.length - 1 - position) * step
      ).toISOString()
      if (line.direction === "inbound") lastInboundAt = at
      messages.push({
        id: `msg_acme_${pad(index + 1)}_${pad(position + 1)}`,
        workspaceId: WORKSPACE_IDS.acme,
        conversationId: id,
        wamid: `wamid.seed${pad(index + 1)}${pad(position + 1)}`,
        direction: line.direction,
        type: line.template ? "template" : "text",
        body: line.body,
        template: line.template
          ? {
              id: departed.id,
              name: departed.name,
              language: "tr",
              header: departed.content.tr.header ?? null,
              footer: departed.content.tr.footer ?? null,
            }
          : null,
        status: line.direction === "inbound" ? "delivered" : "read",
        error: null,
        record: null,
        sentBy:
          line.direction === "outbound" && !line.template
            ? SEED_USERS.owner.id
            : null,
        queuedAt: at,
        createdAt: at,
      })
    })
    const last = lines.at(-1)!
    conversations.push({
      id,
      workspaceId: WORKSPACE_IDS.acme,
      phone,
      profileName: name,
      contact: { objectKey: "contact", recordId: contact.id },
      assigneeId:
        index >= 16
          ? SEED_USERS.agent.id
          : assignees[index % assignees.length]!,
      status: kind === "closed" ? "closed" : "open",
      unreadCount: kind === "fresh" && index % 3 !== 2 ? 1 + (index % 2) : 0,
      lastMessageAt: new Date(end).toISOString(),
      lastMessagePreview: last.body.slice(0, 120),
      lastMessageDirection: last.direction,
      lastInboundAt,
      createdAt: new Date(end - lines.length * step).toISOString(),
    })
  }

  UNKNOWN_NUMBERS.forEach((item, position) => {
    const at = new Date(now - (30 + position * 150) * 60_000).toISOString()
    const id = `cnv_acme_u${position + 1}`
    conversations.push({
      id,
      workspaceId: WORKSPACE_IDS.acme,
      phone: item.phone,
      profileName: item.profileName,
      contact: null,
      assigneeId: null,
      status: "open",
      unreadCount: 1,
      lastMessageAt: at,
      lastMessagePreview: item.text,
      lastMessageDirection: "inbound",
      lastInboundAt: at,
      createdAt: at,
    })
    messages.push({
      id: `msg_acme_u${position + 1}_01`,
      workspaceId: WORKSPACE_IDS.acme,
      conversationId: id,
      wamid: `wamid.seedu${position + 1}`,
      direction: "inbound",
      type: "text",
      body: item.text,
      template: null,
      status: "delivered",
      error: null,
      record: null,
      sentBy: null,
      queuedAt: at,
      createdAt: at,
    })
  })

  return { conversations, messages }
}
