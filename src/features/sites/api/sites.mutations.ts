import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import {
  createDomain,
  deleteDomain,
  makeDomainPrimary,
  updateSite,
  verifyDomain,
} from "./sites.api"
import { siteKeys } from "./sites.keys"
import type { Domain, UpdateSiteInput } from "./sites.schemas"

export function useUpdateSite() {
  const { t } = useTranslation("sites")
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Partial<UpdateSiteInput>) => updateSite(input),
    meta: { successMessage: t("toast.saved") },
    onSuccess: (site) => queryClient.setQueryData(siteKeys.current(), site),
  })
}

/** Domains change the site's primary origin: refresh both. */
function useInvalidateSite() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: siteKeys.all })
}

export function useCreateDomain() {
  const { t } = useTranslation("sites")
  const invalidate = useInvalidateSite()

  return useMutation({
    mutationFn: createDomain,
    meta: { successMessage: t("toast.domainAdded") },
    onSuccess: invalidate,
  })
}

export function useVerifyDomain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: verifyDomain,
    onSuccess: (domain) =>
      queryClient.setQueryData<Domain[]>(siteKeys.domains(), (domains) =>
        domains?.map((item) => (item.id === domain.id ? domain : item))
      ),
  })
}

export function useMakeDomainPrimary() {
  const { t } = useTranslation("sites")
  const invalidate = useInvalidateSite()

  return useMutation({
    mutationFn: makeDomainPrimary,
    meta: { successMessage: t("toast.primaryChanged") },
    onSuccess: invalidate,
  })
}

export function useDeleteDomain() {
  const { t } = useTranslation("sites")
  const invalidate = useInvalidateSite()

  return useMutation({
    mutationFn: deleteDomain,
    meta: { successMessage: t("toast.domainRemoved") },
    onSuccess: invalidate,
  })
}
