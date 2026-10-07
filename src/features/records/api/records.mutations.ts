import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import type { CrmRecord, ObjectDef } from "@/engine/metadata"
import { getErrorMessage } from "@/lib/api"

import {
  createField,
  createRecord,
  createView,
  deleteAttachment,
  deleteField,
  deleteRecord,
  deleteView,
  moveRecordStage,
  runBulkAction,
  setDefaultView,
  updateField,
  updateObject,
  updateRecord,
  updateView,
  uploadAttachments,
} from "./records.api"
import { metadataKeys, recordKeys, viewKeys } from "./records.keys"
import type {
  BulkActionInput,
  FieldInput,
  FieldPatch,
  ObjectPatch,
  RecordInputValues,
  StageMoveInput,
  ViewInput,
  ViewPatch,
} from "./records.schemas"

/** Lists, boards and related lists of an object (details stay cached). */
function invalidateCollections(queryClient: QueryClient, objectKey: string) {
  return queryClient.invalidateQueries({
    queryKey: recordKeys.object(objectKey),
    predicate: (query) => query.queryKey[2] !== "detail",
  })
}

/** Every object may show this record in a related list or relation cell. */
function invalidateAllCollections(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: recordKeys.all,
    predicate: (query) => query.queryKey[2] !== "detail",
  })
}

export function useCreateRecord(objectKey: string) {
  const { t } = useTranslation("records")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: RecordInputValues) => createRecord(objectKey, values),
    meta: { successMessage: t("toast.created") },
    onSuccess: (record) => {
      queryClient.setQueryData(recordKeys.detail(objectKey, record.id), record)
      return invalidateAllCollections(queryClient)
    },
  })
}

interface UpdateVariables {
  id: string
  values: RecordInputValues
}

/**
 * Optimistic by default (inline edit): the detail cache shows the new value
 * at once and rolls back when the server rejects it.
 */
export function useUpdateRecord(
  objectKey: string,
  {
    optimistic = true,
    successMessage,
  }: { optimistic?: boolean; successMessage?: string } = {}
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, values }: UpdateVariables) =>
      updateRecord(objectKey, id, values),
    meta: successMessage ? { successMessage } : undefined,
    onMutate: async ({ id, values }) => {
      if (!optimistic) return undefined
      const key = recordKeys.detail(objectKey, id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<CrmRecord>(key)
      if (previous) {
        queryClient.setQueryData<CrmRecord>(key, {
          ...previous,
          values: { ...previous.values, ...values },
        })
      }
      return { previous }
    },
    onError: (_error, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          recordKeys.detail(objectKey, id),
          context.previous
        )
      }
    },
    onSuccess: (record) => {
      queryClient.setQueryData(recordKeys.detail(objectKey, record.id), record)
    },
    onSettled: () => invalidateAllCollections(queryClient),
  })
}

export function useDeleteRecord(objectKey: string) {
  const { t } = useTranslation("records")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteRecord(objectKey, id),
    meta: { successMessage: t("toast.deleted") },
    onSuccess: async (_data, id) => {
      // Not removed: the open page would refetch (404) before navigating away.
      await queryClient.invalidateQueries({
        queryKey: recordKeys.detail(objectKey, id),
        refetchType: "none",
      })
      return invalidateAllCollections(queryClient)
    },
  })
}

interface StageMoveVariables extends StageMoveInput {
  id: string
}

/**
 * Stage change used by the record header and the kanban board. The detail
 * cache moves at once (the board keeps its own optimistic copy) and rolls
 * back on failure. Errors — 422 stage gate failures included — are toasted
 * here and rethrown to the caller.
 */
