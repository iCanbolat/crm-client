/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_APP_HOST: string
  readonly VITE_PUBLIC_FORMS_DOMAIN: string
  readonly VITE_ENABLE_MSW: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
