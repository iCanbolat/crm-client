import { useSuspenseQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { getErrorMessage } from "@/lib/api"

import { useUpdateNotificationPreferencesMutation } from "../api/notifications.mutations"
import { notificationQueries } from "../api/notifications.queries"
import { NOTIFICATION_TYPES } from "../api/notifications.schemas"

/** Per-user switches of the notification types (B7.2). */
export function NotificationPreferencesPage() {
  const { t } = useTranslation("notifications")
  const { data } = useSuspenseQuery(notificationQueries.preferences())
  const update = useUpdateNotificationPreferencesMutation()

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={t("preferences.title")}
        description={t("preferences.description")}
      />
      <Card>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {NOTIFICATION_TYPES.map((type) => {
              const label = t(`types.${type}.title` as "types.task.due.title", {
                rule: t("title"),
              })
              const id = `notification-pref-${type.replace(".", "-")}`
              return (
                <li
                  key={type}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span id={id} className="text-sm font-medium">
                      {label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t(
                        `preferences.types.${type}` as "preferences.types.task.due"
                      )}
                    </span>
                  </div>
                  <Switch
                    aria-label={t("preferences.toggle", { label })}
                    checked={data.types[type]}
                    disabled={update.isPending}
                    onCheckedChange={(checked) =>
                      update.mutate(
                        { types: { [type]: checked } },
                        {
                          onSuccess: () =>
                            toast.success(t("preferences.saved")),
                          onError: (error) =>
                            toast.error(getErrorMessage(error)),
                        }
                      )
                    }
                  />
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
