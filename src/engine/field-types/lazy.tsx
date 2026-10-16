import { Suspense, use, type ComponentType } from "react"

import { Skeleton } from "@/components/ui/skeleton"

import type { FieldInputProps } from "./types"

const preloaders = new Set<() => Promise<void>>()

/**
 * Field input whose widget (select, combobox, uploader…) loads on first
 * render, so pages that only show values — and forms without that field
 * type — skip its code (bundle budgets, Faz 8). The returned component is a
 * regular `Input`: it suspends inside its own boundary, and once loaded it
 * renders synchronously with a stable tree (no remount while typing).
 */
export function lazyFieldInput<V>(
  load: () => Promise<ComponentType<FieldInputProps<V>>>
): ComponentType<FieldInputProps<V>> {
  let Loaded: ComponentType<FieldInputProps<V>> | undefined
  let pending: Promise<void> | undefined
  const preload = () =>
    (pending ??= load().then(
      (component) => {
        Loaded = component
      },
      (error: unknown) => {
        pending = undefined // a later render retries (chunk load error)
        throw error
      }
    ))
  preloaders.add(preload)

  function Resolved(props: FieldInputProps<V>) {
    if (!Loaded) use(preload())
    const Component = Loaded!
    return <Component {...props} />
  }

  return function LazyFieldInput(props: FieldInputProps<V>) {
    return (
      <Suspense fallback={<Skeleton className="h-9 w-full" aria-busy />}>
        <Resolved {...props} />
      </Suspense>
    )
  }
}

/** Loads every lazy input created so far (tests render them synchronously). */
export async function preloadFieldInputs() {
  await Promise.all([...preloaders].map((preload) => preload()))
}
