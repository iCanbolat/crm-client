import { createContext, use, type ReactNode } from "react"

import type { CrmRecord } from "@/engine/metadata"

/**
 * Stages that need their own flow instead of a plain move, e.g. a lead's
 * "converted" stage opens the conversion dialog (B3.3). Keyed by object key,
 * then stage key; the kanban and the record header both honour it.
 */
export type StageInterceptors = Record<
  string,
  Record<string, (record: CrmRecord) => void>
>

const StageInterceptorsContext = createContext<StageInterceptors>({})

export function StageInterceptorsProvider({
  value,
  children,
}: {
  value: StageInterceptors
  children: ReactNode
}) {
  return (
    <StageInterceptorsContext value={value}>
      {children}
    </StageInterceptorsContext>
  )
}

export function useStageInterceptors() {
  return use(StageInterceptorsContext)
}
