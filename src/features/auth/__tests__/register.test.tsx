import { waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { fetchMe, resendVerificationCode, verifyEmail } from "../api/auth.api"
import { signUp } from "../lib/session"
import { createWorkspace } from "@/features/workspace/api/workspace.api"
import { latestEmail } from "@/mocks/accounts"
import { db } from "@/mocks/db"
import { signInAs } from "@/test/auth"
import { createTestQueryClient, renderRoute, screen } from "@/test/render"

const ACCOUNT = {
  name: "Deniz Kaya",
  email: "deniz@vizeplus.test",
  password: "Guvenli123!",
  companyName: "Vize Plus Danışmanlık",
  acceptTerms: true as const,
}

const userOf = (email: string) =>
  db.users.findFirst((item) => item.email === email)!

/** Faz 10 — self sign-up, e-mail verification, new workspaces (B10.5). */
describe("self sign-up (B10.5)", () => {
  it("TC-10.5-01 validates the form and refuses taken e-mails", async () => {
    const { user } = await renderRoute("/register")
    await screen.findByRole("heading", { name: "Hesap oluştur" })

    await user.type(screen.getByLabelText("Ad soyad"), ACCOUNT.name)
    await user.type(screen.getByLabelText("E-posta"), "owner@acme.test")
    await user.type(screen.getByLabelText("Şirket adı"), ACCOUNT.companyName)
    await user.type(screen.getByLabelText("Şifre"), ACCOUNT.password)
    await user.type(screen.getByLabelText("Şifre (tekrar)"), "baska-sifre")
    await user.click(screen.getByRole("button", { name: "Hesap oluştur" }))

    expect(await screen.findByText("Şifreler eşleşmiyor.")).toBeInTheDocument()
    expect(
      screen.getByText("Devam etmek için koşulları kabul edin.")
    ).toBeInTheDocument()

    await user.clear(screen.getByLabelText("Şifre (tekrar)"))
    await user.type(screen.getByLabelText("Şifre (tekrar)"), ACCOUNT.password)
    await user.click(
      screen.getByRole("checkbox", { name: /Kullanım koşullarını/ })
    )
    await user.click(screen.getByRole("button", { name: "Hesap oluştur" }))

    expect(
      await screen.findByText("Bu e-posta ile zaten bir hesap var.")
    ).toBeInTheDocument()
    expect(screen.getByLabelText("E-posta")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
  })

  it("TC-10.5-02 wrong, expired and too frequent codes are refused", async () => {
    await signUp(createTestQueryClient(), ACCOUNT)
    const account = userOf(ACCOUNT.email)
    expect(account.emailVerified).toBe(false)
    const code = latestEmail(ACCOUNT.email, "verifyEmail")!.code!

    await expect(
      verifyEmail({ code: code === "000000" ? "111111" : "000000" })
    ).rejects.toMatchObject({ status: 422, code: "INVALID_CODE" })
    await expect(resendVerificationCode()).rejects.toMatchObject({
      status: 429,
      code: "RESEND_TOO_SOON",
    })

    db.emailVerifications.update(account.id, {
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      sentAt: new Date(Date.now() - 120_000).toISOString(),
    })
    await expect(verifyEmail({ code })).rejects.toMatchObject({
      status: 422,
      code: "CODE_EXPIRED",
    })

    await resendVerificationCode()
    const fresh = latestEmail(ACCOUNT.email, "verifyEmail")!.code!
    const me = await verifyEmail({ code: fresh })
    expect(me.user.emailVerified).toBe(true)
    expect(me.memberships).toEqual([
      expect.objectContaining({
        workspaceName: ACCOUNT.companyName,
        role: "owner",
        vertical: null,
      }),
    ])
  })

  it("TC-10.5-03 sign up → verify → pick the sector → panel", async () => {
    const { user, router } = await renderRoute("/register")
    await screen.findByRole("heading", { name: "Hesap oluştur" })

    await user.type(screen.getByLabelText("Ad soyad"), ACCOUNT.name)
    await user.type(screen.getByLabelText("E-posta"), ACCOUNT.email)
    await user.type(screen.getByLabelText("Şirket adı"), ACCOUNT.companyName)
    await user.type(screen.getByLabelText("Şifre"), ACCOUNT.password)
    await user.type(screen.getByLabelText("Şifre (tekrar)"), ACCOUNT.password)
    await user.click(
      screen.getByRole("checkbox", { name: /Kullanım koşullarını/ })
    )
    await user.click(screen.getByRole("button", { name: "Hesap oluştur" }))

    expect(
      await screen.findByRole("heading", { name: "E-postanızı doğrulayın" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/verify-email")
    expect(screen.getByText(new RegExp(ACCOUNT.email))).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /sn sonra yeniden gönderebilirsiniz/ })
    ).toBeDisabled()

    // Unverified accounts cannot reach the app yet.
    await router.navigate({ to: "/dashboard" })
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/verify-email")
    )

    const code = latestEmail(ACCOUNT.email, "verifyEmail")!.code!
    await user.type(await screen.findByLabelText("Doğrulama kodu"), code)
    await user.click(screen.getByRole("button", { name: "Doğrula" }))

    expect(
      await screen.findByRole("heading", { name: "Sektörünüz" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/onboarding")
    await user.click(
      screen.getByRole("radio", { name: "Vize & Eğitim Danışmanlığı" })
    )
    await user.click(screen.getByRole("button", { name: "Devam et" }))
    expect(await screen.findByLabelText("Şirket adı")).toHaveValue(
      ACCOUNT.companyName
    )
  })

  it("TC-10.5-04 a further workspace starts with its own onboarding", async () => {
    signInAs("owner")
    const workspace = await createWorkspace({ name: "Acme Eğitim" })
    expect(workspace).toMatchObject({
      vertical: null,
      modules: [],
      onboarding: { status: "pending", step: 0 },
    })

    const me = await fetchMe()
    const sectors = me.memberships.map((item) => [
      item.workspaceName,
      item.vertical,
    ])
    expect(sectors).toEqual(
      expect.arrayContaining([
        ["Acme Lojistik", "forwarding"],
        ["Acme Eğitim", null],
      ])
    )
    expect(
      me.memberships.find((item) => item.workspaceId === workspace.id)?.role
    ).toBe("owner")
  })

  it("TC-10.5-04 the switcher opens the new workspace in its onboarding", async () => {
    const { user, router } = await renderRoute("/dashboard", { as: "owner" })
    await user.click(
      await screen.findByRole("button", {
        name: /Çalışma alanı: Acme Lojistik/,
      })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Yeni çalışma alanı" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Yeni çalışma alanı oluştur",
    })
    await user.type(within(dialog).getByLabelText("Şirket adı"), "Acme Eğitim")
    await user.click(
      within(dialog).getByRole("button", { name: "Oluştur ve kur" })
    )

    expect(
      await screen.findByRole("heading", { name: "Sektörünüz" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/onboarding")
  })
})
