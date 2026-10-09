import { screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { renderRoute } from "@/test/render"

describe("automation UI (B7.3)", () => {
  it("lists rules with summaries and switches one on", async () => {
    const { user } = await renderRoute("/settings/automations", {
      as: "admin",
    })
    const rule = await screen.findByRole("link", {
      name: "Web formundan gelen navlun taleplerini dağıt kuralını aç",
    })
    const card = rule.closest("li")!
    expect(
      await within(card).findByText(
        "Navlun Teklif Formu formundan gönderim geldiğinde"
      )
    ).toBeInTheDocument()
    expect(
      within(card).getByText("→ Sırayla ata: Zeynep Kaya, Can Öztürk")
    ).toBeInTheDocument()
    expect(within(card).getByText("Henüz çalışmadı")).toBeInTheDocument()

    await user.click(
      within(card).getByRole("switch", {
        name: "Web formundan gelen navlun taleplerini dağıt kuralını aç/kapat",
      })
    )
    expect(await screen.findByText("Kural açıldı.")).toBeInTheDocument()
    expect(db.automations.findById("aut_acme_webform")!.enabled).toBe(true)
  })

  it("creates a rule in the editor", async () => {
    const { user, router } = await renderRoute("/settings/automations/new", {
      as: "owner",
    })
    await user.type(
      await screen.findByLabelText("Kural adı"),
      "Kazanılan fırsat"
    )

    await user.click(screen.getByRole("combobox", { name: "Tetikleyici" }))
    await user.click(
      await screen.findByRole("option", {
        name: "Bir kaydın aşaması değiştiğinde",
      })
    )
    await user.click(screen.getByRole("combobox", { name: "Nesne" }))
    await user.click(await screen.findByRole("option", { name: "Fırsat" }))

    // Saving without an action is refused.
    await user.click(screen.getByRole("button", { name: "Kuralı oluştur" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Eksik veya hatalı alanları düzeltin."
    )

    await user.click(screen.getByRole("combobox", { name: "Aksiyon ekle" }))
    await user.click(
      await screen.findByRole("option", { name: "Görev oluştur" })
    )
    await user.type(screen.getByLabelText("Görev başlığı"), "Sözleşmeyi gönder")
    await user.click(screen.getByRole("button", { name: "Kuralı oluştur" }))

    expect(await screen.findByText("Kural oluşturuldu.")).toBeInTheDocument()
    const created = db.automations.findFirst(
      (row) => row.name === "Kazanılan fırsat"
    )!
    expect(created).toMatchObject({
      enabled: true,
      trigger: { type: "record.stageChanged", objectKey: "deal", stage: null },
      actions: [
        {
          type: "createTask",
          title: "Sözleşmeyi gönder",
          dueInDays: 1,
          assignee: "owner",
        },
      ],
    })
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/settings/automations/${created.id}`
      )
    )
    expect(
      await screen.findByText("Bu kural henüz çalışmadı.")
    ).toBeInTheDocument()
  })

  it("shows managers a read-only editor and deletes for admins", async () => {
    const manager = await renderRoute(
      "/settings/automations/aut_acme_quote_followup",
      { as: "manager" }
    )
    expect(
      await screen.findByText(
        "Kuralları yalnız sahip ve yöneticiler değiştirebilir."
      )
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Kural adı")).toBeDisabled()
    expect(
      screen.queryByRole("button", { name: "Kaydet" })
    ).not.toBeInTheDocument()
    manager.unmount()

    const { user, router } = await renderRoute(
      "/settings/automations/aut_acme_quote_followup",
      { as: "admin" }
    )
    await user.click(await screen.findByRole("button", { name: "Kuralı sil" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Kuralı sil" }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/settings/automations")
    )
    expect(db.automations.findById("aut_acme_quote_followup")).toBeUndefined()
  })

  it("forbids agents", async () => {
    await renderRoute("/settings/automations", { as: "agent" })
    expect(
      await screen.findByText("Bu sayfaya erişiminiz yok")
    ).toBeInTheDocument()
  })
})
