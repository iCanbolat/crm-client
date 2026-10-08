import type {
  FieldDef,
  I18nTextValue,
  ObjectDef,
  OptionColor,
  SelectOption,
} from "@/engine/metadata"

/**
 * Core CRM objects every workspace starts with (server-side seed). Tenants
 * customize them through the metadata API; sector modules extend them (B3.1).
 */

const t = (tr: string, en: string): I18nTextValue => ({ tr, en })

const option = (
  value: string,
  tr: string,
  en: string,
  color?: OptionColor
): SelectOption => ({ value, label: t(tr, en), ...(color ? { color } : {}) })

/** Owner, tags and timestamps — present on every core object. */
function systemFields(): FieldDef[] {
  return [
    {
      key: "ownerId",
      label: t("Sahip", "Owner"),
      type: "user",
      required: true,
      system: true,
    },
    {
      key: "tags",
      label: t("Etiketler", "Tags"),
      type: "multiselect",
      system: true,
      options: [
        option("vip", "VIP", "VIP", "violet"),
        option("hot", "Sıcak", "Hot", "red"),
        option("cold", "Soğuk", "Cold", "blue"),
        option("followUp", "Takip", "Follow-up", "amber"),
        option("partner", "Partner", "Partner", "teal"),
      ],
    },
    {
      key: "createdAt",
      label: t("Oluşturulma", "Created"),
      type: "datetime",
      system: true,
      readOnly: true,
    },
    {
      key: "updatedAt",
      label: t("Son güncelleme", "Last updated"),
      type: "datetime",
      system: true,
      readOnly: true,
    },
  ]
}

const SYSTEM_SECTION = {
  key: "system",
  label: t("Sahiplik ve kayıt bilgisi", "Ownership & record info"),
  fields: ["ownerId", "tags", "createdAt", "updatedAt"],
}

const newestFirst = { field: "createdAt", direction: "desc" } as const

/** WhatsApp consent (Faz 6): utility templates need an explicit opt-in. */
function whatsappOptInFields(): FieldDef[] {
  return [
    {
      key: "whatsappOptIn",
      label: t("WhatsApp bildirim izni", "WhatsApp opt-in"),
      type: "boolean",
      system: true,
      helpText: t(
        "Sevkiyat ve teklif bildirimleri WhatsApp ile gönderilebilir.",
        "Shipment and quote updates may be sent over WhatsApp."
      ),
    },
    {
      key: "whatsappOptInAt",
      label: t("WhatsApp izin tarihi", "WhatsApp opt-in date"),
      type: "datetime",
      system: true,
      readOnly: true,
    },
  ]
}

export const INDUSTRIES = [
  option("logistics", "Lojistik", "Logistics", "blue"),
  option("manufacturing", "Üretim", "Manufacturing", "violet"),
  option("retail", "Perakende", "Retail", "amber"),
  option("ecommerce", "E-ticaret", "E-commerce", "teal"),
  option("automotive", "Otomotiv", "Automotive", "gray"),
  option("textile", "Tekstil", "Textile", "red"),
  option("food", "Gıda", "Food", "green"),
  option("chemicals", "Kimya", "Chemicals", "gray"),
  option("other", "Diğer", "Other", "gray"),
]

