import { z } from "zod"

import { MODULE_IDS } from "@/engine/modules"
import i18n, { supportedLanguages } from "@/lib/i18n"
import { ROLES } from "@/lib/rbac"

import { COUNTRY_CODES, CURRENCIES, TIMEZONES } from "../lib/reference"

export const WORKSPACE_NAME_MIN = 2
export const WORKSPACE_NAME_MAX = 80
/** ~512 KB image as a base64 data URL. */
export const LOGO_MAX_BYTES = 512 * 1024
const LOGO_MAX_LENGTH = Math.ceil((LOGO_MAX_BYTES * 4) / 3) + 100
export const MAX_INVITES = 10

export const companyInfoSchema = z.object({
  name: z.string().trim().min(WORKSPACE_NAME_MIN).max(WORKSPACE_NAME_MAX),
  logoUrl: z.string().max(LOGO_MAX_LENGTH).nullable(),
  country: z.enum(COUNTRY_CODES),
  currency: z.enum(CURRENCIES),
  timezone: z.enum(TIMEZONES),
  language: z.enum(supportedLanguages),
})
export type CompanyInfo = z.infer<typeof companyInfoSchema>

export const moduleSelectionSchema = z.object({
  modules: z.array(z.enum(MODULE_IDS)).min(1),
})
export type ModuleSelection = z.infer<typeof moduleSelectionSchema>

/** The owner role cannot be handed out by invitation. */
export const INVITABLE_ROLES = ["admin", "manager", "agent", "viewer"] as const
export const invitableRoleSchema = z.enum(INVITABLE_ROLES)
export type InvitableRole = z.infer<typeof invitableRoleSchema>

export const inviteInputSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: invitableRoleSchema,
})
export type InviteInput = z.infer<typeof inviteInputSchema>

export const teamInvitesSchema = z.object({
  invites: z
    .array(inviteInputSchema)
    .max(MAX_INVITES)
    .superRefine((invites, ctx) => {
      const seen = new Set<string>()
      invites.forEach((invite, index) => {
        if (seen.has(invite.email)) {
          ctx.addIssue({
            code: "custom",
            path: [index, "email"],
            message: i18n.t("workspace:team.duplicateEmail"),
          })
        }
        seen.add(invite.email)
      })
    }),
})
export type TeamInvites = z.infer<typeof teamInvitesSchema>

export const ONBOARDING_STEPS = ["company", "modules", "team", "done"] as const
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]
export const LAST_ONBOARDING_STEP = ONBOARDING_STEPS.length - 1

export const onboardingDraftSchema = z.object({
  company: companyInfoSchema.optional(),
  modules: moduleSelectionSchema.shape.modules.optional(),
  invites: z.array(inviteInputSchema).optional(),
})
export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>

export const onboardingStateSchema = z.object({
  status: z.enum(["pending", "completed"]),
  /** Index into ONBOARDING_STEPS where the wizard resumes. */
  step: z.number().int().min(0).max(LAST_ONBOARDING_STEP),
  draft: onboardingDraftSchema,
})
export type OnboardingState = z.infer<typeof onboardingStateSchema>

export const saveOnboardingInputSchema = z.object({
  step: onboardingStateSchema.shape.step,
  draft: onboardingDraftSchema,
})
export type SaveOnboardingInput = z.infer<typeof saveOnboardingInputSchema>

export const completeOnboardingInputSchema = z.object({
  company: companyInfoSchema,
  modules: moduleSelectionSchema.shape.modules,
  invites: teamInvitesSchema.shape.invites,
})
export type CompleteOnboardingInput = z.infer<
  typeof completeOnboardingInputSchema
>

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logoUrl: z.string().nullable(),
  country: z.string().nullable(),
  currency: z.string().nullable(),
  timezone: z.string().nullable(),
  language: z.enum(supportedLanguages).nullable(),
  /** Activated sector modules (module ids). */
  modules: z.array(z.string()),
  onboarding: onboardingStateSchema,
  createdAt: z.iso.datetime(),
})
export type Workspace = z.infer<typeof workspaceSchema>

export const memberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.email(),
  avatarUrl: z.string().nullable(),
  role: z.enum(ROLES),
  joinedAt: z.iso.datetime(),
})
export type Member = z.infer<typeof memberSchema>

export const inviteSchema = z.object({
  id: z.string(),
  email: z.email(),
  role: invitableRoleSchema,
  status: z.enum(["pending", "accepted", "revoked"]),
  invitedAt: z.iso.datetime(),
})
export type Invite = z.infer<typeof inviteSchema>

export const membersResponseSchema = z.object({ data: z.array(memberSchema) })
export const invitesResponseSchema = z.object({ data: z.array(inviteSchema) })
