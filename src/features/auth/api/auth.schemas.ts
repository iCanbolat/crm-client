import { z } from "zod"

import { MODULE_IDS } from "@/engine/modules"
import { ROLES } from "@/lib/rbac"

export const roleSchema = z.enum(ROLES)

export const userSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  /** Self sign-ups confirm their address with a code (Faz 10). */
  emailVerified: z.boolean().default(true),
})
export type User = z.infer<typeof userSchema>

export const membershipSchema = z.object({
  workspaceId: z.string(),
  workspaceName: z.string(),
  workspaceLogoUrl: z.string().nullable(),
  /** Sector of the workspace (`null` until its onboarding picks one). */
  vertical: z.enum(MODULE_IDS).nullable().default(null),
  role: roleSchema,
})
export type Membership = z.infer<typeof membershipSchema>

export const meSchema = z.object({
  user: userSchema,
  memberships: z.array(membershipSchema),
})
export type Me = z.infer<typeof meSchema>

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Access token lifetime in seconds. */
  expiresIn: z.number().int().positive(),
})
export type AuthTokens = z.infer<typeof authTokensSchema>

export const loginInputSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
})
export type LoginInput = z.infer<typeof loginInputSchema>

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72

export const registerInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
  /** Prefills the workspace name of the onboarding. */
  companyName: z.string().trim().min(2).max(80),
  acceptTerms: z.literal(true),
})
export type RegisterInput = z.infer<typeof registerInputSchema>

export const VERIFICATION_CODE_LENGTH = 6

export const verifyEmailInputSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${VERIFICATION_CODE_LENGTH}}$`)),
})
export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>

export const forgotPasswordInputSchema = z.object({
  email: z.email().trim().toLowerCase(),
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>

export const refreshInputSchema = z.object({ refreshToken: z.string().min(1) })

/** Route search params of the login page. */
export const loginSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
})