export function companyObject(): ObjectDef {
  return {
    key: "company",
    label: t("Şirket", "Company"),
    pluralLabel: t("Şirketler", "Companies"),
    icon: "building",
    primaryField: "name",
    searchFields: ["name", "domain", "email", "taxNumber"],
    fields: [
      {
        key: "name",
        label: t("Şirket adı", "Company name"),
        type: "text",
        required: true,
        system: true,
        validation: { max: 120 },
      },
      { key: "domain", label: t("Web sitesi", "Website"), type: "url" },
      {
        key: "industry",
        label: t("Sektör", "Industry"),
        type: "select",
        options: INDUSTRIES,
      },
      { key: "email", label: t("E-posta", "Email"), type: "email" },
      { key: "phone", label: t("Telefon", "Phone"), type: "phone" },
      { key: "country", label: t("Ülke", "Country"), type: "country" },
      { key: "city", label: t("Şehir", "City"), type: "text" },
      {
        key: "taxNumber",
        label: t("Vergi numarası", "Tax number"),
        type: "text",
        validation: { pattern: "^[0-9]{10,11}$" },
      },
      {
        key: "employees",
        label: t("Çalışan sayısı", "Employees"),
        type: "number",
        validation: { min: 0 },
      },
      {
        key: "annualRevenue",
        label: t("Yıllık ciro", "Annual revenue"),
        type: "currency",
        validation: { min: 0 },
      },
      {
        key: "description",
        label: t("Notlar", "Notes"),
        type: "textarea",
      },
      ...systemFields(),
    ],
    layouts: {
      list: {
        columns: [
          "name",
          "industry",
          "country",
          "city",
          "phone",
          "ownerId",
          "createdAt",
        ],
        defaultSort: newestFirst,
      },
      detail: {
        highlights: ["industry", "country", "ownerId"],
        sections: [
          {
            key: "overview",
            label: t("Genel bilgiler", "Overview"),
            fields: [
              "name",
              "industry",
              "domain",
              "taxNumber",
              "employees",
              "annualRevenue",
            ],
          },
          {
            key: "contact",
            label: t("İletişim", "Contact"),
            fields: ["email", "phone", "country", "city"],
          },
          SYSTEM_SECTION,
          {
            key: "notes",
            label: t("Notlar", "Notes"),
            fields: ["description"],
          },
        ],
        related: [
          { objectKey: "contact", field: "companyId" },
          { objectKey: "deal", field: "companyId" },
        ],
      },
    },
  }
}

export function contactObject(): ObjectDef {
  return {
    key: "contact",
    label: t("Kişi", "Contact"),
    pluralLabel: t("Kişiler", "Contacts"),
    icon: "contact",
    primaryField: "name",
    searchFields: ["name", "email", "phone"],
    fields: [
      {
        key: "name",
        label: t("Ad soyad", "Full name"),
        type: "text",
        required: true,
        system: true,
        validation: { max: 120 },
      },
      { key: "title", label: t("Ünvan", "Job title"), type: "text" },
      {
        key: "companyId",
        label: t("Şirket", "Company"),
        type: "relation",
        relation: { objectKey: "company", displayField: "name" },
      },
      { key: "email", label: t("E-posta", "Email"), type: "email" },
      { key: "phone", label: t("Telefon", "Phone"), type: "phone" },
      { key: "country", label: t("Ülke", "Country"), type: "country" },
      ...whatsappOptInFields(),
      ...systemFields(),
    ],
    layouts: {
      list: {
        columns: ["name", "companyId", "title", "email", "phone", "ownerId"],
        defaultSort: newestFirst,
      },
      detail: {
        highlights: ["companyId", "title", "ownerId"],
        sections: [
          {
            key: "overview",
            label: t("Kişi bilgileri", "Contact details"),
            fields: ["name", "title", "companyId"],
          },
          {
            key: "contact",
            label: t("İletişim", "Contact"),
            fields: [
              "email",
              "phone",
              "country",
              "whatsappOptIn",
              "whatsappOptInAt",
            ],
          },
          SYSTEM_SECTION,
        ],
        related: [{ objectKey: "deal", field: "contactId" }],
      },
    },
  }
}

export const LEAD_SOURCES = [
  option("webForm", "Web formu", "Web form", "blue"),
  option("email", "E-posta", "Email", "teal"),
  option("phone", "Telefon", "Phone", "violet"),
  option("referral", "Referans", "Referral", "green"),
  option("fair", "Fuar", "Trade fair", "amber"),
  option("agent", "Acente", "Agent", "gray"),
  option("other", "Diğer", "Other", "gray"),
]

