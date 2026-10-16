import {
  BookOpenIcon,
  CalendarClockIcon,
  GraduationCapIcon,
  SchoolIcon,
  StampIcon,
  UsersIcon,
} from "lucide-react"

import { lazy } from "react"

import type { ModuleManifest } from "@/engine/modules"

import { visaEducationFieldTypes } from "./field-types"
import { visaEducationFormBlocks } from "./form-blocks"
import { visaEducationReports } from "./reports"
import {
  visaEducationMessageTemplates,
  visaEducationMessageTriggers,
} from "./message-templates"
import { APPLICANT_FILTERS } from "./lib/constants"
import { visaEducationConversion } from "./metadata/conversion"
import { contactExtension, leadExtension } from "./metadata/extend"
import {
  appointmentObject,
  enrollmentObject,
  institutionObject,
  programObject,
  visaApplicationObject,
} from "./metadata/objects"

type WidgetName = keyof typeof import("./components/dashboard/widgets")

/** Widgets load with the dashboard, not the app shell (B7.4). */
const widget = (name: WidgetName) =>
  lazy(() =>
    import("./components/dashboard/widgets").then((module) => ({
      default: module[name],
    }))
  )

/** Record page cards load with the record page, not the app shell. */
const EnquirySummaryCard = lazy(() =>
  import("./components/profile-cards").then((module) => ({
    default: module.EnquirySummaryCard,
  }))
)
const ApplicantProfileCard = lazy(() =>
  import("./components/profile-cards").then((module) => ({
    default: module.ApplicantProfileCard,
  }))
)
const OfferCard = lazy(() =>
  import("./components/application-cards").then((module) => ({
    default: module.OfferCard,
  }))
)
const EligibilityCard = lazy(() =>
  import("./components/application-cards").then((module) => ({
    default: module.EligibilityCard,
  }))
)
const CommissionCard = lazy(() =>
  import("./components/application-cards").then((module) => ({
    default: module.CommissionCard,
  }))
)
const AppointmentsCard = lazy(() =>
  import("./components/application-cards").then((module) => ({
    default: module.AppointmentsCard,
  }))
)
const ChecklistCard = lazy(() =>
  import("./components/checklist-card").then((module) => ({
    default: module.ChecklistCard,
  }))
)
const PaymentPlanCard = lazy(() =>
  import("./components/payment-plan-card").then((module) => ({
    default: module.PaymentPlanCard,
  }))
)

/** Visa & education consultancy module — Faz 8. */
export const visaEducationModule: ModuleManifest = {
  id: "visa-education",
  status: "active",
  label: { tr: "Vize & Eğitim Danışmanlığı", en: "Visa & Education" },
  description: {
    tr: "Başvuranlar, okul ve vize başvuruları, belge kontrol listeleri, randevular ve ödeme planları.",
    en: "Applicants, school and visa applications, document checklists, appointments and payment plans.",
  },
  icon: GraduationCapIcon,
  objects: [
    institutionObject(),
    programObject(),
    enrollmentObject(),
    visaApplicationObject(),
    appointmentObject(),
  ],
  extend: {
    lead: leadExtension,
    contact: contactExtension,
  },
  fieldTypes: visaEducationFieldTypes,
  formBlocks: visaEducationFormBlocks,
  recordSlots: {
    "lead.detail.sidebar": [
      { id: "visa-education.enquiry", component: EnquirySummaryCard },
    ],
    "contact.detail.sidebar": [
      { id: "visa-education.applicant", component: ApplicantProfileCard },
    ],
    "enrollment.detail.main": [
      { id: "visa-education.offer", component: OfferCard },
      { id: "visa-education.checklist", component: ChecklistCard },
      { id: "visa-education.payments", component: PaymentPlanCard },
    ],
    "enrollment.detail.sidebar": [
      { id: "visa-education.eligibility", component: EligibilityCard },
      { id: "visa-education.commission", component: CommissionCard },
    ],
    "visaApplication.detail.main": [
      { id: "visa-education.checklist", component: ChecklistCard },
      { id: "visa-education.payments", component: PaymentPlanCard },
    ],
    "visaApplication.detail.sidebar": [
      { id: "visa-education.appointments", component: AppointmentsCard },
    ],
  },
  leadConversion: visaEducationConversion,
  messageTemplates: visaEducationMessageTemplates,
  messageTriggers: visaEducationMessageTriggers,
  reports: visaEducationReports,
  dashboardWidgets: [
    {
      id: "visa-education.inquiries",
      size: 1,
      component: widget("OpenInquiriesWidget"),
    },
    {
      id: "visa-education.approvalRate",
      size: 1,
      component: widget("ApprovalRateWidget"),
    },
    {
      id: "visa-education.commission",
      size: 2,
      component: widget("CommissionWidget"),
    },
    {
      id: "visa-education.enrollments",
      size: 2,
      component: widget("EnrollmentStagesWidget"),
    },
    {
      id: "visa-education.visas",
      size: 2,
      component: widget("VisaStagesWidget"),
    },
    {
      id: "visa-education.appointments",
      size: 2,
      component: widget("UpcomingAppointmentsWidget"),
    },
    {
      id: "visa-education.missingDocuments",
      size: 2,
      component: widget("MissingDocumentsWidget"),
    },
    {
      id: "visa-education.overdue",
      size: 2,
      component: widget("OverdueInstallmentsWidget"),
    },
    {
      id: "visa-education.intakes",
      size: 2,
      component: widget("IntakeForecastWidget"),
    },
  ],
  navigation: [
    {
      id: "visa-education.applicants",
      label: { tr: "Başvuranlar", en: "Applicants" },
      icon: UsersIcon,
      to: "/o/$objectKey",
      params: { objectKey: "contact" },
      search: { filters: APPLICANT_FILTERS },
    },
    {
      id: "visa-education.enrollments",
      label: { tr: "Okul başvuruları", en: "School applications" },
      icon: GraduationCapIcon,
      to: "/o/$objectKey",
      params: { objectKey: "enrollment" },
    },
    {
      id: "visa-education.visas",
      label: { tr: "Vize başvuruları", en: "Visa applications" },
      icon: StampIcon,
      to: "/o/$objectKey",
      params: { objectKey: "visaApplication" },
    },
    {
      id: "visa-education.appointments",
      label: { tr: "Randevular", en: "Appointments" },
      icon: CalendarClockIcon,
      to: "/o/$objectKey",
      params: { objectKey: "appointment" },
    },
    {
      id: "visa-education.institutions",
      label: { tr: "Kurumlar", en: "Institutions" },
      icon: SchoolIcon,
      to: "/o/$objectKey",
      params: { objectKey: "institution" },
    },
    {
      id: "visa-education.programs",
      label: { tr: "Programlar", en: "Programmes" },
      icon: BookOpenIcon,
      to: "/o/$objectKey",
      params: { objectKey: "program" },
    },
  ],
}
