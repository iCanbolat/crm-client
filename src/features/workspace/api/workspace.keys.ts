/** Tenant scoped: dropped from the cache whenever the workspace switches. */
export const workspaceKeys = {
  all: ["workspace"] as const,
  current: () => [...workspaceKeys.all, "current"] as const,
  members: () => [...workspaceKeys.all, "members"] as const,
  invites: () => [...workspaceKeys.all, "invites"] as const,
}
