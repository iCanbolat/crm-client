export const automationKeys = {
  all: ["automations"] as const,
  list: () => [...automationKeys.all, "list"] as const,
  detail: (id: string) => [...automationKeys.all, "detail", id] as const,
  runs: (id: string) => [...automationKeys.all, "runs", id] as const,
}
