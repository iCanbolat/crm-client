import { useTranslation } from "react-i18next"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Can } from "@/features/auth"

import type { ExampleListParams } from "../api/example.schemas"
import { CreateExampleForm } from "./create-example-form"
import { ExampleList } from "./example-list"

interface ExamplesCardProps {
  params: ExampleListParams
  onPageChange: (page: number) => void
}

export function ExamplesCard({ params, onPageChange }: ExamplesCardProps) {
  const { t } = useTranslation("example")

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("title")}</h2>
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Can action="create" resource="record">
          <CreateExampleForm />
        </Can>
        <ExampleList params={params} onPageChange={onPageChange} />
      </CardContent>
    </Card>
  )
}
