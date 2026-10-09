import type { ObjectDef, RecordValues } from "@/engine/metadata"
import type { ReportResult } from "@/engine/reports"
import type { Language } from "@/lib/i18n"

export interface ReportSourceRow {
  id: string
  objectKey: string
  values: RecordValues
}

/** Everything a report builder needs; builders stay pure. */
export interface ReportContext {
  /** Every record of the workspace (any object). */
  records: readonly ReportSourceRow[]
  range: { from: string; to: string }
  /** Only records owned by this user (`null` = everyone). */
  ownerId: string | null
  language: Language
  /** Reporting currency of money columns. */
  currency: string
  userName: (id: string) => string
  objectDef: (objectKey: string) => ObjectDef | undefined
}

export type ReportBody = Pick<ReportResult, "rows" | "totals">

/** Backend side of a report definition (B7.1). */
export interface ReportBuilder {
  key: string
  /** Reports of a sector module exist only while it is active. */
  moduleId?: string
  build: (context: ReportContext) => ReportBody
}

const builders = new Map<string, ReportBuilder>()

export function registerReportBuilder(builder: ReportBuilder) {
  builders.set(builder.key, builder)
}

export function getReportBuilder(key: string) {
  return builders.get(key)
}

/* ---------------------------------------------------------------- helpers */

const day = (value: unknown) =>
  typeof value === "string" && value ? value.slice(0, 10) : null

export function inRange(value: unknown, range: ReportContext["range"]) {
  const date = day(value)
  return !!date && date >= range.from && date <= range.to
}

/** Rows of one object created in the range (and owned by the filter user). */
export function reportRows(context: ReportContext, objectKey: string) {
  return context.records.filter(
    (row) =>
      row.objectKey === objectKey &&
      inRange(row.values.createdAt, context.range) &&
      (!context.ownerId || row.values.ownerId === context.ownerId)
  )
}
