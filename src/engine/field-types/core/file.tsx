import { CircleHelpIcon, PaperclipIcon } from "lucide-react"
import { z } from "zod"

import { Input } from "@/components/ui/input"
import { formatNumber } from "@/lib/format"
import { getCurrentLanguage } from "@/lib/i18n"

import { fileRefSchema, type FileRef } from "../../metadata/schemas"
import { lazyFieldInput } from "../lazy"
import type { FieldTypeDefinition } from "../types"
import { EmptyValue } from "../ui"

export const toFiles = (value: unknown): FileRef[] => {
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
  Input: lazyFieldInput(() =>
    import("./inputs").then((module) => module.FileInput)
  ),
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
