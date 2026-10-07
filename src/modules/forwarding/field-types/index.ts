import type { AnyFieldTypeDefinition } from "@/engine/field-types"

import {
  containerFieldType,
  dimensionsFieldType,
  volumeFieldType,
  weightFieldType,
} from "./cargo"
import { airportFieldType, locationFieldType, portFieldType } from "./location"
import { dangerousGoodsFieldType, hsCodeFieldType } from "./trade"

export const forwardingFieldTypes: AnyFieldTypeDefinition[] = [
  portFieldType,
  airportFieldType,
  locationFieldType,
  containerFieldType,
  weightFieldType,
  volumeFieldType,
  dimensionsFieldType,
  hsCodeFieldType,
  dangerousGoodsFieldType,
]

export {
  countContainers,
  formatContainers,
  toContainers,
  toDimensions,
  type ContainerLine,
} from "./cargo"
export { formatLocation, toLocation } from "./location"
export { formatDangerousGoods, toDangerousGoods } from "./trade"
