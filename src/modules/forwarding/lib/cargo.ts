import type { TransportMode } from "./constants"

/** One line of a packing list; lengths in centimetres. */
export interface DimensionLine {
  length: number
  width: number
  height: number
  quantity: number
}

/** Volumetric divisors and density ratios (plan B3.2). */
export const AIR_KG_PER_CBM = 1_000_000 / 6000 // IATA 1:6000 ≈ 166.67
export const COURIER_KG_PER_CBM = 1_000_000 / 5000 // express 1:5000 = 200
export const LCL_KG_PER_CBM = 1000 // W/M: 1 t = 1 m³
export const ROAD_KG_PER_CBM = 333
export const ROAD_KG_PER_LDM = 1850

const round = (value: number, digits: number) => {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** Air chargeable weight is billed in half kilograms, rounded up. */
const ceilHalf = (value: number) => Math.ceil(round(value, 6) * 2) / 2

/** Total volume (m³) of a packing list, 3 decimals. */
export function calcCbm(lines: readonly DimensionLine[]) {
  const total = lines.reduce(
    (sum, line) =>
      sum +
      (line.length * line.width * line.height * line.quantity) / 1_000_000,
    0
  )
  return round(total, 3)
}

export interface ChargeableWeight {
  value: number
  /** `kg` for weight based modes, `wm` (revenue tons) for LCL. */
  unit: "kg" | "wm"
  /** Which measure won: actual weight, volume or loading metres. */
  basis: "weight" | "volume" | "ldm"
}

/**
 * Weight the carrier bills: the greater of actual and volumetric weight.
 * Equipment based modes (FCL, FTL, rail) bill the actual gross weight.
 */
export function calcChargeableWeight(
  mode: TransportMode,
  grossKg: number,
  cbm: number,
  ldm = 0
): ChargeableWeight {
  const gross = Math.max(grossKg, 0)
  const volume = Math.max(cbm, 0)

  switch (mode) {
    case "AIR":
    case "COURIER": {
      const ratio = mode === "AIR" ? AIR_KG_PER_CBM : COURIER_KG_PER_CBM
      const volumetric = volume * ratio
      return volumetric > gross
        ? { value: ceilHalf(volumetric), unit: "kg", basis: "volume" }
        : { value: ceilHalf(gross), unit: "kg", basis: "weight" }
    }
    case "SEA_LCL": {
      const tons = gross / LCL_KG_PER_CBM
      return volume > tons
        ? { value: round(volume, 3), unit: "wm", basis: "volume" }
        : { value: round(tons, 3), unit: "wm", basis: "weight" }
    }
    case "ROAD_LTL": {
      const byVolume = volume * ROAD_KG_PER_CBM
      const byLdm = ldm * ROAD_KG_PER_LDM
      const max = Math.max(gross, byVolume, byLdm)
      const basis = max === gross ? "weight" : max === byLdm ? "ldm" : "volume"
      return { value: round(max, 2), unit: "kg", basis }
    }
    default:
      return { value: round(gross, 2), unit: "kg", basis: "weight" }
  }
}
