import "@/app/modules"

import { describe, expect, it } from "vitest"

import {
  advanceStatus,
  CUSTOMER_SERVICE_WINDOW_MS,
  dispatchKey,
  extractVariables,
  fromWaId,
  getRecipientRule,
  isOptOutMessage,
  isValidTemplateParam,
  isWindowOpen,
  matchTriggers,
  renderTemplate,
  resolveTemplateParams,
  templateToText,
  toMetaSendPayload,
  toMetaTemplatePayload,
  toWaId,
  validateTemplateDef,
  windowClosesAt,
  type MessageTemplateDef,
} from "@/engine/messaging"
import { getMessageTemplates, getMessageTriggers } from "@/engine/modules"
import {
  contactObject,
  leadObject,
} from "@/features/records/mocks/core-objects"
import {
  quoteObject,
  shipmentObject,
} from "@/modules/forwarding/metadata/objects"

const base: MessageTemplateDef = {
  id: "test.template",
  name: "test_template_v1",
  category: "utility",
  objectKey: "shipment",
  label: { tr: "Test", en: "Test" },
  content: {
    tr: {
      header: "Başlık",
      body: "Merhaba {{1}}, {{2}} hazır.",
      footer: "Alt",
    },
    en: {
      header: "Title",
      body: "Hello {{1}}, {{2}} is ready.",
      footer: "Foot",
    },
  },
  variables: [
    {
      source: { kind: "recipient", field: "firstName" },
      example: { tr: "Ayşe", en: "Sarah" },
    },
    {
      source: { kind: "field", field: "shipmentNumber" },
      example: { tr: "SHP-1", en: "SHP-1" },
    },
  ],
}

const withBody = (tr: string, en = tr): MessageTemplateDef => ({
  ...base,
  content: {
    tr: { ...base.content.tr, body: tr },
    en: { ...base.content.en, body: en },
  },
})

const codes = (def: MessageTemplateDef) =>
  validateTemplateDef(def).map((issue) => issue.code)

