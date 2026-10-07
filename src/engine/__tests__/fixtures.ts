import type { FieldDef, ObjectDef } from "@/engine/metadata"

const t = (tr: string, en = tr) => ({ tr, en })

export const field = (
  key: string,
  type: string,
  extra: Partial<FieldDef> = {}
): FieldDef => ({ key, label: t(key), type, ...extra })

/** Small object exercising every core field type. */
export function testObject(): ObjectDef {
  return {
    key: "thing",
    label: t("Şey", "Thing"),
    pluralLabel: t("Şeyler", "Things"),
    icon: "box",
    primaryField: "name",
    searchFields: ["name", "email"],
    fields: [
      field("name", "text", {
        required: true,
        system: true,
        validation: { max: 20 },
      }),
      field("notes", "textarea"),
      field("count", "number", { validation: { min: 0, max: 10 } }),
      field("price", "currency"),
      field("ratio", "percent"),
      field("day", "date"),
      field("at", "datetime"),
      field("active", "boolean"),
      field("stage", "select", {
        required: true,
        options: [
          { value: "new", label: t("Yeni", "New"), color: "blue" },
          { value: "won", label: t("Kazanıldı", "Won"), color: "green" },
          { value: "lost", label: t("Kayıp", "Lost"), color: "red" },
        ],
      }),
      field("tags", "multiselect", {
        options: [
          { value: "vip", label: t("VIP") },
          { value: "hot", label: t("Sıcak", "Hot") },
        ],
      }),
      field("email", "email"),
      field("phone", "phone"),
      field("site", "url"),
      field("country", "country"),
      field("ownerId", "user", { required: true }),
      field("companyId", "relation", {
        relation: { objectKey: "company", displayField: "name" },
      }),
      field("files", "file"),
      field("reason", "select", {
        options: [{ value: "price", label: t("Fiyat", "Price") }],
      }),
      field("createdAt", "datetime", { readOnly: true, system: true }),
    ],
    pipeline: {
      field: "stage",
      amountField: "price",
      stages: [
        { key: "new", label: t("Yeni", "New"), kind: "open" },
        { key: "won", label: t("Kazanıldı", "Won"), kind: "won" },
        {
          key: "lost",
          label: t("Kayıp", "Lost"),
          kind: "lost",
          requiredFields: ["reason"],
        },
      ],
    },
    layouts: {
      list: { columns: ["name", "stage", "price"] },
      detail: {
        highlights: ["stage"],
        sections: [
          {
            key: "main",
            label: t("Ana", "Main"),
            fields: ["name", "stage", "price"],
          },
          { key: "meta", label: t("Meta"), fields: ["createdAt", "ownerId"] },
        ],
        related: [],
      },
    },
  }
}
