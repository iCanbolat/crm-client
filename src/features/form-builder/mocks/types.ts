import type { FormStatus } from "../api/forms.schemas"

/** Stored form: the draft is kept as saved (it may be an older schema). */
export interface FormRow {
  id: string
  workspaceId: string
  name: string
  slug: string
  status: FormStatus
  publishedVersion: number | null
  draft: unknown
  ownerId: string
  createdAt: string
  updatedAt: string
  /** Counters until the submission inbox arrives (Faz 5). */
  views: number
  submissions: number
}

/** Immutable published copy of a form's content (B4.7). */
export interface FormVersionRow {
  id: string
  workspaceId: string
  formId: string
  version: number
  content: unknown
  publishedAt: string
  publishedBy: string
}

export interface FormSeed {
  forms: FormRow[]
  versions: FormVersionRow[]
}
