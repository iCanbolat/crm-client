import { foldText } from "@/engine/logic"

import { FORM_SLUG_MAX } from "../api/forms.schemas"

/** "Navlun Teklif Formu" → "navlun-teklif-formu" (Turkish letters folded). */
export function slugify(text: string) {
  return (
    foldText(text)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, FORM_SLUG_MAX)
      .replace(/-+$/, "") || "form"
  )
}

/** `slug`, or `slug-2`, `slug-3`… when taken. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>) {
  let slug = base
  for (let n = 2; taken.has(slug); n += 1) {
    const suffix = `-${n}`
    slug = `${base.slice(0, FORM_SLUG_MAX - suffix.length)}${suffix}`
  }
  return slug
}
