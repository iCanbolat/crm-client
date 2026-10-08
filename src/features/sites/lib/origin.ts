import { env } from "@/lib/env"

/**
 * Public origin of a site (B5.2): the active primary custom domain (always
 * https), otherwise the platform subdomain of the forms domain. Protocol and
 * port of the subdomain follow the admin app (dev: `http`, `:5173`).
 */
export function getSiteOrigin(
  site: { subdomain: string; primaryDomain: string | null },
  location: Pick<Location, "protocol" | "port"> = window.location,
  domain: string = env.VITE_PUBLIC_FORMS_DOMAIN
) {
  if (site.primaryDomain) return `https://${site.primaryDomain}`
  const port = location.port ? `:${location.port}` : ""
  return `${location.protocol}//${site.subdomain}.${domain}${port}`
}

/** `acme-lojistik.forms.example.com` */
export const getPlatformHost = (
  subdomain: string,
  domain: string = env.VITE_PUBLIC_FORMS_DOMAIN
) => `${subdomain}.${domain}`
