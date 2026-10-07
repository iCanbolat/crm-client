import { Link, useMatches, useParams } from "@tanstack/react-router"
import { Fragment } from "react"
import { useTranslation } from "react-i18next"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useObjectCrumb, useRecordCrumb } from "@/features/records"

import { useNavigation } from "../hooks/use-navigation"

/** Built from `staticData.crumb` of the matched routes. */
export function Breadcrumbs() {
  const { t } = useTranslation("shell")
  const matches = useMatches()
  const navigation = useNavigation()
  const navLinks = navigation.flatMap((group) => group.items)
  const params = useParams({ strict: false })
  // Object and record crumbs show live names from metadata / the record.
  const objectLabel = useObjectCrumb(params.objectKey)
  const recordLabel = useRecordCrumb(params.objectKey, params.recordId)

  const crumbs = matches.flatMap((match) => {
    const crumb = match.staticData.crumb
    if (!crumb) return []

    let label: string
    if (crumb === "object") {
      // Module objects without metadata yet: their navigation entry.
      label =
        objectLabel ??
        navLinks.find((item) => item.href === match.pathname)?.title ??
        t("crumbs.object")
    } else if (crumb === "objectSettings") {
      label = objectLabel ?? t("crumbs.objectSettings")
    } else if (crumb === "record") {
      label = recordLabel ?? t("crumbs.record")
    } else {
      label = t(`crumbs.${crumb}`)
    }

    return [{ id: match.id, label, pathname: match.pathname }]
  })

  if (crumbs.length === 0) return null

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <Fragment key={crumb.id}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem className="min-w-0">
                {isLast ? (
                  <BreadcrumbPage className="truncate">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link to={crumb.pathname} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
