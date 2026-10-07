import { useSuspenseQuery } from "@tanstack/react-query"
import { MailIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Can } from "@/features/auth"
import { formatDate } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"

import { workspaceQueries } from "../api/workspace.queries"
import { InviteMemberDialog } from "./invite-member-dialog"

export function MembersPanel() {
  const { t } = useTranslation("workspace")
  const language = getCurrentLanguage()
  const { data: members } = useSuspenseQuery(workspaceQueries.members())
  const { data: invites } = useSuspenseQuery(workspaceQueries.invites())
  const pendingInvites = invites.data.filter(
    (invite) => invite.status === "pending"
  )

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>
              <h2>{t("members.title")}</h2>
            </CardTitle>
            <CardDescription>
              {t("members.count", { count: members.data.length })}
            </CardDescription>
          </div>
          <Can action="manage" resource="member">
            <InviteMemberDialog />
          </Can>
        </CardHeader>
        <CardContent>
          <ul
            aria-label={t("members.title")}
            className="divide-y rounded-3xl border"
          >
            {members.data.map((member) => (
              <li
                key={member.userId}
                className="flex items-center gap-3 px-4 py-3"
              >
                <UserAvatar name={member.name} src={member.avatarUrl} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{member.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </span>
                </div>
                <Badge
                  variant={member.role === "owner" ? "default" : "secondary"}
                >
                  {t(`roles.${member.role}`)}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("members.invitesTitle")}</h2>
          </CardTitle>
          <CardDescription>{t("members.invitesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("members.noInvites")}
            </p>
          ) : (
            <ul
              aria-label={t("members.invitesTitle")}
              className="divide-y rounded-3xl border"
            >
              {pendingInvites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <MailIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {invite.email}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {formatDate(invite.invitedAt, language)}
                  </span>
                  <Badge variant="outline">{t(`roles.${invite.role}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
