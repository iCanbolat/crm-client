import { Link } from "@tanstack/react-router"
import { ShieldAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { buttonVariants } from "@/components/ui/button"

export function ForbiddenPage() {
  const { t } = useTranslation()

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlertIcon className="size-7" aria-hidden />
      </div>
      <p className="font-heading text-5xl font-semibold text-primary">
        {t("forbidden.code")}
      </p>
      <h1 className="font-heading text-2xl font-semibold">
        {t("forbidden.title")}
      </h1>
      <p className="text-muted-foreground">{t("forbidden.description")}</p>
      <Link to="/" className={buttonVariants({ variant: "outline" })}>
        {t("actions.goHome")}
      </Link>
    </section>
  )
}
