import {
  CalendarDaysIcon,
  MailIcon,
  PhoneIcon,
  StickyNoteIcon,
  type LucideIcon,
} from "lucide-react"

import type { ActivityType } from "../api/activities.schemas"

export const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  note: StickyNoteIcon,
  call: PhoneIcon,
  email: MailIcon,
  meeting: CalendarDaysIcon,
}
