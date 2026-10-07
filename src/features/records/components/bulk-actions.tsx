import { useSuspenseQuery } from "@tanstack/react-query"
import { TagIcon, Trash2Icon, UserRoundIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getField, getOptionLabel, type ObjectDef } from "@/engine/metadata"
import { usePermission } from "@/features/auth"
import { getCurrentLanguage } from "@/lib/i18n"

import { useBulkAction } from "../api/records.mutations"
import { directoryQueries } from "../api/records.queries"

interface BulkActionsProps {
  objectDef: ObjectDef
  ids: string[]
  onDone: () => void
}

/**
 * Assign, tag and delete the selected records. Agents may select anything;
 * the API skips records they do not own and reports them.
 */
export function BulkActions({ objectDef, ids, onDone }: BulkActionsProps) {
  const { t } = useTranslation(["records", "common"])
  const language = getCurrentLanguage()
  const { data: users } = useSuspenseQuery(directoryQueries.users())
  const mutation = useBulkAction(objectDef.key)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const canDeleteAny = usePermission("delete", "record")
  const canEdit = usePermission("create", "record")
  const tags = getField(objectDef, "tags")
  const assignable = users.data.filter((user) => user.role !== "viewer")

  async function run(input: Parameters<typeof mutation.mutateAsync>[0]) {
    try {
      await mutation.mutateAsync(input)
      onDone()
    } catch {
      // Toasted by the global mutation error handler.
    }
  }

  if (!canEdit) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" disabled={mutation.isPending} />
          }
        >
          <UserRoundIcon data-icon="inline-start" />
          {t("bulk.assign")}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          {assignable.map((user) => (
            <DropdownMenuItem
              key={user.id}
              onClick={() =>
                void run({ action: "assign", ids, ownerId: user.id })
              }
            >
              {user.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {tags?.options?.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                disabled={mutation.isPending}
              />
            }
          >
            <TagIcon data-icon="inline-start" />
            {t("bulk.addTag")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            {tags.options.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() =>
                  void run({ action: "addTag", ids, tag: option.value })
                }
              >
                {getOptionLabel(tags, option.value, language)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <Button
        variant="destructive"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => setConfirmDelete(true)}
      >
        <Trash2Icon data-icon="inline-start" />
        {t("common:actions.delete")}
      </Button>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("bulk.deleteTitle", { count: ids.length })}
        description={
          canDeleteAny
            ? t("bulk.deleteDescription", { count: ids.length })
            : t("bulk.deleteOwnDescription", { count: ids.length })
        }
        confirmLabel={t("common:actions.delete")}
        variant="destructive"
        isPending={mutation.isPending}
        onConfirm={async () => {
          // Rejections keep the dialog open.
          await mutation.mutateAsync({ action: "delete", ids })
          onDone()
        }}
      />
    </>
  )
}
