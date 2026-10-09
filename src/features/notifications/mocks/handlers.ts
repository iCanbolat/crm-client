import { http, HttpResponse } from "msw"

import { authenticate } from "@/mocks/auth/authenticate"
import { db } from "@/mocks/db"
import { runScheduledChecks } from "@/mocks/scheduler"
import { withScenario } from "@/mocks/scenarios/with-scenario"
import { paginate } from "@/mocks/utils/list"
import { apiError, apiPath, getRequestT } from "@/mocks/utils/http"

import {
  markNotificationsSchema,
  notificationPreferencesInputSchema,
  type AppNotification,
} from "../api/notifications.schemas"
import "./producers"
import { preferencesOf, savePreferences } from "./store"
import type { NotificationRow } from "./types"

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown
  } catch {
    return null
  }
}

function toNotification({
  id,
  type,
  params,
  link,
  readAt,
  createdAt,
}: NotificationRow): AppNotification {
  return { id, type, params, link, readAt, createdAt }
}

const mine = (workspaceId: string, userId: string) => (row: NotificationRow) =>
  row.workspaceId === workspaceId && row.userId === userId

/**
 * In-app notifications of the signed-in user (B7.2). Personal data: every
 * member reads and marks only their own, so no RBAC resource is involved.
 */
export const notificationHandlers = [
  http.get(
    apiPath("/notifications/preferences"),
    withScenario(({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const { workspace, user } = auth.context
      return HttpResponse.json({ types: preferencesOf(workspace.id, user.id) })
    })
  ),

  http.patch(
    apiPath("/notifications/preferences"),
    withScenario(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const t = getRequestT(request)
      const input = notificationPreferencesInputSchema.safeParse(
        await readJson(request)
      )
      if (!input.success) {
        return apiError(422, "VALIDATION_ERROR", t("validation"))
      }
      const { workspace, user } = auth.context
      return HttpResponse.json({
        types: savePreferences(workspace.id, user.id, input.data.types),
      })
    })
  ),

  http.get(
    apiPath("/notifications"),
    withScenario(
      ({ request }) => {
        const auth = authenticate(request)
        if (!auth.ok) return auth.response
        const { workspace, user } = auth.context
        // Reminders are due "now": the poll doubles as the scheduler tick.
        runScheduledChecks(workspace.id)

        const url = new URL(request.url)
        const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
        const pageSize = Math.min(
          MAX_PAGE_SIZE,
          Math.max(
            1,
            Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE
          )
        )
        const all = db.notifications
          .findMany(mine(workspace.id, user.id))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const unread = all.filter((row) => row.readAt === null)
        const list = url.searchParams.get("unread") === "true" ? unread : all
        const result = paginate(list, page, pageSize)
        return HttpResponse.json({
          data: result.data.map(toNotification),
          meta: result.meta,
          unreadCount: unread.length,
        })
      },
      {
        empty: () =>
          HttpResponse.json({
            data: [],
            meta: { page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 },
            unreadCount: 0,
          }),
      }
    )
  ),

  http.patch(
    apiPath("/notifications"),
    withScenario(async ({ request }) => {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      const t = getRequestT(request)
      const input = markNotificationsSchema.safeParse(await readJson(request))
      if (!input.success) {
        return apiError(422, "VALIDATION_ERROR", t("validation"))
      }
      const { workspace, user } = auth.context
      const now = new Date().toISOString()
      const targets = db.notifications.findMany(
        (row) =>
          mine(workspace.id, user.id)(row) &&
          ("all" in input.data
            ? row.readAt === null
            : input.data.ids.includes(row.id))
      )
      for (const row of targets) {
        db.notifications.update(row.id, {
          readAt: input.data.read ? (row.readAt ?? now) : null,
        })
      }
      return HttpResponse.json({
        updated: targets.length,
        unreadCount: db.notifications.findMany(
          (row) => mine(workspace.id, user.id)(row) && row.readAt === null
        ).length,
      })
    })
  ),
]
