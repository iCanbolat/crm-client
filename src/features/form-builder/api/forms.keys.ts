import type { FormListParams } from "./forms.schemas"

export const formKeys = {
  all: ["forms"] as const,
  lists: () => [...formKeys.all, "list"] as const,
  list: (params: FormListParams) => [...formKeys.lists(), params] as const,
  details: () => [...formKeys.all, "detail"] as const,
  detail: (id: string) => [...formKeys.details(), id] as const,
  stats: (id: string) => [...formKeys.detail(id), "stats"] as const,
}
