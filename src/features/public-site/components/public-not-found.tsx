import { useTranslation } from "react-i18next"

import type { Language } from "@/lib/i18n"

/**
 * Brand-neutral 404 (TC-5.4-01): unknown hosts and unpublished forms must
 * not reveal which tenant, if any, sits behind the address.
 */
export function PublicNotFound({ language }: { language?: Language }) {
  const { t } = useTranslation("public", { lng: language })

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <section className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="font-heading text-5xl font-semibold text-muted-foreground">
          404
        </p>
        <h1 className="font-heading text-2xl font-semibold">
          {t("notFound.title")}
        </h1>
        <p className="text-muted-foreground">{t("notFound.description")}</p>
      </section>
    </main>
  )
}
