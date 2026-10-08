import { useQuery } from "@tanstack/react-query"

import { isApiError } from "@/lib/api"

import { publicQueries } from "../api/public.queries"
import { matchPublicRoute } from "../lib/public-route"
import { PublicFormPage } from "./public-form-page"
import { PublicNotFound } from "./public-not-found"
import { PublicStatus } from "./public-status"

/**
 * Public form site of the visited host (B5.1/B5.4): `/` shows the site's
 * default form, `/f/:slug` a hosted form, `/embed/:slug` the iframe view.
 */
export function PublicSite({
  host,
  pathname,
}: {
  host: string
  pathname: string
}) {
  const route = matchPublicRoute(pathname)
  const site = useQuery({
    ...publicQueries.site(host),
    enabled: route.kind !== "notFound",
  })

  if (route.kind === "notFound") return <PublicNotFound />
  if (site.isPending) return <PublicStatus kind="loading" />
  if (site.isError) {
    return isApiError(site.error) && site.error.status === 404 ? (
      <PublicNotFound />
    ) : (
      <PublicStatus kind="error" onRetry={() => void site.refetch()} />
    )
  }

  const slug = route.kind === "home" ? site.data.defaultFormSlug : route.slug
  if (!slug) return <PublicNotFound />
  return (
    <PublicFormPage
      key={slug}
      site={site.data}
      slug={slug}
      embedded={route.kind === "embed"}
    />
  )
}
