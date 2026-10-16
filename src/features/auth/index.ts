export { authKeys } from "./api/auth.keys"
export {
  useRegisterMutation,
  useResendVerificationMutation,
  useSignOut,
  useVerifyEmailMutation,
} from "./api/auth.mutations"
export { authQueries } from "./api/auth.queries"
export {
  authTokensSchema,
  loginInputSchema,
  loginSearchSchema,
  membershipSchema,
  meSchema,
  registerInputSchema,
  roleSchema,
  userSchema,
} from "./api/auth.schemas"
export type {
  LoginInput,
  Me,
  Membership,
  RegisterInput,
  User,
} from "./api/auth.schemas"
export { AuthLayout } from "./components/auth-layout"
export { Can } from "./components/can"
export { ForgotPasswordForm } from "./components/forgot-password-form"
export { LoginForm } from "./components/login-form"
export { RegisterForm } from "./components/register-form"
export { VerifyEmailForm } from "./components/verify-email-form"
export { usePermission, useSession } from "./hooks/use-session"
export { bindApiClientToSession } from "./lib/api-binding"
export { requireAuth, requirePermission, requireUnverified } from "./lib/guards"
export type { AuthContext } from "./lib/guards"
export {
  ensureSession,
  refreshAccessToken,
  resolveActiveMembership,
  signIn,
  signOut,
  signUp,
  switchWorkspace,
} from "./lib/session"
export {
  getSessionState,
  hasSessionTokens,
  resetSessionStore,
  sessionStore,
  setSessionTokens,
  setActiveWorkspaceId,
  useSessionState,
} from "./lib/session-store"
