import { useQueryClient } from "@tanstack/react-query"
import { DatabaseZapIcon, RotateCcwIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { signIn } from "@/features/auth"

import { resetDb } from "../db"
import { clearPersistedDb, savePersistedDb } from "../db/persistence"
import { DEMO_PASSWORD, SEED_USERS, type SeedUserKey } from "../db/seed"
import {
  isScenario,
  SCENARIOS,
  setScenarioState,
  useScenarioState,
} from "../scenarios/scenario-store"
import { WhatsappSimulator } from "./whatsapp-simulator"

interface DevToolbarProps {
  /** Called after a quick sign-in so the app can route into the shell. */
  onSignedIn?: () => void | Promise<void>
}

/** Floating MSW control panel — rendered only when mocking is enabled. */
export default function DevToolbar({ onSignedIn }: DevToolbarProps) {
  const { t } = useTranslation(["dev", "workspace"])
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [quickUser, setQuickUser] = useState<SeedUserKey | null>(null)
  const scenario = useScenarioState((state) => state.scenario)
  const persist = useScenarioState((state) => state.persist)

  const scenarioItems = SCENARIOS.map((value) => ({
    value,
    label: t(`scenarios.${value}`),
  }))
  const userItems = (Object.keys(SEED_USERS) as SeedUserKey[]).map((key) => ({
    value: key,
    label: `${SEED_USERS[key].name} · ${SEED_USERS[key].email}`,
  }))

  async function quickSignIn(key: SeedUserKey) {
    setQuickUser(key)
    const user = SEED_USERS[key]
    try {
      await signIn(queryClient, { email: user.email, password: DEMO_PASSWORD })
      toast.success(t("quickLoginDone", { name: user.name }))
      setOpen(false)
      await onSignedIn?.()
    } finally {
      setQuickUser(null)
    }
  }

  // resetQueries drops cached data so suspense queries refetch and surface
  // the new scenario (errors, empty pages…) immediately.
  const refetchAll = () => queryClient.resetQueries()

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              size="sm"
              variant="secondary"
              data-testid="msw-badge"
              className="shadow-lg ring-1 ring-foreground/10"
            />
          }
        >
          <span
            aria-hidden
            className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20"
          />
          {t("badge")} · {t(`scenarios.${scenario}`)}
        </PopoverTrigger>
        <PopoverContent side="top" sideOffset={8} className="w-80">
          <PopoverHeader>
            <PopoverTitle className="flex items-center gap-2">
              <DatabaseZapIcon className="size-4" aria-hidden />
              {t("title")}
            </PopoverTitle>
            <PopoverDescription>{t("description")}</PopoverDescription>
          </PopoverHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="msw-scenario">{t("scenario")}</Label>
            <Select
              items={scenarioItems}
              value={scenario}
              onValueChange={(value) => {
                if (!isScenario(value)) return
                setScenarioState({ scenario: value })
                void refetchAll()
              }}
            >
              <SelectTrigger id="msw-scenario" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scenarioItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="msw-quick-login">{t("quickLogin")}</Label>
            <Select
              items={userItems}
              value={quickUser}
              onValueChange={(value) => {
                if (typeof value === "string" && value in SEED_USERS) {
                  void quickSignIn(value as SeedUserKey)
                }
              }}
            >
              <SelectTrigger id="msw-quick-login" className="w-full">
                <SelectValue placeholder={t("quickLoginPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {userItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("quickLoginHint")}
            </p>
          </div>

          <Separator />

          <WhatsappSimulator />

          <Separator />

          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="msw-persist">{t("persist")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("persistHint")}
              </p>
            </div>
            <Switch
              id="msw-persist"
              checked={persist}
              onCheckedChange={(checked) => {
                setScenarioState({ persist: checked })
                if (checked) savePersistedDb()
                else clearPersistedDb()
              }}
            />
          </div>

          <Button
            variant="outline"
            onClick={() => {
              clearPersistedDb()
              resetDb()
              void refetchAll()
              toast.success(t("resetDone"))
            }}
          >
            <RotateCcwIcon data-icon="inline-start" />
            {t("resetDb")}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
