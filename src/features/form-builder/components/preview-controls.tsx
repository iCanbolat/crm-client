import { MonitorIcon, SmartphoneIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { FormDevice } from "@/features/form-renderer"
import type { Language } from "@/lib/i18n"

/** Device (desktop / mobile) and language switches of form previews. */
export function PreviewControls({
  device,
  onDeviceChange,
  language,
  languages,
  onLanguageChange,
}: {
  device: FormDevice
  onDeviceChange: (device: FormDevice) => void
  language: Language
  languages: readonly Language[]
  onLanguageChange: (language: Language) => void
}) {
  const { t } = useTranslation("forms")
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        aria-label={t("preview.device")}
        value={[device]}
        onValueChange={(value) => {
          const next = value[0] as FormDevice | undefined
          if (next) onDeviceChange(next)
        }}
      >
        <ToggleGroupItem value="desktop" aria-label={t("preview.desktop")}>
          <MonitorIcon />
        </ToggleGroupItem>
        <ToggleGroupItem value="mobile" aria-label={t("preview.mobile")}>
          <SmartphoneIcon />
        </ToggleGroupItem>
      </ToggleGroup>
      {languages.length > 1 ? (
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          aria-label={t("preview.language")}
          value={[language]}
          onValueChange={(value) => {
            const next = value[0] as Language | undefined
            if (next) onLanguageChange(next)
          }}
        >
          {languages.map((item) => (
            <ToggleGroupItem key={item} value={item} className="px-3 uppercase">
              {item}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}
    </div>
  )
}
