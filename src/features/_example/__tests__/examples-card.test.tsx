import { within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { server } from "@/mocks/node"
import { setScenarioState } from "@/mocks/scenarios/scenario-store"
import { apiPath } from "@/mocks/utils/http"
import { renderRoute, screen } from "@/test/render"

async function renderHome(path = "/examples") {
  const utils = await renderRoute(path, { as: "owner" })
  const list = await screen.findByRole("list", { name: "Örnek kayıtlar" })
  return { ...utils, list }
}

describe("Example feature (template)", () => {
  it("TC-0.3-06 lists seeded records and paginates via the URL", async () => {
    const { user, router, list } = await renderHome()

    expect(within(list).getAllByRole("listitem")).toHaveLength(5)
    expect(screen.getByText("Toplam 24 kayıt")).toBeInTheDocument()
    expect(screen.getByText("Sayfa 1 / 5")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Önceki" })).toBeDisabled()

    const firstPageNames = within(list)
      .getAllByRole("listitem")
      .map((item) => item.textContent)

    await user.click(screen.getByRole("button", { name: "Sonraki" }))

    expect(await screen.findByText("Sayfa 2 / 5")).toBeInTheDocument()
    expect(router.state.location.search).toMatchObject({ page: 2 })
    const secondPage = screen.getByRole("list", { name: "Örnek kayıtlar" })
    expect(
      within(secondPage)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).not.toEqual(firstPageNames)
  })

  it("TC-0.3-06 opens directly on the page given in the URL", async () => {
    await renderHome("/examples?page=5")

    expect(screen.getByText("Sayfa 5 / 5")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sonraki" })).toBeDisabled()
  })

  it("TC-0.3-07 shows the empty state when there is no data", async () => {
    setScenarioState({ scenario: "empty" })

    await renderRoute("/examples", { as: "owner" })

    expect(await screen.findByText("Henüz kayıt yok")).toBeInTheDocument()
    expect(
      screen.queryByRole("list", { name: "Örnek kayıtlar" })
    ).not.toBeInTheDocument()
  })

  it("TC-0.3-07 shows the route error state and recovers on retry", async () => {
    setScenarioState({ scenario: "error" })
    const { user } = await renderRoute("/examples", { as: "owner" })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Sunucuda bir hata oluştu")

    setScenarioState({ scenario: "default" })
    await user.click(within(alert).getByRole("button", { name: "Tekrar dene" }))

    expect(
      await screen.findByRole("list", { name: "Örnek kayıtlar" })
    ).toBeInTheDocument()
  })

  it("TC-0.3-08 creates a record, shows a toast and refreshes the list", async () => {
    const { user } = await renderHome()

    await user.type(
      screen.getByRole("textbox", { name: "Kayıt adı" }),
      "Acme Lojistik"
    )
    await user.click(screen.getByRole("button", { name: "Ekle" }))

    expect(await screen.findByText("Kayıt eklendi.")).toBeInTheDocument()
    expect(await screen.findByText("Toplam 25 kayıt")).toBeInTheDocument()
    expect(
      within(screen.getByRole("list", { name: "Örnek kayıtlar" })).getByText(
        "Acme Lojistik"
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Kayıt adı" })).toHaveValue("")
  })

  it("TC-0.3-08 validates on the client before calling the API", async () => {
    let posted = false
    server.use(
      http.post(apiPath("/examples"), () => {
        posted = true
        return HttpResponse.json({})
      })
    )
    const { user } = await renderHome()

    await user.type(screen.getByRole("textbox", { name: "Kayıt adı" }), "a")
    await user.click(screen.getByRole("button", { name: "Ekle" }))

    const input = screen.getByRole("textbox", { name: "Kayıt adı" })
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription(/çok küçük/i)
    expect(posted).toBe(false)
  })

  it("TC-0.3-08 maps server-side field errors onto the form", async () => {
    const existing = db.examples.all()[0]!
    const { user } = await renderHome()

    const input = screen.getByRole("textbox", { name: "Kayıt adı" })
    await user.type(input, existing.name)
    await user.click(screen.getByRole("button", { name: "Ekle" }))

    expect(
      await screen.findByText("Bu isimde bir kayıt zaten var.")
    ).toBeInTheDocument()
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveFocus()
    expect(screen.queryByText("Kayıt eklendi.")).not.toBeInTheDocument()
  })

  it("TC-0.3-09 deletes a record after confirmation", async () => {
    const { user, list } = await renderHome()
    const firstItem = within(list).getAllByRole("listitem")[0]!
    const name = firstItem.querySelector("p")!.textContent!

    await user.click(
      within(firstItem).getByRole("button", { name: `${name} kaydını sil` })
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent(`"${name}" kalıcı olarak silinecek`)

    await user.click(within(dialog).getByRole("button", { name: "Sil" }))

    expect(await screen.findByText("Kayıt silindi.")).toBeInTheDocument()
    expect(await screen.findByText("Toplam 23 kayıt")).toBeInTheDocument()
    expect(screen.queryByText(name)).not.toBeInTheDocument()
  })

  it("TC-0.3-09 keeps the record and shows a toast when deletion fails", async () => {
    server.use(
      http.delete(apiPath("/examples/:id"), () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "x" } },
          { status: 500 }
        )
      )
    )
    const { user, list } = await renderHome()
    const firstItem = within(list).getAllByRole("listitem")[0]!

    await user.click(within(firstItem).getAllByRole("button")[0]!)
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Sil" }))

    expect(
      await screen.findByText(
        "Sunucuda bir hata oluştu. Lütfen biraz sonra tekrar deneyin."
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByText("Toplam 24 kayıt")).toBeInTheDocument()
  })
})
