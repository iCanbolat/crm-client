/** `<head>` of a public form page (B5.4): title, description, icon, OG. */
export interface DocumentMeta {
  title: string
  description: string
  faviconUrl: string | null
  ogImageUrl: string | null
  language: string
}

function upsert(selector: string, create: () => HTMLElement) {
  let element = document.head.querySelector<HTMLElement>(selector)
  if (!element) {
    element = create()
    document.head.appendChild(element)
  }
  return element
}

function setMeta(attribute: "name" | "property", key: string, value: string) {
  const element = upsert(`meta[${attribute}="${key}"]`, () => {
    const meta = document.createElement("meta")
    meta.setAttribute(attribute, key)
    return meta
  })
  element.setAttribute("content", value)
}

export function applyDocumentMeta(meta: DocumentMeta) {
  document.title = meta.title
  document.documentElement.lang = meta.language
  setMeta("name", "description", meta.description)
  setMeta("property", "og:title", meta.title)
  setMeta("property", "og:description", meta.description)
  if (meta.ogImageUrl) setMeta("property", "og:image", meta.ogImageUrl)
  if (meta.faviconUrl) {
    const icon = upsert('link[rel="icon"]', () => {
      const link = document.createElement("link")
      link.rel = "icon"
      return link
    }) as HTMLLinkElement
    icon.removeAttribute("type")
    icon.href = meta.faviconUrl
  }
}
