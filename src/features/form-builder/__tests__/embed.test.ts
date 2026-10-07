import { describe, expect, it } from "vitest"

import { FORM_EMBED_RESIZE_MESSAGE } from "@/engine/forms"

import {
  getEmbedFormUrl,
  getHostedFormUrl,
  getIframeSnippet,
  getPublicFormsOrigin,
  getScriptSnippet,
} from "../lib/embed"

describe("embed codes (B4.7)", () => {
  it("TC-4.7-02 point to the workspace's public form address", () => {
    const prod = getPublicFormsOrigin(
      "acme-lojistik",
      { protocol: "https:", port: "" },
      "forms.example.com"
    )
    expect(prod).toBe("https://acme-lojistik.forms.example.com")
    const dev = getPublicFormsOrigin("acme-lojistik", {
      protocol: "http:",
      port: "5173",
    })
    expect(dev).toBe("http://acme-lojistik.forms.localhost:5173")

    const target = {
      origin: prod,
      slug: "navlun-teklif",
      title: 'Navlun "Teklif" <Formu>',
    }
    expect(getHostedFormUrl(target)).toBe(
      "https://acme-lojistik.forms.example.com/f/navlun-teklif"
    )
    expect(getEmbedFormUrl(target)).toBe(
      "https://acme-lojistik.forms.example.com/embed/navlun-teklif"
    )

    const iframe = getIframeSnippet(target)
    expect(iframe).toContain(
      'src="https://acme-lojistik.forms.example.com/embed/navlun-teklif"'
    )
    expect(iframe).toContain('title="Navlun &quot;Teklif&quot; &lt;Formu&gt;"')

    const script = getScriptSnippet(target)
    expect(script).toContain(
      'frame.src = "https://acme-lojistik.forms.example.com/embed/navlun-teklif";'
    )
    // Height messages are accepted from the form's origin only.
    expect(script).toContain(
      'event.origin !== "https://acme-lojistik.forms.example.com"'
    )
    expect(script).toContain(`data.type === "${FORM_EMBED_RESIZE_MESSAGE}"`)
    // The title cannot close the script element.
    expect(script).toContain(
      'frame.title = "Navlun \\"Teklif\\" \\u003cFormu>";'
    )
    expect(script).not.toContain("<Formu>")
  })
})
