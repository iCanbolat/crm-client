import { apiClient } from "@/lib/api"

import {
  authTokensSchema,
  meSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type VerifyEmailInput,
} from "./auth.schemas"

export function login(input: LoginInput) {
  return apiClient.post("/auth/login", {
    body: input,
    schema: authTokensSchema,
    auth: false,
  })
}

export function register(input: RegisterInput) {
  return apiClient.post("/auth/register", {
    body: input,
    schema: authTokensSchema,
    auth: false,
  })
}

export function verifyEmail(input: VerifyEmailInput) {
  return apiClient.post("/auth/verify-email", { body: input, schema: meSchema })
}

export function resendVerificationCode() {
  return apiClient.post("/auth/verify-email/resend")
}

export function refreshTokens(refreshToken: string) {
  return apiClient.post("/auth/refresh", {
    body: { refreshToken },
    schema: authTokensSchema,
    auth: false,
  })
}

export function logout(refreshToken: string | null) {
  return apiClient.post("/auth/logout", {
    body: { refreshToken },
    auth: false,
  })
}

export function fetchMe(signal?: AbortSignal) {
  return apiClient.get("/me", { signal, schema: meSchema })
}

export function requestPasswordReset(input: ForgotPasswordInput) {
  return apiClient.post("/auth/forgot-password", { body: input, auth: false })
}
