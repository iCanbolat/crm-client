import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { recordKeys } from "@/features/records"

import {
  changeQuoteStatus,
  createQuote,
  reviseQuote,
  updateQuote,
} from "./quotes.api"
import { quoteKeys } from "./quotes.queries"
import type { Quote, QuoteInput, QuoteStatusInput } from "./quotes.schemas"

/** Quote headers, deals and shipments change together: refresh records. */
function refresh(queryClient: QueryClient, quote: Quote) {
  queryClient.setQueryData(quoteKeys.detail(quote.id), quote)
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: quoteKeys.details(quote.id) }),
    queryClient.invalidateQueries({ queryKey: recordKeys.all }),
  ])
}

export function useCreateQuote() {
  const { t } = useTranslation("forwarding")
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: QuoteInput) => createQuote(input),
    meta: { successMessage: t("quote.toast.created") },
    onSuccess: (quote) => refresh(queryClient, quote),
  })
}

export function useUpdateQuote(id: string) {
  const { t } = useTranslation("forwarding")
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: QuoteInput) => updateQuote(id, input),
    meta: { successMessage: t("quote.toast.saved") },
    onSuccess: (quote) => refresh(queryClient, quote),
  })
}

export function useReviseQuote(id: string) {
  const { t } = useTranslation("forwarding")
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => reviseQuote(id),
    meta: { successMessage: t("quote.toast.revised") },
    onSuccess: (quote) => refresh(queryClient, quote),
  })
}

export function useQuoteStatus(id: string) {
  const { t } = useTranslation("forwarding")
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: QuoteStatusInput) => changeQuoteStatus(id, input),
    meta: { successMessage: t("quote.toast.status") },
    onSuccess: (result) => refresh(queryClient, result.quote),
  })
}
