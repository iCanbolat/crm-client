/** Pages of the public form site (B5.1); no router library on purpose. */
export type PublicRoute =
  | { kind: "home" }
  | { kind: "form"; slug: string }
  | { kind: "embed"; slug: string }
  | { kind: "notFound" }

const SLUG = "([a-z0-9]+(?:-[a-z0-9]+)*)"
const FORM_PATH = new RegExp(`^/f/${SLUG}/?$`)
const EMBED_PATH = new RegExp(`^/embed/${SLUG}/?$`)

export function matchPublicRoute(pathname: string): PublicRoute {
  if (pathname === "/" || pathname === "") return { kind: "home" }

  const form = FORM_PATH.exec(pathname)
  if (form?.[1]) return { kind: "form", slug: form[1] }

  const embed = EMBED_PATH.exec(pathname)
  if (embed?.[1]) return { kind: "embed", slug: embed[1] }

  return { kind: "notFound" }
}
