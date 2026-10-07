import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, stripSearchParams } from "@tanstack/react-router"
import { z } from "zod"

import { requirePermission } from "@/features/auth"
import {
  BUILDER_TABS,
  FormBuilderPage,
  formQueries,
} from "@/features/form-builder"

const searchSchema = z.object({
  tab: z.enum(BUILDER_TABS).default("build").catch("build"),
})

export const Route = createFileRoute("/_app/forms/$formId/edit")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams({ tab: "build" })] },
  beforeLoad: ({ context }) =>
    requirePermission(context.auth, "update", "form"),
  component: FormEditorRoute,
})

function FormEditorRoute() {
  const { formId } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: form } = useSuspenseQuery(formQueries.detail(formId))

  return (
    <FormBuilderPage
      // A fresh editor (and undo history) per form.
      key={formId}
      form={form}
      tab={tab}
      onTabChange={(next) =>
        void navigate({ search: { tab: next }, replace: true })
      }
    />
  )
}
