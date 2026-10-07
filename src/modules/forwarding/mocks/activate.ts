import { db } from "@/mocks/db"

import { DEAL_STAGE_MAP } from "../metadata/extend"

/**
 * Data migration when a workspace activates forwarding later on: deals move
 * from the core pipeline onto the forwarding one.
 */
export function activateForwarding(workspaceId: string) {
  const deals = db.records.findMany(
    (row) => row.workspaceId === workspaceId && row.objectKey === "deal"
  )
  for (const row of deals) {
    const stage = DEAL_STAGE_MAP[String(row.values.stage)]
    if (stage && stage !== row.values.stage) {
      db.records.update(row.id, { values: { ...row.values, stage } })
    }
  }
}
