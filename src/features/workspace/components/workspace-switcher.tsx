import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { ChevronsUpDownIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { switchWorkspace, useSession } from "@/features/auth"

import { useWorkspace } from "../hooks/use-workspace"
import { WorkspaceAvatar } from "./workspace-avatar"

export function WorkspaceSwitcher() {
  const { t } = useTranslation("workspace")
  const workspace = useWorkspace()
  const { memberships, role } = useSession()
  const queryClient = useQueryClient()
  const router = useRouter()
  const { isMobile, setOpenMobile } = useSidebar()

  async function handleSelect(workspaceId: string) {
    if (workspaceId === workspace.id) return
    setOpenMobile(false)
    switchWorkspace(queryClient, workspaceId)
    await router.navigate({ to: "/dashboard" })
    await router.invalidate()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={t("switcher.trigger", { name: workspace.name })}
                className="data-popup-open:bg-sidebar-accent"
              />
            }
          >
            <WorkspaceAvatar
              name={workspace.name}
              logoUrl={workspace.logoUrl}
            />
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{workspace.name}</span>
              {role ? (
                <span className="truncate text-xs text-muted-foreground">
                  {t(`roles.${role}`)}
                </span>
              ) : null}
            </span>
            <ChevronsUpDownIcon className="ml-auto" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side={isMobile ? "bottom" : "right"}
            className="min-w-60"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("switcher.label")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={workspace.id}
                onValueChange={(value) => void handleSelect(String(value))}
              >
                {memberships.map((membership) => (
                  <DropdownMenuRadioItem
                    key={membership.workspaceId}
                    value={membership.workspaceId}
                    closeOnClick
                  >
                    <WorkspaceAvatar
                      name={membership.workspaceName}
                      logoUrl={membership.workspaceLogoUrl}
                      className="size-6 rounded-lg"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">
                        {membership.workspaceName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {t(`roles.${membership.role}`)}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
