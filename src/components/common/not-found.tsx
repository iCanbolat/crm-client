import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { buttonVariants } from "@/components/ui/button"

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="font-heading text-6xl font-semibold text-primary">
        {t("notFound.code")}
      </p>
      <h1 className="font-heading text-2xl font-semibold">
        {t("notFound.title")}
      </h1>
      <p className="text-muted-foreground">{t("notFound.description")}</p>
      <Link to="/" className={buttonVariants({ variant: "outline" })}>
        {t("actions.goHome")}
      </Link>
    </section>
  )
}
