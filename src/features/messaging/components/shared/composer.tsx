import { FileTextIcon, SendIcon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { usePermission } from "@/features/auth"
import { getErrorMessage } from "@/lib/api"

import { useSendMessage } from "../../api/messaging.mutations"
import {
  MESSAGE_TEXT_MAX,
  type Conversation,
  type RecordLink,
} from "../../api/messaging.schemas"
import { TemplateSendDialog } from "./template-send-dialog"
import { useWindowState, WindowIndicator } from "./window-indicator"

interface ComposerProps {
  conversation: Conversation
  /** Record page the composer sits on (prefills template variables). */
  record?: RecordLink | null
}

/** Free text inside the 24 h window, templates any time (B6.3/B6.4). */
export function Composer({ conversation, record = null }: ComposerProps) {
  const { t } = useTranslation("messaging")
  const id = useId()
  const canSend = usePermission("create", "conversation")
  const { open } = useWindowState(conversation.lastInboundAt)
  const send = useSendMessage(conversation.id)
  const [text, setText] = useState("")
  const [templateOpen, setTemplateOpen] = useState(false)

  if (!canSend) {
    return (
      <p className="border-t px-4 py-3 text-sm text-muted-foreground">
        {t("composer.readOnly")}
      </p>
    )
  }

  const submit = () => {
    const body = text.trim()
    if (!body || !open || send.isPending) return
    send.mutate({ type: "text", body }, { onSuccess: () => setText("") })
  }

  return (
    <div className="flex flex-col gap-2 border-t p-3">
      <WindowIndicator lastInboundAt={conversation.lastInboundAt} />
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label htmlFor={`${id}-text`} className="sr-only">
          {t("composer.label")}
        </label>
        <Textarea
          id={`${id}-text`}
          value={text}
          rows={2}
          maxLength={MESSAGE_TEXT_MAX}
          disabled={!open}
          aria-describedby={`${id}-hint`}
          placeholder={
            open ? t("composer.placeholder") : t("composer.placeholderClosed")
          }
          className="min-h-10 flex-1 resize-none"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("composer.sendTemplate")}
          onClick={() => setTemplateOpen(true)}
        >
          <FileTextIcon />
        </Button>
        <Button
          type="submit"
          size="icon"
          aria-label={t("composer.send")}
          disabled={!open || !text.trim() || send.isPending}
        >
          <SendIcon />
        </Button>
      </form>
      <p id={`${id}-hint`} className="sr-only">
        {t("composer.hint")}
      </p>
      {send.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(send.error)}
        </p>
      ) : null}
      <TemplateSendDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        conversation={conversation}
        record={record}
        optIn={conversation.optIn}
      />
    </div>
  )
}
