import { RefreshCcwDotIcon } from "lucide-react"
import { createContext, use, useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import type { CrmRecord } from "@/engine/metadata"
import { usePermission } from "@/features/auth"
import { StageInterceptorsProvider } from "@/features/records"

import { ConvertLeadDialog } from "./convert-lead-dialog"

const LeadConversionContext = createContext<(lead: CrmRecord) => void>(() => {})

/**
 * Hosts the conversion dialog for the whole app: the record header button
 * and moving a lead to "converted" (kanban, stepper) both open it.
 */
export function LeadConversionProvider({ children }: { children: ReactNode }) {
  const [lead, setLead] = useState<CrmRecord | null>(null)
  const interceptors = useMemo(() => ({ lead: { converted: setLead } }), [])

  return (
    <LeadConversionContext value={setLead}>
      <StageInterceptorsProvider value={interceptors}>
        {children}
      </StageInterceptorsProvider>
      <ConvertLeadDialog
        lead={lead}
        onOpenChange={(open) => {
          if (!open) setLead(null)
        }}
      />
    </LeadConversionContext>
  )
}

/** "Convert" action of a lead's record page. */
export function ConvertLeadButton({ lead }: { lead: CrmRecord }) {
  const { t } = useTranslation("leads")
  const open = use(LeadConversionContext)
  const canUpdate = usePermission("update", "record", {
    ownerId: lead.values.ownerId as string | undefined,
  })
  const canCreate = usePermission("create", "record")
  if (lead.values.stage === "converted" || !canUpdate || !canCreate) return null

  return (
    <Button onClick={() => open(lead)}>
      <RefreshCcwDotIcon data-icon="inline-start" />
      {t("convert.action")}
    </Button>
  )
}
