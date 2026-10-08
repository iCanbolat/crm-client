import { useQuery } from "@tanstack/react-query"
import { CheckIcon, CopyIcon, TriangleAlertIcon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { getSiteOrigin, siteQueries } from "@/features/sites"
import { useWorkspace } from "@/features/workspace"

import type { FormSummary } from "../../api/forms.schemas"
import {
  getHostedFormUrl,
  getIframeSnippet,
  getScriptSnippet,
} from "../../lib/embed"

const EMBED_KINDS = ["link", "iframe", "script"] as const
type EmbedKind = (typeof EMBED_KINDS)[number]

function CodeBlock({ kind, code }: { kind: EmbedKind; code: string }) {
  const { t } = useTranslation("forms")
  const id = useId()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success(t("toast.copied"))
    } catch {
      // No clipboard access: select the code for a manual copy.
      const area = document.getElementById(id) as HTMLTextAreaElement | null
      area?.select()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t(`embed.${kind}.label`)}</Label>
      <Textarea
        id={id}
        readOnly
        value={code}
        rows={kind === "script" ? 10 : kind === "iframe" ? 4 : 1}
        spellCheck={false}
        className="font-mono text-xs"
        onFocus={(event) => event.currentTarget.select()}
      />
      <p className="text-sm text-muted-foreground">{t(`embed.${kind}.help`)}</p>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => void copy()}
      >
        {copied ? (
          <CheckIcon data-icon="inline-start" />
        ) : (
          <CopyIcon data-icon="inline-start" />
        )}
        {t("embed.copy")}
      </Button>
    </div>
  )
}

/** Hosted link, iframe and JS embed code of a form (B4.7). */
export function EmbedOptions({
  form,
}: {
  form: Pick<FormSummary, "name" | "slug" | "status">
}) {
  const { t } = useTranslation("forms")
  // Until the site loads, the platform subdomain (= workspace slug).
  const workspace = useWorkspace()
  const site = useQuery(siteQueries.current())
  const target = {
    origin: getSiteOrigin(
      site.data ?? { subdomain: workspace.slug, primaryDomain: null }
    ),
    slug: form.slug,
    title: form.name,
  }
  const codes: Record<EmbedKind, string> = {
    link: getHostedFormUrl(target),
    iframe: getIframeSnippet(target),
    script: getScriptSnippet(target),
  }

  return (
    <div className="flex flex-col gap-3">
      {form.status !== "published" ? (
        <p className="flex items-start gap-1.5 text-sm text-amber-800 dark:text-amber-300">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("embed.notPublished")}
        </p>
      ) : null}
      <Tabs defaultValue="link">
        <TabsList aria-label={t("embed.kinds")}>
          {EMBED_KINDS.map((kind) => (
            <TabsTrigger key={kind} value={kind}>
              {t(`embed.${kind}.tab`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {EMBED_KINDS.map((kind) => (
          <TabsContent key={kind} value={kind} className="pt-2">
            <CodeBlock kind={kind} code={codes[kind]} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
