import { waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  applyMapping,
  createEmptyContent,
  getMappableTargets,
} from "@/engine/forms"
import { leadObject } from "@/features/records/mocks/core-objects"
import { db } from "@/mocks/db"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import { signInAs } from "@/test/auth"
import { renderRoute, screen } from "@/test/render"

import { formField } from "../../../engine/__tests__/form-fixtures"
import { TEMPLATE_REVIEW_MS } from "../mocks/store"

const { acme, marmara } = WORKSPACE_IDS

function reachableShipment(optIn = true) {
  const shipment = db.records.findFirst(
    (row) =>
      row.workspaceId === acme &&
      row.objectKey === "shipment" &&
      !!row.values.contactId
  )!
  const contact = db.records.findById(String(shipment.values.contactId))!
  db.records.update(contact.id, {
    values: { ...contact.values, phone: "+905551112233", whatsappOptIn: optIn },
  })
  db.records.update(shipment.id, {
    values: { ...shipment.values, atd: "2026-10-05", eta: "2026-10-20" },
  })
  return { shipment, contact }
}

describe("WhatsApp settings (B6.1/B6.2/B6.5)", () => {
  it("TC-6.1-01 validates credentials before any request, then connects", async () => {
    signInAs("owner", { workspaceId: marmara })
    const { user } = await renderRoute("/settings/whatsapp")
    expect(await screen.findByText("Bağlı değil")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Bağla" }))
    expect(
      await screen.findAllByText("6–20 haneli sayısal bir ID girin.")
    ).toHaveLength(2)
    expect(
      screen.getByText("Token en az 20 karakter olmalı.")
    ).toBeInTheDocument()
    expect(db.waChannels.findById(`wa_${marmara}`)).toBeUndefined()

    await user.type(
      screen.getByLabelText("WhatsApp Business Account ID"),
      "123456789012"
    )
    await user.type(screen.getByLabelText("Phone Number ID"), "234567890123")
    await user.type(
      screen.getByLabelText("Kalıcı erişim token'ı"),
      "EAAG-invalid-token-for-test"
    )
    await user.click(screen.getByRole("button", { name: "Bağlantıyı test et" }))
    // TC-6.1-02 Meta's answer next to the field.
    expect(
      await screen.findByText(/Meta erişim token'ı geçersiz/)
    ).toBeInTheDocument()

    const token = screen.getByLabelText("Kalıcı erişim token'ı")
    await user.clear(token)
    await user.type(token, "EAAGvalidTokenForMarmara7890")
    await user.click(screen.getByRole("button", { name: "Bağlantıyı test et" }))
    expect(
      await screen.findByText(
        "Bağlantı başarılı: Marmara Forwarding · +90 850 789 01 23"
      )
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Bağla" }))
    expect(await screen.findByText("Bağlı")).toBeInTheDocument()
    expect(
      screen.getByText(/••••7890 · .* tarihinde güncellendi/)
    ).toBeInTheDocument()
    // TC-6.1-03 the token never comes back into the form.
    expect(screen.queryByDisplayValue(/EAAG/)).not.toBeInTheDocument()
  })

  it("TC-6.1-04 managers see a read-only page, agents get 403", async () => {
    const manager = await renderRoute("/settings/whatsapp", { as: "manager" })
    expect(await screen.findByText("+90 850 321 09 87")).toBeInTheDocument()
    expect(
      screen.getByText("Ayarları yalnız sahip ve yöneticiler değiştirebilir.")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Bağlantıyı kes" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Doğrulama token'ı")).not.toBeInTheDocument()
    manager.unmount()

    await renderRoute("/settings/whatsapp", { as: "agent" })
    expect(
      await screen.findByText("Bu sayfaya erişiminiz yok")
    ).toBeInTheDocument()
  })

  it("disconnects after confirmation", async () => {
    const { user } = await renderRoute("/settings/whatsapp", { as: "owner" })
    await user.click(
      await screen.findByRole("button", { name: "Bağlantıyı kes" })
    )
    const dialog = await screen.findByRole("alertdialog")
    await user.click(
      within(dialog).getByRole("button", { name: "Bağlantıyı kes" })
    )
    expect(await screen.findByText("Bağlı değil")).toBeInTheDocument()
    expect(db.waChannels.findById(`wa_${acme}`)).toBeUndefined()
  })

  it("TC-6.2-05 shows the sector's templates read-only", async () => {
    await renderRoute("/settings/whatsapp?tab=templates", { as: "owner" })
    expect(
      await screen.findByText("Sektörünüze göre otomatik yönetilir")
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Forwarding \(Lojistik\) sektörünüz/)
    ).toBeInTheDocument()
    expect(screen.getByText("fwd_shipment_departed_v1")).toBeInTheDocument()
    expect(screen.getAllByText("Türkçe: Onaylandı")).toHaveLength(10)
    // Preview with sample values and the variable → field table.
    expect(
      screen.getAllByText(/Merhaba Ayşe, SHP-2026-0042 numaralı sevkiyatınız/)
        .length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText("ATD (gerçekleşen çıkış)").length
    ).toBeGreaterThan(0)
    expect(
      screen.queryByRole("button", { name: /Düzenle|Sil/ })
    ).not.toBeInTheDocument()
  })

  it("TC-6.2-04 polls Meta's review until approval", async () => {
    signInAs("owner", { workspaceId: marmara })
    const { user } = await renderRoute("/settings/whatsapp")
    await user.type(
      await screen.findByLabelText("WhatsApp Business Account ID"),
      "123456789012"
    )
    await user.type(screen.getByLabelText("Phone Number ID"), "234567890123")
    await user.type(
      screen.getByLabelText("Kalıcı erişim token'ı"),
      "EAAGvalidTokenForMarmara7890"
    )
    await user.click(screen.getByRole("button", { name: "Bağla" }))
    await screen.findByText("Bağlı")
    await user.click(screen.getByRole("tab", { name: "Şablonlar" }))
    expect((await screen.findAllByText("Türkçe: İncelemede")).length).toBe(10)

    for (const row of db.waTemplates.findMany(
      (item) => item.workspaceId === marmara
    )) {
      db.waTemplates.update(row.id, {
        submittedAt: new Date(Date.now() - TEMPLATE_REVIEW_MS).toISOString(),
      })
    }
    await waitFor(
      () =>
        expect(screen.getAllByText("İngilizce: Onaylandı")).toHaveLength(10),
      { timeout: 4000 }
    )
  })

  it("switches automatic notifications on", async () => {
    const { user } = await renderRoute("/settings/whatsapp?tab=notifications", {
      as: "owner",
    })
    const toggle = await screen.findByRole("switch", {
      name: "Sevkiyat aşaması: Yola çıktı (ATD) bildirimini aç/kapat",
    })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    await waitFor(() =>
      expect(
        db.waSettings.findById(`was_${acme}`)!.triggers[
          "forwarding.milestone.DEPARTED"
        ]
      ).toBe(true)
    )
    expect(screen.getByText("Henüz otomatik bildirim yok.")).toBeInTheDocument()
  })
})

describe("inbox (B6.3)", () => {
  it("TC-6.3-06 keeps filters in the URL and opens a conversation", async () => {
    const { user, router } = await renderRoute("/inbox", { as: "owner" })
    const list = await screen.findByRole("region", { name: "Konuşmalar" })
    // Sidebar badge with the unread conversations.
    expect(await screen.findByText("6 okunmamış konuşma")).toBeInTheDocument()

    await user.click(within(list).getByRole("button", { name: "Okunmamış" }))
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ unread: true })
    )
    await user.click(
      await within(list).findByRole("button", { name: /Jonas Weber/ })
    )
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        c: "cnv_acme_u1",
        unread: true,
      })
    )
    const conversation = await screen.findByRole("region", {
      name: "Jonas Weber ile konuşma",
    })
    expect(
      await within(conversation).findByText(
        "Hello, do you handle LCL to Hamburg?"
      )
    ).toBeInTheDocument()
    // Opening reads it.
    await waitFor(() =>
      expect(db.conversations.findById("cnv_acme_u1")!.unreadCount).toBe(0)
    )
    expect(screen.getByText("Kayıtlı olmayan numara")).toBeInTheDocument()
  })

  it("sends free text inside the window", async () => {
    const { user } = await renderRoute("/inbox?c=cnv_acme_01", { as: "owner" })
    expect(await screen.findByText(/Yanıt penceresi açık/)).toBeInTheDocument()
    const box = screen.getByLabelText("Mesaj")
    await user.type(box, "Belgeleri e-postayla iletiyorum.{Enter}")
    await waitFor(() =>
      expect(
        db.messages.findFirst(
          (row) => row.body === "Belgeleri e-postayla iletiyorum."
        )
      ).toMatchObject({ direction: "outbound", type: "text" })
    )
    expect(box).toHaveValue("")
  })

  it("TC-6.3-02 locks free text when the 24 h window is closed", async () => {
    await renderRoute("/inbox?c=cnv_acme_07", { as: "owner" })
    expect(
      await screen.findByText(/24 saatlik yanıt penceresi kapalı/)
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Mesaj")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Gönder" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Şablon gönder" })).toBeEnabled()
  })

  it("TC-6.1-05 asks to connect WhatsApp when there is no number", async () => {
    signInAs("owner", { workspaceId: marmara })
    await renderRoute("/inbox")
    expect(await screen.findByText("WhatsApp bağlı değil")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "WhatsApp'ı bağla" })
    ).toHaveAttribute("href", "/settings/whatsapp")
    expect(await screen.findByText("Konuşma yok")).toBeInTheDocument()
  })

  it("lets agents take a conversation, not assign it", async () => {
    const { user } = await renderRoute("/inbox?c=cnv_acme_u1", { as: "agent" })
    await user.click(await screen.findByRole("button", { name: "Üstlen" }))
    expect(
      await screen.findByRole("button", { name: "Bırak" })
    ).toBeInTheDocument()
    expect(db.conversations.findById("cnv_acme_u1")!.assigneeId).toBe(
      "usr_agent"
    )
  })
})

