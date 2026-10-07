import { describe, expect, it } from "vitest"

import { parseEnv } from "@/lib/env"

const validEnv = {
  VITE_API_URL: "/api",
  VITE_APP_HOST: "app.localhost",
  VITE_PUBLIC_FORMS_DOMAIN: "forms.localhost",
  VITE_ENABLE_MSW: "true",
}

describe("parseEnv", () => {
  it("parses a valid environment and coerces booleans", () => {
    expect(parseEnv(validEnv)).toEqual({ ...validEnv, VITE_ENABLE_MSW: true })
    expect(parseEnv({ ...validEnv, VITE_ENABLE_MSW: "false" })).toMatchObject({
      VITE_ENABLE_MSW: false,
    })
  })

  it("accepts an absolute API URL and defaults MSW to disabled", () => {
    const { VITE_ENABLE_MSW: _omit, ...rest } = validEnv
    expect(
      parseEnv({ ...rest, VITE_API_URL: "https://api.example.com/v1" })
    ).toMatchObject({
      VITE_API_URL: "https://api.example.com/v1",
      VITE_ENABLE_MSW: false,
    })
  })

  it("TC-0.2-04 throws a descriptive error listing every invalid variable", () => {
    expect(() =>
      parseEnv({ ...validEnv, VITE_API_URL: "api", VITE_APP_HOST: "" })
    ).toThrowError(
      /Invalid environment variables:[\s\S]*VITE_API_URL: must be a path starting with '\/' or an absolute URL[\s\S]*VITE_APP_HOST/
    )
  })

  it("TC-0.2-04 reports missing variables", () => {
    expect(() => parseEnv({})).toThrowError(/VITE_PUBLIC_FORMS_DOMAIN/)
  })
})
