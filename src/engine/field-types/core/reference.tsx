import { Link } from "@tanstack/react-router"
import { Link2Icon, UserIcon } from "lucide-react"
import { z } from "zod"

import { UserAvatar } from "@/components/common/user-avatar"

import type { RecordRef } from "../../metadata/schemas"
import { lazyFieldInput } from "../lazy"
import { useFieldServices } from "../services"
import type { FieldTypeDefinition } from "../types"
import { EmptyValue } from "../ui"
import { isBlank, textComparable } from "./shared"

const ID_OPERATORS = ["in", "notIn", "isEmpty", "isNotEmpty"] as const

/* ------------------------------------------------------------------- user */

function useUserLabel(
  id: string | null | undefined,
  refValue?: RecordRef | null
) {
  const { users } = useFieldServices()
  if (!id) return null
  return refValue?.label ?? users.find((user) => user.id === id)?.name ?? id
}

function UserCell({
  value,
  refValue,
}: {
  value: string | null | undefined
  refValue?: RecordRef | null
}) {
  const name = useUserLabel(value, refValue)
  if (!name) return <EmptyValue />
  return (
    <span className="inline-flex items-center gap-2">
      <UserAvatar name={name} className="size-6" />
      <span className="truncate">{name}</span>
    </span>
  )
}

export const userFieldType: FieldTypeDefinition<string> = {
  type: "user",
  icon: UserIcon,
  toZod: () => z.string().min(1),
  isEmpty: isBlank,
  toComparable: textComparable,
  format: (value, { refValue }) => refValue?.label ?? value,
  filterOperators: ID_OPERATORS,
  sortable: true,
  getOptions: (_field, { services }) =>
    services.users.map((user) => ({ value: user.id, label: user.name })),
  creatable: true,
  Cell: UserCell,
  Input: lazyFieldInput(() =>
    import("./inputs").then((module) => module.UserInput)
  ),
}

/* --------------------------------------------------------------- relation */

function RelationCell({
  field,
  value,
  refValue,
}: {
  field: { relation?: { objectKey: string } }
  value: string | null | undefined
  refValue?: RecordRef | null
}) {
  const objectKey = field.relation?.objectKey
  if (!value || !objectKey) return <EmptyValue />
  return (
    <Link
      to="/o/$objectKey/$recordId"
      params={{ objectKey, recordId: value }}
      className="text-primary underline-offset-4 hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {refValue?.label ?? value}
    </Link>
  )
}

export const relationFieldType: FieldTypeDefinition<string> = {
  type: "relation",
  icon: Link2Icon,
  toZod: () => z.string().min(1),
  isEmpty: isBlank,
  toComparable: textComparable,
  format: (value, { refValue }) => refValue?.label ?? value,
  filterOperators: ["eq", "neq", "isEmpty", "isNotEmpty"],
  sortable: false,
  config: "relation",
  creatable: true,
  Cell: RelationCell,
  Input: lazyFieldInput(() =>
    import("./inputs").then((module) => module.RelationInput)
  ),
}
