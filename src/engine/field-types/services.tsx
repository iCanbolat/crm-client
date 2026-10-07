import { createContext, useContext, type ReactNode } from "react"

import type { FileRef, RecordRef } from "../metadata/schemas"

export interface UserOption {
  id: string
  name: string
  avatarUrl?: string | null
}

/**
 * Data access the field inputs need but the engine must not own (it cannot
 * import features). The records feature provides the implementation.
 */
export interface FieldServices {
  users: UserOption[]
  defaultCurrency: string
  defaultCountry: string
  searchRecords(
    objectKey: string,
    q: string,
    signal?: AbortSignal
  ): Promise<RecordRef[]>
  /** "Create new" from a relation picker; absent when not allowed. */
  createRecord?(objectKey: string, label: string): Promise<RecordRef>
  uploadFile(file: File): Promise<FileRef>
}

export const defaultFieldServices: FieldServices = {
  users: [],
  defaultCurrency: "TRY",
  defaultCountry: "TR",
  searchRecords: async () => [],
  uploadFile: async () => {
    throw new Error("File uploads are not available")
  },
}

const FieldServicesContext = createContext<FieldServices>(defaultFieldServices)

export function FieldServicesProvider({
  value,
  children,
}: {
  value: FieldServices
  children: ReactNode
}) {
  return (
    <FieldServicesContext.Provider value={value}>
      {children}
    </FieldServicesContext.Provider>
  )
}

export function useFieldServices() {
  return useContext(FieldServicesContext)
}
