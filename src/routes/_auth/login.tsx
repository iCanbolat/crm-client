import { createFileRoute, useRouter } from "@tanstack/react-router"

import { LoginForm, loginSearchSchema } from "@/features/auth"
import { sanitizeRedirect } from "@/lib/redirect"

export const Route = createFileRoute("/_auth/login")({
  validateSearch: loginSearchSchema,
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  const router = useRouter()

  return (
    <LoginForm
      onSuccess={() =>
        router.navigate({ href: sanitizeRedirect(redirect) ?? "/dashboard" })
      }
    />
  )
}
