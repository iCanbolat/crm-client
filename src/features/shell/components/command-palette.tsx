import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  FileSearchIcon,
  LanguagesIcon,
  Loader2Icon,
  LogOutIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { useTheme } from "@/components/theme-provider"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getCurrentLanguage } from "@/lib/i18n"

import { searchQueries } from "../api/search.queries"
import { SEARCH_MIN_LENGTH, type SearchHit } from "../api/search.schemas"
import { useNavigation } from "../hooks/use-navigation"
import type { NavLink } from "../lib/navigation"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSignOut: () => void
}

/** Muted group headings miss AA contrast on the popover background. */
const GROUP_CLASS = "**:[[cmdk-group-heading]]:text-foreground/70"

const normalize = (value: string) => value.toLocaleLowerCase("tr").trim()

export function CommandPalette({
  open,
  onOpenChange,
  onSignOut,
}: CommandPaletteProps) {
  const { t, i18n } = useTranslation(["shell", "common"])
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const groups = useNavigation()
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(normalize(query))
  const search = useQuery({
    ...searchQueries.results(debouncedQuery),
    enabled: open && debouncedQuery.length >= SEARCH_MIN_LENGTH,
  })

  const needle = normalize(query)
  const pages = groups
    .flatMap((group) => group.items)
    .filter((item) => !needle || normalize(item.title).includes(needle))
  const hits =
    needle.length >= SEARCH_MIN_LENGTH ? (search.data?.data ?? []) : []

  function close() {
    onOpenChange(false)
    setQuery("")
  }

  function openPage(item: NavLink) {
    close()
    void navigate({ to: item.to, params: item.params, search: item.search })
  }

  function openHit(hit: SearchHit) {
    close()
    if (hit.type === "record" && hit.objectKey) {
      void navigate({
        to: "/o/$objectKey/$recordId",
        params: { objectKey: hit.objectKey, recordId: hit.id },
      })
    } else {
      void navigate({ to: "/examples", search: { q: hit.title } })
    }
  }

  const isDark = theme === "dark"
  const nextLanguage = getCurrentLanguage() === "tr" ? "en" : "tr"
  const actions = [
    {
      id: "theme",
      icon: isDark ? SunIcon : MoonIcon,
      title: isDark
        ? t("command.actions.lightTheme")
        : t("command.actions.darkTheme"),
      run: () => setTheme(isDark ? "light" : "dark"),
    },
    {
      id: "language",
      icon: LanguagesIcon,
      title: t("command.actions.language", {
        language: t(`common:language.${nextLanguage}`),
      }),
      run: () => void i18n.changeLanguage(nextLanguage),
    },
    {
      id: "sign-out",
      icon: LogOutIcon,
      title: t("command.actions.signOut"),
      run: onSignOut,
    },
  ].filter((action) => !needle || normalize(action.title).includes(needle))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent
        className="top-[20%] translate-y-0 overflow-hidden rounded-4xl! p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t("command.title")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("command.description")}
        </DialogDescription>
        <Command shouldFilter={false} label={t("command.title")}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t("command.placeholder")}
            aria-label={t("command.placeholder")}
          />
          <CommandList>
            <CommandEmpty>
              {search.isFetching ? (
                <Loader2Icon
                  className="mx-auto size-4 animate-spin"
                  aria-label={t("command.searching")}
                />
              ) : (
                t("command.empty")
              )}
            </CommandEmpty>
            {pages.length ? (
              <CommandGroup
                className={GROUP_CLASS}
                heading={t("command.pages")}
              >
                {pages.map((item) => {
                  const Icon = item.icon
                  return (
                    <CommandItem
                      key={item.id}
                      value={`page:${item.id}`}
                      onSelect={() => openPage(item)}
                    >
                      <Icon aria-hidden />
                      {item.title}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : null}
            {hits.length ? (
              <CommandGroup
                className={GROUP_CLASS}
                heading={t("command.records")}
              >
                {hits.map((hit) => (
                  <CommandItem
                    key={`${hit.type}:${hit.id}`}
                    value={`record:${hit.type}:${hit.id}`}
                    onSelect={() => openHit(hit)}
                  >
                    <FileSearchIcon aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{hit.title}</span>
                      {hit.subtitle ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {hit.subtitle}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {actions.length ? (
              <CommandGroup
                className={GROUP_CLASS}
                heading={t("command.actionsHeading")}
              >
                {actions.map((action) => {
                  const Icon = action.icon
                  return (
                    <CommandItem
                      key={action.id}
                      value={`action:${action.id}`}
                      onSelect={() => {
                        close()
                        action.run()
                      }}
                    >
                      <Icon aria-hidden />
                      {action.title}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
