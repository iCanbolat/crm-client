import { useTranslation } from "react-i18next"

import type { Site } from "../api/sites.schemas"

type PreviewSite = Pick<Site, "brand" | "legal">

/** Hosted page frame as visitors see it (TC-5.2-02). */
export function SitePreview({ site, url }: { site: PreviewSite; url: string }) {
  const { t } = useTranslation("sites")
  const { brand, legal } = site
  const links = [
    { key: "kvkk", url: legal.kvkkUrl },
    { key: "privacy", url: legal.privacyUrl },
    { key: "cookies", url: legal.cookieUrl },
  ].filter((link) => link.url)

  return (
    <figure
      aria-label={t("preview.title")}
      className="overflow-hidden rounded-2xl border bg-muted/40"
    >
      <div className="flex items-center gap-2 border-b bg-background px-3 py-2">
        {brand.faviconUrl ? (
          <img src={brand.faviconUrl} alt="" className="size-4 rounded-sm" />
        ) : (
          <span
            className="size-4 rounded-sm"
            style={{ backgroundColor: brand.primaryColor }}
            aria-hidden
          />
        )}
        <span className="truncate font-mono text-xs text-muted-foreground">
          {url}
        </span>
      </div>
      <div
        data-testid="site-preview-header"
        className="flex items-center gap-3 border-t-4 bg-background px-4 py-3"
        style={{ borderTopColor: brand.primaryColor }}
      >
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt="" className="h-8 w-auto" />
        ) : null}
        <span className="font-heading font-semibold">{brand.name}</span>
      </div>
      <div className="p-4">
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed bg-background text-sm text-muted-foreground">
          {t("preview.formPlaceholder")}
        </div>
      </div>
      {links.length ? (
        <ul className="flex flex-wrap justify-center gap-4 px-4 pb-4 text-xs text-muted-foreground">
          {links.map((link) => (
            <li key={link.key} className="underline underline-offset-2">
              {t(`preview.${link.key}` as "preview.kvkk")}
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  )
}
