/**
 * Mock JWT stand-in: `<prefix>.<base64url(JSON payload)>`. Tokens are
 * self-contained (subject + expiry), so a page reload keeps the session even
 * though the in-memory mock DB is reseeded. Logout/rotation revoke the `jti`.
 */

export type TokenKind = "access" | "refresh"

export interface TokenPayload {
  sub: string
  jti: string
  /** Expiry, epoch milliseconds. */
  exp: number
}

export type TokenCheck =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: "invalid" | "expired" }

export const ACCESS_TOKEN_TTL_MS = 15 * 60_000
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60_000

const PREFIX: Record<TokenKind, string> = {
  access: "mock-at",
  refresh: "mock-rt",
}

function encode(payload: TokenPayload) {
  return btoa(JSON.stringify(payload))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")
}

function decode(value: string): unknown {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/")
  return JSON.parse(atob(base64))
}

function isPayload(value: unknown): value is TokenPayload {
  const payload = value as Partial<TokenPayload> | null
  return (
    typeof payload?.sub === "string" &&
    typeof payload.jti === "string" &&
    typeof payload.exp === "number"
  )
}

export function createToken(kind: TokenKind, userId: string, ttlMs: number) {
  const payload: TokenPayload = {
    sub: userId,
    jti: crypto.randomUUID(),
    exp: Date.now() + ttlMs,
  }
  return `${PREFIX[kind]}.${encode(payload)}`
}

export function readToken(kind: TokenKind, token: string): TokenCheck {
  const [prefix, body] = token.split(".")
  if (prefix !== PREFIX[kind] || !body) return { ok: false, reason: "invalid" }

  let payload: unknown
  try {
    payload = decode(body)
  } catch {
    return { ok: false, reason: "invalid" }
  }

  if (!isPayload(payload)) return { ok: false, reason: "invalid" }
  if (payload.exp <= Date.now()) return { ok: false, reason: "expired" }
  return { ok: true, payload }
}

export interface IssueOptions {
  accessTtlMs?: number
  refreshTtlMs?: number
}

export function issueTokens(userId: string, options: IssueOptions = {}) {
  const accessTtlMs = options.accessTtlMs ?? ACCESS_TOKEN_TTL_MS
  return {
    accessToken: createToken("access", userId, accessTtlMs),
    refreshToken: createToken(
      "refresh",
      userId,
      options.refreshTtlMs ?? REFRESH_TOKEN_TTL_MS
    ),
    expiresIn: Math.max(1, Math.round(accessTtlMs / 1000)),
  }
}
