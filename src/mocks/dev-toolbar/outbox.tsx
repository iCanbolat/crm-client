import { Link } from "@tanstack/react-router"
import { MailIcon } from "lucide-react"
import { useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"

import { Label } from "@/components/ui/label"

import { db, onDbChange } from "../db"

const LIMIT = 5

// `snapshot()` copies; keep one copy per DB change for useSyncExternalStore.
let cache: ReturnType<typeof db.outbox.snapshot> | null = null
onDbChange(() => {
  cache = null
})
const getSnapshot = () => (cache ??= db.outbox.snapshot())

/** Latest e-mails of the mock backend: verification codes, invitations. */
function useOutbox() {
  return useSyncExternalStore(onDbChange, getSnapshot)
}

export function Outbox({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation("dev")
  const emails = [...useOutbox()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, LIMIT)

  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-2">
        <MailIcon className="size-4" aria-hidden />
        {t("outbox.title")}
      </Label>
      {emails.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("outbox.empty")}</p>
      ) : (
        <ul aria-label={t("outbox.title")} className="flex flex-col gap-2">
          {emails.map((email) => (
            <li
              key={email.id}
              className="flex flex-col gap-0.5 rounded-2xl border px-3 py-2 text-xs"
            >
              <span className="truncate text-muted-foreground">{email.to}</span>
              <span className="font-medium">{email.subject}</span>
              {email.code ? (
                <span className="font-mono text-sm tracking-widest">
                  {email.code}
                </span>
              ) : null}
              {email.link && email.kind === "invite" ? (
                <Link
                  to={email.link}
                  onClick={onNavigate}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {t("outbox.openLink")}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
