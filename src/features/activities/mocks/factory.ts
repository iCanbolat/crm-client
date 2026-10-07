import { addDays } from "date-fns"

import { seedRecords } from "@/features/records/mocks/factory"
import { createSeededFaker, MOCK_REFERENCE_DATE } from "@/mocks/db/faker"
import { getRecordOwners, WORKSPACE_IDS } from "@/mocks/db/seed"

import type {
  Activity,
  ActivityType,
  Task,
  TaskPriority,
} from "../api/activities.schemas"
import { toDay } from "../lib/tasks"

/** Stored shapes: tenant scoped, names are joined on read. */
export interface ActivityRow extends Omit<Activity, "createdByName"> {
  workspaceId: string
}

export interface TaskRow extends Omit<Task, "assigneeName" | "related"> {
  workspaceId: string
  related: { objectKey: string; recordId: string } | null
}

const SUBJECTS: Record<Exclude<ActivityType, "note">, string[]> = {
  call: [
    "Fiyat görüşmesi",
    "Tanışma araması",
    "Takip araması",
    "Teklif değerlendirmesi",
  ],
  email: [
    "Teklif gönderildi",
    "Navlun bilgisi istendi",
    "Sözleşme taslağı",
    "Teşekkür e-postası",
  ],
  meeting: [
    "Ofis ziyareti",
    "Online demo",
    "Yıllık değerlendirme",
    "Depo ziyareti",
  ],
}

const NOTES = [
  "Müşteri aylık 20 konteyner hacim bekliyor.",
  "Fiyat beklentisi rakip teklifin %5 altında.",
  "Karar verici satın alma müdürü; ay sonuna kadar dönüş yapacak.",
  "Tehlikeli madde taşımacılığı için ek belge istendi.",
  "Ödeme vadesi 60 gün olarak talep edildi.",
  "Hamburg hattı için haftalık sefer bilgisi paylaşıldı.",
]

const TASK_TITLES = [
  "Teklifi revize et",
  "Müşteriyi ara",
  "Sözleşme taslağını gönder",
  "Navlun fiyatlarını güncelle",
  "Toplantı notlarını paylaş",
  "Referans kontrolü yap",
  "Fuar sonrası takip e-postası",
  "Gümrük evraklarını iste",
]

let activityCache: ActivityRow[] | null = null

export function seedActivities(): ActivityRow[] {
  activityCache ??= [WORKSPACE_IDS.acme, WORKSPACE_IDS.marmara].flatMap(
    (workspaceId) => {
      const faker = createSeededFaker(`activities:${workspaceId}`)
      const owners = getRecordOwners(workspaceId)
      const records = seedRecords().filter(
        (row) =>
          row.workspaceId === workspaceId &&
          (row.objectKey === "lead" ||
            row.objectKey === "deal" ||
            row.objectKey === "company")
      )
      const sample = faker.helpers.arrayElements(
        records,
        workspaceId === WORKSPACE_IDS.acme ? 60 : 10
      )
      return sample.flatMap((record) =>
        Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () => {
          const type = faker.helpers.arrayElement([
            "note",
            "call",
            "email",
            "meeting",
          ] as const)
          const occurredAt = faker.date
            .recent({ days: 60, refDate: MOCK_REFERENCE_DATE })
            .toISOString()
          return {
            id: `act_${faker.string.alphanumeric({ length: 12, casing: "lower" })}`,
            workspaceId,
            type,
            subject:
              type === "note"
                ? null
                : faker.helpers.arrayElement(SUBJECTS[type]),
            body: faker.helpers.arrayElement(NOTES),
            occurredAt,
            durationMinutes:
              type === "call" || type === "meeting"
                ? faker.helpers.arrayElement([10, 15, 30, 45, 60])
                : null,
            direction:
              type === "call" || type === "email"
                ? faker.helpers.arrayElement(["outbound", "inbound"] as const)
                : null,
            objectKey: record.objectKey,
            recordId: record.id,
            createdBy: faker.helpers.arrayElement(owners),
            createdAt: occurredAt,
          } satisfies ActivityRow
        })
      )
    }
  )
  return activityCache
}

/**
 * Due dates are relative to the real "today" so the demo always has tasks
 * due today, overdue and upcoming (offsets stay deterministic).
 */
export function seedTasks(): TaskRow[] {
  const today = new Date()
  return [WORKSPACE_IDS.acme, WORKSPACE_IDS.marmara].flatMap((workspaceId) => {
    const faker = createSeededFaker(`tasks:${workspaceId}`)
    const owners = getRecordOwners(workspaceId)
    const records = seedRecords().filter(
      (row) =>
        row.workspaceId === workspaceId &&
        (row.objectKey === "lead" || row.objectKey === "deal")
    )
    const count = workspaceId === WORKSPACE_IDS.acme ? 40 : 6
    return Array.from({ length: count }, (_, index) => {
      const offset = faker.number.int({ min: -10, max: 14 })
      const pinnedToToday = index < owners.length
      // Every owner keeps an open task due today.
      const done =
        faker.datatype.boolean({ probability: 0.2 }) && !pinnedToToday
      const record = faker.helpers.maybe(
        () => faker.helpers.arrayElement(records),
        {
          probability: 0.8,
        }
      )
      const createdAt = addDays(
        MOCK_REFERENCE_DATE,
        -faker.number.int({ min: 1, max: 30 })
      )
      return {
        id: `tsk_${workspaceId.slice(3)}_${String(index + 1).padStart(3, "0")}`,
        workspaceId,
        title: faker.helpers.arrayElement(TASK_TITLES),
        description:
          faker.helpers.maybe(() => faker.helpers.arrayElement(NOTES), {
            probability: 0.4,
          }) ?? null,
        dueDate: toDay(addDays(today, pinnedToToday ? 0 : offset)),
        priority: faker.helpers.arrayElement([
          "low",
          "medium",
          "high",
        ] as const satisfies readonly TaskPriority[]),
        status: done ? "done" : "open",
        assigneeId: owners[index % owners.length]!,
        completedAt: done ? addDays(today, -1).toISOString() : null,
        related: record
          ? { objectKey: record.objectKey, recordId: record.id }
          : null,
        createdBy: faker.helpers.arrayElement(owners),
        createdAt: createdAt.toISOString(),
      } satisfies TaskRow
    })
  })
}
