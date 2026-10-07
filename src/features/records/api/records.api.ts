import { z } from "zod"

import {
  crmRecordSchema,
  fileRefSchema,
  objectDefSchema,
  objectListResponseSchema,
} from "@/engine/metadata"
import { apiClient, type QueryParams } from "@/lib/api"

import {
  attachmentListSchema,
  attachmentSchema,
  bulkActionResultSchema,
  recordListResponseSchema,
  savedViewSchema,
  userDirectorySchema,
  viewListResponseSchema,
  type BulkActionInput,
  type FieldInput,
  type FieldPatch,
  type ObjectPatch,
  type RecordInputValues,
  type RecordListParams,
  type StageMoveInput,
  type ViewInput,
  type ViewPatch,
} from "./records.schemas"

const segment = encodeURIComponent

/** Conditions travel as one JSON encoded `filters` query param. */
export function toListQuery(params: RecordListParams): QueryParams {
  return {
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    q: params.q,
    filters: params.filters?.length
      ? JSON.stringify(params.filters)
      : undefined,
  }
}

/* ------------------------------------------------------------- metadata */

export function fetchObjects(signal?: AbortSignal) {
  return apiClient.get("/meta/objects", {
    signal,
    schema: objectListResponseSchema,
  })
}

export function updateObject(objectKey: string, patch: ObjectPatch) {
  return apiClient.patch(`/meta/objects/${segment(objectKey)}`, {
    body: patch,
    schema: objectDefSchema,
  })
}

export function createField(objectKey: string, input: FieldInput) {
  return apiClient.post(`/meta/objects/${segment(objectKey)}/fields`, {
    body: input,
    schema: objectDefSchema,
  })
}

export function updateField(
  objectKey: string,
  fieldKey: string,
  patch: FieldPatch
) {
  return apiClient.patch(
    `/meta/objects/${segment(objectKey)}/fields/${segment(fieldKey)}`,
    { body: patch, schema: objectDefSchema }
  )
}

export function deleteField(objectKey: string, fieldKey: string) {
  return apiClient.delete(
    `/meta/objects/${segment(objectKey)}/fields/${segment(fieldKey)}`,
    { schema: objectDefSchema }
  )
}

/* -------------------------------------------------------------- records */

export function fetchRecords(
  objectKey: string,
  params: RecordListParams,
  signal?: AbortSignal
) {
  return apiClient.get(`/records/${segment(objectKey)}`, {
    query: toListQuery(params),
    signal,
    schema: recordListResponseSchema,
  })
}

export function fetchRecord(
  objectKey: string,
  id: string,
  signal?: AbortSignal
) {
  return apiClient.get(`/records/${segment(objectKey)}/${segment(id)}`, {
    signal,
    schema: crmRecordSchema,
  })
}

export function createRecord(objectKey: string, values: RecordInputValues) {
  return apiClient.post(`/records/${segment(objectKey)}`, {
    body: values,
    schema: crmRecordSchema,
  })
}

export function updateRecord(
  objectKey: string,
  id: string,
  values: RecordInputValues
) {
  return apiClient.patch(`/records/${segment(objectKey)}/${segment(id)}`, {
    body: values,
    schema: crmRecordSchema,
  })
}

export function deleteRecord(objectKey: string, id: string) {
  return apiClient.delete(`/records/${segment(objectKey)}/${segment(id)}`)
}

export function moveRecordStage(
  objectKey: string,
  id: string,
  input: StageMoveInput
) {
  return apiClient.patch(
    `/records/${segment(objectKey)}/${segment(id)}/stage`,
    { body: input, schema: crmRecordSchema }
  )
}

export function runBulkAction(objectKey: string, input: BulkActionInput) {
  return apiClient.post(`/records/${segment(objectKey)}/bulk`, {
    body: input,
    schema: bulkActionResultSchema,
  })
}

/* ---------------------------------------------------- files & directory */

export function fetchAttachments(
  objectKey: string,
  id: string,
  signal?: AbortSignal
) {
  return apiClient.get(`/records/${segment(objectKey)}/${segment(id)}/files`, {
    signal,
    schema: attachmentListSchema,
  })
}

function toFormData(files: File[], category?: string | null) {
  const body = new FormData()
  for (const file of files) body.append("file", file, file.name)
  if (category) body.append("category", category)
  return body
}

export function uploadAttachments(
  objectKey: string,
  id: string,
  files: File[],
  category?: string | null
) {
  return apiClient.post(`/records/${segment(objectKey)}/${segment(id)}/files`, {
    body: toFormData(files, category),
    schema: z.object({ data: z.array(attachmentSchema) }),
  })
}

export function deleteAttachment(
  objectKey: string,
  id: string,
  fileId: string
) {
  return apiClient.delete(
    `/records/${segment(objectKey)}/${segment(id)}/files/${segment(fileId)}`
  )
}

/** Upload for file fields (stored in the record value). */
export function uploadFile(file: File) {
  return apiClient.post("/files", {
    body: toFormData([file]),
    schema: fileRefSchema,
  })
}

export function fetchUserDirectory(signal?: AbortSignal) {
  return apiClient.get("/users", { signal, schema: userDirectorySchema })
}

/* ---------------------------------------------------------- saved views */

export function fetchViews(objectKey: string, signal?: AbortSignal) {
  return apiClient.get("/views", {
    query: { objectKey },
    signal,
    schema: viewListResponseSchema,
  })
}

export function createView(input: ViewInput) {
  return apiClient.post("/views", { body: input, schema: savedViewSchema })
}

export function updateView(id: string, patch: ViewPatch) {
  return apiClient.patch(`/views/${segment(id)}`, {
    body: patch,
    schema: savedViewSchema,
  })
}

export function deleteView(id: string) {
  return apiClient.delete(`/views/${segment(id)}`)
}

export function setDefaultView(objectKey: string, viewId: string | null) {
  return apiClient.put("/views/default", { body: { objectKey, viewId } })
}
