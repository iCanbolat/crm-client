import type {
  MessageTemplateDef,
  TemplateContent,
  TemplateLanguage,
} from "./types"
import { TEMPLATE_LANGUAGES } from "./types"

/** Meta's limits for utility templates. */
export const TEMPLATE_LIMITS = {
  name: 512,
  header: 60,
  body: 1024,
  footer: 60,
  param: 1024,
} as const

const NAME_PATTERN = /^[a-z0-9_]+$/
const VARIABLE_PATTERN = /\{\{\s*(\d+)\s*\}\}/g

export type TemplateIssueCode =
  | "nameFormat"
  | "missingLanguage"
  | "headerTooLong"
  | "headerVariables"
  | "bodyEmpty"
  | "bodyTooLong"
  | "footerTooLong"
  | "footerVariables"
  | "variableSequence"
  | "variableAtEdge"
  | "variableCount"

export interface TemplateIssue {
  code: TemplateIssueCode
  language?: TemplateLanguage
}

/** Placeholder numbers in order of appearance (`{{2}} … {{1}}` → [2, 1]). */
export function extractVariables(text: string): number[] {
  return Array.from(text.matchAll(VARIABLE_PATTERN), (match) =>
    Number(match[1])
  )
}

/**
 * Meta's review rules a template must pass before it is submitted:
 * name format, lengths, plain header/footer, `{{1}}…{{n}}` used in sequence,
 * no variable at the very start or end of the body, one sample per variable.
 */
export function validateTemplateDef(def: MessageTemplateDef): TemplateIssue[] {
  const issues: TemplateIssue[] = []
  if (!NAME_PATTERN.test(def.name) || def.name.length > TEMPLATE_LIMITS.name) {
    issues.push({ code: "nameFormat" })
  }
  for (const language of TEMPLATE_LANGUAGES) {
    const content = def.content[language] as TemplateContent | undefined
    if (!content) {
      issues.push({ code: "missingLanguage", language })
      continue
    }
    const add = (code: TemplateIssueCode) => issues.push({ code, language })
    if (content.header !== undefined) {
      if (content.header.length > TEMPLATE_LIMITS.header) add("headerTooLong")
      if (extractVariables(content.header).length) add("headerVariables")
    }
    if (content.footer !== undefined) {
      if (content.footer.length > TEMPLATE_LIMITS.footer) add("footerTooLong")
      if (extractVariables(content.footer).length) add("footerVariables")
    }
    const body = content.body.trim()
    if (!body) {
      add("bodyEmpty")
      continue
    }
    if (body.length > TEMPLATE_LIMITS.body) add("bodyTooLong")
    if (/^\{\{\s*\d+\s*\}\}/.test(body) || /\{\{\s*\d+\s*\}\}$/.test(body)) {
      add("variableAtEdge")
    }
    const numbers = extractVariables(body)
    const unique = Array.from(new Set(numbers)).sort((a, b) => a - b)
    if (unique.some((number, index) => number !== index + 1)) {
      add("variableSequence")
    }
    if (unique.length !== def.variables.length) add("variableCount")
  }
  return issues
}

/** Text of a template with `{{n}}` replaced by `params[n - 1]`. */
export function renderTemplate(
  content: TemplateContent,
  params: readonly string[]
) {
  const fill = (text: string) =>
    text.replace(VARIABLE_PATTERN, (match, index: string) => {
      const value = params[Number(index) - 1]
      return value === undefined || value === "" ? match : value
    })
  return {
    header: content.header,
    body: fill(content.body),
    footer: content.footer,
  }
}

/** Plain text of a rendered template (timeline, previews, search). */
export function templateToText(
  content: TemplateContent,
  params: readonly string[]
) {
  const rendered = renderTemplate(content, params)
  return [rendered.header, rendered.body, rendered.footer]
    .filter(Boolean)
    .join("\n\n")
}

export function templateExamples(
  def: MessageTemplateDef,
  language: TemplateLanguage
) {
  return def.variables.map((variable) => variable.example[language])
}

/** Meta language code of a template language. */
export const META_LANGUAGE_CODES: Record<TemplateLanguage, string> = {
  tr: "tr",
  en: "en",
}

/**
 * Body of `POST /{WABA_ID}/message_templates` (Graph API) — what the
 * backend submits for each module template and language.
 */
export function toMetaTemplatePayload(
  def: MessageTemplateDef,
  language: TemplateLanguage
) {
  const content = def.content[language]
  const examples = templateExamples(def, language)
  return {
    name: def.name,
    language: META_LANGUAGE_CODES[language],
    category: "UTILITY" as const,
    components: [
      ...(content.header
        ? [
            {
              type: "HEADER" as const,
              format: "TEXT" as const,
              text: content.header,
            },
          ]
        : []),
      {
        type: "BODY" as const,
        text: content.body,
        ...(examples.length ? { example: { body_text: [examples] } } : {}),
      },
      ...(content.footer
        ? [{ type: "FOOTER" as const, text: content.footer }]
        : []),
    ],
  }
}

/** Body of `POST /{PHONE_NUMBER_ID}/messages` for a template message. */
export function toMetaSendPayload(
  def: Pick<MessageTemplateDef, "name">,
  language: TemplateLanguage,
  to: string,
  params: readonly string[]
) {
  return {
    messaging_product: "whatsapp" as const,
    recipient_type: "individual" as const,
    to,
    type: "template" as const,
    template: {
      name: def.name,
      language: { code: META_LANGUAGE_CODES[language] },
      components: params.length
        ? [
            {
              type: "body" as const,
              parameters: params.map((text) => ({
                type: "text" as const,
                text,
              })),
            },
          ]
        : [],
    },
  }
}

/**
 * Meta rejects parameters with new lines, tabs or more than four
 * consecutive spaces; empty ones cannot be sent at all.
 */
export function isValidTemplateParam(value: string) {
  return (
    value.trim().length > 0 &&
    value.length <= TEMPLATE_LIMITS.param &&
    !/[\n\t]/.test(value) &&
    !/ {5,}/.test(value)
  )
}
