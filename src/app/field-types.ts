import { registerFieldTypes } from "@/engine/field-types"
import { forwardingFieldTypes } from "@/modules/forwarding/field-types"

/**
 * Public form site (B5.1): only the sector field types a published form can
 * render. Importing the manifests would pull dashboards and record slots
 * into the public bundle; the admin app registers them via `./modules`.
 */
registerFieldTypes(forwardingFieldTypes)
