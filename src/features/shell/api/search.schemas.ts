import { z } from "zod"

export const SEARCH_MIN_LENGTH = 2

/** Global record search (⌘K): CRM records of every object + examples. */
export const searchHitSchema = z.object({
  id: z.string(),
  type: z.enum(["record", "example"]),
  /** Object of a CRM record hit. */
  objectKey: z.string().nullable().default(null),
  title: z.string(),
  subtitle: z.string().nullable(),
})
export type SearchHit = z.infer<typeof searchHitSchema>

export const searchResponseSchema = z.object({ data: z.array(searchHitSchema) })
