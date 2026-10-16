import { fireEvent, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"

import { screen } from "./render"

/** Opens a `DatePicker` trigger and picks `YYYY-MM-DD` through the calendar. */
export async function pickDate(
  user: UserEvent,
  trigger: HTMLElement,
  iso: string
) {
  const [year, month] = iso.split("-").map(Number)
  await user.click(trigger)
  const dialog = await screen.findByRole("dialog")
  // The calendar is lazy: wait for its month/year dropdowns.
  const [monthSelect, yearSelect] =
    await within(dialog).findAllByRole("combobox")
  fireEvent.change(yearSelect!, { target: { value: String(year) } })
  fireEvent.change(monthSelect!, { target: { value: String(month! - 1) } })
  const cell = dialog.querySelector(`[data-day="${iso}"] button`)
  if (!cell) throw new Error(`No calendar day for ${iso}`)
  await user.click(cell as HTMLElement)
}
