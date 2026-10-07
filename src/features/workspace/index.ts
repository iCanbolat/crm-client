export { activateModule } from "./api/workspace.api"
export { workspaceKeys } from "./api/workspace.keys"
export {
  useCompleteOnboarding,
  useCreateInvite,
  useSaveOnboardingProgress,
} from "./api/workspace.mutations"
export { workspaceQueries } from "./api/workspace.queries"
export {
  companyInfoSchema,
  completeOnboardingInputSchema,
  INVITABLE_ROLES,
  inviteInputSchema,
  inviteSchema,
  memberSchema,
  moduleSelectionSchema,
  ONBOARDING_STEPS,
  onboardingDraftSchema,
  saveOnboardingInputSchema,
  workspaceSchema,
} from "./api/workspace.schemas"
export type {
  CompanyInfo,
  CompleteOnboardingInput,
  Invite,
  InviteInput,
  Member,
  OnboardingDraft,
  OnboardingState,
  Workspace,
} from "./api/workspace.schemas"
export { MembersPanel } from "./components/members-panel"
export {
  OnboardingLayout,
  OnboardingPending,
} from "./components/onboarding/onboarding-layout"
export { OnboardingWizard } from "./components/onboarding/onboarding-wizard"
export { WorkspaceAvatar } from "./components/workspace-avatar"
export { WorkspaceSwitcher } from "./components/workspace-switcher"
export { useActiveModules, useWorkspace } from "./hooks/use-workspace"
export { getResumeStep, isOnboardingComplete } from "./lib/onboarding"
export { ensureModuleActive } from "./lib/module-guard"
