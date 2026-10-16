import { describe, expect, it } from "vitest"

import type { ObjectDef } from "@/engine/metadata"
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

/** Just enough metadata for nav items: key, plural label, icon. */
const object = (key: string, en: string) =>
  ({ key, pluralLabel: { tr: en, en }, icon: "inbox" }) as ObjectDef

const FORWARDING_OBJECTS = [
  object("lead", "Freight enquiries"),
  object("company", "Companies"),
  object("contact", "Contacts"),
  object("deal", "Deals"),
  object("quote", "Quotes"),
  object("shipment", "Shipments"),
]
const VISA_OBJECTS = [
  object("lead", "Enquiries"),
  object("contact", "Applicants"),
  object("enrollment", "School applications"),
  object("visaApplication", "Visa applications"),
  object("appointment", "Appointments"),
  object("institution", "Institutions"),
  object("program", "Programmes"),
]

function navigationFor(
  role: Role,
  moduleIds: string[] = ["forwarding"],
  objects: ObjectDef[] = FORWARDING_OBJECTS
) {
  return buildNavigation({
    modules: getModules().filter(
      (manifest) =>
        manifest.status === "active" && moduleIds.includes(manifest.id)
    ),
    objects,
    subject: { userId: "u1", role },
    language: "en",
    translate,
  })
}

const ids = (groups: ReturnType<typeof navigationFor>) =>
  groups.flatMap((group) => group.items.map((item) => item.id))

describe("navigation", () => {
  it("TC-10.3-02 forwarding: sales and operations groups between core groups", () => {
    const groups = navigationFor("owner")

    expect(groups.map((group) => group.id)).toEqual([
      "workspace",
      "module:forwarding.sales",
      "module:forwarding.operations",
      "marketing",
      "settings",
    ])
    expect(groups[1]).toMatchObject({
      title: "Sales",
      items: [
        { title: "Freight enquiries", href: "/o/lead" },
        { title: "Companies", href: "/o/company" },
        { title: "Contacts", href: "/o/contact" },
        { title: "Deals", href: "/o/deal" },
        { title: "Quotes", href: "/o/quote" },
      ],
    })
    expect(groups[2]).toMatchObject({
      title: "Operations",
      items: [
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

  it("TC-10.3-01 visa: no CRM group, companies, deals or duplicate contacts", () => {
    const groups = navigationFor("owner", ["visa-education"], VISA_OBJECTS)

    expect(groups.map((group) => group.id)).toEqual([
      "workspace",
      "module:visa-education.consulting",
      "module:visa-education.catalog",
      "marketing",
      "settings",
    ])
    const links = groups.flatMap((group) => group.items)
    expect(links.map((link) => link.href)).not.toContain("/o/company")
    expect(links.map((link) => link.href)).not.toContain("/o/deal")
    expect(
      links.filter((link) => link.href === "/o/contact").map((l) => l.title)
    ).toEqual(["Applicants", "Sponsors"])
    expect(groups[1]!.items.map((item) => item.title)).toEqual([
      "Enquiries",
      "Applicants",
      "Sponsors",
      "School applications",
      "Visa applications",
      "Appointments",
    ])
  })

  it("TC-10.3-03 object items follow the metadata and vanish without it", () => {
    const renamed = FORWARDING_OBJECTS.map((def) =>
      def.key === "deal"
        ? { ...def, pluralLabel: { tr: "Fırsatlar", en: "Opportunities" } }
        : def
    )
    const links = navigationFor("owner", ["forwarding"], renamed).flatMap(
      (group) => group.items
    )
    expect(links.find((link) => link.id === "forwarding.deals")?.title).toBe(
      "Opportunities"
    )

    const withoutDeals = FORWARDING_OBJECTS.filter((def) => def.key !== "deal")
    expect(
      ids(navigationFor("owner", ["forwarding"], withoutDeals))
    ).not.toContain("forwarding.deals")
  })

  it("marks a saved-filter link active only on its own list", () => {
    const links = navigationFor("owner").flatMap((group) => group.items)
    const companies = links.find((link) => link.id === "forwarding.companies")!
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
