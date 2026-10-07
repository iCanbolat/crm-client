import { z } from "zod"

export const envSchema = z.object({
  VITE_API_URL: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("/") || URL.canParse(value), {
      message: "must be a path starting with '/' or an absolute URL",
    }),
  VITE_APP_HOST: z.string().min(1),
  VITE_PUBLIC_FORMS_DOMAIN: z.string().min(1),
  VITE_ENABLE_MSW: z.stringbool().default(false),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")

    throw new Error(
      `Invalid environment variables:\n${details}\nCheck the .env files in the client project.`
    )
  }

  return result.data
}

export const env = parseEnv(import.meta.env)
