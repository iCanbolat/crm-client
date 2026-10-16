import { db } from "@/mocks/db"

import { seedCatalog } from "./catalog"

/**
 * Activating the module later on (onboarding / Settings): the workspace
 * gets the starting catalogue once (B8.3). Must not rely on
 * `workspace.modules`, which is updated after this hook runs.
 */
export function activateVisaEducation(workspaceId: string) {
  const hasCatalog = db.records.findFirst(
    (row) => row.workspaceId === workspaceId && row.objectKey === "institution"
  )
  if (hasCatalog) return
  const owner =
    db.memberships.findFirst(
      (item) => item.workspaceId === workspaceId && item.role === "owner"
    )?.userId ?? ""
  const { institutions, programs } = seedCatalog(workspaceId, owner)
  for (const row of [...institutions, ...programs]) db.records.create(row)
}
