import { describe, expect, it } from "vitest"

import {
  automationRuleInputSchema,
  automationRunKey,
  evaluateRuleConditions,
  pickRoundRobin,
  triggerMatches,
  triggerObjectKey,
  type AutomationTrigger,
} from "@/engine/automation"

import { testObject } from "./fixtures"

const def = testObject()

describe("automation rules (B7.3)", () => {
  it("TC-7.3-01 evaluates all conditions on the record (engine/logic)", () => {
    const values = { name: "Acme", stage: "new", count: 4, tags: ["vip"] }
    expect(evaluateRuleConditions(def, values, [])).toBe(true)
    expect(
      evaluateRuleConditions(def, values, [
        { field: "stage", op: "in", value: ["new", "won"] },
        { field: "count", op: "gte", value: 3 },
      ])
    ).toBe(true)
    expect(
      evaluateRuleConditions(def, values, [
        { field: "stage", op: "eq", value: "new" },
        { field: "tags", op: "in", value: ["hot"] },
      ])
    ).toBe(false)
    // Unknown fields are ignored; a missing object never passes.
    expect(
      evaluateRuleConditions(def, values, [
        { field: "gone", op: "eq", value: "x" },
      ])
    ).toBe(true)
    expect(
      evaluateRuleConditions(undefined, values, [
        { field: "stage", op: "eq", value: "new" },
      ])
    ).toBe(false)
  })

  it("TC-7.3-01 picks round-robin assignees in order, skipping former members", () => {
    const users = ["a", "b", "c"]
    expect(pickRoundRobin(users, null)).toBe("a")
    expect(pickRoundRobin(users, "a")).toBe("b")
    expect(pickRoundRobin(users, "c")).toBe("a")
    expect(pickRoundRobin(users, "gone")).toBe("a")
    const member = (id: string) => id !== "b"
    expect(pickRoundRobin(users, "a", member)).toBe("c")
    expect(pickRoundRobin(["b"], null, member)).toBeNull()
  })

  it("matches triggers to events", () => {
    const submission: AutomationTrigger = {
      type: "submission.created",
      formId: "form_a",
    }
    const event = (type: string, objectKey = "lead", data = {}) => ({
      type,
      objectKey,
      data,
    })
    expect(
      triggerMatches(
        submission,
        event("submission.created", "lead", { formId: "form_a" })
      )
    ).toBe(true)
    expect(
      triggerMatches(
        submission,
        event("submission.created", "lead", { formId: "form_b" })
      )
    ).toBe(false)
    expect(
      triggerMatches(
        { ...submission, formId: null },
        event("submission.created")
      )
    ).toBe(true)
    expect(triggerMatches(submission, event("record.created"))).toBe(false)

    const created: AutomationTrigger = {
      type: "record.created",
      objectKey: "lead",
    }
    expect(triggerMatches(created, event("record.created"))).toBe(true)
    expect(triggerMatches(created, event("record.created", "deal"))).toBe(false)

    const stage: AutomationTrigger = {
      type: "record.stageChanged",
      objectKey: "deal",
      stage: "won",
    }
    expect(
      triggerMatches(
        stage,
        event("record.stageChanged", "deal", { stage: "won" })
      )
    ).toBe(true)
    expect(
      triggerMatches(
        stage,
        event("record.stageChanged", "deal", { stage: "lost" })
      )
    ).toBe(false)
    expect(
      triggerMatches(
        { ...stage, stage: null },
        event("record.stageChanged", "deal", { stage: "lost" })
      )
    ).toBe(true)

    const quiet: AutomationTrigger = { type: "quote.noResponse", afterDays: 2 }
    expect(triggerMatches(quiet, event("quote.noResponse", "quote"))).toBe(true)
    expect(triggerMatches(quiet, event("quote.noResponse", "lead"))).toBe(false)

    expect(triggerObjectKey(submission)).toBe("lead")
    expect(triggerObjectKey(stage)).toBe("deal")
    expect(triggerObjectKey(created)).toBe("lead")
    expect(triggerObjectKey(quiet)).toBe("quote")
  })

  it("keys a run per rule, record, event and target stage", () => {
    expect(
      automationRunKey("r1", {
        type: "record.stageChanged",
        objectKey: "deal",
        recordId: "d1",
        data: { stage: "won" },
      })
    ).toBe("r1:record.stageChanged:deal:d1:won")
    expect(
      automationRunKey("r1", {
        type: "record.created",
        objectKey: "lead",
        recordId: "l1",
      })
    ).toBe("r1:record.created:lead:l1")
  })

  it("validates rule input", () => {
    const valid = {
      name: "Dağıt",
      enabled: true,
      trigger: { type: "submission.created", formId: null },
      conditions: [],
      actions: [{ type: "notify", to: "owner" }],
    }
    expect(automationRuleInputSchema.safeParse(valid).success).toBe(true)
    expect(
      automationRuleInputSchema.safeParse({ ...valid, actions: [] }).success
    ).toBe(false)
    expect(
      automationRuleInputSchema.safeParse({
        ...valid,
        actions: [{ type: "assignRoundRobin", userIds: [] }],
      }).success
    ).toBe(false)
    expect(
      automationRuleInputSchema.safeParse({
        ...valid,
        trigger: { type: "quote.noResponse", afterDays: 0 },
      }).success
    ).toBe(false)
  })
})
