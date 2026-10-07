import type { ReactNode } from "react"

import type { Action, Resource, Target } from "@/lib/rbac"

import { usePermission } from "../hooks/use-session"

interface CanProps {
  action: Action
  resource: Resource
  target?: Target
  children: ReactNode
  fallback?: ReactNode
}

/** Renders `children` only when the current role may perform the action. */
export function Can({
  action,
  resource,
  target,
  children,
  fallback = null,
}: CanProps) {
  return usePermission(action, resource, target) ? children : fallback
}
