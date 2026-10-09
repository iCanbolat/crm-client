import "i18next"

import type { AppResources, defaultNS } from "./index"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: AppResources
  }
}