describe("message templates (B6.2)", () => {
  it("TC-6.2-01 every forwarding template passes Meta's rules", () => {
    const templates = getMessageTemplates(["forwarding"])
    expect(templates).toHaveLength(10)
    for (const { template } of templates) {
      expect(validateTemplateDef(template), template.name).toEqual([])
      expect(template.category).toBe("utility")
      expect(template.name).toMatch(/^fwd_[a-z_]+_v\d+$/)
    }
    // Template names are unique per WABA.
    const names = templates.map(({ template }) => template.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it("TC-6.2-01 rejects formats Meta would reject", () => {
    expect(codes(base)).toEqual([])
    expect(codes({ ...base, name: "Bad-Name" })).toEqual(["nameFormat"])
    expect(codes(withBody("{{1}} merhaba, {{2}} hazır."))).toContain(
      "variableAtEdge"
    )
    expect(codes(withBody("Merhaba {{1}}, {{2}}"))).toContain("variableAtEdge")
    expect(codes(withBody("Merhaba {{1}}, {{3}} hazır."))).toContain(
      "variableSequence"
    )
    expect(codes(withBody("Merhaba {{1}}, hazır."))).toContain("variableCount")
    expect(
      codes(withBody(`Merhaba {{1}}, {{2}} ${"x".repeat(1100)}.`))
    ).toContain("bodyTooLong")
    expect(codes(withBody("   "))).toContain("bodyEmpty")
    expect(
      codes({
        ...base,
        content: {
          ...base.content,
          tr: {
            ...base.content.tr,
            header: "{{1}} başlık",
            footer: "x".repeat(61),
          },
        },
      })
    ).toEqual(["headerVariables", "footerTooLong"])
    expect(
      codes({
        ...base,
        content: {
          tr: base.content.tr,
          en: { body: "Hello {{1}} and {{2}} ok", footer: "{{1}}" },
        },
      })
    ).toEqual(["footerVariables"])
    const missing = { ...base, content: { tr: base.content.tr } } as never
    expect(validateTemplateDef(missing)).toEqual([
      { code: "missingLanguage", language: "en" },
    ])
  })

  it("renders variables and keeps unknown placeholders", () => {
    expect(extractVariables("a {{2}} b {{ 1 }}")).toEqual([2, 1])
    expect(renderTemplate(base.content.tr, ["Ali", ""])).toEqual({
      header: "Başlık",
      body: "Merhaba Ali, {{2}} hazır.",
      footer: "Alt",
    })
    expect(templateToText(base.content.en, ["Sam", "SHP-9"])).toBe(
      "Title\n\nHello Sam, SHP-9 is ready.\n\nFoot"
    )
  })

  it("TC-6.2-02 fills variables from the record, formatted per language", () => {
    const departed = getMessageTemplates(["forwarding"]).find(
      ({ template }) => template.id === "forwarding.shipmentDeparted"
    )!.template
    const record = {
      id: "shp_1",
      values: {
        shipmentNumber: "SHP-2026-0007",
        atd: "2026-10-05",
        origin: {
          code: "TRIST",
          name: "İstanbul",
          country: "TR",
          kind: "port",
        },
        eta: null,
      },
      refs: {},
    }
    const context = {
      objectDef: shipmentObject(),
      record,
      recipientName: "Ayşe Yılmaz",
    }
    const tr = resolveTemplateParams(departed, context, "tr")
    expect(tr.params[0]).toBe("Ayşe")
    expect(tr.params[1]).toBe("SHP-2026-0007")
    expect(tr.params[2]).toMatch(/5.*Eki.*2026|05\.10\.2026/)
    expect(tr.params[3]).toContain("TRIST")
    // ETA is empty: the message cannot go out without it.
    expect(tr.missing).toEqual([5])

    const en = resolveTemplateParams(departed, context, "en")
    expect(en.params[2]).toMatch(/Oct/)

    // Without a record only the person and the company are known.
    const received = getMessageTemplates(["forwarding"]).find(
      ({ template }) => template.id === "forwarding.requestReceived"
    )!.template
    expect(
      resolveTemplateParams(
        received,
        { recipientName: " Can Öz ", workspaceName: "Acme" },
        "tr"
      )
    ).toEqual({ params: ["Can", "Acme"], missing: [] })
    expect(
      resolveTemplateParams(
        {
          ...base,
          variables: [
            {
              ...base.variables[0]!,
              source: { kind: "event", field: "document" },
            },
            base.variables[1]!,
          ],
        },
        { eventData: { document: "B/L" } },
        "tr"
      )
    ).toEqual({ params: ["B/L", ""], missing: [2] })
  })

  it("TC-6.2-06 builds Meta's template and send payloads", () => {
    expect(toMetaTemplatePayload(base, "tr")).toEqual({
      name: "test_template_v1",
      language: "tr",
      category: "UTILITY",
      components: [
        { type: "HEADER", format: "TEXT", text: "Başlık" },
        {
          type: "BODY",
          text: "Merhaba {{1}}, {{2}} hazır.",
          example: { body_text: [["Ayşe", "SHP-1"]] },
        },
        { type: "FOOTER", text: "Alt" },
      ],
    })
    const plain = toMetaTemplatePayload(
      {
        ...base,
        variables: [],
        content: { ...base.content, en: { body: "Thanks." } },
      },
      "en"
    )
    expect(plain.components).toEqual([{ type: "BODY", text: "Thanks." }])

    expect(
      toMetaSendPayload(base, "en", "905551112233", ["Sam", "SHP-1"])
    ).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "905551112233",
      type: "template",
      template: {
        name: "test_template_v1",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Sam" },
              { type: "text", text: "SHP-1" },
            ],
          },
        ],
      },
    })
    expect(toMetaSendPayload(base, "tr", "90", []).template.components).toEqual(
      []
    )
  })

  it("validates send parameters like Meta", () => {
    expect(isValidTemplateParam("SHP-1")).toBe(true)
    expect(isValidTemplateParam(" ")).toBe(false)
    expect(isValidTemplateParam("a\nb")).toBe(false)
    expect(isValidTemplateParam("a\tb")).toBe(false)
    expect(isValidTemplateParam("a     b")).toBe(false)
    expect(isValidTemplateParam("x".repeat(1025))).toBe(false)
  })
})

