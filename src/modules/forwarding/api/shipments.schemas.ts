import { z } from "zod"

import { MILESTONES } from "../lib/constants"

export const milestoneEventSchema = z.object({
  id: z.string(),
  milestone: z.enum(MILESTONES),
  at: z.string(),
  note: z.string().nullish(),
  createdByName: z.string().nullish(),
})
export type MilestoneEventDto = z.infer<typeof milestoneEventSchema>

export const milestoneListSchema = z.object({
  data: z.array(milestoneEventSchema),
  /** Milestones that may be recorded next. */
  next: z.array(z.enum(MILESTONES)),
})
export type MilestoneList = z.infer<typeof milestoneListSchema>

export const milestoneInputSchema = z.object({
  milestone: z.enum(MILESTONES),
  at: z.iso.datetime({ offset: true }),
  note: z.string().max(500).optional(),
})
export type MilestoneInput = z.infer<typeof milestoneInputSchema>
