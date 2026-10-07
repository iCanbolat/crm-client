import { createFileRoute, Outlet } from "@tanstack/react-router"
import { z } from "zod"

const searchSchema = z.object({
  version: z.number().int().min(1).optional().catch(undefined),
})

export const Route = createFileRoute("/_app/quotes/$quoteId")({
  staticData: { crumb: "quoteBuilder" },
  validateSearch: searchSchema,
  component: Outlet,
})