export function leadObject(): ObjectDef {
  return {
    key: "lead",
    label: t("Lead", "Lead"),
    pluralLabel: t("Lead'ler", "Leads"),
    icon: "inbox",
    primaryField: "name",
    searchFields: ["name", "companyName", "email", "phone"],
    fields: [
      {
        key: "name",
        label: t("Ad soyad", "Full name"),
        type: "text",
        required: true,
        system: true,
        validation: { max: 120 },
      },
      {
        key: "companyName",
        label: t("Şirket adı", "Company name"),
        type: "text",
      },
      { key: "email", label: t("E-posta", "Email"), type: "email" },
      { key: "phone", label: t("Telefon", "Phone"), type: "phone" },
      { key: "country", label: t("Ülke", "Country"), type: "country" },
      ...whatsappOptInFields(),
      {
        key: "source",
        label: t("Kaynak", "Source"),
        type: "select",
        options: LEAD_SOURCES,
      },
      {
        key: "stage",
        label: t("Aşama", "Stage"),
        type: "select",
        required: true,
        system: true,
        options: [
          option("new", "Yeni", "New", "blue"),
          option("contacted", "İletişim kuruldu", "Contacted", "amber"),
          option("qualified", "Nitelikli", "Qualified", "violet"),
          option("converted", "Dönüştürüldü", "Converted", "green"),
          option("lost", "Kayıp", "Lost", "red"),
        ],
      },
      {
        key: "lostReason",
        label: t("Kayıp nedeni", "Lost reason"),
        type: "select",
        system: true,
        options: [
          option("price", "Fiyat", "Price"),
          option("noResponse", "Yanıt yok", "No response"),
          option("notQualified", "Uygun değil", "Not a fit"),
          option("competitor", "Rakip tercih edildi", "Chose a competitor"),
          option("other", "Diğer", "Other"),
        ],
      },
      {
        key: "estimatedValue",
        label: t("Tahmini değer", "Estimated value"),
        type: "currency",
        validation: { min: 0 },
      },
      { key: "message", label: t("Mesaj", "Message"), type: "textarea" },
      // Set by the conversion (POST /leads/:id/convert, B3.3).
      {
        key: "convertedCompanyId",
        label: t("Dönüştürülen şirket", "Converted company"),
        type: "relation",
        relation: { objectKey: "company", displayField: "name" },
        system: true,
        readOnly: true,
      },
      {
        key: "convertedContactId",
        label: t("Dönüştürülen kişi", "Converted contact"),
        type: "relation",
        relation: { objectKey: "contact", displayField: "name" },
        system: true,
        readOnly: true,
      },
      {
        key: "convertedDealId",
        label: t("Oluşturulan fırsat", "Created deal"),
        type: "relation",
        relation: { objectKey: "deal", displayField: "name" },
        system: true,
        readOnly: true,
      },
      ...systemFields(),
    ],
    pipeline: {
      field: "stage",
      amountField: "estimatedValue",
      stages: [
        { key: "new", label: t("Yeni", "New"), kind: "open", color: "blue" },
        {
          key: "contacted",
          label: t("İletişim kuruldu", "Contacted"),
          kind: "open",
          color: "amber",
        },
        {
          key: "qualified",
          label: t("Nitelikli", "Qualified"),
          kind: "open",
          color: "violet",
        },
        {
          key: "converted",
          label: t("Dönüştürüldü", "Converted"),
          kind: "won",
          color: "green",
        },
        {
          key: "lost",
          label: t("Kayıp", "Lost"),
          kind: "lost",
          color: "red",
          requiredFields: ["lostReason"],
        },
      ],
    },
    layouts: {
      list: {
        columns: [
          "name",
          "companyName",
          "stage",
          "source",
          "estimatedValue",
          "ownerId",
          "createdAt",
        ],
        defaultSort: newestFirst,
      },
      detail: {
        highlights: ["stage", "source", "ownerId"],
        sections: [
          {
            key: "contact",
            label: t("İletişim bilgileri", "Contact details"),
            fields: [
              "name",
              "companyName",
              "email",
              "phone",
              "country",
              "whatsappOptIn",
              "whatsappOptInAt",
            ],
          },
          {
            key: "qualification",
            label: t("Değerlendirme", "Qualification"),
            fields: [
              "stage",
              "source",
              "estimatedValue",
              "lostReason",
              "convertedCompanyId",
              "convertedContactId",
              "convertedDealId",
            ],
          },
          SYSTEM_SECTION,
          { key: "notes", label: t("Mesaj", "Message"), fields: ["message"] },
        ],
        related: [],
      },
    },
  }
}

