import type { FormRuntimeContext } from "@/features/form-renderer"

/**
 * Where the visitor is (B5.4). Hosted: this page. Embedded: the host page,
 * which an iframe only knows from `document.referrer` — its query carries
 * the UTM parameters of the campaign that brought the visitor.
 */
export function getPageContext(
  embedded: boolean,
  location: Pick<Location, "href" | "search"> = window.location,
  referrer: string = document.referrer
): FormRuntimeContext & { pageUrl: string; referrerUrl: string } {
  if (!embedded) {
    return {
      search: location.search,
      referrer,
      pageUrl: location.href,
      referrerUrl: referrer,
    }
  }
  let search: string
  try {
    search = referrer ? new URL(referrer).search : ""
  } catch {
    search = ""
  }
  return { search, referrer, pageUrl: referrer, referrerUrl: "" }
}
