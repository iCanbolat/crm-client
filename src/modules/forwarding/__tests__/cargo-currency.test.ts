import { describe, expect, it } from "vitest"

import { AIR_KG_PER_CBM, calcCbm, calcChargeableWeight } from "../lib/cargo"
import {
  convertCurrency,
  roundMoney,
  UnknownCurrencyError,
} from "../lib/currency"

const rates = { USD: 1, EUR: 0.92, TRY: 41.5, GBP: 0.79, CNY: 7.12 }

describe("cargo calculations (B3.2)", () => {
  it("TC-3.2-01 sums the volume of a packing list in m³", () => {
    expect(
      calcCbm([{ length: 120, width: 80, height: 100, quantity: 2 }])
    ).toBe(1.92)
    expect(
      calcCbm([
        { length: 120, width: 80, height: 100, quantity: 1 },
        { length: 50.5, width: 40, height: 30, quantity: 3 },
      ])
    ).toBe(1.142)
    expect(calcCbm([])).toBe(0)
  })

  it("TC-3.2-02 air: the greater of actual and volumetric weight (1:6000), in half kilos", () => {
    expect(AIR_KG_PER_CBM).toBeCloseTo(166.67, 2)
    // 1.92 m³ × 166.67 = 320 kg > 250 kg actual
    expect(calcChargeableWeight("AIR", 250, 1.92)).toEqual({
      value: 320,
      unit: "kg",
      basis: "volume",
    })
    expect(calcChargeableWeight("AIR", 400.2, 1.92)).toEqual({
      value: 400.5,
      unit: "kg",
      basis: "weight",
    })
    // Courier uses 1:5000 (200 kg/m³)
    expect(calcChargeableWeight("COURIER", 10, 0.1).value).toBe(20)
  })

  it("TC-3.2-02 LCL: revenue tons (W/M, 1 t = 1 m³)", () => {
    expect(calcChargeableWeight("SEA_LCL", 1800, 2.5)).toEqual({
      value: 2.5,
      unit: "wm",
      basis: "volume",
    })
    expect(calcChargeableWeight("SEA_LCL", 3200, 2.5)).toEqual({
      value: 3.2,
      unit: "wm",
      basis: "weight",
    })
  })

  it("TC-3.2-02 road LTL: weight, volume (333 kg/m³) or loading metres (1850 kg/ldm)", () => {
    expect(calcChargeableWeight("ROAD_LTL", 500, 3)).toMatchObject({
      value: 999,
      basis: "volume",
    })
    expect(calcChargeableWeight("ROAD_LTL", 500, 1, 2)).toMatchObject({
      value: 3700,
      basis: "ldm",
    })
    expect(calcChargeableWeight("ROAD_LTL", 5000, 1, 1)).toMatchObject({
      value: 5000,
      basis: "weight",
    })
    // Equipment based modes bill the gross weight.
    expect(calcChargeableWeight("SEA_FCL", 18000, 60).value).toBe(18000)
    expect(calcChargeableWeight("ROAD_FTL", -5, 0).value).toBe(0)
  })
})

describe("currency conversion (B3.2)", () => {
  it("TC-3.2-03 converts through USD and rounds half up to cents", () => {
    expect(convertCurrency(100, "USD", "EUR", rates)).toBe(92)
    expect(convertCurrency(92, "EUR", "USD", rates)).toBe(100)
    // 100 EUR → 108.6957 USD → 4510.87 TRY
    expect(convertCurrency(100, "EUR", "TRY", rates)).toBe(4510.87)
    expect(convertCurrency(10.005, "USD", "USD", rates)).toBe(10.01)
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(-1.005)).toBe(-1.01)
  })

  it("TC-3.2-03 rejects unknown currencies", () => {
    expect(() => convertCurrency(1, "XYZ", "USD", rates)).toThrow(
      UnknownCurrencyError
    )
    expect(() => convertCurrency(1, "USD", "XYZ", rates)).toThrow(/XYZ/)
  })
})
