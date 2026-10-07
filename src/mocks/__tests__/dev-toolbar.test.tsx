import { describe, expect, it, vi } from "vitest"

import { getSessionState } from "@/features/auth"

import { db } from "@/mocks/db"
import { DB_STORAGE_KEY } from "@/mocks/db/persistence"
import { WORKSPACE_IDS } from "@/mocks/db/seed"
import DevToolbar from "@/mocks/dev-toolbar/dev-toolbar"
import { getScenarioState } from "@/mocks/scenarios/scenario-store"
import { renderWithProviders, screen } from "@/test/render"

async function openToolbar() {
  const utils = await renderWithProviders(<DevToolbar />)
  await utils.user.click(screen.getByTestId("msw-badge"))
  await screen.findByText("Mock API araçları")
  return utils
}

describe("DevToolbar", () => {
  it("TC-0.4-07 shows the active scenario on the badge", async () => {
    await renderWithProviders(<DevToolbar />)

    expect(screen.getByTestId("msw-badge")).toHaveTextContent(
      "MSW · Varsayılan"
    )
  })

  it("TC-0.4-07 switches the scenario and resets cached queries", async () => {
    const { user, queryClient } = await openToolbar()
    queryClient.setQueryData(["cached"], "value")

    await user.click(screen.getByRole("combobox", { name: "Senaryo" }))
    await user.click(
      await screen.findByRole("option", { name: "Sunucu hatası" })
    )

    expect(getScenarioState().scenario).toBe("error")
    expect(screen.getByTestId("msw-badge")).toHaveTextContent("Sunucu hatası")
    expect(queryClient.getQueryData(["cached"])).toBeUndefined()
  })

  it("TC-0.4-07 toggles persistence and resets the database", async () => {
    const { user } = await openToolbar()
    const seeded = db.examples.count()

    await user.click(
      screen.getByRole("switch", { name: "Veriyi tarayıcıda sakla" })
    )
    expect(getScenarioState().persist).toBe(true)
    expect(localStorage.getItem(DB_STORAGE_KEY)).not.toBeNull()

    db.examples.delete(db.examples.all()[0]!.id)
    await user.click(screen.getByRole("button", { name: "Veriyi sıfırla" }))

    expect(db.examples.count()).toBe(seeded)
    expect(await screen.findByText("Mock veri sıfırlandı.")).toBeInTheDocument()

    await user.click(
      screen.getByRole("switch", { name: "Veriyi tarayıcıda sakla" })
    )
    expect(getScenarioState().persist).toBe(false)
    expect(localStorage.getItem(DB_STORAGE_KEY)).toBeNull()
  })

  it("signs in as a seed user from the quick sign-in select", async () => {
    const onSignedIn = vi.fn()
    const { user } = await renderWithProviders(
      <DevToolbar onSignedIn={onSignedIn} />
    )
    await user.click(screen.getByTestId("msw-badge"))

    await user.click(
      await screen.findByRole("combobox", { name: "Hızlı giriş" })
    )
    await user.click(
      await screen.findByRole("option", {
        name: /Deniz Arslan · viewer@acme.test/,
      })
    )

    expect(
      await screen.findByText("Deniz Arslan olarak giriş yapıldı.")
    ).toBeInTheDocument()
    expect(onSignedIn).toHaveBeenCalledTimes(1)
    expect(getSessionState()).toMatchObject({
      accessToken: expect.stringMatching(/^mock-at\./),
      activeWorkspaceId: WORKSPACE_IDS.acme,
    })
  })
})
