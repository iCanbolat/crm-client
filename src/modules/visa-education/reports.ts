import {
  FilterIcon,
  HandCoinsIcon,
  StampIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

import type { ReportDef } from "@/engine/reports"

import { t } from "./lib/constants"

/** Visa & education reports (B8.10); money columns in USD. */
export const visaEducationReports: ReportDef[] = [
  {
    key: "visaOutcomes",
    label: t("Vize sonuçları", "Visa outcomes"),
    description: t(
      "Ülke ve vize türüne göre başvuru, onay, ret, onay oranı ve sonuç süresi.",
      "Applications, approvals, refusals, approval rate and decision time per country and category."
    ),
    icon: StampIcon,
    columns: [
      { key: "country", label: t("Ülke", "Country"), kind: "text" },
      { key: "category", label: t("Vize türü", "Category"), kind: "text" },
      { key: "submitted", label: t("Başvurulan", "Submitted"), kind: "number" },
      { key: "approved", label: t("Onay", "Approved"), kind: "number" },
      { key: "refused", label: t("Ret", "Refused"), kind: "number" },
      {
        key: "approvalRate",
        label: t("Onay oranı", "Approval rate"),
        kind: "percent",
      },
      {
        key: "avgDays",
        label: t("Ort. sonuç süresi (gün)", "Avg. days to decision"),
        kind: "number",
      },
    ],
    chart: { kind: "bar", labelKey: "country", valueKey: "approvalRate" },
  },
  {
    key: "enrollmentFunnel",
    label: t("Okul başvurusu hunisi", "School application funnel"),
    description: t(
      "Danışmanlıktan başvuruya, kabullere ve kayda geçiş.",
      "From counselling to applications, offers and enrolment."
    ),
    icon: FilterIcon,
    columns: [
      { key: "stage", label: t("Aşama", "Stage"), kind: "text" },
      { key: "count", label: t("Dosya", "Files"), kind: "number" },
      {
        key: "ofStarted",
        label: t("Başlayanlara oranı", "Of started"),
        kind: "percent",
      },
      {
        key: "stepRate",
        label: t("Önceki adımdan geçiş", "From previous step"),
        kind: "percent",
      },
    ],
    chart: { kind: "funnel", labelKey: "stage", valueKey: "count" },
  },
  {
    key: "commissionByInstitution",
    sensitivity: "financial",
    label: t("Kurum bazlı komisyon", "Commission by institution"),
    description: t(
      "Kayıt olan öğrenciler için beklenen, tahsil edilen ve açık okul komisyonu.",
      "Expected, received and open school commission for enrolled students."
    ),
    icon: HandCoinsIcon,
    columns: [
      { key: "institution", label: t("Kurum", "Institution"), kind: "text" },
      { key: "country", label: t("Ülke", "Country"), kind: "text" },
      { key: "enrolled", label: t("Kayıt", "Enrolled"), kind: "number" },
      { key: "expected", label: t("Beklenen", "Expected"), kind: "currency" },
      {
        key: "received",
        label: t("Tahsil edilen", "Received"),
        kind: "currency",
      },
      { key: "open", label: t("Açık", "Open"), kind: "currency" },
    ],
    chart: { kind: "bar", labelKey: "institution", valueKey: "expected" },
  },
  {
    key: "counselorPerformance",
    label: t("Danışman performansı", "Counsellor performance"),
    description: t(
      "Danışman başına talep, okul başvurusu, kayıt, vize dosyası ve onay oranı.",
      "Enquiries, school applications, enrolments, visa files and approval rate per counsellor."
    ),
    icon: UsersIcon,
    columns: [
      { key: "name", label: t("Danışman", "Counsellor"), kind: "text" },
      { key: "leads", label: t("Talep", "Enquiries"), kind: "number" },
      {
        key: "enrollments",
        label: t("Okul başvurusu", "School apps"),
        kind: "number",
      },
      { key: "enrolled", label: t("Kayıt", "Enrolled"), kind: "number" },
      { key: "visas", label: t("Vize dosyası", "Visa files"), kind: "number" },
      {
        key: "approvalRate",
        label: t("Vize onay oranı", "Visa approval rate"),
        kind: "percent",
      },
      {
        key: "serviceFees",
        label: t("Hizmet bedeli", "Service fees"),
        kind: "currency",
      },
    ],
    chart: { kind: "bar", labelKey: "name", valueKey: "serviceFees" },
  },
  {
    key: "collections",
    label: t("Tahsilatlar", "Collections"),
    description: t(
      "Danışman başına planlanan hizmet bedeli, tahsil edilen, kalan ve geciken dosyalar.",
      "Planned service fees, collected, outstanding and overdue files per counsellor."
    ),
    icon: WalletIcon,
    columns: [
      { key: "name", label: t("Danışman", "Counsellor"), kind: "text" },
      {
        key: "files",
        label: t("Planlı dosya", "Files with a plan"),
        kind: "number",
      },
      {
        key: "billed",
        label: t("Hizmet bedeli", "Service fees"),
        kind: "currency",
      },
      {
        key: "collected",
        label: t("Tahsil edilen", "Collected"),
        kind: "currency",
      },
      {
        key: "outstanding",
        label: t("Kalan", "Outstanding"),
        kind: "currency",
      },
      {
        key: "overdue",
        label: t("Geciken dosya", "Overdue files"),
        kind: "number",
      },
    ],
    chart: { kind: "bar", labelKey: "name", valueKey: "collected" },
  },
]
