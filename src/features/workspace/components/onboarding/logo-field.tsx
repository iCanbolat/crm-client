import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

import { LOGO_MAX_BYTES } from "../../api/workspace.schemas"

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

interface LogoFieldProps {
  value: string | null
  onChange: (value: string | null) => void
  fallback: string
  /** Defaults to "Logo" (e.g. the site favicon reuses the field). */
  label?: string
}

/** Mock upload: the image is kept as a data URL in the workspace profile. */
export function LogoField({
  value,
  onChange,
  fallback,
  label,
}: LogoFieldProps) {
  const { t } = useTranslation("workspace")
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const errorId = useId()
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t("company.logoInvalidType"))
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError(t("company.logoTooLarge", { size: LOGO_MAX_BYTES / 1024 }))
      return
    }
    setError(null)
    onChange(await readAsDataUrl(file))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium" id={`${inputId}-label`}>
        {label ?? t("company.logo")}
      </span>
      <div className="flex items-center gap-3">
        <Avatar className="size-14 rounded-2xl">
          {value ? (
            <AvatarImage src={value} alt={t("company.logoPreview")} />
          ) : null}
          <AvatarFallback className="rounded-2xl font-medium text-foreground">
            {fallback ? fallback : <ImageIcon className="size-5" aria-hidden />}
          </AvatarFallback>
        </Avatar>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          aria-labelledby={`${inputId}-label`}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            void handleFile(event.target.files?.[0])
            event.target.value = ""
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon data-icon="inline-start" />
          {value ? t("company.logoChange") : t("company.logoUpload")}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("company.logoRemove")}
            onClick={() => onChange(null)}
          >
            <Trash2Icon />
          </Button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("company.logoHint")}</p>
      )}
    </div>
  )
}
