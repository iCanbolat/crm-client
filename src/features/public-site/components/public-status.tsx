import { Loader2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

/** Loading / load error of a public page (no admin chrome). */
export function PublicStatus({
  kind,
  onRetry,
}: {
  kind: "loading" | "error"
  onRetry?: () => void
}) {
  const { t } = useTranslation("public")

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      {kind === "loading" ? (
        <p
          role="status"
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Loader2Icon className="size-5 animate-spin" aria-hidden />
          {t("loading")}
        </p>
      ) : (
        <section
          role="alert"
          className="flex max-w-md flex-col items-center gap-3 text-center"
        >
          <h1 className="font-heading text-xl font-semibold">
            {t("error.title")}
          </h1>
          <p className="text-muted-foreground">{t("error.description")}</p>
          {onRetry ? (
            <Button type="button" variant="outline" onClick={onRetry}>
              {t("error.retry")}
            </Button>
          ) : null}
        </section>
      )}
    </main>
  )
}
