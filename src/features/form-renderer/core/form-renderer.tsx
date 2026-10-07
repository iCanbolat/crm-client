import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2Icon, InfoIcon } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import {
  Controller,
  useForm,
  useWatch,
  type FieldErrors,
  type Resolver,
} from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import {
  clearHiddenAnswers,
  evaluateFormLogic,
  formDefToZod,
  getStepFieldKeys,
  isFieldRequired,
  type FormAnswers,
  type FormContent,
} from "@/engine/forms"
import type { Language } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"
import { cn } from "@/lib/utils"

import { FormFieldView, formInputId } from "./form-field-view"
import { buildInitialAnswers, type FormRuntimeContext } from "./prefill"

export interface FormRendererProps {
  content: FormContent
  language: Language
  /**
   * `preview` (builder) never leaves the page: a redirect URL is announced
   * instead of followed.
   */
  mode?: "live" | "preview"
  context?: FormRuntimeContext
  /** Receives the visible answers; a rejection keeps the form open. */
  onSubmit?: (answers: FormAnswers) => Promise<void> | void
  idPrefix?: string
  className?: string
}

/**
 * Renders a form definition (plan B4.1/B4.4): steps with progress, logic,
 * per-step validation, honeypot and the success state. Shared by the
 * builder preview and the public renderer (Faz 5).
 */
export function FormRenderer({
  content,
  language,
  mode = "live",
  context,
  onSubmit,
  idPrefix,
  className,
}: FormRendererProps) {
  const { t } = useTranslation("renderer", { lng: language })
  const generatedId = useId().replace(/[^a-zA-Z0-9]/g, "")
  const prefix = idPrefix ?? `form-${generatedId}`
  const initialAnswers = useMemo(
    () => buildInitialAnswers(content, context),
    [content, context]
  )
  const resolver = useMemo<Resolver<FormAnswers>>(
    () => (values, resolverContext, options) =>
      (zodResolver(formDefToZod(content, values)) as Resolver<FormAnswers>)(
        values,
        resolverContext,
        options
      ),
    [content]
  )
  const form = useForm<FormAnswers>({
    defaultValues: initialAnswers,
    resolver,
    mode: "onTouched",
    shouldFocusError: false,
  })
  const answers = useWatch({ control: form.control }) as FormAnswers
  const logic = evaluateFormLogic(content, answers)
  const steps = content.steps.filter((step) => !logic.hiddenSteps.has(step.id))

  const [stepIndex, setStepIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const honeypotRef = useRef<HTMLInputElement>(null)
  const stepRef = useRef<HTMLDivElement>(null)
  const moved = useRef(false)

  const index = Math.min(stepIndex, Math.max(steps.length - 1, 0))
  const step = steps[index]
  const isLast = index >= steps.length - 1
  const { settings } = content

  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    stepRef.current?.focus()
  }, [index])

  function focusField(key: string) {
    const field = content.fields.find((item) => item.key === key)
    if (!field) return
    const element = document.getElementById(formInputId(prefix, field))
    element?.focus()
  }

  function goTo(nextIndex: number) {
    moved.current = true
    setStepIndex(nextIndex)
  }

  async function next() {
    if (!step) return
    const keys = getStepFieldKeys(content, step.id, form.getValues())
    const valid = keys.length === 0 || (await form.trigger(keys))
    if (valid) {
      goTo(index + 1)
      return
    }
    const failed = keys.find((key) => form.getFieldState(key).error)
    if (failed) focusField(failed)
  }

  function onInvalid(errors: FieldErrors<FormAnswers>) {
    const keys = Object.keys(errors)
    const first = content.fields.find((field) => keys.includes(field.key))
    if (!first) return
    const target = steps.findIndex((item) => item.id === first.stepId)
    if (target >= 0 && target !== index) goTo(target)
    else focusField(first.key)
  }

  async function onValid(values: FormAnswers) {
    setSubmitError(false)
    // Bots fill every input: pretend success, send nothing (plan B5.5).
    if (honeypotRef.current?.value) {
      setDone(true)
      return
    }
    try {
      await onSubmit?.(clearHiddenAnswers(content, values))
    } catch {
      setSubmitError(true)
      return
    }
    if (mode === "live" && settings.redirectUrl) {
      window.location.assign(settings.redirectUrl)
      return
    }
    setDone(true)
  }

  function restart() {
    form.reset(initialAnswers)
    setStepIndex(0)
    setDone(false)
  }

  if (done) {
    return (
      <div
        role="status"
        className={cn(
          "flex flex-col items-center gap-3 py-8 text-center",
          className
        )}
      >
        <CheckCircle2Icon className="size-10 text-primary" aria-hidden />
        <p className="max-w-prose text-base">
          {resolveI18nText(settings.successMessage, language)}
        </p>
        {mode === "preview" && settings.redirectUrl ? (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <InfoIcon className="size-4" aria-hidden />
            {t("redirectNote", { url: settings.redirectUrl })}
          </p>
        ) : null}
        {mode === "preview" ? (
          <Button type="button" variant="outline" onClick={restart}>
            {t("again")}
          </Button>
        ) : null}
      </div>
    )
  }

  if (content.fields.length === 0 || !step) {
    return (
      <p
        className={cn(
          "py-8 text-center text-sm text-muted-foreground",
          className
        )}
      >
        {t("empty")}
      </p>
    )
  }

  const stepTitle = resolveI18nText(step.title, language)
  const fields = content.fields.filter(
    (field) => field.stepId === step.id && !logic.hiddenFields.has(field.id)
  )

  return (
    <form
      noValidate
      className={cn("@container relative flex flex-col gap-6", className)}
      onSubmit={(event) => {
        if (isLast) {
          void form.handleSubmit(onValid, onInvalid)(event)
          return
        }
        event.preventDefault()
        void next()
      }}
    >
      {steps.length > 1 && settings.showProgress ? (
        <Progress value={((index + 1) / steps.length) * 100}>
          <ProgressLabel className="text-muted-foreground">
            {t("stepOf", { current: index + 1, total: steps.length })}
          </ProgressLabel>
        </Progress>
      ) : null}
      <div
        ref={stepRef}
        tabIndex={-1}
        className="flex flex-col gap-5 outline-none"
      >
        {stepTitle ? (
          <h2 className="text-xl font-semibold">{stepTitle}</h2>
        ) : null}
        <div className="grid gap-5 @sm:grid-cols-2">
          {fields.map((field) => (
            <Controller
              key={field.id}
              name={field.key}
              control={form.control}
              render={({ field: controller, fieldState }) => (
                <FormFieldView
                  field={field}
                  language={language}
                  idPrefix={prefix}
                  required={isFieldRequired(field, logic)}
                  value={controller.value}
                  onChange={controller.onChange}
                  onBlur={controller.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
          ))}
        </div>
      </div>
      {settings.honeypot ? (
        <div aria-hidden className="sr-only">
          <label>
            {t("honeypot")}
            <input
              ref={honeypotRef}
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
            />
          </label>
        </div>
      ) : null}
      {submitError ? (
        <p role="alert" className="text-sm text-destructive">
          {t("submitError")}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        {index > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => goTo(index - 1)}
          >
            {t("back")}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {isLast
            ? form.formState.isSubmitting
              ? t("submitting")
              : resolveI18nText(settings.submitLabel, language)
            : t("next")}
        </Button>
      </div>
    </form>
  )
}
