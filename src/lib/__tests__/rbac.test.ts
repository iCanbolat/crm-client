import { describe, expect, it } from "vitest"

import {
  ACTIONS,
  can,
  ForbiddenError,
  isForbiddenError,
  isRole,
  type Action,
  type Resource,
  type Role,
} from "@/lib/rbac"

const subject = (role: Role) => ({ userId: "u1", role })

describe("rbac policy", () => {
  it.each<[Role, Action, Resource, boolean]>([
    ["owner", "delete", "workspace", true],
    ["admin", "delete", "workspace", false],
    ["admin", "manage", "member", true],
    ["manager", "read", "member", true],
    ["manager", "manage", "member", false],
    ["manager", "delete", "record", true],
    ["agent", "create", "record", true],
    ["agent", "read", "member", false],
    ["agent", "manage", "workspace", false],
    ["viewer", "read", "record", true],
    ["viewer", "create", "record", false],
    ["viewer", "read", "member", false],
  ])("%s may %s %s → %s", (role, action, resource, expected) => {
    expect(can(subject(role), action, resource)).toBe(expected)
  })

  it("TC-1.4-01 viewer can only read records", () => {
    const allowed = ACTIONS.filter((action) =>
      can(subject("viewer"), action, "record", { ownerId: "u1" })
    )
    expect(allowed).toEqual(["read"])
  })

  it("TC-1.4-02 agent edits and deletes only own records", () => {
    const agent = subject("agent")

    expect(can(agent, "update", "record", { ownerId: "u1" })).toBe(true)
    expect(can(agent, "delete", "record", { ownerId: "u1" })).toBe(true)
    expect(can(agent, "update", "record", { ownerId: "u2" })).toBe(false)
    expect(can(agent, "delete", "record", { ownerId: "u2" })).toBe(false)
    // Without a concrete record, ownership rules never apply.
    expect(can(agent, "delete", "record")).toBe(false)
    expect(can(agent, "delete", "record", { ownerId: null })).toBe(false)
  })

  it("managers act on any record regardless of ownership", () => {
    expect(can(subject("manager"), "update", "record", { ownerId: "u2" })).toBe(
      true
    )
  })

  it("denies everything without a subject", () => {
    expect(can(null, "read", "record")).toBe(false)
    expect(can(undefined, "read", "workspace")).toBe(false)
  })

  it("recognizes roles and forbidden errors", () => {
    expect(isRole("agent")).toBe(true)
    expect(isRole("root")).toBe(false)
    expect(isForbiddenError(new ForbiddenError())).toBe(true)
    expect(isForbiddenError(new Error("x"))).toBe(false)
  })
})
