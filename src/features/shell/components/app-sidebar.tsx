import { Link, useLocation } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { WorkspaceSwitcher } from "@/features/workspace"

import { useNavigation } from "../hooks/use-navigation"
import { isActiveLink } from "../lib/navigation"

export function AppSidebar() {
  const { t } = useTranslation("shell")
  const groups = useNavigation()
  const pathname = useLocation({ select: (location) => location.pathname })
  const search = useLocation({
    select: (location) => location.search as Record<string, unknown>,
  })
  const links = groups.flatMap((group) => group.items)
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <Sidebar collapsible="icon" aria-label={t("sidebar.label")}>
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={t("sidebar.navigation")} className="contents">
          {groups.map((group) => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={isActiveLink(item, pathname, search, links)}
                          tooltip={item.title}
                          render={
                            <Link
                              to={item.to}
                              params={item.params}
                              search={item.search}
                              onClick={() => {
                                if (isMobile) setOpenMobile(false)
                              }}
                            />
                          }
                        >
                          <Icon aria-hidden />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
