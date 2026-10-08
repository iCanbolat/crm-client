export const siteKeys = {
  all: ["site"] as const,
  current: () => [...siteKeys.all, "current"] as const,
  domains: () => [...siteKeys.all, "domains"] as const,
}
