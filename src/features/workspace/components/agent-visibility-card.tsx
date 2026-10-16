import { useTranslation } from "react-i18next"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { AGENT_VISIBILITIES, type AgentVisibility } from "@/lib/rbac"
import { cn } from "@/lib/utils"

import { useUpdateWorkspaceSettings } from "../api/workspace.mutations"
import { useRoleLabels } from "../hooks/use-role-label"
import { useWorkspace } from "../hooks/use-workspace"

/**
 * Which records agents see (Faz 10): their own + unassigned ones, or all.
 * Rendered for roles that manage members.
 */
export function AgentVisibilityCard() {
  const { t } = useTranslation("workspace")
  const workspace = useWorkspace()
  const roles = useRoleLabels()
  const mutation = useUpdateWorkspaceSettings()
  const agent = roles.label("agent")

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 id="agent-visibility-title">{t("visibility.title")}</h2>
        </CardTitle>
        <CardDescription>
          {t("visibility.description", { role: agent })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          aria-labelledby="agent-visibility-title"
          value={workspace.agentVisibility}
          disabled={mutation.isPending}
          onValueChange={(value) =>
            mutation.mutate({ agentVisibility: value as AgentVisibility })
          }
        >
          {AGENT_VISIBILITIES.map((value) => {
            const titleId = `agent-visibility-${value}`
            return (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-3xl border p-4 transition-colors hover:bg-muted/50",
                  workspace.agentVisibility === value &&
                    "border-primary bg-primary/5"
                )}
              >
                <RadioGroupItem value={value} aria-labelledby={titleId} />
                <span className="flex flex-col gap-0.5">
                  <span id={titleId} className="text-sm font-medium">
                    {t(`visibility.${value}.title`)}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      // Muted grey fails AA contrast on the tinted card.
                      workspace.agentVisibility === value
                        ? "text-foreground/75"
                        : "text-muted-foreground"
                    )}
                  >
                    {t(`visibility.${value}.description`, { role: agent })}
                  </span>
                </span>
              </label>
            )
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  )
}
