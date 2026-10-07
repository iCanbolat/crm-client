import { z } from "zod"

import { CARRIER_KINDS } from "../lib/constants"

export const LOCATION_KINDS = ["port", "airport", "city"] as const
export type LocationKind = (typeof LOCATION_KINDS)[number]

/** Value of `port`, `airport` and `location` fields (UN/LOCODE or IATA). */
export const locationSchema = z.object({
  code: z.string().min(3).max(5),
  name: z.string().min(1),
  country: z.string().length(2),
  kind: z.enum(LOCATION_KINDS),
})
export type LocationValue = z.infer<typeof locationSchema>

export const locationListSchema = z.object({ data: z.array(locationSchema) })

export const carrierSchema = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.enum(CARRIER_KINDS),
})
export type Carrier = z.infer<typeof carrierSchema>
export const carrierListSchema = z.object({ data: z.array(carrierSchema) })

export const fxRatesSchema = z.object({
  base: z.literal("USD"),
  date: z.string(),
  rates: z.record(z.string(), z.number().positive()),
})
export type FxRatesResponse = z.infer<typeof fxRatesSchema>
