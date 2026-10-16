import { within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { setScenarioState } from "@/mocks/scenarios/scenario-store"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { renderRoute, screen } from "@/test/render"

type User = Awaited<ReturnType<typeof renderRoute>>["user"]

async function startOnboarding() {
  const utils = await renderRoute("/dashboard", { as: "newcomer" })
  await screen.findByRole("heading", { name: "Sektörünüz" })
  return utils
}

async function next(user: User) {
  await user.click(screen.getByRole("button", { name: "Devam et" }))
}

async function selectOption(user: User, label: string, option: string) {
  await user.click(screen.getByRole("combobox", { name: label }))
  await user.click(await screen.findByRole("option", { name: option }))
}

async function completeVerticalStep(
  user: User,
  vertical = "Forwarding (Lojistik)"
) {
  await user.click(screen.getByRole("radio", { name: vertical }))
  await next(user)
  await screen.findByRole("heading", { name: "Şirket bilgileri" })
}

async function completeCompanyStep(user: User) {
  await selectOption(user, "Para birimi", "USD — ABD doları")
  await next(user)
  await screen.findByRole("heading", { name: "Ekibinizi davet edin" })
}

const kuzey = () => db.workspaces.findById(WORKSPACE_IDS.kuzey)!

describe("workspace onboarding (B1.2)", () => {
  it("redirects a workspace that is not set up to the onboarding wizard", async () => {
    const { router, user } = await startOnboarding()

    expect(router.state.location.pathname).toBe("/onboarding")
    expect(screen.getByText("Adım 1 / 4")).toBeInTheDocument()
    await completeVerticalStep(user)
    expect(screen.getByText("Adım 2 / 4")).toBeInTheDocument()
    // Prefilled from the sign-up and sensible defaults.
    expect(screen.getByLabelText("Şirket adı")).toHaveValue("Kuzey Lojistik")
    expect(screen.getByRole("combobox", { name: "Ülke" })).toHaveTextContent(
      "Türkiye"
    )
  })

  it("TC-1.2-01 validates the company step", async () => {
    const { user } = await startOnboarding()
    await completeVerticalStep(user)

    await user.clear(screen.getByLabelText("Şirket adı"))
    await next(user)

    const name = screen.getByLabelText("Şirket adı")
    expect(name).toHaveAttribute("aria-invalid", "true")
    expect(name).toHaveAccessibleDescription(/çok küçük/i)
    expect(kuzey().onboarding.step).toBe(1)
  })

  it("TC-1.2-01 rejects a logo that is too large or not an image", async () => {
    const { user } = await startOnboarding()
    await completeVerticalStep(user)
    const input = screen.getByLabelText("Logo")

    await user.upload(
      input,
      new File([new Uint8Array(600 * 1024)], "logo.png", { type: "image/png" })
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Logo en fazla 512 KB olabilir."
    )

    await user.upload(
      input,
      new File(["<svg xmlns='http://www.w3.org/2000/svg'/>"], "logo.svg", {
        type: "image/svg+xml",
      })
    )
    expect(
      await screen.findByRole("button", { name: "Logoyu kaldır" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("TC-10.1-01 requires a sector and validates invitations", async () => {
    const { user } = await startOnboarding()

    await next(user)
    expect(await screen.findByText("Bir sektör seçin.")).toBeInTheDocument()
    expect(kuzey().onboarding.step).toBe(0)

    await completeVerticalStep(user)
    await completeCompanyStep(user)
    await user.click(screen.getByRole("button", { name: "Davet ekle" }))
    await user.click(screen.getByRole("button", { name: "Davet ekle" }))
    await user.type(screen.getByLabelText("1. davet e-postası"), "gecersiz")
    await user.type(
      screen.getByLabelText("2. davet e-postası"),
      "ekip@kuzey.test"
    )
    await next(user)

    expect(screen.getByLabelText("1. davet e-postası")).toHaveAttribute(
      "aria-invalid",
      "true"
    )

    await user.clear(screen.getByLabelText("1. davet e-postası"))
    await user.type(
      screen.getByLabelText("1. davet e-postası"),
      "EKIP@kuzey.test"
    )
    await next(user)

    expect(
      await screen.findByText("Bu e-posta zaten listede.")
    ).toBeInTheDocument()
  })

  it("shows a form-level message when saving a step fails", async () => {
    const { user } = await startOnboarding()
    await user.click(
      screen.getByRole("radio", { name: "Forwarding (Lojistik)" })
    )
    setScenarioState({ scenario: "validation" })

    await next(user)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Mock doğrulama hatası"
    )
    expect(screen.getByText("Adım 1 / 4")).toBeInTheDocument()
  })

  it("TC-10.1-01 a single sector is picked; coming-soon ones are disabled", async () => {
    const { user } = await startOnboarding()

    const health = screen.getByRole("radio", { name: "Sağlık Turizmi" })
    expect(health).toHaveAttribute("aria-disabled", "true")
    await user.click(health)
    expect(health).not.toBeChecked()
    expect(screen.getAllByText("Yakında")).toHaveLength(1)

    const forwarding = screen.getByRole("radio", {
      name: "Forwarding (Lojistik)",
    })
    const visa = screen.getByRole("radio", {
      name: "Vize & Eğitim Danışmanlığı",
    })
    await user.click(forwarding)
    await user.click(visa)
    expect(visa).toBeChecked()
    expect(forwarding).not.toBeChecked()
    expect(
      screen.getByText(/Sektör kurulumdan sonra değiştirilemez/)
    ).toBeInTheDocument()
  })

  it("TC-1.2-03 completes the setup, locks the sector and opens the shell", async () => {
    const { user, router } = await startOnboarding()
    await completeVerticalStep(user)
    await completeCompanyStep(user)

    await user.click(screen.getByRole("button", { name: "Davet ekle" }))
    await user.type(
      screen.getByLabelText("1. davet e-postası"),
      "operasyon@kuzey.test"
    )
    await next(user)

    const summary = await screen.findByRole("heading", {
      name: "Her şey hazır",
    })
    const card = summary.closest("[data-slot=card]") as HTMLElement
    expect(within(card).getByText("Kuzey Lojistik")).toBeInTheDocument()
    expect(within(card).getByText("Forwarding (Lojistik)")).toBeInTheDocument()
    expect(within(card).getByText("1 kişi davet edilecek")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Kurulumu tamamla" }))

    expect(
      await screen.findByRole("heading", { name: "Hoş geldiniz, Selin" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/dashboard")
    expect(
      await screen.findByText("Çalışma alanınız hazır!")
    ).toBeInTheDocument()
    const nav = screen.getByRole("navigation", { name: "Ana menü" })
    expect(
      within(nav).getByRole("link", { name: "Teklifler" })
    ).toBeInTheDocument()

    expect(kuzey()).toMatchObject({
      vertical: "forwarding",
      modules: ["forwarding"],
      currency: "USD",
      onboarding: { status: "completed" },
    })
    expect(
      db.invites.findFirst((item) => item.email === "operasyon@kuzey.test")
    ).toMatchObject({ workspaceId: WORKSPACE_IDS.kuzey, role: "agent" })
  })

  it("TC-1.2-04 resumes an interrupted onboarding at the saved step", async () => {
    const first = await startOnboarding()
    await completeVerticalStep(first.user)
    await completeCompanyStep(first.user)
    first.unmount()

    expect(kuzey().onboarding).toMatchObject({
      status: "pending",
      step: 2,
      draft: {
        vertical: "forwarding",
        company: { name: "Kuzey Lojistik", currency: "USD" },
      },
    })

    // Fresh app instance (new router + empty cache), e.g. the next day.
    const { user } = await renderRoute("/onboarding", { as: "newcomer" })

    expect(
      await screen.findByRole("heading", { name: "Ekibinizi davet edin" })
    ).toBeInTheDocument()
    expect(screen.getByText("Adım 3 / 4")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Geri" }))
    expect(
      await screen.findByRole("combobox", { name: "Para birimi" })
    ).toHaveTextContent("USD — ABD doları")
    await user.click(screen.getByRole("button", { name: "Geri" }))
    expect(
      await screen.findByRole("radio", { name: "Forwarding (Lojistik)" })
    ).toBeChecked()
  })

  it("leaves completed workspaces out of the wizard", async () => {
    const { router } = await renderRoute("/onboarding", { as: "owner" })

    await screen.findByRole("heading", { name: /Hoş geldiniz/ })
    expect(router.state.location.pathname).toBe("/dashboard")
  })

  it("tells members without setup rights to wait for an admin", async () => {
    db.memberships.create({
      id: "ws_kuzey:usr_viewer",
      userId: SEED_USERS.viewer.id,
      workspaceId: WORKSPACE_IDS.kuzey,
      role: "agent",
      joinedAt: new Date().toISOString(),
    })
    // Remove the viewer's onboarded workspace so Kuzey is the active one.
    db.memberships.delete(`${WORKSPACE_IDS.acme}:${SEED_USERS.viewer.id}`)

    await renderRoute("/dashboard", { as: "viewer" })

    expect(
      await screen.findByText("Çalışma alanı henüz kurulmadı")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Sektörünüz" })
    ).not.toBeInTheDocument()
  })
})
