import { createFileRoute, Outlet } from "@tanstack/react-router"

import { NotFoundPage } from "@/components/common/not-found"
import { isModuleActive } from "@/engine/modules"
import { ensureObjectDef, useObjectDef } from "@/features/records"
import { useWorkspace } from "@/features/workspace"

/**
 * Generic object area: every object with metadata — core or contributed by
 * an active module — gets its list, record and form screens.
 */
export const Route = createFileRoute("/_app/o/$objectKey")({
  staticData: { crumb: "object" },
  loader: ({ context, params }) =>
    ensureObjectDef(context.queryClient, params.objectKey).then(() => null),
  component: ObjectLayout,
})

function ObjectLayout() {
  const { objectKey } = Route.useParams()
  const objectDef = useObjectDef(objectKey)
  const workspace = useWorkspace()

  if (!objectDef || !isModuleActive(objectDef.moduleId, workspace.modules)) {
    return <NotFoundPage />
  }
  return <Outlet />
}
