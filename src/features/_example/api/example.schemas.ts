import { z } from "zod"

import { listSearchSchema, paginatedSchema } from "@/lib/api"

export const exampleStatusSchema = z.enum(["active", "archived"])
export type ExampleStatus = z.infer<typeof exampleStatusSchema>

export const exampleItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: exampleStatusSchema,
  createdAt: z.iso.datetime(),
  /** Record ownership drives the agent's edit/delete rights (B1.4). */
  ownerId: z.string(),
  ownerName: z.string().nullable(),
})
export type ExampleItem = z.infer<typeof exampleItemSchema>

export const exampleListResponseSchema = paginatedSchema(exampleItemSchema)

/** Defaults are stripped from the URL to keep links clean. */
export const EXAMPLE_LIST_DEFAULTS = { page: 1, pageSize: 5 } as const

/** Route search params of the example list (also sent as API query). */
export const exampleListSearchSchema = listSearchSchema.extend({
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(EXAMPLE_LIST_DEFAULTS.pageSize)
    .catch(EXAMPLE_LIST_DEFAULTS.pageSize),
  status: exampleStatusSchema.optional().catch(undefined),
})
export type ExampleListParams = z.infer<typeof exampleListSearchSchema>

export const EXAMPLE_NAME_MIN = 2
export const EXAMPLE_NAME_MAX = 80

export const createExampleInputSchema = z.object({
  name: z.string().trim().min(EXAMPLE_NAME_MIN).max(EXAMPLE_NAME_MAX),
})
export type CreateExampleInput = z.infer<typeof createExampleInputSchema>
