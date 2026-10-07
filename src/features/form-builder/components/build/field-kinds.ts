import {
  AlignLeftIcon,
  AtSignIcon,
  CalendarIcon,
  CircleDotIcon,
  EyeOffIcon,
  HashIcon,
  HeadingIcon,
  ListChecksIcon,
  MinusIcon,
  PaperclipIcon,
  PhoneIcon,
  PilcrowIcon,
  ShieldCheckIcon,
  SquareChevronDownIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react"
import { createElement } from "react"
import { useTranslation } from "react-i18next"

import { getFieldType } from "@/engine/field-types"
import {
  FORM_PALETTE_TYPES,
  type FormBlockDef,
  type FormField,
  type FormPaletteType,
} from "@/engine/forms"
import { getModules } from "@/engine/modules"
import { getCurrentLanguage } from "@/lib/i18n"
import { resolveI18nText } from "@/lib/i18n-text"

export const PALETTE_GROUPS: {
  id: "basic" | "choice" | "special" | "layout"
  types: FormPaletteType[]
}[] = [
  {
    id: "basic",
    types: ["text", "textarea", "email", "phone", "number", "date"],
  },
  { id: "choice", types: ["select", "radio", "checkboxes"] },
  { id: "special", types: ["file", "consent", "hidden"] },
  { id: "layout", types: ["heading", "paragraph", "divider"] },
]

export const PALETTE_ICONS: Record<FormPaletteType, LucideIcon> = {
  text: TypeIcon,
  textarea: AlignLeftIcon,
  email: AtSignIcon,
  phone: PhoneIcon,
  number: HashIcon,
  select: SquareChevronDownIcon,
  radio: CircleDotIcon,
  checkboxes: ListChecksIcon,
  date: CalendarIcon,
  file: PaperclipIcon,
  consent: ShieldCheckIcon,
  hidden: EyeOffIcon,
  heading: HeadingIcon,
  paragraph: PilcrowIcon,
  divider: MinusIcon,
}

export function isPaletteType(type: string): type is FormPaletteType {
  return (FORM_PALETTE_TYPES as readonly string[]).includes(type)
}

export function fieldIcon(type: string): LucideIcon {
  return isPaletteType(type) ? PALETTE_ICONS[type] : getFieldType(type).icon
}

/** Icon of a field's type (palette icon or the engine field type's). */
export function FieldKindIcon({
  type,
  className,
}: {
  type: string
  className?: string
}) {
  const Icon = isPaletteType(type)
    ? PALETTE_ICONS[type]
    : getFieldType(type).icon
  return createElement(Icon, { className, "aria-hidden": true })
}

/** Module block a field was added with (still registered). */
export function findBlock(
  blockId: string | undefined
): FormBlockDef | undefined {
  if (!blockId) return undefined
  return getModules()
    .flatMap((module) => module.formBlocks ?? [])
    .find((block) => block.id === blockId)
}

/** "Kısa metin", or the module block's name for sector fields. */
export function useFieldKindLabel() {
  const { t } = useTranslation(["forms", "engine"])
  return (field: Pick<FormField, "type" | "blockId">) => {
    if (isPaletteType(field.type)) return t(`forms:types.${field.type}`)
    const block = findBlock(field.blockId)
    if (block) return resolveI18nText(block.label, getCurrentLanguage())
    return field.type
  }
}
