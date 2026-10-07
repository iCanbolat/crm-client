import { describe, expect, it } from "vitest"

import { getModules } from "@/engine/modules"
import type { Role } from "@/lib/rbac"

import {
  buildHref,
  buildNavigation,
  isActiveLink,
  isActivePath,
} from "../lib/navigation"

// Registers the module manifests like the app does.
import "@/app/modules"

const translate = (key: string) => key

function navigationFor(role: Role, moduleIds: string[] = ["forwarding"]) {
  return buildNavigation({
    modules: getModules().filter(
      (manifest) =>
        manifest.status === "active" && moduleIds.includes(manifest.id)
    ),
    subject: { userId: "u1", role },
    language: "en",
    translate,
  })
}

const ids = (groups: ReturnType<typeof navigationFor>) =>
  groups.flatMap((group) => group.items.map((item) => item.id))

describe("navigation", () => {
  it("TC-1.3-01 puts module groups between the core and settings groups", () => {
    const groups = navigationFor("owner")

    expect(groups.map((group) => group.id)).toEqual([
      "workspace",
      "crm",
      "marketing",
      "module:forwarding",
      "settings",
    ])
    expect(groups[3]).toMatchObject({
      title: "Forwarding (Logistics)",
      items: [
        { title: "Quotes", href: "/o/quote" },
        { title: "Shipments", href: "/o/shipment" },
        {
          title: "Agent network",
          href: "/o/company",
          search: {
            filters: [
              { field: "companyTypes", op: "in", value: ["overseas_agent"] },
            ],
          },
        },
      ],
    })
  })

  it("marks a saved-filter link active only on its own list", () => {
    const links = navigationFor("owner").flatMap((group) => group.items)
    const companies = links.find((link) => link.id === "companies")!
    const agents = links.find((link) => link.id === "forwarding.partners")!

    expect(isActiveLink(companies, "/o/company", {}, links)).toBe(true)
    expect(isActiveLink(agents, "/o/company", {}, links)).toBe(false)
    expect(isActiveLink(agents, "/o/company", agents.search!, links)).toBe(true)
    expect(isActiveLink(companies, "/o/company", agents.search!, links)).toBe(
      false
    )
    // Record pages below the list keep the plain list link active.
    expect(isActiveLink(companies, "/o/company/cmp_1", {}, links)).toBe(true)
  })

  it("TC-1.3-01 drops module groups of inactive modules", () => {
    expect(ids(navigationFor("owner", []))).not.toContain("forwarding.quotes")
  })

  it("lists My tasks for everyone and object settings for admins only", () => {
    expect(ids(navigationFor("viewer"))).toContain("tasks")
    expect(ids(navigationFor("admin"))).toContain("objects")
    expect(ids(navigationFor("manager"))).not.toContain("objects")
  })

  it("TC-1.4-01 hides items the role may not use", () => {
    expect(ids(navigationFor("manager"))).toContain("members")
    expect(ids(navigationFor("agent"))).not.toContain("members")
    expect(ids(navigationFor("viewer"))).not.toContain("members")
  })

  it("builds hrefs and active state", () => {
    expect(buildHref("/o/$objectKey", { objectKey: "deal" })).toBe("/o/deal")
    expect(buildHref("/dashboard")).toBe("/dashboard")
    expect(isActivePath("/o/lead/42", "/o/lead")).toBe(true)
    expect(isActivePath("/o/leads", "/o/lead")).toBe(false)
  })
})
