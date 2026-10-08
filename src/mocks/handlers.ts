import { exampleHandlers } from "@/features/_example/mocks/handlers"
import { activitiesHandlers } from "@/features/activities/mocks/handlers"
import { authHandlers } from "@/features/auth/mocks/handlers"
import { formHandlers } from "@/features/form-builder/mocks/handlers"
import { leadsHandlers } from "@/features/leads/mocks/handlers"
import { pipelinesHandlers } from "@/features/pipelines/mocks/handlers"
import { recordsHandlers } from "@/features/records/mocks/handlers"
import { siteHandlers } from "@/features/sites/mocks/handlers"
import { shellHandlers } from "@/features/shell/mocks/handlers"
import { workspaceHandlers } from "@/features/workspace/mocks/handlers"
import { forwardingHandlers } from "@/modules/forwarding/mocks/handlers"

/** Aggregates the colocated handlers of every feature/module. */
export const handlers = [
  ...authHandlers,
  ...workspaceHandlers,
  ...shellHandlers,
  ...exampleHandlers,
  // Before the generic record routes (`/records/:objectKey/board`).
  ...pipelinesHandlers,
  ...activitiesHandlers,
  ...leadsHandlers,
  ...recordsHandlers,
  ...formHandlers,
  ...siteHandlers,
  // Sector modules
  ...forwardingHandlers,
]
