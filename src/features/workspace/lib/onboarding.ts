import {
  LAST_ONBOARDING_STEP,
  type OnboardingState,
} from "../api/workspace.schemas"

/**
 * The step to resume at: the saved step, but never past the first step whose
 * prerequisites are missing from the draft (e.g. after a schema change).
 */
export function getResumeStep({ step, draft }: OnboardingState): number {
  if (!draft.company) return 0
  if (!draft.modules?.length) return Math.min(step, 1)
  return Math.min(step, LAST_ONBOARDING_STEP)
}

export function isOnboardingComplete(onboarding: OnboardingState) {
  return onboarding.status === "completed"
}
