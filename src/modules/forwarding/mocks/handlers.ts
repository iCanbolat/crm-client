import { registerRecordHook } from "@/features/records/mocks/store"

import { dashboardHandlers } from "./dashboard-handlers"
import { quoteHandlers } from "./quote-handlers"
import { referenceHandlers } from "./reference-handlers"
import { shipmentHandlers } from "./shipment-handlers"
import { shipmentHook } from "./shipment-store"

registerRecordHook("shipment", shipmentHook)

/** Mock backend of the forwarding module (aggregated by `src/mocks`). */
export const forwardingHandlers = [
  ...referenceHandlers,
  ...quoteHandlers,
  ...shipmentHandlers,
  ...dashboardHandlers,
]
