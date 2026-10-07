import {
  BikeIcon,
  ContainerIcon,
  PlaneIcon,
  ShipIcon,
  TrainFrontIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react"

import { isTransportMode, type TransportMode } from "../lib/constants"

const MODE_ICONS: Record<TransportMode, LucideIcon> = {
  SEA_FCL: ShipIcon,
  SEA_LCL: ShipIcon,
  AIR: PlaneIcon,
  ROAD_FTL: TruckIcon,
  ROAD_LTL: TruckIcon,
  RAIL: TrainFrontIcon,
  MULTIMODAL: ContainerIcon,
  COURIER: BikeIcon,
}

export function ModeIcon({
  mode,
  className,
}: {
  mode: unknown
  className?: string
}) {
  const Icon = isTransportMode(mode) ? MODE_ICONS[mode] : ContainerIcon
  return <Icon className={className} aria-hidden />
}
