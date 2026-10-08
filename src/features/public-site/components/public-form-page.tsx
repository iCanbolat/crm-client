import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"

import { FormRenderer, FormThemeScope } from "@/features/form-renderer"
import { isApiError } from "@/lib/api"
import { isLanguage, type Language } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { submitPublicForm, trackPublicEvent } from "../api/public.api"
import { publicQueries } from "../api/public.queries"
import type { PublicForm, PublicSite } from "../api/public.schemas"
import { applyDocumentMeta } from "../lib/document-meta"
import { getPageContext } from "../lib/page-context"
import { useEmbedResize } from "../lib/use-embed-resize"
import { PublicNotFound } from "./public-not-found"
import { PublicStatus } from "./public-status"

/** Views are counted once per page load (StrictMode runs effects twice). */
const trackedViews = new Set<string>()

/** `?lang=` when the form offers it, else the form's default language. */
export function resolveFormLanguage(
  form: PublicForm,
  search: string
): Language {
  const requested = new URLSearchParams(search).get("lang")
  const { languages, defaultLanguage } = form.content.settings
  return isLanguage(requested) && languages.includes(requested)
    ? requested
    : defaultLanguage
}

function SiteFooter({
  site,
  language,
}: {
  site: PublicSite
  language: Language
}) {
  const { t } = useTranslation("public", { lng: language })
  const links = [
    { key: "kvkk", url: site.legal.kvkkUrl },
    { key: "privacy", url: site.legal.privacyUrl },
    { key: "cookies", url: site.legal.cookieUrl },
  ] as const
  const shown = links.filter((link) => link.url)
  if (shown.length === 0) return null
  return (
    <footer className="px-4 pb-8">
      <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        {shown.map((link) => (
          <li key={link.key}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {t(`footer.${link.key}`)}
            </a>
          </li>
        ))}
      </ul>
    </footer>
  )
}

function FormView({
  site,
  form,
  embedded,
}: {
  site: PublicSite
  form: PublicForm
  embedded: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const language = resolveFormLanguage(form, window.location.search)
  const context = useMemo(() => getPageContext(embedded), [embedded])
  useEmbedResize(rootRef, embedded)

  useEffect(() => {
    applyDocumentMeta({
      title: site.seo.title || `${form.name} · ${site.brand.name}`,
      description: site.seo.description,
      faviconUrl: site.brand.faviconUrl,
      ogImageUrl: site.seo.ogImageUrl,
      language,
    })
  }, [site, form.name, language])

  // The host page shows through around the form card.
  useEffect(() => {
    if (!embedded) return
    document.documentElement.style.background = "transparent"
    document.body.style.background = "transparent"
  }, [embedded])

  useEffect(() => {
    if (trackedViews.has(form.slug)) return
    trackedViews.add(form.slug)
    void trackPublicEvent({ type: "view", formSlug: form.slug })
  }, [form.slug])

  const renderer = (
    <FormThemeScope theme={form.content.theme}>
      <h1 className="sr-only">{form.name}</h1>
      <FormRenderer
        content={form.content}
        language={language}
        mode="live"
        context={context}
        idPrefix={`public-${form.slug}`}
        onSubmit={async (answers) => {
          await submitPublicForm(form.slug, {
            answers,
            meta: {
              pageUrl: context.pageUrl,
              referrer: context.referrerUrl,
              embedded,
              language,
            },
          })
        }}
      />
    </FormThemeScope>
  )

  if (embedded) {
    return (
      <div ref={rootRef} data-embed className="p-1">
        <main>{renderer}</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header
        className="border-t-4 bg-background"
        style={{ borderTopColor: site.brand.primaryColor }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {site.brand.logoUrl ? (
            <img src={site.brand.logoUrl} alt="" className="h-8 w-auto" />
          ) : null}
          <span className="font-heading font-semibold">{site.brand.name}</span>
        </div>
      </header>
      <main className={cn("flex-1 px-4 py-6 sm:py-10")}>{renderer}</main>
      <SiteFooter site={site} language={language} />
    </div>
  )
}

/** A published form of the site, hosted or embedded (B5.4). */
export function PublicFormPage({
  site,
  slug,
  embedded,
}: {
  site: PublicSite
  slug: string
  embedded: boolean
}) {
  const query = useQuery(publicQueries.form(slug))

  if (query.isPending) return <PublicStatus kind="loading" />
  if (query.isError) {
    return isApiError(query.error) && query.error.status === 404 ? (
      <PublicNotFound />
    ) : (
      <PublicStatus kind="error" onRetry={() => void query.refetch()} />
    )
  }
  return <FormView site={site} form={query.data} embedded={embedded} />
}
