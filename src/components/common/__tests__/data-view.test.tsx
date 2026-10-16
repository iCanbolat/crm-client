import type { ColumnDef } from "@tanstack/react-table"
import { within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createSelectColumn,
  DataTableColumnHeader,
  useDataTable,
  type DataTableState,
} from "@/components/common/data-table"
import {
  DATA_VIEW_STORAGE_KEY,
  DataView,
  resetDataViewPreferences,
} from "@/components/common/data-view"
import { renderWithProviders, screen } from "@/test/render"

interface Row {
  id: string
  name: string
  city: string
}

const ROWS: Row[] = Array.from({ length: 25 }, (_, index) => ({
  id: `r${index}`,
  name: `Firma ${String(index).padStart(2, "0")}`,
  city: index % 2 ? "İzmir" : "Ankara",
}))

const columns: ColumnDef<Row, string>[] = [
  createSelectColumn<Row>((row) => row.name) as ColumnDef<Row, string>,
  {
    id: "name",
    accessorKey: "name",
    enableHiding: false,
    meta: { label: "Ad" },
    header: ({ table, column }) => (
      <DataTableColumnHeader table={table} column={column} title="Ad" />
    ),
  },
  {
    id: "city",
    accessorKey: "city",
    meta: { label: "Şehir" },
    header: "Şehir",
  },
]

function Harness({ initialState }: { initialState?: Partial<DataTableState> }) {
  const table = useDataTable({
    data: ROWS,
    columns,
    getRowId: (row) => row.id,
    mode: "client",
    enableRowSelection: true,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
      ...initialState,
    },
  })
  const selected = Object.keys(table.getState().rowSelection).length

  return (
    <>
      <output aria-label="seçili">{selected}</output>
      <DataView
        table={table}
        label="Firmalar"
        viewKey="test:companies"
        card={{ title: "name" }}
        emptyState={<p>Sonuç yok</p>}
      />
    </>
  )
}

function mockContainerWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width,
  } as DOMRect)
}

describe("DataView", () => {
  beforeEach(() => resetDataViewPreferences())
  afterEach(() => vi.restoreAllMocks())

  it("pages and sorts in memory in client mode", async () => {
    const { user } = await renderWithProviders(<Harness />)
    const table = screen.getByRole("table", { name: "Firmalar" })
    expect(within(table).getAllByRole("row")).toHaveLength(11)
    expect(screen.getByText("Sayfa 1 / 3")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Sonraki" }))
    expect(within(table).getByText("Firma 10")).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "Ad kolonu seçenekleri" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Azalan sırala" })
    )
    expect(screen.getByText("Sayfa 1 / 3")).toBeInTheDocument()
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Firma 24")
  })

  it("switches to cards that follow column visibility and remembers it", async () => {
    const { user } = await renderWithProviders(
      <Harness initialState={{ columnVisibility: { city: false } }} />
    )
    await user.click(screen.getByRole("button", { name: "Kartlar" }))

    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    const list = screen.getByRole("list", { name: "Firmalar" })
    const cards = within(list).getAllByRole("listitem")
    expect(cards).toHaveLength(10)
    expect(cards[0]).toHaveTextContent("Firma 00")
    expect(within(list).queryByText("Şehir")).not.toBeInTheDocument()
    expect(localStorage.getItem(DATA_VIEW_STORAGE_KEY)).toContain(
      '"test:companies":"grid"'
    )
  })

  it("selects and sorts without headers in the card layout", async () => {
    const { user } = await renderWithProviders(<Harness />)
    await user.click(screen.getByRole("button", { name: "Kartlar" }))

    await user.click(
      screen.getByRole("checkbox", { name: "Sayfadaki tüm satırları seç" })
    )
    expect(screen.getByRole("status", { name: "seçili" })).toHaveTextContent(
      "10"
    )

    await user.click(screen.getByRole("button", { name: /^Sırala/ }))
    await user.click(await screen.findByRole("menuitemradio", { name: "Ad" }))
    // Radio items keep the menu open, so the direction is right there.
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Azalan sırala" })
    )
    const list = screen.getByRole("list", { name: "Firmalar" })
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent(
      "Firma 24"
    )
  })

  it("forces cards in a narrow container and hides the table option", async () => {
    mockContainerWidth(400)
    await renderWithProviders(<Harness />)

    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Firmalar" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Tablo" })
    ).not.toBeInTheDocument()
    // The stored choice is untouched; a wide container shows the table again.
    expect(localStorage.getItem(DATA_VIEW_STORAGE_KEY) ?? "").not.toContain(
      "grid"
    )
  })
})
