import { matchPublicRoute } from "../lib/public-route"
import { PublicNotFound } from "./public-not-found"

/** Public form site of the visited host (B5.1). */
export function PublicSite({ pathname }: { host: string; pathname: string }) {
  const route = matchPublicRoute(pathname)
  if (route.kind === "notFound") return <PublicNotFound />
  return <PublicNotFound />
}