describe("record tab and template sends (B6.4)", () => {
  it("TC-6.4-04 hides the tab without a connected number", async () => {
    signInAs("owner", { workspaceId: marmara })
    const shipment = db.records.findFirst(
      (row) => row.workspaceId === marmara && row.objectKey === "shipment"
    )!
    await renderRoute(`/o/shipment/${shipment.id}`)
    await screen.findByRole("tab", { name: "Detay" })
    expect(
      screen.queryByRole("tab", { name: "WhatsApp" })
    ).not.toBeInTheDocument()
  })

  it("TC-6.4-01 starts a conversation from a shipment with a template", async () => {
    const { shipment, contact } = reachableShipment()
    const { user } = await renderRoute(
      `/o/shipment/${shipment.id}?tab=whatsapp`,
      { as: "owner" }
    )
    expect(await screen.findByText("Henüz konuşma yok")).toBeInTheDocument()
    expect(screen.getByText("İzin var")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Şablonla başlat" }))

    const dialog = await screen.findByRole("dialog", { name: "Şablon gönder" })
    await user.click(within(dialog).getByLabelText("Şablon"))
    await user.click(
      await screen.findByRole("option", { name: "Sevkiyat yola çıktı" })
    )
    const number = String(shipment.values.shipmentNumber)
    await waitFor(() =>
      expect(within(dialog).getByLabelText(/2\. değişken/)).toHaveValue(number)
    )
    expect(within(dialog).getByLabelText(/1\. değişken/)).toHaveValue(
      String(contact.values.name).split(" ")[0]
    )
    await user.click(within(dialog).getByRole("button", { name: "Gönder" }))

    await waitFor(() =>
      expect(
        db.messages.findFirst(
          (row) =>
            row.template?.name === "fwd_shipment_departed_v1" &&
            row.record?.recordId === shipment.id
        )
      ).toBeDefined()
    )
    expect(await screen.findByText("Şablon gönderildi.")).toBeInTheDocument()
    expect(
      await screen.findByRole("list", { name: "Mesajlar" })
    ).toHaveTextContent(number)
  })

  it("TC-6.4-02 blocks templates without consent", async () => {
    const { shipment } = reachableShipment(false)
    const { user } = await renderRoute(
      `/o/shipment/${shipment.id}?tab=whatsapp`,
      { as: "owner" }
    )
    expect(await screen.findByText("İzin yok")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Şablonla başlat" }))
    const dialog = await screen.findByRole("dialog", { name: "Şablon gönder" })
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Bu kişinin WhatsApp bildirim izni yok"
    )
    expect(
      within(dialog).getByRole("button", { name: "Gönder" })
    ).toBeDisabled()
  })

  it("TC-6.4-05 a form consent field feeds the WhatsApp opt-in", () => {
    const consent = formField("whatsappConsent", "consent")
    const lead = leadObject()
    expect(
      getMappableTargets(consent, lead).map((field) => field.key)
    ).toContain("whatsappOptIn")
    const content = {
      ...createEmptyContent(),
      fields: [consent],
      mapping: {
        ...createEmptyContent().mapping,
        fields: { [consent.id]: "whatsappOptIn" },
      },
    }
    expect(
      applyMapping(content, lead, { whatsappConsent: true }).values
    ).toEqual({ whatsappOptIn: true })
  })
})
