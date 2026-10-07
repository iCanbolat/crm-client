import { setActiveWorkspaceId, setSessionTokens } from "@/features/auth"
import { issueTokens, type IssueOptions } from "@/mocks/auth/tokens"
import { db } from "@/mocks/db"
import { SEED_USERS, type SeedUserKey } from "@/mocks/db/seed"

export interface SignInOptions extends IssueOptions {
  /** Defaults to the user's first workspace. */
  workspaceId?: string
}

/**
 * Puts a seed user's session straight into the session store (no login
 * request), exactly as a successful sign-in would leave it.
 */
export function signInAs(key: SeedUserKey, options: SignInOptions = {}) {
  const user = SEED_USERS[key]
  const workspaceId =
    options.workspaceId ??
    db.memberships.findFirst((item) => item.userId === user.id)?.workspaceId ??
    null

  const tokens = issueTokens(user.id, options)
  setSessionTokens(tokens)
  setActiveWorkspaceId(workspaceId)
  return { user, tokens, workspaceId }
}
