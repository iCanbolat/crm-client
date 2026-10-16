import {
  BookOpenIcon,
  CalendarClockIcon,
  GraduationCapIcon,
  HandHeartIcon,
  SchoolIcon,
  StampIcon,
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
import { APPLICANT_FILTERS, SPONSOR_FILTERS } from "./lib/constants"
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
      {
        id: "visa-education.commission",
        component: CommissionCard,
        requiresField: "commissionExpected",
      },
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
  roleLabels: {
    manager: {
      label: { tr: "Ekip lideri", en: "Team lead" },
      description: {
        tr: "Tüm başvuruları görür, danışmanlara iş dağıtır, komisyonları izler.",
        en: "Sees every file, assigns counsellors and follows commissions.",
      },
    },
    agent: {
      label: { tr: "Danışman", en: "Counsellor" },
      description: {
        tr: "Kendisine atanan başvuranlar ve dosyalarla çalışır; komisyonları görmez.",
        en: "Works on the applicants and files assigned to them; no commissions.",
      },
    },
    viewer: {
      label: { tr: "Gözlemci", en: "Observer" },
      description: {
        tr: "Kayıtları salt okunur görür; pasaport ve doğum tarihi gizlidir.",
        en: "Read-only access; passports and dates of birth are hidden.",
      },
    },
  },
  // B2C consultancy (Faz 10): no companies or deals; leads are enquiries
  // and contacts are applicants (and their sponsors).
  coreObjects: {
    company: { enabled: false },
    deal: { enabled: false },
    lead: {
      label: { tr: "Talep", en: "Enquiry" },
      pluralLabel: { tr: "Talepler", en: "Enquiries" },
      hiddenFields: ["companyName"],
    },
    contact: {
      label: { tr: "Başvuran", en: "Applicant" },
      pluralLabel: { tr: "Başvuranlar", en: "Applicants" },
      icon: "users",
      hiddenFields: ["title"],
    },
  },
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
      sensitivity: "financial",
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
  navGroups: [
    {
      id: "visa-education.consulting",
      label: { tr: "Danışmanlık", en: "Consulting" },
      items: [
        { id: "visa-education.enquiries", objectKey: "lead" },
        {
          id: "visa-education.applicants",
          objectKey: "contact",
          search: { filters: APPLICANT_FILTERS },
        },
        {
          id: "visa-education.sponsors",
          objectKey: "contact",
          label: { tr: "Sponsorlar", en: "Sponsors" },
          icon: HandHeartIcon,
          search: { filters: SPONSOR_FILTERS },
        },
        {
          id: "visa-education.enrollments",
          objectKey: "enrollment",
          label: { tr: "Okul başvuruları", en: "School applications" },
          icon: GraduationCapIcon,
        },
        {
          id: "visa-education.visas",
          objectKey: "visaApplication",
          label: { tr: "Vize başvuruları", en: "Visa applications" },
          icon: StampIcon,
        },
        {
          id: "visa-education.appointments",
          objectKey: "appointment",
          label: { tr: "Randevular", en: "Appointments" },
          icon: CalendarClockIcon,
        },
      ],
    },
    {
      id: "visa-education.catalog",
      label: { tr: "Katalog", en: "Catalogue" },
      items: [
        {
          id: "visa-education.institutions",
          objectKey: "institution",
          label: { tr: "Kurumlar", en: "Institutions" },
          icon: SchoolIcon,
        },
        {
          id: "visa-education.programs",
          objectKey: "program",
          label: { tr: "Programlar", en: "Programmes" },
          icon: BookOpenIcon,
        },
      ],
    },
  ],
}
