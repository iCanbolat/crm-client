import { CheckIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getErrorMessage } from "@/lib/api"
import { getCurrentLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import {
  useCompleteOnboarding,
  useSaveOnboardingProgress,
} from "../../api/workspace.mutations"
import {
  completeOnboardingInputSchema,
  ONBOARDING_STEPS,
  type CompanyInfo,
  type OnboardingDraft,
} from "../../api/workspace.schemas"
import { useWorkspace } from "../../hooks/use-workspace"
import { getResumeStep } from "../../lib/onboarding"
import { COMPANY_DEFAULTS } from "../../lib/reference"
import { CompanyStep } from "./company-step"
import { ModulesStep } from "./modules-step"
import { ReviewStep } from "./review-step"
import { TeamStep } from "./team-step"

interface OnboardingWizardProps {
  onCompleted: () => void | Promise<void>
}

/**
 * Company → module → team → review. Every "next" persists the draft and the
 * step on the server, so an interrupted onboarding resumes where it stopped.
 */
export function OnboardingWizard({ onCompleted }: OnboardingWizardProps) {
  const { t } = useTranslation("workspace")
  const workspace = useWorkspace()
  const [step, setStep] = useState(() => getResumeStep(workspace.onboarding))
  const [draft, setDraft] = useState<OnboardingDraft>(
    workspace.onboarding.draft
  )
  const saveProgress = useSaveOnboardingProgress()
  const complete = useCompleteOnboarding()

  const stepKey = ONBOARDING_STEPS[step] ?? "company"

  async function advance(patch: OnboardingDraft) {
    const nextDraft = { ...draft, ...patch }
    const nextStep = step + 1
    await saveProgress.mutateAsync({ step: nextStep, draft: nextDraft })
    setDraft(nextDraft)
    setStep(nextStep)
  }

  const goBack = () => setStep((current) => Math.max(0, current - 1))

  const companyDefaults: CompanyInfo = draft.company ?? {
    name: workspace.name,
    logoUrl: workspace.logoUrl,
    ...COMPANY_DEFAULTS,
    language: getCurrentLanguage(),
  }

  const review = completeOnboardingInputSchema.safeParse({
    company: draft.company,
    modules: draft.modules,
    invites: draft.invites ?? [],
  })

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t("onboarding.progress")}>
        <ol className="grid grid-cols-4 gap-2">
          {ONBOARDING_STEPS.map((key, index) => {
            const done = index < step
            const current = index === step
            return (
              <li
                key={key}
                aria-current={current ? "step" : undefined}
                className="flex flex-col gap-2"
              >
                <span
                  className={cn(
                    "h-1.5 rounded-full bg-muted",
                    (done || current) && "bg-primary"
                  )}
                />
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs text-muted-foreground",
                    current && "font-medium text-foreground"
                  )}
                >
                  {done ? <CheckIcon className="size-3" aria-hidden /> : null}
                  <span className="truncate">{t(`steps.${key}.short`)}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </nav>

      <Card>
        <CardHeader>
          <p className="text-xs font-medium text-muted-foreground">
            {t("onboarding.stepOf", {
              step: step + 1,
              total: ONBOARDING_STEPS.length,
            })}
          </p>
          <CardTitle>
            <h2 className="font-heading text-xl">
              {t(`steps.${stepKey}.title`)}
            </h2>
          </CardTitle>
          <CardDescription>{t(`steps.${stepKey}.description`)}</CardDescription>
        </CardHeader>
        <CardContent>
          {stepKey === "company" ? (
            <CompanyStep
              defaultValues={companyDefaults}
              onSubmit={(company) => advance({ company })}
            />
          ) : null}
          {stepKey === "modules" ? (
            <ModulesStep
              defaultValues={{ modules: draft.modules ?? [] }}
              onSubmit={({ modules }) => advance({ modules })}
              onBack={goBack}
            />
          ) : null}
          {stepKey === "team" ? (
            <TeamStep
              defaultValues={{ invites: draft.invites ?? [] }}
              onSubmit={({ invites }) => advance({ invites })}
              onBack={goBack}
            />
          ) : null}
          {stepKey === "done" && review.success ? (
            <ReviewStep
              values={review.data}
              isSubmitting={complete.isPending}
              error={
                complete.error ? getErrorMessage(complete.error) : undefined
              }
              onBack={goBack}
              onSubmit={() =>
                complete.mutate(review.data, {
                  onSuccess: () => void onCompleted(),
                })
              }
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
