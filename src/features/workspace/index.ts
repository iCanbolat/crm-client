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
  ONBOARDING_STEPS,
  onboardingDraftSchema,
  saveOnboardingInputSchema,
  verticalSchema,
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
  Vertical,
  Workspace,
} from "./api/workspace.schemas"
export { InvitationInvalid, InvitationPage } from "./components/invitation-page"
export { MembersPanel } from "./components/members-panel"
export { LogoField } from "./components/onboarding/logo-field"
export {
  OnboardingLayout,
  OnboardingPending,
} from "./components/onboarding/onboarding-layout"
export { OnboardingWizard } from "./components/onboarding/onboarding-wizard"
export { WorkspaceAvatar } from "./components/workspace-avatar"
export { WorkspaceSwitcher } from "./components/workspace-switcher"
export { useRoleLabels } from "./hooks/use-role-label"
export { useActiveModules, useWorkspace } from "./hooks/use-workspace"
export { getResumeStep, isOnboardingComplete } from "./lib/onboarding"
export { ensureModuleActive } from "./lib/module-guard"
