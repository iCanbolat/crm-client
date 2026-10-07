import type { RecordListParams } from "./records.schemas"

/** Tenant scoped: everything but the identity is dropped on workspace switch. */
export const metadataKeys = {
  all: ["meta"] as const,
  objects: () => [...metadataKeys.all, "objects"] as const,
}

export const recordKeys = {
  all: ["records"] as const,
  /** Prefix of everything about one object (lists, boards, details). */
  object: (objectKey: string) => [...recordKeys.all, objectKey] as const,
  lists: (objectKey: string) =>
    [...recordKeys.object(objectKey), "list"] as const,
  list: (objectKey: string, params: RecordListParams) =>
    [...recordKeys.lists(objectKey), params] as const,
  details: (objectKey: string) =>
    [...recordKeys.object(objectKey), "detail"] as const,
  detail: (objectKey: string, id: string) =>
    [...recordKeys.details(objectKey), id] as const,
  attachments: (objectKey: string, id: string) =>
    [...recordKeys.object(objectKey), "files", id] as const,
}

export const viewKeys = {
  all: ["views"] as const,
  list: (objectKey: string) => [...viewKeys.all, objectKey] as const,
}

export const directoryKeys = {
  users: () => ["directory", "users"] as const,
}
