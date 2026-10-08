import { zodResolver } from "@hookform/resolvers/zod"
import { useSuspenseQuery } from "@tanstack/react-query"
import { GlobeIcon, InfoIcon } from "lucide-react"
import { useId } from "react"
import { Controller, useForm, useWatch, type Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { ColorField } from "@/components/common/color-field"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { usePermission } from "@/features/auth"
import { LogoField } from "@/features/workspace"
import { applyServerFieldErrors } from "@/lib/forms"

import { useUpdateSite } from "../api/sites.mutations"
import { siteQueries } from "../api/sites.queries"
import {
  updateSiteInputSchema,
  type Site,
  type UpdateSiteInput,
} from "../api/sites.schemas"
import { getSiteOrigin } from "../lib/origin"
import { DomainsCard } from "./domains-card"
import { SitePreview } from "./site-preview"

const SEO_TITLE_MAX = 70
const SEO_DESCRIPTION_MAX = 160
const NO_FORM = "__none"

const toFormValues = (site: Site): UpdateSiteInput => ({
  subdomain: site.subdomain,
  brand: site.brand,
  defaultFormId: site.defaultFormId,
  seo: site.seo,
  legal: site.legal,
})

/** Text input bound to a nested field with its error (`brand.name`, …). */
function TextField({
  form,
  name,
  label,
  help,
  type = "text",
  placeholder,
}: {
  form: ReturnType<typeof useForm<UpdateSiteInput>>
  name: Path<UpdateSiteInput>
  label: string
  help?: string
  type?: "text" | "url"
  placeholder?: string
}) {
  const id = useId()
  const { error } = form.getFieldState(name, form.formState)
  const describedBy =
    [help ? `${id}-help` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={type}
        spellCheck={false}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...form.register(name)}
      />
      {help ? (
        <FieldDescription id={`${id}-help`}>{help}</FieldDescription>
      ) : null}
      <FieldError id={`${id}-error`} errors={[error]} />
    </Field>
  )
}

