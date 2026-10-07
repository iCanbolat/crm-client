import { LogOutIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { LanguageSwitcher } from "@/components/common/language-switcher"
import { ThemeToggle } from "@/components/common/theme-toggle"
import { Button } from "@/components/ui/button"

interface OnboardingLayoutProps {
  children: ReactNode
  onSignOut: () => void
}

export function OnboardingLayout({
  children,
  onSignOut,
}: OnboardingLayoutProps) {
  const { t } = useTranslation(["workspace", "common"])

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="flex h-14 items-center justify-between gap-2 px-4">
        <span className="flex items-center gap-2 font-heading font-semibold whitespace-nowrap">
          <img src="/favicon.svg" alt="" className="size-7" />
          {t("common:appName")}
        </span>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("onboarding.signOut")}
            onClick={onSignOut}
          >
            <LogOutIcon data-icon="inline-start" />
            <span className="hidden sm:inline">{t("onboarding.signOut")}</span>
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-6 pb-24">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {t("onboarding.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("onboarding.description")}
          </p>
        </div>
        {children}
      </main>
    </div>
  )
}

/** Shown to members whose workspace is not set up by an owner/admin yet. */
export function OnboardingPending() {
  const { t } = useTranslation("workspace")

  return (
    <div
      role="status"
      className="rounded-3xl border border-dashed px-6 py-10 text-center"
    >
      <p className="font-medium">{t("onboarding.pendingTitle")}</p>
      <p className="text-sm text-muted-foreground">
        {t("onboarding.pendingDescription")}
      </p>
    </div>
  )
}
