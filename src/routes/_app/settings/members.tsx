import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/common/page-header"
import { requirePermission } from "@/features/auth"
import { MembersPanel, workspaceQueries } from "@/features/workspace"

export const Route = createFileRoute("/_app/settings/members")({
  staticData: { crumb: "members" },
  beforeLoad: ({ context }) =>
    requirePermission(context.auth, "read", "member"),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueries.members()),
      context.queryClient.ensureQueryData(workspaceQueries.invites()),
    ]),
  component: MembersPage,
})

function MembersPage() {
  const { t } = useTranslation("shell")

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("nav.members")} />
      <MembersPanel />
    </div>
  )
}
