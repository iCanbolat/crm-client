import { registerModules, type ModuleManifest } from "@/engine/modules"
import { forwardingModule } from "@/modules/forwarding"
import { healthTourismModule } from "@/modules/health-tourism"
import { visaEducationModule } from "@/modules/visa-education"

/** Every sector module shipped with the app (active and coming soon). */
export const moduleManifests: ModuleManifest[] = [
  forwardingModule,
  visaEducationModule,
  healthTourismModule,
]

registerModules(moduleManifests)
