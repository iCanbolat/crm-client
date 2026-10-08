import { FORM_EMBED_RESIZE_MESSAGE } from "@/engine/forms"

/**
 * Public addresses of a form (B4.7). The origin is the site's
 * (`getSiteOrigin` of `@/features/sites`): its primary custom domain or the
 * platform subdomain.
 */
export interface EmbedTarget {
  /** `getSiteOrigin(site)`. */
  origin: string
  slug: string
  title: string
}

export const getHostedFormUrl = ({ origin, slug }: EmbedTarget) =>
  `${origin}/f/${encodeURIComponent(slug)}`

export const getEmbedFormUrl = ({ origin, slug }: EmbedTarget) =>
  `${origin}/embed/${encodeURIComponent(slug)}`

const escapeAttribute = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

/** Fixed-height iframe. */
export function getIframeSnippet(target: EmbedTarget) {
  return `<iframe src="${escapeAttribute(getEmbedFormUrl(target))}" title="${escapeAttribute(target.title)}" width="100%" height="720" style="border:0;max-width:100%" loading="lazy"></iframe>`
}

/**
 * Self-contained script: inserts the iframe and resizes it to the height the
 * form reports with `postMessage` (only from the form's own origin).
 */
export function getScriptSnippet(target: EmbedTarget) {
  const id = `crm-form-${target.slug}`
  // JSON strings are valid JS string literals; `<` is escaped for <script>.
  const js = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c")
  return [
    `<div id="${escapeAttribute(id)}"></div>`,
    "<script>",
    "(function () {",
    `  var host = document.getElementById(${js(id)});`,
    '  var frame = document.createElement("iframe");',
    `  frame.src = ${js(getEmbedFormUrl(target))};`,
    `  frame.title = ${js(target.title)};`,
    '  frame.style.cssText = "width:100%;border:0;min-height:320px";',
    '  frame.setAttribute("loading", "lazy");',
    "  host.appendChild(frame);",
    '  window.addEventListener("message", function (event) {',
    `    if (event.origin !== ${js(target.origin)} || event.source !== frame.contentWindow) return;`,
    "    var data = event.data || {};",
    `    if (data.type === ${js(FORM_EMBED_RESIZE_MESSAGE)} && typeof data.height === "number") {`,
    '      frame.style.height = data.height + "px";',
    "    }",
    "  });",
    "})();",
    "</script>",
  ].join("\n")
}
