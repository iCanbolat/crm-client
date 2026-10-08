import { describe, expect, it } from "vitest"

import { normalizeHost, resolveAppMode } from "../app-mode"

const options = { appHost: "app.localhost", allowHostOverride: true }

describe("resolveAppMode", () => {
  it.each([
    ["app.localhost", { mode: "admin" }],
    ["app.localhost:5173", { mode: "admin" }],
    ["APP.LOCALHOST", { mode: "admin" }],
    ["localhost:5174", { mode: "admin" }],
    ["127.0.0.1:5173", { mode: "admin" }],
    ["192.168.1.20:5173", { mode: "admin" }],
    ["[::1]:5173", { mode: "admin" }],
    [
      "acme-lojistik.forms.localhost:5173",
      { mode: "public", host: "acme-lojistik.forms.localhost" },
    ],
    [
      "teklif.acmelojistik.com",
      { mode: "public", host: "teklif.acmelojistik.com" },
    ],
    [
      "Teklif.AcmeLojistik.com:443",
      { mode: "public", host: "teklif.acmelojistik.com" },
    ],
  ])("TC-5.1-01 %s", (host, expected) => {
    expect(resolveAppMode(host, "", options)).toEqual(expected)
  })

  it("TC-5.1-01 ?__host= simulates a custom domain in dev", () => {
    expect(
      resolveAppMode(
        "localhost:5174",
        "?__host=Teklif.AcmeLojistik.com",
        options
      )
    ).toEqual({ mode: "public", host: "teklif.acmelojistik.com" })
  })

  it("TC-5.1-02 ?__host= is ignored when overrides are off (production)", () => {
    expect(
      resolveAppMode("app.localhost", "?__host=teklif.acmelojistik.com", {
        ...options,
        allowHostOverride: false,
      })
    ).toEqual({ mode: "admin" })
  })

  it("normalizes hosts", () => {
    expect(normalizeHost(" Acme.Forms.Localhost:80 ")).toBe(
      "acme.forms.localhost"
    )
    expect(normalizeHost("[::1]:3000")).toBe("[::1]")
  })
})
