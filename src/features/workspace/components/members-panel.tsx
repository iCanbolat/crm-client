import { useSuspenseQuery } from "@tanstack/react-query"
import {
  CopyIcon,
  MailIcon,
  SendIcon,
  UserMinusIcon,
  XIcon,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Can, usePermission, useSession } from "@/features/auth"
import { formatDate } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"

import {
  useRemoveMember,
  useResendInvite,
  useRevokeInvite,
  useUpdateMemberRole,
} from "../api/workspace.mutations"
import { workspaceQueries } from "../api/workspace.queries"
import {
  INVITABLE_ROLES,
  type InvitableRole,
  type Member,
} from "../api/workspace.schemas"
import { useRoleLabels } from "../hooks/use-role-label"
import { AgentVisibilityCard } from "./agent-visibility-card"
import { InviteMemberDialog } from "./invite-member-dialog"

/** Settings → Team: members, roles, invitations (B1.4, Faz 10). */
export function MembersPanel() {
  const { t } = useTranslation("workspace")
  const roles = useRoleLabels()
  const language = getCurrentLanguage()
  const { user } = useSession()
  const canManage = usePermission("manage", "member")
  const { data: members } = useSuspenseQuery(workspaceQueries.members())
  const { data: invites } = useSuspenseQuery(workspaceQueries.invites())
  const pendingInvites = invites.data.filter(
    (invite) => invite.status === "pending"
  )
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()
  const resendInvite = useResendInvite()
  const revokeInvite = useRevokeInvite()
  const [removing, setRemoving] = useState<Member | null>(null)

  const roleItems = INVITABLE_ROLES.map((role) => ({
    value: role,
    label: roles.label(role),
  }))

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(new URL(link, location.origin).href)
    toast.success(t("members.linkCopied"))
  }

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
            {members.data.map((member) => {
              const self = member.userId === user.id
              // Never the owner, never oneself (same rule as the API).
              const editable = canManage && member.role !== "owner" && !self
              return (
                <li
                  key={member.userId}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <UserAvatar name={member.name} src={member.avatarUrl} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {member.name}
                      {self ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          ({t("members.you")})
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </div>
                  {editable ? (
                    <div className="flex items-center gap-2">
                      <Select
                        items={roleItems}
                        value={member.role}
                        onValueChange={(value) => {
                          if (value && value !== member.role) {
                            updateRole.mutate({
                              userId: member.userId,
                              role: value as InvitableRole,
                            })
                          }
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          aria-label={t("members.changeRole", {
                            name: member.name,
                          })}
                          className="w-40"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("members.removeLabel", {
                          name: member.name,
                        })}
                        onClick={() => setRemoving(member)}
                      >
                        <UserMinusIcon />
                      </Button>
                    </div>
                  ) : (
                    <Badge
                      variant={
                        member.role === "owner" ? "default" : "secondary"
                      }
                    >
                      {roles.label(member.role)}
                    </Badge>
                  )}
                </li>
              )
            })}
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
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <MailIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm">{invite.email}</span>
                    {invite.expiresAt ? (
                      <span className="text-xs text-muted-foreground">
                        {t("members.expires", {
                          date: formatDate(invite.expiresAt, language),
                        })}
                      </span>
                    ) : null}
                  </div>
                  <Badge variant="outline">{roles.label(invite.role)}</Badge>
                  {canManage ? (
                    <div className="flex items-center gap-1">
                      {invite.link ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("members.copyLinkLabel", {
                            email: invite.email,
                          })}
                          onClick={() => void copyLink(invite.link!)}
                        >
                          <CopyIcon />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("members.resendLabel", {
                          email: invite.email,
                        })}
                        disabled={resendInvite.isPending}
                        onClick={() => resendInvite.mutate(invite.id)}
                      >
                        <SendIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("members.revokeLabel", {
                          email: invite.email,
                        })}
                        disabled={revokeInvite.isPending}
                        onClick={() => revokeInvite.mutate(invite.id)}
                      >
                        <XIcon />
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Can action="manage" resource="member">
        <AgentVisibilityCard />
      </Can>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title={t("members.removeTitle", { name: removing?.name ?? "" })}
        description={t("members.removeDescription")}
        confirmLabel={t("members.remove")}
        variant="destructive"
        isPending={removeMember.isPending}
        onConfirm={async () => {
          if (!removing) return
          await removeMember.mutateAsync(removing.userId)
          setRemoving(null)
        }}
      />
    </div>
  )
}
