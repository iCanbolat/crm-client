import { FileIcon, Loader2Icon, PaperclipIcon, XIcon } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getErrorMessage } from "@/lib/api"

import type { FileRef } from "../../metadata/schemas"
import { useFieldServices } from "../services"
import type { FieldInputProps } from "../types"
import { toFiles } from "./file"

// Inputs of ./file, loaded on first render (see ../lazy).

export function FileInput(props: FieldInputProps<FileRef[]>) {
  const { t } = useTranslation("engine")
  const { uploadFile } = useFieldServices()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const files = toFiles(props.value)

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(Array.from(list, uploadFile))
      props.onChange([...files, ...uploaded])
    } catch (error) {
      toast.error(t("input.uploadFailed"), {
        description: getErrorMessage(error),
      })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function remove(id: string) {
    const next = files.filter((file) => file.id !== id)
    props.onChange(next.length ? next : null)
  }

  return (
    <div className="flex flex-col gap-2">
      {files.length ? (
        <ul className="flex flex-col gap-1">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm"
            >
              <FileIcon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("input.removeFile", { name: file.name })}
                onClick={() => remove(file.id)}
                disabled={props.disabled}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        ref={inputRef}
        id={props.id}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-describedby={props.describedBy}
        aria-label={props.ariaLabel}
        onChange={(event) => void handleFiles(event.target.files)}
        disabled={props.disabled || uploading}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => inputRef.current?.click()}
        onBlur={props.onBlur}
        disabled={props.disabled || uploading}
        aria-invalid={props.invalid ? true : undefined}
      >
        {uploading ? (
          <Loader2Icon className="animate-spin" data-icon="inline-start" />
        ) : (
          <PaperclipIcon data-icon="inline-start" />
        )}
        {uploading ? t("input.uploading") : t("input.chooseFiles")}
      </Button>
    </div>
  )
}
