import { useNavigate } from "@tanstack/react-router"
import {
  CheckIcon,
  CopyPlusIcon,
  PrinterIcon,
  SendIcon,
  XIcon,
} from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { usePermission } from "@/features/auth"

import { useQuoteStatus, useReviseQuote } from "../../api/quotes.mutations"
import type { Quote } from "../../api/quotes.schemas"
import { canRevise, canTransition } from "../../lib/quote"

interface QuoteStatusActionsProps {
  quote: Quote
  /** Unsaved builder changes: status actions wait until they are saved. */
  dirty: boolean
  defaultEmail?: string | null
}

/** Status flow of the latest version (B3.4): send → accept / reject, revise. */
export function QuoteStatusActions({
  quote,
  dirty,
  defaultEmail,
}: QuoteStatusActionsProps) {
  const { t } = useTranslation(["forwarding", "common"])
  const navigate = useNavigate()
  const id = useId()
  const status = useQuoteStatus(quote.id)
  const revise = useReviseQuote(quote.id)
  const canUpdate = usePermission("update", "record", {
    ownerId: quote.ownerId,
  })
  const [sending, setSending] = useState(false)
  const [confirm, setConfirm] = useState<"accept" | "reject" | null>(null)
  const [to, setTo] = useState(defaultEmail ?? "")
  const [message, setMessage] = useState(() => t("quote.emailDefault"))
  const latest = quote.versions.at(-1)?.version === quote.version

  if (!canUpdate) {
    return <PrintButton quoteId={quote.id} version={quote.version} />
  }

  async function run(action: "accept" | "reject") {
    const result = await status.mutateAsync({ action })
    setConfirm(null)
    if (result.shipmentId) {
      const shipmentId = result.shipmentId
      toast.success(t("quote.shipmentCreated"), {
        action: {
          label: t("quote.openShipment"),
          onClick: () =>
            void navigate({
              to: "/o/$objectKey/$recordId",
              params: { objectKey: "shipment", recordId: shipmentId },
            }),
        },
      })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {latest && canTransition(quote.status, "sent") ? (
        <Button disabled={dirty} onClick={() => setSending(true)}>
          <SendIcon data-icon="inline-start" />
          {t("quote.send")}
        </Button>
      ) : null}
      {latest && canTransition(quote.status, "accepted") ? (
        <Button onClick={() => setConfirm("accept")}>
          <CheckIcon data-icon="inline-start" />
          {t("quote.accept")}
        </Button>
      ) : null}
      {latest && canTransition(quote.status, "rejected") ? (
        <Button variant="outline" onClick={() => setConfirm("reject")}>
          <XIcon data-icon="inline-start" />
          {t("quote.reject")}
        </Button>
      ) : null}
      {latest && canRevise(quote.status) ? (
        <Button
          variant="outline"
          disabled={revise.isPending}
          onClick={async () => {
            const next = await revise.mutateAsync()
            await navigate({
              to: "/quotes/$quoteId",
              params: { quoteId: next.id },
              search: {},
            })
          }}
        >
          <CopyPlusIcon data-icon="inline-start" />
          {t("quote.revise")}
        </Button>
      ) : null}
      <PrintButton quoteId={quote.id} version={quote.version} />

      <Dialog open={sending} onOpenChange={setSending}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault()
              await status
                .mutateAsync({
                  action: "send",
                  email: to ? { to, message } : undefined,
                })
                .then(() => setSending(false))
                .catch(() => undefined)
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("quote.sendTitle")}</DialogTitle>
              <DialogDescription>
                {t("quote.sendDescription")}
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor={`${id}-to`}>{t("quote.emailTo")}</FieldLabel>
              <Input
                id={`${id}-to`}
                type="email"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-message`}>
                {t("quote.emailMessage")}
              </FieldLabel>
              <Textarea
                id={`${id}-message`}
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSending(false)}
              >
                {t("common:actions.cancel")}
              </Button>
              <Button type="submit" disabled={status.isPending}>
                <SendIcon data-icon="inline-start" />
                {t("quote.send")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={t(
          confirm === "reject" ? "quote.rejectTitle" : "quote.acceptTitle"
        )}
        description={t(
          confirm === "reject"
            ? "quote.rejectDescription"
            : "quote.acceptDescription"
        )}
        confirmLabel={t(confirm === "reject" ? "quote.reject" : "quote.accept")}
        variant={confirm === "reject" ? "destructive" : "default"}
        isPending={status.isPending}
        onConfirm={() => run(confirm ?? "accept")}
      />
    </div>
  )
}

function PrintButton({
  quoteId,
  version,
}: {
  quoteId: string
  version: number
}) {
  const { t } = useTranslation("forwarding")
  const navigate = useNavigate()
  return (
    <Button
      variant="ghost"
      onClick={() =>
        void navigate({
          to: "/quotes/$quoteId/print",
          params: { quoteId },
          search: { version },
        })
      }
    >
      <PrinterIcon data-icon="inline-start" />
      {t("quote.print")}
    </Button>
  )
}
