import { http, HttpResponse } from "msw"

import { authorize } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { roundMoney } from "@/lib/currency"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import {
  paymentInputSchema,
  paymentPlanInputSchema,
} from "../api/payments.schemas"
import {
  isInstallmentPaid,
  planSummary,
  validatePlan,
  type Installment,
} from "../lib/payments"
import { readJson, requestT, resolveRecord, validationError } from "./http"
import {
  CHECKLIST_OBJECTS,
  planId,
  planOf,
  syncPaymentSummary,
  today,
} from "./store"

const PATH = "/payment-plans/:objectKey/:id"

function resolve(request: Request, params: Record<string, unknown>) {
  return resolveRecord(
    request,
    String(params.objectKey),
    String(params.id),
    CHECKLIST_OBJECTS
  )
}

function planResponse(workspaceId: string, objectKey: string, id: string) {
  const plan = planOf(workspaceId, objectKey, id)
  return {
    plan: plan
      ? {
          serviceFee: plan.serviceFee,
          installments: plan.installments,
          updatedAt: plan.updatedAt,
        }
      : null,
    summary: planSummary(plan, today()),
  }
}

export const paymentHandlers = [
  http.get(
    apiPath(PATH),
    withScenario(({ request, params }) => {
      const resolved = resolve(request, params)
      if ("response" in resolved) return resolved.response
      const { row, workspaceId } = resolved
      return HttpResponse.json(planResponse(workspaceId, row.objectKey, row.id))
    })
  ),

  /** Replaces the plan; paid instalments must stay as they are. */
  http.put(
    apiPath(PATH),
    withScenario(async ({ request, params }) => {
      const resolved = resolve(request, params)
      if ("response" in resolved) return resolved.response
      const { row, workspaceId, auth } = resolved
      const denied = authorize(request, auth, "update", "record", {
        ownerId: row.values.ownerId as string | undefined,
      })
      if (denied) return denied
      const t = requestT(request)
      const parsed = paymentPlanInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return validationError(request, parsed.error)
      const input = parsed.data
      const current = planOf(workspaceId, row.objectKey, row.id)

      const paid = (current?.installments ?? []).filter(
        (item) => item.paidAmount > 0
      )
      for (const item of paid) {
        const next = input.installments.find((entry) => entry.id === item.id)
        if (
          !next ||
          Math.abs(next.amount - item.amount) > 0.001 ||
          current!.serviceFee.currency !== input.serviceFee.currency
        ) {
          return apiError(409, "INSTALLMENT_PAID", t("errors.installmentPaid"))
        }
      }

      const installments: Installment[] = input.installments.map((entry) => {
        const previous = current?.installments.find(
          (item) => item.id === entry.id
        )
        return {
          id: previous?.id ?? `ins_${crypto.randomUUID().slice(0, 8)}`,
          label: entry.label,
          dueDate: entry.dueDate,
          amount: roundMoney(entry.amount),
          paidAmount: previous?.paidAmount ?? 0,
          paidAt: previous?.paidAt ?? null,
          method: previous?.method ?? null,
          note: entry.note ?? null,
        }
      })
      const plan = { serviceFee: input.serviceFee, installments }
      const issue = validatePlan(plan)
      if (issue) {
        return apiError(422, issue.code, t(`errors.plan.${issue.code}`, issue))
      }
      const id = planId(row.objectKey, row.id)
      const stored = {
        ...plan,
        updatedAt: new Date().toISOString(),
      }
      if (current) db.paymentPlans.update(id, stored)
      else {
        db.paymentPlans.create({
          id,
          workspaceId,
          objectKey: row.objectKey,
          recordId: row.id,
          ...stored,
        })
      }
      syncPaymentSummary(workspaceId, row.objectKey, row.id)
      return HttpResponse.json(planResponse(workspaceId, row.objectKey, row.id))
    })
  ),

  http.post(
    apiPath(`${PATH}/installments/:installmentId/pay`),
    withScenario(async ({ request, params }) => {
      const resolved = resolve(request, params)
      if ("response" in resolved) return resolved.response
      const { row, workspaceId, auth } = resolved
      const denied = authorize(request, auth, "update", "record", {
        ownerId: row.values.ownerId as string | undefined,
      })
      if (denied) return denied
      const t = requestT(request)
      const plan = planOf(workspaceId, row.objectKey, row.id)
      const installment = plan?.installments.find(
        (item) => item.id === String(params.installmentId)
      )
      if (!plan || !installment) {
        return apiError(404, "NOT_FOUND", getRequestT(request)("mock.notFound"))
      }
      const parsed = paymentInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return validationError(request, parsed.error)
      if (isInstallmentPaid(installment)) {
        return apiError(409, "INSTALLMENT_PAID", t("errors.installmentPaid"))
      }
      const paidAmount = roundMoney(installment.paidAmount + parsed.data.amount)
      if (paidAmount > installment.amount + 0.001) {
        return apiError(422, "OVERPAID", t("errors.plan.OVERPAID"), {
          fieldErrors: { amount: [t("errors.plan.OVERPAID")] },
        })
      }
      db.paymentPlans.update(plan.id, {
        installments: plan.installments.map((item) =>
          item.id === installment.id
            ? {
                ...item,
                paidAmount,
                paidAt: parsed.data.paidAt,
                method: parsed.data.method,
              }
            : item
        ),
        updatedAt: new Date().toISOString(),
      })
      syncPaymentSummary(workspaceId, row.objectKey, row.id)
      return HttpResponse.json(planResponse(workspaceId, row.objectKey, row.id))
    })
  ),
]
