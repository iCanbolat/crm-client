import type { ColumnDef } from "@tanstack/react-table"
import { within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import {
  createSelectColumn,
  DataTable,
  DataTableColumnHeader,
  DataTablePagination,
  DataTableSelectionBar,
  DataTableViewOptions,
  useDataTable,
  type DataTableState,
  type Density,
} from "@/components/common/data-table"
import { SortableList } from "@/components/common/sortable-list"
import { renderWithProviders, screen } from "@/test/render"

interface Row {
  id: string
  name: string
  city: string
}

const ROWS: Row[] = Array.from({ length: 60 }, (_, index) => ({
  id: `r${index}`,
  name: `Firma ${String(index).padStart(2, "0")}`,
  city: index % 2 ? "İzmir" : "Ankara",
}))

const columns: ColumnDef<Row, unknown>[] = [
  createSelectColumn<Row>((row) => row.name),
  {
    id: "name",
    accessorKey: "name",
    size: 200,
    meta: { label: "Ad" },
    header: ({ table, column }) => (
      <DataTableColumnHeader table={table} column={column} title="Ad" />
    ),
  },
  {
    id: "city",
    accessorKey: "city",
    meta: { label: "Şehir" },
    header: ({ table, column }) => (
      <DataTableColumnHeader table={table} column={column} title="Şehir" />
    ),
  },
]

function Harness({ pageSize = 10 }: { pageSize?: number }) {
  const [state, setState] = useState<DataTableState>({
    pagination: { pageIndex: 0, pageSize },
    sorting: [],
    columnVisibility: {},
    columnOrder: [],
    columnPinning: { left: [], right: [] },
    rowSelection: {},
  })
  const [density, setDensity] = useState<Density>("comfortable")
  // Server-side behaviour, simulated: sort + page here.
  const sorted = [...ROWS].sort((a, b) =>
    state.sorting[0]?.desc
      ? b.name.localeCompare(a.name)
      : a.name.localeCompare(b.name)
  )
  const { pageIndex, pageSize: size } = state.pagination
  const table = useDataTable({
    data: sorted.slice(pageIndex * size, pageIndex * size + size),
    columns,
    rowCount: ROWS.length,
    getRowId: (row) => row.id,
    state,
    enableRowSelection: true,
    onStateChange: (patch) => setState((current) => ({ ...current, ...patch })),
  })
  const selected = Object.keys(state.rowSelection).length

  return (
    <>
      <DataTableViewOptions
        table={table}
        density={density}
        onDensityChange={setDensity}
      />
      <DataTableSelectionBar
        count={selected}
        onClear={() =>
          setState((current) => ({ ...current, rowSelection: {} }))
        }
      >
        <span>işlemler</span>
      </DataTableSelectionBar>
      <DataTable
        table={table}
        label="Firmalar"
        density={density}
        emptyState="Boş"
      />
      <DataTablePagination table={table} />
      <output data-testid="state">
        {JSON.stringify({ ...state, density })}
      </output>
    </>
  )
}

const state = () => JSON.parse(screen.getByTestId("state").textContent!)

describe("DataTable (B2.2)", () => {
  it("renders server-side pages with accessible headers and pagination", async () => {
    const { user } = await renderWithProviders(<Harness />)
    const table = screen.getByRole("table", { name: "Firmalar" })

    expect(within(table).getAllByRole("row")).toHaveLength(11)
    expect(screen.getByText("Toplam 60 kayıt")).toBeInTheDocument()
    expect(screen.getByText("Sayfa 1 / 6")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Sonraki" }))
    expect(screen.getByText("Sayfa 2 / 6")).toBeInTheDocument()
    expect(within(table).getByText("Firma 10")).toBeInTheDocument()
  })

  it("sorts from the column menu and reports aria-sort", async () => {
    const { user } = await renderWithProviders(<Harness />)

    await user.click(
      screen.getByRole("button", { name: "Ad kolonu seçenekleri" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Azalan sırala" })
    )

    expect(screen.getByRole("columnheader", { name: /Ad/ })).toHaveAttribute(
      "aria-sort",
      "descending"
    )
    expect(state().sorting).toEqual([{ id: "name", desc: true }])
    expect(state().pagination.pageIndex).toBe(0)
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Firma 59")

    await user.click(
      screen.getByRole("button", { name: "Ad kolonu seçenekleri" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Sıralamayı kaldır" })
    )
    expect(state().sorting).toEqual([])
  })

  it("hides, moves and pins columns", async () => {
    const { user } = await renderWithProviders(<Harness />)

    await user.click(
      screen.getByRole("button", { name: "Şehir kolonu seçenekleri" })
    )
    await user.click(await screen.findByRole("menuitem", { name: "Sola taşı" }))
    expect(state().columnOrder).toEqual(["__select", "city", "name"])

    await user.click(
      screen.getByRole("button", { name: "Ad kolonu seçenekleri" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Sola sabitle" })
    )
    expect(state().columnPinning.left).toEqual(["name"])
    expect(screen.getByRole("columnheader", { name: /Ad/ })).toHaveStyle({
      position: "sticky",
    })

    await user.click(
      screen.getByRole("button", { name: "Görünüm seçenekleri" })
    )
    await user.click(
      await screen.findByRole("menuitemcheckbox", { name: "Şehir" })
    )
    expect(state().columnVisibility).toEqual({ city: false })
    expect(
      screen.queryByRole("columnheader", { name: /Şehir/ })
    ).not.toBeInTheDocument()

    await user.click(await screen.findByRole("menuitemradio", { name: "Sıkı" }))
    expect(state().density).toBe("compact")
  })

  it("selects rows and shows the bulk action bar", async () => {
    const { user } = await renderWithProviders(<Harness />)

    await user.click(
      screen.getByRole("checkbox", { name: "Satırı seç: Firma 00" })
    )
    expect(
      screen.getByRole("region", { name: "Toplu işlemler" })
    ).toHaveTextContent("1 kayıt seçildi")
    await user.click(
      screen.getByRole("checkbox", { name: "Sayfadaki tüm satırları seç" })
    )
    expect(
      screen.getByRole("region", { name: "Toplu işlemler" })
    ).toHaveTextContent("10 kayıt seçildi")
    await user.click(screen.getByRole("button", { name: "Seçimi temizle" }))
    expect(
      screen.queryByRole("region", { name: "Toplu işlemler" })
    ).not.toBeInTheDocument()
  })

  it("virtualizes large pages", async () => {
    await renderWithProviders(<Harness pageSize={100} />)
    const table = screen.getByRole("table", { name: "Firmalar" })
    // jsdom has no layout: only the overscan window is rendered.
    expect(within(table).getAllByRole("row").length).toBeLessThan(61)
    expect(table).toHaveAttribute("aria-rowcount", "61")
  })
})

describe("SortableList", () => {
  function List() {
    const [items, setItems] = useState(["Yeni", "Teklif", "Kazanıldı"])
    return (
      <SortableList
        label="Aşamalar"
        items={items}
        getId={(item) => item}
        getLabel={(item) => item}
        onReorder={setItems}
        renderItem={(item) => <span>{item}</span>}
      />
    )
  }

  it("reorders with the move buttons and keeps the handles accessible", async () => {
    const { user } = await renderWithProviders(<List />)
    const list = screen.getByRole("list", { name: "Aşamalar" })

    expect(
      screen.getByRole("button", { name: "Yukarı taşı: Yeni" })
    ).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Aşağı taşı: Yeni" }))
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["Teklif", "Yeni", "Kazanıldı"])
    expect(
      screen.getByRole("button", { name: "Sırala: Yeni" })
    ).toHaveAttribute("aria-roledescription", "sortable")
  })
})
