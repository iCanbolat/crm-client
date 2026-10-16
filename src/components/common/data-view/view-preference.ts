import { useStore } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

/** Built-in layouts of a data view; pages may add their own (e.g. kanban). */
export type DataViewLayout = "table" | "grid"

interface DataViewPreferences {
  /** Chosen layout per list (`viewKey`). */
  layouts: Record<string, DataViewLayout>
}

export const DATA_VIEW_STORAGE_KEY = "ui:data-views"

export const dataViewPreferencesStore = createStore<DataViewPreferences>()(
  persist(() => ({ layouts: {} }), {
    name: DATA_VIEW_STORAGE_KEY,
    storage: createJSONStorage(() => localStorage),
  })
)

export function setDataViewLayout(viewKey: string, layout: DataViewLayout) {
  dataViewPreferencesStore.setState((state) => ({
    layouts: { ...state.layouts, [viewKey]: layout },
  }))
}

export function resetDataViewPreferences() {
  dataViewPreferencesStore.setState({ layouts: {} }, true)
}

/** Personal table/grid choice of one list, kept in localStorage. */
export function useDataViewLayout(
  viewKey: string,
  fallback: DataViewLayout = "table"
) {
  return useStore(
    dataViewPreferencesStore,
    (state) => state.layouts[viewKey] ?? fallback
  )
}
