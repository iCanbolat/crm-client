import { useSuspenseQuery } from "@tanstack/react-query"
import {
  BookmarkIcon,
  ChevronDownIcon,
  Loader2Icon,
  SaveIcon,
  StarIcon,
  StarOffIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePermission } from "@/features/auth"

import {
  useCreateView,
  useDeleteView,
  useSetDefaultView,
  useUpdateView,
} from "../api/records.mutations"
import { viewQueries } from "../api/records.queries"
import {
  VIEW_NAME_MAX,
  type RecordListSearch,
  type SavedView,
} from "../api/records.schemas"
import {
  isViewDirty,
  searchFromView,
  viewStateFromSearch,
} from "../lib/list-state"

interface ViewsMenuProps {
  objectKey: string
  search: RecordListSearch
  /** Navigates to a view (or to the unfiltered list with `null`). */
  onSelect: (search: RecordListSearch | null) => void
}

function SaveViewDialog({
  open,
  onOpenChange,
  objectKey,
  search,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  objectKey: string
  search: RecordListSearch
  onSaved: (view: SavedView) => void
}) {
  const { t } = useTranslation(["records", "common"])
  const id = useId()
  const canShare = usePermission("manage", "view")
  const mutation = useCreateView(objectKey)
  const [name, setName] = useState("")
  const [shared, setShared] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t("views.nameRequired"))
      return
    }
    try {
      const view = await mutation.mutateAsync({
        name: trimmed,
        shared,
        state: viewStateFromSearch(search),
      })
      setName("")
      setShared(false)
      setError(null)
      onOpenChange(false)
      onSaved(view)
    } catch {
      // Toasted globally.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-6"
        >
          <DialogHeader>
            <DialogTitle>{t("views.saveAsTitle")}</DialogTitle>
            <DialogDescription>
              {t("views.saveAsDescription")}
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={`${id}-name`}>{t("views.name")}</FieldLabel>
            <Input
              id={`${id}-name`}
              value={name}
              maxLength={VIEW_NAME_MAX}
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => setName(event.target.value)}
            />
            <FieldError id={`${id}-error`}>{error}</FieldError>
          </Field>
          {canShare ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${id}-shared`}
                checked={shared}
                onCheckedChange={setShared}
              />
              <Label htmlFor={`${id}-shared`} className="font-normal">
                {t("views.shareWithTeam")}
              </Label>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              {t("common:actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Saved views: switch, save, share, make default, delete. */
export function ViewsMenu({ objectKey, search, onSelect }: ViewsMenuProps) {
  const { t } = useTranslation(["records", "common"])
  const { data } = useSuspenseQuery(viewQueries.list(objectKey))
  const canCreate = usePermission("create", "view")
  const active = data.data.find((view) => view.id === search.view)
  const canUpdate = usePermission("update", "view", {
    ownerId: active?.ownerId,
  })
  const canDelete = usePermission("delete", "view", {
    ownerId: active?.ownerId,
  })
  const dirty = active ? isViewDirty(active, search) : false
  const isDefault = !!active && data.defaultViewId === active.id
  const updateView = useUpdateView(objectKey)
  const deleteView = useDeleteView(objectKey)
  const setDefault = useSetDefaultView(objectKey)
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveCurrent = () =>
    active
      ? updateView.mutate({
          id: active.id,
          patch: { state: viewStateFromSearch(search) },
        })
      : undefined

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" className="max-w-64" />}
        >
          <BookmarkIcon data-icon="inline-start" />
          <span className="truncate">{active?.name ?? t("views.all")}</span>
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("views.title")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={active?.id ?? ""}
              onValueChange={(value) => {
                const view = data.data.find((item) => item.id === value)
                onSelect(view ? searchFromView(view) : null)
              }}
            >
              <DropdownMenuRadioItem value="" closeOnClick>
                {t("views.all")}
              </DropdownMenuRadioItem>
              {data.data.map((view) => (
                <DropdownMenuRadioItem
                  key={view.id}
                  value={view.id}
                  closeOnClick
                >
                  <span className="truncate">{view.name}</span>
                  {view.shared ? (
                    <>
                      <UsersIcon className="size-3.5" aria-hidden />
                      <span className="sr-only">{t("views.shared")}</span>
                    </>
                  ) : null}
                  {data.defaultViewId === view.id ? (
                    <>
                      <StarIcon className="size-3.5" aria-hidden />
                      <span className="sr-only">{t("views.default")}</span>
                    </>
                  ) : null}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {active && canUpdate ? (
              <DropdownMenuItem disabled={!dirty} onClick={saveCurrent}>
                <SaveIcon aria-hidden />
                {t("views.update")}
              </DropdownMenuItem>
            ) : null}
            {canCreate ? (
              <DropdownMenuItem onClick={() => setSaveAsOpen(true)}>
                <BookmarkIcon aria-hidden />
                {t("views.saveAs")}
              </DropdownMenuItem>
            ) : null}
            {active ? (
              <DropdownMenuItem
                onClick={() => setDefault.mutate(isDefault ? null : active.id)}
              >
                {isDefault ? (
                  <StarOffIcon aria-hidden />
                ) : (
                  <StarIcon aria-hidden />
                )}
                {isDefault ? t("views.unsetDefault") : t("views.setDefault")}
              </DropdownMenuItem>
            ) : null}
            {active && canDelete ? (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2Icon aria-hidden />
                {t("views.delete")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {active && dirty ? (
        <>
          <Badge variant="outline">{t("views.unsaved")}</Badge>
          {canUpdate ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={saveCurrent}
              disabled={updateView.isPending}
            >
              <SaveIcon data-icon="inline-start" />
              {t("views.saveChanges")}
            </Button>
          ) : null}
        </>
      ) : null}

      <SaveViewDialog
        open={saveAsOpen}
        onOpenChange={setSaveAsOpen}
        objectKey={objectKey}
        search={search}
        onSaved={(view) => onSelect(searchFromView(view))}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("views.deleteTitle")}
        description={
          active
            ? t("views.deleteDescription", { name: active.name })
            : undefined
        }
        confirmLabel={t("common:actions.delete")}
        variant="destructive"
        isPending={deleteView.isPending}
        onConfirm={async () => {
          if (!active) return
          await deleteView.mutateAsync(active.id)
          onSelect(null)
        }}
      />
    </div>
  )
}
