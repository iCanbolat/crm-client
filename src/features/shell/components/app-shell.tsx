import { SearchIcon } from "lucide-react"
import {
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import { useTranslation } from "react-i18next"

import { LanguageSwitcher } from "@/components/common/language-switcher"
import { ThemeToggle } from "@/components/common/theme-toggle"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useSignOut } from "@/features/auth"

import { setSidebarOpen, useUiPreferences } from "../lib/ui-preferences"
import { AppSidebar } from "./app-sidebar"
import { Breadcrumbs } from "./breadcrumbs"
import { CommandPalette } from "./command-palette"
import { NotificationsButton } from "./notifications-button"
import { UserMenu } from "./user-menu"

/** ⌘K / Ctrl+K toggles the command palette from anywhere in the shell. */
function useCommandPaletteShortcut(setOpen: Dispatch<SetStateAction<boolean>>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [setOpen])
}

/** Authenticated, module-aware layout: sidebar + header + content. */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation("shell")
  const sidebarOpen = useUiPreferences((state) => state.sidebarOpen)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { signOut } = useSignOut()

  useCommandPaletteShortcut(setPaletteOpen)

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar />
      {/* min-w-0: wide tables scroll inside the page, not the page itself. */}
      <SidebarInset className="min-w-0">
        <header
          data-print-hidden
          className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:px-4"
        >
          <SidebarTrigger aria-label={t("sidebar.toggle")} />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-muted-foreground"
              aria-label={t("command.open")}
              onClick={() => setPaletteOpen(true)}
            >
              <SearchIcon data-icon="inline-start" />
              <span className="hidden lg:inline">{t("command.trigger")}</span>
              <Kbd className="hidden text-foreground sm:inline-flex">⌘K</Kbd>
            </Button>
            <NotificationsButton />
            <LanguageSwitcher />
            <ThemeToggle />
            <UserMenu onSignOut={signOut} />
          </div>
        </header>
        <div className="flex-1 px-4 pt-6 pb-24 md:px-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </div>
      </SidebarInset>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSignOut={signOut}
      />
    </SidebarProvider>
  )
}
