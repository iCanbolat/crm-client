import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/forms/$formId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/forms/$formId/edit",
      params: { formId: params.formId },
      replace: true,
    })
  },
})
