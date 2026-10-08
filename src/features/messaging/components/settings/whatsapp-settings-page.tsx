import { useSuspenseQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/common/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { messagingQueries } from "../../api/messaging.queries"
import { ConnectionPanel } from "./connection-panel"
import { NotificationsPanel } from "./notifications-panel"
import { TemplatesPanel } from "./templates-panel"

export const WHATSAPP_SETTINGS_TABS = [
  "connection",
  "templates",
  "notifications",
] as const
export type WhatsappSettingsTab = (typeof WHATSAPP_SETTINGS_TABS)[number]

interface WhatsappSettingsPageProps {
  tab: WhatsappSettingsTab
  onTabChange: (tab: WhatsappSettingsTab) => void
}

/** Ayarlar → WhatsApp (Faz 6). */
export function WhatsappSettingsPage({
  tab,
  onTabChange,
}: WhatsappSettingsPageProps) {
  const { t } = useTranslation("messaging")
  const { data: channel } = useSuspenseQuery(messagingQueries.channel())
  const connected = !!channel.connection

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
      />
      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as WhatsappSettingsTab)}
      >
        <TabsList>
          {WHATSAPP_SETTINGS_TABS.map((item) => (
            <TabsTrigger key={item} value={item}>
              {t(`settings.tabs.${item}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="connection" className="pt-4">
          <ConnectionPanel />
        </TabsContent>
        <TabsContent value="templates" className="pt-4">
          <TemplatesPanel connected={connected} />
        </TabsContent>
        <TabsContent value="notifications" className="pt-4">
          <NotificationsPanel connected={connected} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
