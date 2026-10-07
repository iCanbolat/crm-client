import { z } from "zod"

import { ROLES } from "@/lib/rbac"

export const roleSchema = z.enum(ROLES)

export const userSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof userSchema>

export const membershipSchema = z.object({
  workspaceId: z.string(),
  workspaceName: z.string(),
  workspaceLogoUrl: z.string().nullable(),
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

export const forgotPasswordInputSchema = z.object({
  email: z.email().trim().toLowerCase(),
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>

export const refreshInputSchema = z.object({ refreshToken: z.string().min(1) })

/** Route search params of the login page. */
export const loginSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
})
