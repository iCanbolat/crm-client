import { LanguagesIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getCurrentLanguage, supportedLanguages } from "@/lib/i18n"

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const language = getCurrentLanguage()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("language.label")}
            className="gap-1.5 uppercase"
          />
        }
      >
        <LanguagesIcon data-icon="inline-start" />
        {language}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 min-w-0">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={language}
            onValueChange={(value) => void i18n.changeLanguage(value)}
          >
            {supportedLanguages.map((lng) => (
              <DropdownMenuRadioItem
                key={lng}
                value={lng}
                lang={lng}
                closeOnClick
              >
                {t(`language.${lng}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
