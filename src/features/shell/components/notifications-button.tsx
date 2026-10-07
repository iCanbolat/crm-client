import { BellIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

/** Placeholder until the notification center lands (Faz 6 / B6.2). */
export function NotificationsButton() {
  const { t } = useTranslation("shell")

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("notifications.label")}
          />
        }
      >
        <BellIcon />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <PopoverHeader>
          <PopoverTitle>{t("notifications.label")}</PopoverTitle>
          <PopoverDescription>{t("notifications.empty")}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}
