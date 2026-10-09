import { createFileRoute } from "@tanstack/react-router"

import { ReportsPage } from "@/features/reports"

export const Route = createFileRoute("/_app/reports/")({
  component: ReportsPage,
})