describe("conversations (B6.3)", () => {
  it("TC-6.3-01 the customer service window lasts 24 hours", () => {
    const now = new Date("2026-10-08T12:00:00.000Z")
    const at = (ms: number) => new Date(now.getTime() - ms).toISOString()
    expect(isWindowOpen(null, now)).toBe(false)
    expect(isWindowOpen(at(0), now)).toBe(true)
    expect(isWindowOpen(at(CUSTOMER_SERVICE_WINDOW_MS - 1), now)).toBe(true)
    expect(isWindowOpen(at(CUSTOMER_SERVICE_WINDOW_MS), now)).toBe(false)
    expect(windowClosesAt(null)).toBeNull()
    expect(windowClosesAt(at(0))?.toISOString()).toBe(
      "2026-10-09T12:00:00.000Z"
    )
  })

  it("never moves a message status backwards", () => {
    expect(advanceStatus("queued", "sent")).toBe("sent")
    expect(advanceStatus("read", "delivered")).toBe("read")
    expect(advanceStatus("sent", "failed")).toBe("failed")
    expect(advanceStatus("delivered", "failed")).toBe("delivered")
    expect(advanceStatus("failed", "read")).toBe("failed")
  })

  it("TC-6.3-07 recognizes opt-out replies", () => {
    for (const text of ["DUR", "dur", " Stop! ", "iptal", "İptal."]) {
      expect(isOptOutMessage(text), text).toBe(true)
    }
    expect(isOptOutMessage("durum nedir?")).toBe(false)
  })

  it("converts numbers to Meta's wa_id", () => {
    expect(toWaId("+905551112233")).toBe("905551112233")
    expect(fromWaId("905551112233")).toBe("+905551112233")
    expect(fromWaId("+90555")).toBe("+90555")
  })
})

describe("recipients and triggers (B6.4/B6.5)", () => {
  it("finds who a record's messages go to", () => {
    expect(getRecipientRule(contactObject())).toEqual({
      kind: "self",
      phoneField: "phone",
    })
    expect(getRecipientRule(leadObject())).toEqual({
      kind: "self",
      phoneField: "phone",
    })
    expect(getRecipientRule(quoteObject())).toEqual({
      kind: "relation",
      field: "contactId",
    })
    expect(getRecipientRule(shipmentObject())).toEqual({
      kind: "relation",
      field: "contactId",
    })
    expect(getRecipientRule({ ...shipmentObject(), fields: [] })).toBeNull()
  })

  it("matches triggers on event type and data", () => {
    const triggers = getMessageTriggers(["forwarding"])
    const departed = {
      type: "shipment.milestone",
      objectKey: "shipment",
      recordId: "shp_1",
      data: { milestone: "DEPARTED" },
    }
    expect(matchTriggers(triggers, departed).map((item) => item.id)).toEqual([
      "forwarding.milestone.DEPARTED",
    ])
    expect(
      matchTriggers(triggers, {
        ...departed,
        data: { milestone: "TRANSSHIPMENT" },
      })
    ).toEqual([])
    expect(
      matchTriggers(triggers, {
        type: "lead.created",
        objectKey: "lead",
        recordId: "l1",
        data: { source: "email" },
      })
    ).toEqual([])
    const [trigger] = matchTriggers(triggers, departed)
    expect(
      dispatchKey(trigger!, { ...departed, data: { b: "2", a: "1" } })
    ).toBe("forwarding.milestone.DEPARTED:shp_1:a=1&b=2")
    // Every trigger points at a template of the same module.
    const ids = getMessageTemplates(["forwarding"]).map(
      ({ template }) => template.id
    )
    for (const item of triggers) expect(ids).toContain(item.templateId)
    expect(getMessageTriggers([])).toEqual([])
  })
})
