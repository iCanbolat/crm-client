import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { PublicApp } from "@/app/public-app"
import { FORM_EMBED_RESIZE_MESSAGE, migrateFormContent } from "@/engine/forms"
import { configureApiClient } from "@/lib/api"
import { db } from "@/mocks/db"

const ACME = "acme-lojistik.forms.localhost"

function renderPublic(url: string, host = ACME) {
  window.history.replaceState(null, "", url)
  const user = userEvent.setup()
  render(<PublicApp host={host} />)
  return { user }
}

function editVersion(
  formId: string,
  version: number,
  edit: (content: ReturnType<typeof migrateFormContent>) => void
) {
  const row = db.formVersions.findFirst(
    (item) => item.formId === formId && item.version === version
  )!
  const content = migrateFormContent(row.content)
  edit(content)
  db.formVersions.update(row.id, { content })
}

const notFound = () =>
  screen.findByRole("heading", { name: "Sayfa bulunamadı" })

afterEach(() => {
  configureApiClient({ publicHost: undefined })
  window.history.replaceState(null, "", "/")
  vi.restoreAllMocks()
})

describe("public form site (B5.4)", () => {
  it("TC-5.4-01 unknown hosts get a brand-neutral 404", async () => {
    renderPublic("/f/iletisim", "bilinmeyen.forms.localhost")
    expect(await notFound()).toBeInTheDocument()
    expect(screen.queryByText(/Acme/)).not.toBeInTheDocument()
  })

  it("TC-5.4-02 unpublished forms and unknown paths are 404", async () => {
    renderPublic("/f/acente-basvuru")
    expect(await notFound()).toBeInTheDocument()
  })

  it("TC-5.4-03 the root shows the default form, or 404 without one", async () => {
    renderPublic("/")
    expect(await notFound()).toBeInTheDocument()
  })

  it("TC-5.4-03 the root shows the site's default form", async () => {
    db.sites.update("site_ws_acme", { defaultFormId: "form_contact" })
    renderPublic("/")
    expect(
      await screen.findByRole("heading", { name: "İletişim Formu", level: 1 })
    ).toBeInTheDocument()
    // Hosted chrome: brand header, legal links, document title.
    expect(screen.getByText("Acme Lojistik")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "KVKK Aydınlatma Metni" })
    ).toHaveAttribute("href", "https://acmelojistik.com/kvkk")
    expect(document.title).toBe("Acme Lojistik — Navlun teklifi")
  })

  it("renders the form in ?lang= when the form offers it", async () => {
    db.sites.update("site_ws_acme", { defaultFormId: "form_freight" })
    renderPublic("/f/navlun-teklif?lang=en")
    expect(
      await screen.findByRole("heading", { name: "Contact details" })
    ).toBeInTheDocument()
    expect(document.documentElement.lang).toBe("en")
  })

  it("TC-5.4-04 UTM parameters fill hidden fields and reach the submission", async () => {
    editVersion("form_contact", 1, (content) => {
      content.fields.push({
        id: "fld_utmSource",
        key: "utmSource",
        type: "hidden",
        stepId: content.steps[0]!.id,
        label: { tr: "UTM kaynağı", en: "UTM source" },
        width: "full",
        prefill: { kind: "query", param: "utm_source" },
      })
    })
    const { user } = renderPublic(
      "/f/iletisim?utm_source=linkedin&utm_medium=social"
    )
    await screen.findByRole("heading", { name: "İletişim Formu", level: 1 })

    await user.type(
      screen.getByRole("textbox", { name: /Ad soyad/ }),
      "Ayşe Demir"
    )
    await user.type(
      screen.getByRole("textbox", { name: /E-posta/ }),
      "ayse@demir.test"
    )
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "Gönder" }))

    expect(await screen.findByRole("status")).toBeInTheDocument()
    const submission = db.submissions.findFirst(
      (row) => row.answers.email === "ayse@demir.test"
    )!
    expect(submission.answers.utmSource).toBe("linkedin")
    expect(submission.utm).toMatchObject({
      source: "linkedin",
      medium: "social",
    })
    expect(submission.embedded).toBe(false)
    expect(submission.record?.objectKey).toBe("lead")
  })

  it("TC-5.4-05 embedded forms report their height to the host page", async () => {
    const postMessage = vi.fn()
    vi.spyOn(window, "parent", "get").mockReturnValue({
      postMessage,
    } as unknown as Window)

    renderPublic("/embed/iletisim")
    await screen.findByRole("heading", { name: "İletişim Formu", level: 1 })
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        { type: FORM_EMBED_RESIZE_MESSAGE, height: expect.any(Number) },
        "*"
      )
    )
    // No hosted chrome inside the iframe.
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument()
    expect(document.body.style.background).toBe("transparent")
  })

  it("TC-5.4-06 follows the form's redirect URL after submitting", async () => {
    editVersion("form_contact", 1, (content) => {
      content.settings.redirectUrl = "https://acmelojistik.com/tesekkurler"
    })
    const assign = vi.fn()
    const original = window.location
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...original,
        assign,
        pathname: "/f/iletisim",
        search: "",
        href: original.href,
      },
    })
    try {
      const { user } = renderPublic("/f/iletisim")
      await screen.findByRole("heading", { name: "İletişim Formu", level: 1 })
      await user.type(screen.getByRole("textbox", { name: /Ad soyad/ }), "Can")
      await user.type(
        screen.getByRole("textbox", { name: /E-posta/ }),
        "can@x.test"
      )
      await user.click(screen.getByRole("checkbox"))
      await user.click(screen.getByRole("button", { name: "Gönder" }))
      await waitFor(() =>
        expect(assign).toHaveBeenCalledWith(
          "https://acmelojistik.com/tesekkurler"
        )
      )
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      })
    }
  })

  // Debounced search + combobox: slow under coverage instrumentation.
  it(
    "TC-5.4-07 location search works without a session",
    { timeout: 20_000 },
    async () => {
      const { user } = renderPublic("/f/navlun-teklif")
      await screen.findByRole("heading", { name: "İletişim bilgileri" })
      await user.type(screen.getByRole("textbox", { name: /Ad soyad/ }), "Ayşe")
      await user.type(
        screen.getByRole("textbox", { name: /E-posta/ }),
        "a@b.test"
      )
      await user.click(screen.getByRole("button", { name: "İleri" }))

      const origin = await screen.findByRole("combobox", {
        name: /Çıkış noktası/,
      })
      await user.type(origin, "Hamb")
      // The listbox re-renders from "searching" to results: query the screen.
      const options = await screen.findAllByRole(
        "option",
        { name: /Hamburg/ },
        { timeout: 8_000 }
      )
      expect(options.length).toBeGreaterThan(0)
    }
  )
})
