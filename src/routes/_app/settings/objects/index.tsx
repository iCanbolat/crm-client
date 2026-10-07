import { createFileRoute } from "@tanstack/react-router"

import { ObjectsListPage } from "@/features/settings"

export const Route = createFileRoute("/_app/settings/objects/")({
  component: ObjectsListPage,
})
