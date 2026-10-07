import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { formContent, formField, tt } from "@/engine/__tests__/form-fixtures"
import { renderWithProviders } from "@/test/render"

import { FormRenderer, resolvePrefill } from "../index"

function contactForm() {
  return formContent([
    formField("name", "text", {
      label: tt("Ad soyad", "Full name"),
      required: true,
      width: "half",
    }),
    formField("email", "email", {
      label: tt("E-posta", "Email"),
      required: true,
      width: "half",
      placeholder: tt("ornek@firma.com"),
      helpText: tt("İş adresinizi yazın."),
    }),
    formField("code", "text", {
      label: tt("Liman kodu"),
      validation: { pattern: "^[A-Z]{5}$" },
    }),
    formField("topic", "radio", {
      label: tt("Konu"),
      options: [
        { value: "sea", label: tt("Deniz yolu", "Sea") },
        { value: "air", label: tt("Hava yolu", "Air") },
      ],
    }),
    formField("intro", "paragraph", { content: tt("Bilgilerinizi bırakın.") }),
    formField("utm", "hidden", {
      prefill: { kind: "query", param: "utm_source" },
    }),
    formField("kvkk", "consent", {
      label: tt("KVKK metnini okudum, onaylıyorum."),
      required: true,
      consentUrl: "https://acme.test/kvkk",
    }),
  ])
}

describe("form renderer (B4.1)", () => {
  it("TC-4.1-01 shows validation errors and submits visible answers", async () => {
    const onSubmit = vi.fn()
    const { user } = await renderWithProviders(
      <FormRenderer
        content={contactForm()}
        language="tr"
        mode="preview"
        context={{ search: "?utm_source=linkedin" }}
        onSubmit={onSubmit}
      />
    )

    expect(screen.getByText("Bilgilerinizi bırakın.")).toBeInTheDocument()
    expect(screen.getByLabelText(/E-posta/)).toHaveAttribute(
      "placeholder",
      "ornek@firma.com"
    )
    expect(screen.getByLabelText(/E-posta/)).toHaveAccessibleDescription(
      "İş adresinizi yazın."
    )
    expect(
      screen.getByRole("link", { name: /Aydınlatma metni/ })
    ).toHaveAttribute("href", "https://acme.test/kvkk")

    await user.click(screen.getByRole("button", { name: "Gönder" }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getAllByText("Bu alan zorunludur.")).toHaveLength(2)
    expect(
      screen.getByText("Devam etmek için onaylamanız gerekir.")
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Ad soyad/), "Ayşe Yılmaz")
    await user.type(screen.getByLabelText(/E-posta/), "ayse@")
    await user.type(screen.getByLabelText(/Liman kodu/), "ist")
    await user.click(screen.getByRole("button", { name: "Gönder" }))
    expect(
      screen.getByText("Geçerli bir e-posta adresi girin.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Değer beklenen biçimde değil.")
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText(/E-posta/), "acme.test")
    await user.clear(screen.getByLabelText(/Liman kodu/))
    await user.type(screen.getByLabelText(/Liman kodu/), "TRIST")
    await user.click(screen.getByRole("radio", { name: "Hava yolu" }))
    await user.click(screen.getByRole("checkbox", { name: /KVKK/ }))
    await user.click(screen.getByRole("button", { name: "Gönder" }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Ayşe Yılmaz",
      email: "ayse@acme.test",
      code: "TRIST",
      topic: "air",
      utm: "linkedin",
      kvkk: true,
    })
    expect(await screen.findByRole("status")).toHaveTextContent("Teşekkürler!")
  })

  it("renders labels in the form language and announces redirects in preview", async () => {
    const content = contactForm()
    content.fields = content.fields.filter((field) => field.key === "name")
    content.settings.redirectUrl = "https://acme.test/tesekkurler"
    const { user } = await renderWithProviders(
      <FormRenderer content={content} language="en" mode="preview" />
    )
    await user.type(screen.getByLabelText(/Full name/), "Jane")
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Live visitors are redirected to: https://acme.test/tesekkurler"
    )
    await user.click(
      screen.getByRole("button", { name: "Submit another response" })
    )
    expect(screen.getByLabelText(/Full name/)).toHaveValue("")
  })

  it("keeps the form open when submitting fails and ignores honeypot spam", async () => {
    const content = formContent([formField("name", "text")])
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("offline"))
    const { user, container } = await renderWithProviders(
      <FormRenderer content={content} language="tr" onSubmit={onSubmit} />
    )
    await user.click(screen.getByRole("button", { name: "Gönder" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Form gönderilemedi"
    )

    const trap = container.querySelector<HTMLInputElement>(
      'input[name="website"]'
    )
    expect(trap).not.toBeNull()
    await user.type(trap!, "spam")
    await user.click(screen.getByRole("button", { name: "Gönder" }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("status")).toBeInTheDocument()
  })

  it("resolves hidden field sources", () => {
    const field = formField("x", "hidden")
    expect(resolvePrefill(field)).toBeNull()
    expect(
      resolvePrefill({ ...field, prefill: { kind: "static", value: "web" } })
    ).toBe("web")
    expect(
      resolvePrefill(
        { ...field, prefill: { kind: "referrer" } },
        { referrer: "https://google.com" }
      )
    ).toBe("https://google.com")
    expect(
      resolvePrefill(
        { ...field, prefill: { kind: "query" } },
        { search: "?a=1" }
      )
    ).toBeNull()
  })

  it("shows an empty state for a form without fields", async () => {
    await renderWithProviders(
      <FormRenderer content={formContent([])} language="tr" />
    )
    expect(screen.getByText("Bu formda henüz alan yok.")).toBeInTheDocument()
  })
})
