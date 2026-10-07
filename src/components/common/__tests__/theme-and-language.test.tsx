import { describe, expect, it } from "vitest"

import { LanguageSwitcher } from "@/components/common/language-switcher"
import { ThemeToggle } from "@/components/common/theme-toggle"
import { renderWithProviders, screen } from "@/test/render"

describe("ThemeToggle", () => {
  it("TC-0.2-02 switches to dark, updates <html> class and persists the choice", async () => {
    const { user } = await renderWithProviders(<ThemeToggle />)

    await user.click(screen.getByRole("button", { name: "Tema" }))
    await user.click(await screen.findByRole("menuitemradio", { name: "Koyu" }))

    expect(document.documentElement).toHaveClass("dark")
    expect(localStorage.getItem("theme")).toBe("dark")

    await user.click(screen.getByRole("button", { name: "Tema" }))
    await user.click(await screen.findByRole("menuitemradio", { name: "Açık" }))

    expect(document.documentElement).toHaveClass("light")
    expect(document.documentElement).not.toHaveClass("dark")
    expect(localStorage.getItem("theme")).toBe("light")
  })

  it("TC-0.2-02 restores the stored theme on load", async () => {
    localStorage.setItem("theme", "dark")

    await renderWithProviders(<ThemeToggle />)

    expect(document.documentElement).toHaveClass("dark")
  })
})

describe("LanguageSwitcher", () => {
  it("TC-0.2-03 switches the UI language to English and back", async () => {
    const { user } = await renderWithProviders(<LanguageSwitcher />)

    const trigger = screen.getByRole("button", { name: "Dil" })
    expect(trigger).toHaveTextContent("tr")

    await user.click(trigger)
    await user.click(
      await screen.findByRole("menuitemradio", { name: "English" })
    )

    const englishTrigger = await screen.findByRole("button", {
      name: "Language",
    })
    expect(englishTrigger).toHaveTextContent("en")
    expect(document.documentElement.lang).toBe("en")
    expect(localStorage.getItem("lang")).toBe("en")

    await user.click(englishTrigger)
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Türkçe" })
    )

    expect(
      await screen.findByRole("button", { name: "Dil" })
    ).toBeInTheDocument()
    expect(document.documentElement.lang).toBe("tr")
  })
})