export function useMoveStage(objectDef: ObjectDef) {
  const { t } = useTranslation("records")
  const queryClient = useQueryClient()
  const objectKey = objectDef.key

  return useMutation({
    mutationFn: ({ id, ...input }: StageMoveVariables) =>
      moveRecordStage(objectKey, id, input),
    meta: { suppressErrorToast: true },
    onMutate: async ({ id, stage, values }) => {
      const key = recordKeys.detail(objectKey, id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<CrmRecord>(key)
      if (previous && objectDef.pipeline) {
        queryClient.setQueryData<CrmRecord>(key, {
          ...previous,
          values: {
            ...previous.values,
            ...values,
            [objectDef.pipeline.field]: stage,
          },
        })
      }
      return { previous }
    },
    onError: (error, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          recordKeys.detail(objectKey, id),
          context.previous
        )
      }
      toast.error(t("toast.moveFailed"), {
        description: getErrorMessage(error),
      })
    },
    onSuccess: (record) => {
      queryClient.setQueryData(recordKeys.detail(objectKey, record.id), record)
    },
    onSettled: () => invalidateCollections(queryClient, objectKey),
  })
}

export function useBulkAction(objectKey: string) {
  const { t } = useTranslation("records")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: BulkActionInput) => runBulkAction(objectKey, input),
    onSuccess: (result) => {
      if (result.skipped.length) {
        toast.warning(
          t("bulk.partial", {
            count: result.updated,
            skipped: result.skipped.length,
          })
        )
      } else {
        toast.success(t("bulk.done", { count: result.updated }))
      }
      return queryClient.invalidateQueries({ queryKey: recordKeys.all })
    },
  })
}

export function useUploadAttachments(objectKey: string, recordId: string) {
  const { t } = useTranslation("records")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      files,
      category,
    }: {
      files: File[]
      category?: string | null
    }) => uploadAttachments(objectKey, recordId, files, category),
    meta: { successMessage: t("files.uploaded") },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: recordKeys.attachments(objectKey, recordId),
      }),
  })
}

export function useDeleteAttachment(objectKey: string, recordId: string) {
  const { t } = useTranslation("records")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (fileId: string) =>
      deleteAttachment(objectKey, recordId, fileId),
    meta: { successMessage: t("files.deleted") },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: recordKeys.attachments(objectKey, recordId),
      }),
  })
}

/* ---------------------------------------------------------- saved views */

export function useCreateView(objectKey: string) {
  const { t } = useTranslation("records")
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<ViewInput, "objectKey">) =>
      createView({ ...input, objectKey }),
    meta: { successMessage: t("views.created") },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: viewKeys.list(objectKey) }),
  })
}

export function useUpdateView(objectKey: string) {
  const { t } = useTranslation("records")
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ViewPatch }) =>
      updateView(id, patch),
    meta: { successMessage: t("views.updated") },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: viewKeys.list(objectKey) }),
  })
}

export function useDeleteView(objectKey: string) {
  const { t } = useTranslation("records")
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteView,
    meta: { successMessage: t("views.deleted") },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: viewKeys.list(objectKey) }),
  })
}

export function useSetDefaultView(objectKey: string) {
  const { t } = useTranslation("records")
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (viewId: string | null) => setDefaultView(objectKey, viewId),
    meta: { successMessage: t("views.defaultSaved") },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: viewKeys.list(objectKey) }),
  })
}

/* ------------------------------------------------- metadata (settings) */

function useMetadataMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<ObjectDef>,
  successMessage: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { successMessage },
    onSuccess: async (def) => {
      await queryClient.invalidateQueries({ queryKey: metadataKeys.all })
      // Columns, forms and boards render from metadata: refresh their data.
      await queryClient.invalidateQueries({
        queryKey: recordKeys.object(def.key),
      })
    },
  })
}

export function useUpdateObject(objectKey: string) {
  const { t } = useTranslation("settings")
  return useMetadataMutation(
    (patch: ObjectPatch) => updateObject(objectKey, patch),
    t("objects.saved")
  )
}

export function useCreateField(objectKey: string) {
  const { t } = useTranslation("settings")
  return useMetadataMutation(
    (input: FieldInput) => createField(objectKey, input),
    t("fields.created")
  )
}

export function useUpdateField(objectKey: string) {
  const { t } = useTranslation("settings")
  return useMetadataMutation(
    ({ fieldKey, patch }: { fieldKey: string; patch: FieldPatch }) =>
      updateField(objectKey, fieldKey, patch),
    t("fields.updated")
  )
}

export function useDeleteField(objectKey: string) {
  const { t } = useTranslation("settings")
  return useMetadataMutation(
    (fieldKey: string) => deleteField(objectKey, fieldKey),
    t("fields.deleted")
  )
}