export function dealObject(): ObjectDef {
  return {
    key: "deal",
    label: t("Fırsat", "Deal"),
    pluralLabel: t("Fırsatlar", "Deals"),
    icon: "hand-coins",
    primaryField: "name",
    searchFields: ["name"],
    fields: [
      {
        key: "name",
        label: t("Fırsat adı", "Deal name"),
        type: "text",
        required: true,
        system: true,
        validation: { max: 160 },
      },
      {
        key: "companyId",
        label: t("Şirket", "Company"),
        type: "relation",
        relation: { objectKey: "company", displayField: "name" },
      },
      {
        key: "contactId",
        label: t("Kişi", "Contact"),
        type: "relation",
        relation: { objectKey: "contact", displayField: "name" },
      },
      {
        key: "amount",
        label: t("Tutar", "Amount"),
        type: "currency",
        validation: { min: 0 },
      },
      {
        key: "stage",
        label: t("Aşama", "Stage"),
        type: "select",
        required: true,
        system: true,
        options: [
          option("qualification", "Değerlendirme", "Qualification", "blue"),
          option("proposal", "Teklif", "Proposal", "violet"),
          option("negotiation", "Müzakere", "Negotiation", "amber"),
          option("won", "Kazanıldı", "Won", "green"),
          option("lost", "Kaybedildi", "Lost", "red"),
        ],
      },
      {
        key: "probability",
        label: t("Olasılık", "Probability"),
        type: "percent",
      },
      {
        key: "closeDate",
        label: t("Tahmini kapanış", "Expected close"),
        type: "date",
      },
      {
        key: "lostReason",
        label: t("Kayıp nedeni", "Lost reason"),
        type: "select",
        system: true,
        options: [
          option("price", "Fiyat", "Price"),
          option("timing", "Zamanlama", "Timing"),
          option("competitor", "Rakip tercih edildi", "Chose a competitor"),
          option("noDecision", "Karar çıkmadı", "No decision"),
          option("other", "Diğer", "Other"),
        ],
      },
      { key: "description", label: t("Notlar", "Notes"), type: "textarea" },
      ...systemFields(),
    ],
    pipeline: {
      field: "stage",
      amountField: "amount",
      stages: [
        {
          key: "qualification",
          label: t("Değerlendirme", "Qualification"),
          kind: "open",
          color: "blue",
        },
        {
          key: "proposal",
          label: t("Teklif", "Proposal"),
          kind: "open",
          color: "violet",
        },
        {
          key: "negotiation",
          label: t("Müzakere", "Negotiation"),
          kind: "open",
          color: "amber",
        },
        {
          key: "won",
          label: t("Kazanıldı", "Won"),
          kind: "won",
          color: "green",
        },
        {
          key: "lost",
          label: t("Kaybedildi", "Lost"),
          kind: "lost",
          color: "red",
          requiredFields: ["lostReason"],
        },
      ],
    },
    layouts: {
      list: {
        columns: [
          "name",
          "companyId",
          "stage",
          "amount",
          "closeDate",
          "ownerId",
        ],
        defaultSort: newestFirst,
      },
      detail: {
        highlights: ["stage", "amount", "closeDate"],
        sections: [
          {
            key: "overview",
            label: t("Fırsat bilgileri", "Deal details"),
            fields: [
              "name",
              "companyId",
              "contactId",
              "amount",
              "probability",
              "closeDate",
            ],
          },
          {
            key: "status",
            label: t("Durum", "Status"),
            fields: ["stage", "lostReason"],
          },
          SYSTEM_SECTION,
          {
            key: "notes",
            label: t("Notlar", "Notes"),
            fields: ["description"],
          },
        ],
        related: [],
      },
    },
  }
}

export function coreObjects(): ObjectDef[] {
  return [companyObject(), contactObject(), leadObject(), dealObject()]
}
