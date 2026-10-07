import { z } from "zod"

/** Shared API contracts — used by the client and the MSW handlers alike. */

export const fieldErrorsSchema = z.record(z.string(), z.array(z.string()))

export const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fieldErrors: fieldErrorsSchema.optional(),
    details: z.unknown().optional(),
  }),
})

export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
})

export type PaginationMeta = z.infer<typeof paginationMetaSchema>

export function paginatedSchema<TItem extends z.ZodType>(item: TItem) {
  return z.object({ data: z.array(item), meta: paginationMetaSchema })
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

export const MAX_PAGE_SIZE = 100

/** Base list search params, meant to be extended per list (route `validateSearch`). */
export const listSearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(20).catch(20),
  sort: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
})

export type ListSearch = z.infer<typeof listSearchSchema>

export function getPageCount(meta: PaginationMeta) {
  return Math.max(1, Math.ceil(meta.total / meta.pageSize))
}
