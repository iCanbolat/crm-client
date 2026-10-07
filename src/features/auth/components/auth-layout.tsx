import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { LanguageSwitcher } from "@/components/common/language-switcher"
import { ThemeToggle } from "@/components/common/theme-toggle"

/** Centered, chrome-less layout of the sign-in pages. */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="flex h-14 items-center justify-between px-4">
        <span className="flex items-center gap-2 font-heading font-semibold whitespace-nowrap">
          <img src="/favicon.svg" alt="" className="size-7" />
          {t("appName")}
        </span>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pt-4 pb-24">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
