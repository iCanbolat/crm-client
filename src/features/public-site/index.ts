/**
 * Public form site (Faz 5): hosted (`/f/:slug`) and embedded
 * (`/embed/:slug`) forms on platform subdomains and custom domains. Loaded
 * in its own chunk; depends only on the form renderer, engine and `lib`.
 */
export { PublicSite } from "./components/public-site"
export { matchPublicRoute } from "./lib/public-route"
export type { PublicRoute } from "./lib/public-route"
