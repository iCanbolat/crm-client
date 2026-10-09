/**
 * Time based checks of the mock backend (Faz 7): task reminders, expiring
 * quotes, "no answer for N days" automation rules. A real backend runs them
 * on a schedule; the mock runs them lazily whenever notifications are polled
 * (and from the dev toolbar). Checks must be idempotent.
 */
type ScheduledCheck = (workspaceId: string, now: Date) => void

const checks = new Set<ScheduledCheck>()

export function registerScheduledCheck(check: ScheduledCheck) {
  checks.add(check)
}

export function runScheduledChecks(workspaceId: string, now = new Date()) {
  for (const check of checks) check(workspaceId, now)
}
