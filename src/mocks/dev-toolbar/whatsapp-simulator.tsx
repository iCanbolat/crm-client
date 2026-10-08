import { useQueryClient } from "@tanstack/react-query"
import { MessageCircleIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toWaId } from "@/engine/messaging"
import { useSessionState } from "@/features/auth"
import { messagingKeys } from "@/features/messaging"

import { apiPath } from "../utils/http"

/**
 * Posts a customer message to the mock webhook in Meta's payload shape
 * (`entry[].changes[].value.messages[]`), as Meta would (Faz 6).
 */
export function WhatsappSimulator() {
  const { t } = useTranslation("dev")
  const queryClient = useQueryClient()
  const workspaceId = useSessionState((state) => state.activeWorkspaceId)
  const [phone, setPhone] = useState("+905301112233")
  const [text, setText] = useState("")
  if (!workspaceId) return null

  async function simulate() {
    const from = toWaId(phone.trim())
    const response = await fetch(apiPath(`/webhooks/whatsapp/${workspaceId}`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "mock-waba",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  contacts: [{ wa_id: from, profile: { name: from } }],
                  messages: [
                    {
                      from,
                      id: `wamid.dev${Date.now()}`,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      type: "text",
                      text: { body: text.trim() },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    })
    if (!response.ok) return
    setText("")
    toast.success(t("whatsappSent"))
    await queryClient.invalidateQueries({ queryKey: messagingKeys.all })
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (/^\+\d{8,15}$/.test(phone.trim()) && text.trim()) void simulate()
      }}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <MessageCircleIcon className="size-4" aria-hidden />
        {t("whatsapp")}
      </p>
      <Label htmlFor="msw-wa-phone">{t("whatsappPhone")}</Label>
      <Input
        id="msw-wa-phone"
        value={phone}
        inputMode="tel"
        onChange={(event) => setPhone(event.target.value)}
      />
      <Label htmlFor="msw-wa-text">{t("whatsappText")}</Label>
      <Input
        id="msw-wa-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <Button type="submit" variant="outline" disabled={!text.trim()}>
        {t("whatsappSend")}
      </Button>
    </form>
  )
}
