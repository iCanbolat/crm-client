import {
  CircleHelpIcon,
  FileIcon,
  Loader2Icon,
  PaperclipIcon,
  XIcon,
} from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getErrorMessage } from "@/lib/api"
import { formatNumber } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"

import { fileRefSchema, type FileRef } from "../../metadata/schemas"
import { useFieldServices } from "../services"
import type { FieldInputProps, FieldTypeDefinition } from "../types"
import { EmptyValue } from "../ui"

const toFiles = (value: unknown): FileRef[] => {
  const parsed = z.array(fileRefSchema).safeParse(value)
  return parsed.success ? parsed.data : []
}

/** 1536 → "1,5 KB". */
export function formatFileSize(bytes: number, language: string) {
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${formatNumber(size, language, { maximumFractionDigits: 1 })} ${units[unit]}`
}

function FileInput(props: FieldInputProps<FileRef[]>) {
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

export const fileFieldType: FieldTypeDefinition<FileRef[]> = {
  type: "file",
  icon: PaperclipIcon,
  toZod: () => z.array(fileRefSchema),
  isEmpty: (value) => toFiles(value).length === 0,
  toComparable: (value) => {
    const names = toFiles(value).map((file) => file.name)
    return names.length ? names : null
  },
  format: (value) =>
    toFiles(value)
      .map((file) => file.name)
      .join(", "),
  filterOperators: ["isEmpty", "isNotEmpty"],
  sortable: false,
  creatable: true,
  Cell: ({ value }) => {
    const files = toFiles(value)
    if (files.length === 0) return <EmptyValue />
    return (
      <span
        className="inline-flex items-center gap-1"
        title={files.map((file) => file.name).join(", ")}
      >
        <PaperclipIcon className="size-3.5" aria-hidden />
        {files.length === 1
          ? files[0]!.name
          : `${files.length} · ${formatFileSize(
              files.reduce((sum, file) => sum + file.size, 0),
              getCurrentLanguage()
            )}`}
      </span>
    )
  },
  Input: FileInput,
}

/* ---------------------------------------------------------------- unknown */

function stringify(value: unknown) {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Fallback for types no registered definition knows (e.g. a field added by
 * a module that is not loaded): values are kept as-is and shown read-only.
 */
export const unknownFieldType: FieldTypeDefinition<unknown> = {
  type: "unknown",
  icon: CircleHelpIcon,
  toZod: () => z.unknown(),
  isEmpty: (value) => value === null || value === undefined || value === "",
  toComparable: (value) => {
    const text = stringify(value)
    return text === "" ? null : text
  },
  format: stringify,
  filterOperators: ["isEmpty", "isNotEmpty"],
  sortable: false,
  creatable: false,
  Cell: ({ value }) => {
    const text = stringify(value)
    return text ? (
      <span className="block max-w-xs truncate font-mono text-xs">{text}</span>
    ) : (
      <EmptyValue />
    )
  },
  Input: (props) => (
    <Input
      id={props.id}
      value={stringify(props.value)}
      readOnly
      aria-readonly
      aria-label={props.ariaLabel}
      aria-describedby={props.describedBy}
    />
  ),
}
