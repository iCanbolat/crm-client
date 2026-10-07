import { waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { db } from "@/mocks/db"
import { SEED_USERS, WORKSPACE_IDS } from "@/mocks/db/seed"
import { server } from "@/mocks/node"
import { setScenarioState } from "@/mocks/scenarios/scenario-store"
import { apiPath } from "@/mocks/utils/http"
import { renderRoute, screen } from "@/test/render"
import type { SeedUserKey } from "@/mocks/db/seed"

const deals = () =>
  db.records.findMany(
    (row) => row.workspaceId === WORKSPACE_IDS.acme && row.objectKey === "deal"
  )

async function renderBoard(as: SeedUserKey = "owner") {
  const utils = await renderRoute("/o/deal?layout=kanban", { as })
  const board = await screen.findByRole("region", { name: "Fırsatlar panosu" })
  return { ...utils, board }
}

const column = (board: HTMLElement, stage: string) =>
  within(board).getByRole("region", { name: stage })

const cardsIn = (board: HTMLElement, stage: string) =>
  within(column(board, stage)).queryAllByRole("listitem")

async function moveWithMenu(
  user: Awaited<ReturnType<typeof renderBoard>>["user"],
  title: string,
  stage: string
) {
  await user.click(screen.getByRole("button", { name: `Taşı: ${title}` }))
  await user.click(await screen.findByRole("menuitem", { name: stage }))
}

describe("pipeline board (B2.5)", () => {
  it("shows one column per stage with counts and currency totals", async () => {
    const { board } = await renderBoard()

    const headings = within(board)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent)
    expect(headings).toEqual([
      "Fiyat araştırma",
      "Teklif gönderildi",
      "Müzakere",
      "Kazanıldı (booking)",
      "Kaybedildi",
    ])
    const inProposal = deals().filter(
      (row) => row.values.stage === "quote_sent"
    )
    expect(column(board, "Teklif gönderildi")).toHaveTextContent(
      `${inProposal.length} kayıt`
    )
    expect(cardsIn(board, "Teklif gönderildi")).toHaveLength(inProposal.length)
    expect(column(board, "Teklif gönderildi")).toHaveTextContent(/€|\$|₺/)
  })

  it("switches between table and kanban", async () => {
    const { user, router } = await renderBoard()

    await user.click(screen.getByRole("button", { name: "Tablo" }))
    expect(
      await screen.findByRole("table", { name: "Fırsatlar" })
    ).toBeInTheDocument()
    expect(router.state.location.search).not.toHaveProperty("layout")

    await user.click(screen.getByRole("button", { name: "Kanban" }))
    expect(
      await screen.findByRole("region", { name: "Fırsatlar panosu" })
    ).toBeInTheDocument()
  })

  it("TC-2.5-01 moving a card updates its stage", async () => {
    const target = deals().find((row) => row.values.stage === "rate_research")!
    const title = String(target.values.name)
    const { user, board } = await renderBoard()
    const before = cardsIn(board, "Müzakere").length

    await moveWithMenu(user, title, "Müzakere")

    await waitFor(() =>
      expect(cardsIn(board, "Müzakere")).toHaveLength(before + 1)
    )
    expect(
      within(column(board, "Müzakere")).getByRole("link", {
        name: new RegExp(title),
      })
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(db.records.findById(target.id)!.values.stage).toBe("negotiation")
    )
  })

  it("TC-2.5-02 a failed move puts the card back and shows a toast", async () => {
    server.use(
      http.patch(apiPath("/records/:objectKey/:id/stage"), () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "x" } },
          { status: 500 }
        )
      )
    )
    const target = deals().find((row) => row.values.stage === "rate_research")!
    const title = String(target.values.name)
    const { user, board } = await renderBoard()
    const before = cardsIn(board, "Fiyat araştırma").length

    await moveWithMenu(user, title, "Teklif gönderildi")

    expect(await screen.findByText("Kayıt taşınamadı.")).toBeInTheDocument()
    await waitFor(() =>
      expect(cardsIn(board, "Fiyat araştırma")).toHaveLength(before)
    )
    expect(
      within(column(board, "Fiyat araştırma")).getByRole("link", {
        name: new RegExp(title),
      })
    ).toBeInTheDocument()
    expect(db.records.findById(target.id)!.values.stage).toBe("rate_research")
  })

  it("TC-2.5-03 the stage gate asks for the required field before moving", async () => {
    const target = deals().find((row) => row.values.stage === "negotiation")!
    const title = String(target.values.name)
    const { user, board } = await renderBoard()

    await moveWithMenu(user, title, "Kaybedildi")

    const dialog = await screen.findByRole("dialog", {
      name: '"Kaybedildi" aşaması için bilgi gerekli',
    })
    await user.click(within(dialog).getByRole("button", { name: "Taşı" }))
    expect(
      within(dialog).getByRole("combobox", { name: "Kayıp nedeni" })
    ).toHaveAttribute("aria-invalid", "true")
    expect(db.records.findById(target.id)!.values.stage).toBe("negotiation")

    await user.click(
      within(dialog).getByRole("combobox", { name: "Kayıp nedeni" })
    )
    await user.click(await screen.findByRole("option", { name: "Fiyat" }))
    await user.click(within(dialog).getByRole("button", { name: "Taşı" }))

    await waitFor(() =>
      expect(db.records.findById(target.id)!.values).toMatchObject({
        stage: "lost",
        lostReason: "price",
      })
    )
    expect(
      within(column(board, "Kaybedildi")).getByRole("link", {
        name: new RegExp(title),
      })
    ).toBeInTheDocument()
  })

  it("TC-2.5-04 cards are keyboard operable (drag handle + move menu)", async () => {
    const target = deals().find((row) => row.values.stage === "quote_sent")!
    const title = String(target.values.name)
    const { user } = await renderBoard()

    const handle = screen.getByRole("button", { name: `Sürükle: ${title}` })
    expect(handle).toHaveAttribute("aria-roledescription", "draggable")
    expect(handle).toHaveAccessibleDescription(
      /ok tuşlarıyla aşamalar arasında/
    )

    const menu = screen.getByRole("button", { name: `Taşı: ${title}` })
    menu.focus()
    await user.keyboard("{Enter}")
    const item = await screen.findByRole("menuitem", {
      name: "Kazanıldı (booking)",
    })
    item.focus()
    await user.keyboard("{Enter}")

    await waitFor(() =>
      expect(db.records.findById(target.id)!.values.stage).toBe("won")
    )
  })

  it("filters the board with the same filters as the list", async () => {
    const filters = [{ field: "stage", op: "in", value: ["won"] }]
    await renderRoute(
      `/o/deal?layout=kanban&filters=${encodeURIComponent(JSON.stringify(filters))}`,
      { as: "owner" }
    )
    const board = await screen.findByRole("region", {
      name: "Fırsatlar panosu",
    })

    expect(cardsIn(board, "Teklif gönderildi")).toHaveLength(0)
    expect(
      within(column(board, "Teklif gönderildi")).getByText(
        "Bu aşamada kayıt yok."
      )
    ).toBeInTheDocument()
    expect(cardsIn(board, "Kazanıldı (booking)").length).toBeGreaterThan(0)
  })

  it("agents can only move their own cards", async () => {
    const { board } = await renderBoard("agent")
    const own = deals().find(
      (row) => row.values.ownerId === SEED_USERS.agent.id
    )!
    const foreign = deals().find(
      (row) => row.values.ownerId !== SEED_USERS.agent.id
    )!

    expect(
      within(board).getByRole("button", { name: `Taşı: ${own.values.name}` })
    ).toBeInTheDocument()
    expect(
      within(board).queryByRole("button", {
        name: `Taşı: ${foreign.values.name}`,
      })
    ).not.toBeInTheDocument()
  })

  it("shows empty columns in the empty scenario", async () => {
    setScenarioState({ scenario: "empty" })
    const { board } = await renderBoard()
    expect(within(board).getAllByText("Bu aşamada kayıt yok.")).toHaveLength(5)
  })
})
