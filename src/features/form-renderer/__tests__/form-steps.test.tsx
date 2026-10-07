import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  formContent,
  formField,
  rule,
  tt,
} from "@/engine/__tests__/form-fixtures"
import { renderWithProviders } from "@/test/render"

import { FormRenderer } from "../index"

function stepped() {
  return formContent(
    [
      formField("name", "text", { label: tt("Ad soyad"), required: true }),
      formField("mode", "radio", {
        label: tt("Taşıma modu"),
        required: true,
        options: [
          { value: "AIR", label: tt("Hava") },
          { value: "SEA", label: tt("Deniz") },
        ],
      }),
      formField("weight", "number", {
        label: tt("Ağırlık"),
        required: true,
        stepId: "air",
      }),
      formField("notes", "textarea", {
        label: tt("Notlar"),
        required: true,
        stepId: "last",
      }),
    ],
    {
      steps: [
        { id: "step1", title: tt("İletişim") },
        { id: "air", title: tt("Hava yükü") },
        { id: "last", title: tt("Son adım") },
      ],
      logic: [
        rule("r1", {
          conditions: [{ field: "f_mode", op: "eq", value: "AIR" }],
          action: "show",
          targets: [{ kind: "step", id: "air" }],
        }),
      ],
    }
  )
}

describe("multi-step forms (B4.4)", () => {
  it("TC-4.4-03 validates only the current step when moving on", async () => {
    const onSubmit = vi.fn()
    const { user } = await renderWithProviders(
      <FormRenderer content={stepped()} language="tr" onSubmit={onSubmit} />
    )
    expect(
      screen.getByRole("heading", { name: "İletişim" })
    ).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50"
    )
    expect(screen.getByText("Adım 1 / 2")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "İleri" }))
    expect(screen.getAllByText("Bu alan zorunludur.")).toHaveLength(2)
    expect(
      screen.getByRole("heading", { name: "İletişim" })
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Ad soyad/), "Ayşe")
    await user.click(screen.getByRole("radio", { name: "Hava" }))
    // The air step appears: three steps now.
    expect(screen.getByText("Adım 1 / 3")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "İleri" }))

    expect(
      await screen.findByRole("heading", { name: "Hava yükü" })
    ).toBeInTheDocument()
    // Step 2 starts without errors although its field is required.
    expect(screen.queryByText("Bu alan zorunludur.")).toBeNull()
    await user.click(screen.getByRole("button", { name: "İleri" }))
    expect(screen.getByText("Bu alan zorunludur.")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Geri" }))
    await user.click(screen.getByRole("radio", { name: "Deniz" }))
    await user.click(screen.getByRole("button", { name: "İleri" }))
    // The air step is skipped.
    expect(
      await screen.findByRole("heading", { name: "Son adım" })
    ).toBeInTheDocument()
    expect(screen.getByText("Adım 2 / 2")).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Notlar/), "Acil")
    await user.click(screen.getByRole("button", { name: "Gönder" }))
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Ayşe",
      mode: "SEA",
      notes: "Acil",
    })
  })

  it("jumps back to the step of the first error on submit", async () => {
    const content = formContent(
      [
        formField("phone", "text", { label: tt("Telefon") }),
        formField("notes", "textarea", { label: tt("Notlar"), stepId: "last" }),
      ],
      {
        steps: [
          { id: "step1", title: tt("İletişim") },
          { id: "last", title: tt("Son adım") },
        ],
        // A later answer makes an earlier field mandatory.
        logic: [
          rule("r1", {
            conditions: [{ field: "f_notes", op: "isNotEmpty" }],
            action: "require",
            targets: [{ kind: "field", id: "f_phone" }],
          }),
        ],
      }
    )
    content.settings.showProgress = false
    const onSubmit = vi.fn()
    const { user } = await renderWithProviders(
      <FormRenderer content={content} language="tr" onSubmit={onSubmit} />
    )
    expect(screen.queryByRole("progressbar")).toBeNull()
    await user.click(screen.getByRole("button", { name: "İleri" }))
    await user.type(await screen.findByLabelText(/Notlar/), "Geri arayın")
    await user.click(screen.getByRole("button", { name: "Gönder" }))

    expect(
      await screen.findByRole("heading", { name: "İletişim" })
    ).toBeInTheDocument()
    expect(screen.getByText("Bu alan zorunludur.")).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
