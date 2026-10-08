import type { Workspace } from "@/features/workspace"
import { MOCK_REFERENCE_DATE } from "@/mocks/db/faker"
import { WORKSPACE_IDS } from "@/mocks/db/seed"

import type { SiteRow } from "./types"

export const DEFAULT_SITE_COLOR = "#0f766e"

/** Starting site of a workspace: subdomain = workspace slug. */
export function createSiteRow(
  workspace: Pick<Workspace, "id" | "name" | "slug" | "logoUrl">,
  now: string
): SiteRow {
  return {
    id: `site_${workspace.id}`,
    workspaceId: workspace.id,
    subdomain: workspace.slug,
    brand: {
      name: workspace.name,
      logoUrl: workspace.logoUrl,
      faviconUrl: null,
      primaryColor: DEFAULT_SITE_COLOR,
    },
    defaultFormId: null,
    seo: { title: "", description: "", ogImageUrl: null },
    legal: { kvkkUrl: "", privacyUrl: "", cookieUrl: "" },
    updatedAt: now,
  }
}

/**
 * Acme starts without a default form (the Faz 5 simulation picks one);
 * Marmara's site shows its English quote form at `/`.
 */
export function seedSites(workspaces: readonly Workspace[]): SiteRow[] {
  const now = MOCK_REFERENCE_DATE.toISOString()
  return workspaces.map((workspace) => {
    const row = createSiteRow(workspace, now)
    if (workspace.id === WORKSPACE_IDS.acme) {
      row.seo = {
        title: "Acme Lojistik — Navlun teklifi",
        description: "Deniz, hava ve kara yolu taşımacılığı için hızlı teklif.",
        ogImageUrl: null,
      }
      row.legal = {
        kvkkUrl: "https://acmelojistik.com/kvkk",
        privacyUrl: "https://acmelojistik.com/gizlilik",
        cookieUrl: "",
      }
    }
    if (workspace.id === WORKSPACE_IDS.marmara) {
      row.defaultFormId = "form_marmara_quote"
      row.brand.primaryColor = "#1d4ed8"
    }
    return row
  })
}
