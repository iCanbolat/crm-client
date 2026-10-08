import { describe, expect, it } from "vitest"

import { matchPublicRoute } from "../lib/public-route"

describe("matchPublicRoute", () => {
  it.each([
    ["/", { kind: "home" }],
    ["/f/navlun-teklif", { kind: "form", slug: "navlun-teklif" }],
    ["/f/navlun-teklif/", { kind: "form", slug: "navlun-teklif" }],
    ["/embed/iletisim", { kind: "embed", slug: "iletisim" }],
    ["/f/", { kind: "notFound" }],
    ["/f/Upper", { kind: "notFound" }],
    ["/dashboard", { kind: "notFound" }],
    ["/f/a/b", { kind: "notFound" }],
  ])("%s", (pathname, expected) => {
    expect(matchPublicRoute(pathname)).toEqual(expected)
  })
})
