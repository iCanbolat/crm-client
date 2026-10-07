import { MILESTONES, OPTIONAL_MILESTONES, type Milestone } from "./constants"

export interface MilestoneEvent {
  milestone: Milestone
  /** ISO date-time the event happened. */
  at: string
  note?: string | null
}

export type MilestoneError =
  "ORDER" | "DUPLICATE" | "FUTURE" | "BEFORE_PREVIOUS"

const indexOf = (milestone: Milestone) => MILESTONES.indexOf(milestone)

export function lastMilestone(history: readonly MilestoneEvent[]) {
  return history.reduce<MilestoneEvent | undefined>(
    (last, event) =>
      !last || indexOf(event.milestone) > indexOf(last.milestone)
        ? event
        : last,
    undefined
  )
}

/**
 * Milestones that may be recorded next: the following mandatory one, plus
 * any optional milestone (transshipment) right before it.
 */
export function nextMilestones(
  history: readonly MilestoneEvent[]
): Milestone[] {
  const last = lastMilestone(history)
  const start = last ? indexOf(last.milestone) + 1 : 0
  const result: Milestone[] = []
  for (const milestone of MILESTONES.slice(start)) {
    result.push(milestone)
    if (!OPTIONAL_MILESTONES.includes(milestone)) break
  }
  return result
}

/** Order is kept and dates move forward, never into the future. */
export function validateMilestone(
  history: readonly MilestoneEvent[],
  milestone: Milestone,
  at: Date,
  now: Date
): MilestoneError | null {
  if (history.some((event) => event.milestone === milestone)) return "DUPLICATE"
  if (!nextMilestones(history).includes(milestone)) return "ORDER"
  if (at.getTime() > now.getTime()) return "FUTURE"
  const last = lastMilestone(history)
  // Forms enter minutes: an event in the same minute as the previous one
  // (e.g. booked a moment ago) is not "before" it.
  const previousMinute = last
    ? Math.floor(new Date(last.at).getTime() / 60_000) * 60_000
    : 0
  if (last && at.getTime() < previousMinute) return "BEFORE_PREVIOUS"
  return null
}

const DAY_MS = 86_400_000

/** Whole days from `a` to `b` (calendar days, UTC). */
export function dayDiff(a: string, b: string) {
  const start = Date.UTC(
    Number(a.slice(0, 4)),
    Number(a.slice(5, 7)) - 1,
    Number(a.slice(8, 10))
  )
  const end = Date.UTC(
    Number(b.slice(0, 4)),
    Number(b.slice(5, 7)) - 1,
    Number(b.slice(8, 10))
  )
  return Math.round((end - start) / DAY_MS)
}

export interface ScheduleDates {
  etd?: string | null
  eta?: string | null
  atd?: string | null
  ata?: string | null
}

export interface Delay {
  /** Days the departure slipped (actual or, if pending, so far). */
  departure: number
  arrival: number
  /** The ETA has passed and the cargo has not arrived yet. */
  delayed: boolean
}

/** Plan vs actual deviation (dates as `yyyy-MM-dd`, extra time ignored). */
export function getDelay(dates: ScheduleDates, today: string): Delay {
  const day = (value?: string | null) => (value ? value.slice(0, 10) : null)
  const deviation = (planned: string | null, actual: string | null) => {
    if (!planned) return 0
    if (actual) return dayDiff(planned, actual)
    return Math.max(dayDiff(planned, today), 0)
  }
  const departure = deviation(day(dates.etd), day(dates.atd))
  const arrival = deviation(day(dates.eta), day(dates.ata))
  return { departure, arrival, delayed: !dates.ata && arrival > 0 }
}
