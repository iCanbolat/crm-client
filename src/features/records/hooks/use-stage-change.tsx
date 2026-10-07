import { useState } from "react"

import { getMissingGateFields } from "@/engine/logic"
import {
  getRecordTitle,
  type CrmRecord,
  type ObjectDef,
  type RecordValues,
} from "@/engine/metadata"

import { useMoveStage } from "../api/records.mutations"
import {
  StageGateDialog,
  type StageGateRequest,
} from "../components/stage-gate-dialog"
import { useStageInterceptors } from "../components/stage-interceptors"

interface PendingMove extends StageGateRequest {
  record: CrmRecord
}

export interface StageChangeOptions {
  /** Performs the move (defaults to the plain stage mutation). */
  move?: (
    record: CrmRecord,
    stage: string,
    values?: RecordValues
  ) => Promise<unknown>
}

/**
 * Stage change with the stage gate: moves at once, or first asks for the
 * fields the target stage requires. Returns the trigger and its dialog.
 */
export function useStageChange(
  objectDef: ObjectDef,
  options: StageChangeOptions = {}
) {
  const mutation = useMoveStage(objectDef)
  const interceptors = useStageInterceptors()
  const [pending, setPending] = useState<PendingMove | null>(null)
  const [isMoving, setIsMoving] = useState(false)

  const move =
    options.move ??
    ((record: CrmRecord, stage: string, values?: RecordValues) =>
      mutation.mutateAsync({ id: record.id, stage, values }))

  async function perform(
    record: CrmRecord,
    stage: string,
    values?: RecordValues
  ) {
    setIsMoving(true)
    try {
      await move(record, stage, values)
      return true
    } catch {
      return false
    } finally {
      setIsMoving(false)
    }
  }

  function requestMove(record: CrmRecord, stage: string) {
    const fieldKey = objectDef.pipeline?.field
    if (!fieldKey || record.values[fieldKey] === stage) return
    const intercept = interceptors[objectDef.key]?.[stage]
    if (intercept) {
      intercept(record)
      return
    }
    const missing = getMissingGateFields(objectDef, stage, record.values)
    if (missing.length) {
      setPending({
        record,
        stage,
        fields: missing,
        recordTitle: getRecordTitle(objectDef, record),
      })
      return
    }
    void perform(record, stage)
  }

  const dialog = (
    <StageGateDialog
      objectDef={objectDef}
      request={pending}
      isPending={isMoving}
      onCancel={() => setPending(null)}
      onConfirm={async (values) => {
        if (!pending) return
        const ok = await perform(pending.record, pending.stage, values)
        if (ok) setPending(null)
      }}
    />
  )

  return { requestMove, dialog, isMoving }
}