/** "Site & Alan Adları" (B5.2/B5.3): branding, default form, SEO, domains. */
export function SiteSettingsPage() {
  const { t } = useTranslation("sites")
  const id = useId()
  const { data: site } = useSuspenseQuery(siteQueries.current())
  const canUpdate = usePermission("update", "site")
  const mutation = useUpdateSite()
  const form = useForm<UpdateSiteInput>({
    resolver: zodResolver(updateSiteInputSchema),
    values: toFormValues(site),
    resetOptions: { keepDirtyValues: true },
  })
  const watched = useWatch({ control: form.control }) as UpdateSiteInput
  const subdomain = form.getFieldState("subdomain", form.formState).invalid
    ? site.subdomain
    : watched.subdomain
  const publicUrl = getSiteOrigin({
    subdomain,
    primaryDomain: site.primaryDomain,
  })
  const seoTitle = watched.seo?.title ?? ""
  const seoDescription = watched.seo?.description ?? ""

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await mutation.mutateAsync(values)
      form.reset(toFormValues(saved))
    } catch (error) {
      applyServerFieldErrors(error, form.setError)
    }
  })

  const formItems = [
    { value: NO_FORM, label: t("defaultForm.none") },
    ...site.publishedForms.map((item) => ({
      value: item.id,
      label: item.name,
    })),
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      {!canUpdate ? (
        <p className="flex items-center gap-2 rounded-2xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <InfoIcon className="size-4 shrink-0" aria-hidden />
          {t("readOnly")}
        </p>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <form noValidate onSubmit={submit} className="min-w-0">
          <fieldset disabled={!canUpdate} className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("address.title")}</CardTitle>
                <CardDescription>{t("address.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-5">
                  <TextField
                    form={form}
                    name="subdomain"
                    label={t("address.subdomain")}
                    help={t("address.subdomainHelp")}
                  />
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">
                      {t("address.publicUrl")}
                    </span>
                    <span
                      data-testid="site-public-url"
                      className="flex items-center gap-1.5 font-mono break-all text-muted-foreground"
                    >
                      <GlobeIcon className="size-4 shrink-0" aria-hidden />
                      {publicUrl}
                    </span>
                    {site.primaryDomain ? (
                      <span className="text-xs text-muted-foreground">
                        {t("address.primaryDomain")}
                      </span>
                    ) : null}
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("brand.title")}</CardTitle>
                <CardDescription>{t("brand.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-5">
                  <TextField
                    form={form}
                    name="brand.name"
                    label={t("brand.name")}
                  />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Controller
                      control={form.control}
                      name="brand.logoUrl"
                      render={({ field }) => (
                        <LogoField
                          value={field.value}
                          onChange={field.onChange}
                          fallback=""
                        />
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="brand.faviconUrl"
                      render={({ field }) => (
                        <LogoField
                          label={t("brand.favicon")}
                          value={field.value}
                          onChange={field.onChange}
                          fallback=""
                        />
                      )}
                    />
                  </div>
                  <Controller
                    control={form.control}
                    name="brand.primaryColor"
                    render={({ field }) => (
                      <ColorField
                        label={t("brand.primaryColor")}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("defaultForm.title")}</CardTitle>
                <CardDescription>
                  {t("defaultForm.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Controller
                  control={form.control}
                  name="defaultFormId"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.error ? true : undefined}>
                      <FieldLabel htmlFor={`${id}-form`}>
                        {t("defaultForm.label")}
                      </FieldLabel>
                      <Select
                        items={formItems}
                        value={field.value ?? NO_FORM}
                        onValueChange={(value) =>
                          field.onChange(value === NO_FORM ? null : value)
                        }
                        disabled={!canUpdate}
                      >
                        <SelectTrigger id={`${id}-form`} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {formItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {site.publishedForms.length === 0 ? (
                        <FieldDescription>
                          {t("defaultForm.noPublished")}
                        </FieldDescription>
                      ) : null}
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("seo.title")}</CardTitle>
                <CardDescription>{t("seo.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-5">
                  <TextField
                    form={form}
                    name="seo.title"
                    label={t("seo.pageTitle")}
                    help={t("seo.count", {
                      count: seoTitle.length,
                      max: SEO_TITLE_MAX,
                    })}
                  />
                  <Field
                    data-invalid={
                      form.formState.errors.seo?.description ? true : undefined
                    }
                  >
                    <FieldLabel htmlFor={`${id}-description`}>
                      {t("seo.pageDescription")}
                    </FieldLabel>
                    <Textarea
                      id={`${id}-description`}
                      rows={3}
                      aria-describedby={`${id}-description-help`}
                      {...form.register("seo.description")}
                    />
                    <FieldDescription id={`${id}-description-help`}>
                      {t("seo.count", {
                        count: seoDescription.length,
                        max: SEO_DESCRIPTION_MAX,
                      })}
                    </FieldDescription>
                    <FieldError
                      errors={[form.formState.errors.seo?.description]}
                    />
                  </Field>
                  <Controller
                    control={form.control}
                    name="seo.ogImageUrl"
                    render={({ field }) => (
                      <LogoField
                        label={t("seo.ogImage")}
                        value={field.value}
                        onChange={field.onChange}
                        fallback=""
                      />
                    )}
                  />
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("legal.title")}</CardTitle>
                <CardDescription>{t("legal.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-5">
                  {(["kvkkUrl", "privacyUrl", "cookieUrl"] as const).map(
                    (key) => (
                      <TextField
                        key={key}
                        form={form}
                        name={`legal.${key}`}
                        type="url"
                        placeholder="https://"
                        label={t(`legal.${key}`)}
                      />
                    )
                  )}
                </FieldGroup>
              </CardContent>
            </Card>

            {canUpdate ? (
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={!form.formState.isDirty || mutation.isPending}
                >
                  {t("save")}
                </Button>
              </div>
            ) : null}
          </fieldset>
        </form>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-4">
          <h2 className="text-sm font-medium">{t("preview.title")}</h2>
          <SitePreview
            site={{
              brand: { ...site.brand, ...watched.brand },
              legal: { ...site.legal, ...watched.legal },
            }}
            url={publicUrl}
          />
        </aside>
      </div>

      <DomainsCard canUpdate={canUpdate} />
    </div>
  )
}
