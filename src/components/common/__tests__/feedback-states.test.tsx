import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { LoadingSkeleton } from "@/components/common/loading-skeleton"
import { PageHeader } from "@/components/common/page-header"
import { ApiError } from "@/lib/api"
import { renderWithProviders, screen } from "@/test/render"

function ConfirmHarness({ onConfirm }: { onConfirm: () => unknown }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <p>{open ? "open" : "closed"}</p>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Silinsin mi?"
        description="Geri alınamaz"
        confirmLabel="Sil"
        variant="destructive"
        onConfirm={onConfirm}
      />
    </>
  )
}

describe("ErrorState", () => {
  it("TC-0.3-04 renders a localized message for ApiErrors and retries", async () => {
    const onRetry = vi.fn()
    const error = new ApiError({
      kind: "network",
      status: 0,
      code: "NETWORK_ERROR",
      message: "x",
    })
    const { user } = await renderWithProviders(
      <ErrorState error={error} onRetry={onRetry} />
    )

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Bir şeyler ters gitti")
    expect(alert).toHaveTextContent("Sunucuya ulaşılamadı")

    await user.click(screen.getByRole("button", { name: "Tekrar dene" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("TC-0.3-04 supports custom copy without a retry action", async () => {
    await renderWithProviders(
      <ErrorState title="Başlık" description="Açıklama" />
    )

    expect(screen.getByRole("alert")).toHaveTextContent("BaşlıkAçıklama")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})

describe("ConfirmDialog", () => {
  it("TC-0.3-05 closes after a successful confirmation", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const { user } = await renderWithProviders(
      <ConfirmHarness onConfirm={onConfirm} />
    )

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Silinsin mi?Geri alınamaz"
    )
    await user.click(screen.getByRole("button", { name: "Sil" }))

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(await screen.findByText("closed")).toBeInTheDocument()
  })

  it("TC-0.3-05 stays open when the confirmation fails", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("boom"))
    const { user } = await renderWithProviders(
      <ConfirmHarness onConfirm={onConfirm} />
    )

    await user.click(await screen.findByRole("button", { name: "Sil" }))

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(screen.getByText("open")).toBeInTheDocument()
  })

  it("TC-0.3-05 cancels without confirming", async () => {
    const onConfirm = vi.fn()
    const { user } = await renderWithProviders(
      <ConfirmHarness onConfirm={onConfirm} />
    )

    await user.click(await screen.findByRole("button", { name: "Vazgeç" }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(await screen.findByText("closed")).toBeInTheDocument()
  })
})

describe("layout primitives", () => {
  it("renders page header, empty state and loading skeleton", async () => {
    await renderWithProviders(
      <>
        <PageHeader
          title="Başlık"
          description="Alt başlık"
          actions={<button>Yeni</button>}
        />
        <EmptyState
          title="Boş"
          description="Kayıt yok"
          action={<button>Ekle</button>}
        />
        <LoadingSkeleton variant="page" rows={3} />
        <LoadingSkeleton variant="card" />
      </>
    )

    expect(
      screen.getByRole("heading", { level: 1, name: "Başlık" })
    ).toBeInTheDocument()
    expect(screen.getByText("Kayıt yok")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ekle" })).toBeInTheDocument()
    expect(screen.getAllByRole("status", { name: "Yükleniyor…" })).toHaveLength(
      2
    )
  })
})
