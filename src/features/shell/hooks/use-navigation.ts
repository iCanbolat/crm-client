import { useTranslation } from "react-i18next"

import { useSession } from "@/features/auth"
import { useActiveModules } from "@/features/workspace"
import { getCurrentLanguage } from "@/lib/i18n"

import { buildNavigation } from "../lib/navigation"

export function useNavigation() {
  const { t } = useTranslation("shell")
  const modules = useActiveModules()
  const { subject } = useSession()

  return buildNavigation({
    modules,
    subject,
    language: getCurrentLanguage(),
    translate: (key) => t(key),
  })
}
