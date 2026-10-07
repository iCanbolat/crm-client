import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowRightIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { LoadingSkeleton } from "@/components/common/loading-skeleton"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getFieldType } from "@/engine/field-types"
import type { Condition } from "@/engine/logic"
import {
  getField,
  getRecordTitle,
  label,
  type CrmRecord,
  type ObjectDef,
  type RelatedList as RelatedListDef,
} from "@/engine/metadata"
import { Can } from "@/features/auth"
import { getCurrentLanguage } from "@/lib/i18n"

import { recordQueries } from "../api/records.queries"
import { useObjectDef } from "../hooks/use-object-def"
import { RecordFormSheet } from "./record-form-sheet"

const RELATED_PAGE_SIZE = 5

interface RelatedListProps {
  parentDef: ObjectDef
  parent: CrmRecord
  related: RelatedListDef
}

/** Records of another object that point at this one (e.g. a company's contacts). */
export function RelatedList({ parentDef, parent, related }: RelatedListProps) {
  const { t } = useTranslation("records")
  const language = getCurrentLanguage()
  const relatedDef = useObjectDef(related.objectKey)
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const filters: Condition[] = [
    {
      field: related.field,
      op: "eq",
      value: parent.id,
      label: getRecordTitle(parentDef, parent),
    },
  ]
  const { data, isPending } = useQuery({
    ...recordQueries.list(related.objectKey, {
      page: 1,
      pageSize: RELATED_PAGE_SIZE,
      filters,
    }),
    enabled: !!relatedDef,
  })

  if (!relatedDef) return null

  const title = label(relatedDef.pluralLabel, language)
  const titleId = `related-${related.objectKey}-${related.field}`
  // Second list column (after the primary field) as a subtitle.
  const subtitleField = relatedDef.layouts.list.columns
    .filter((key) => key !== relatedDef.primaryField && key !== related.field)
    .map((key) => getField(relatedDef, key))
    .find(Boolean)

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h3 id={titleId}>
            {title}
            {data ? (
              <span className="ml-1.5 text-muted-foreground tabular-nums">
                ({data.meta.total})
              </span>
            ) : null}
          </h3>
        </CardTitle>
        <CardAction>
          <Can action="create" resource="record">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("related.add", {
                object: label(relatedDef.label, language),
              })}
              onClick={() =>
                relatedDef.createPath
                  ? void navigate({
                      to: relatedDef.createPath,
                      search: { [related.field]: parent.id },
                    } as never)
                  : setCreating(true)
              }
            >
              <PlusIcon />
            </Button>
          </Can>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isPending ? (
          <LoadingSkeleton rows={2} />
        ) : data && data.data.length ? (
          <>
            <ul aria-labelledby={titleId} className="flex flex-col divide-y">
              {data.data.map((record) => {
                const Cell = subtitleField
                  ? getFieldType(subtitleField.type).Cell
                  : null
                return (
                  <li key={record.id} className="flex flex-col gap-0.5 py-2">
                    <Link
                      to="/o/$objectKey/$recordId"
                      params={{
                        objectKey: relatedDef.key,
                        recordId: record.id,
                      }}
                      className="truncate text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {getRecordTitle(relatedDef, record)}
                    </Link>
                    {Cell && subtitleField ? (
                      <span className="truncate text-xs text-muted-foreground">
                        <Cell
                          field={subtitleField}
                          value={record.values[subtitleField.key]}
                          refValue={record.refs[subtitleField.key]}
                        />
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            {data.meta.total > data.data.length ? (
              <Link
                to="/o/$objectKey"
                params={{ objectKey: relatedDef.key }}
                search={{ filters }}
                className="inline-flex items-center gap-1 self-start text-sm text-primary underline-offset-4 hover:underline"
              >
                {t("related.viewAll", { count: data.meta.total })}
                <ArrowRightIcon className="size-3.5" aria-hidden />
              </Link>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("related.empty")}</p>
        )}
      </CardContent>
      <RecordFormSheet
        objectDef={relatedDef}
        open={creating}
        onOpenChange={setCreating}
        defaultValues={{ [related.field]: parent.id }}
        defaultRefs={{
          [related.field]: {
            id: parent.id,
            objectKey: parentDef.key,
            label: getRecordTitle(parentDef, parent),
          },
        }}
      />
    </Card>
  )
}
