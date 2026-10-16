import { z } from "zod"

const stageCount = z.object({ stage: z.string(), count: z.number() })
const money = z.object({ amount: z.number(), currency: z.string() })

/** One response feeds every visa & education widget (B8.10). */
export const visaEducationDashboardSchema = z.object({
  range: z.object({ from: z.string(), to: z.string() }),
  currency: z.string(),
  openInquiries: z.object({
    total: z.number(),
    byService: z.array(z.object({ service: z.string(), count: z.number() })),
  }),
  approvalRate: z.object({
    approved: z.number(),
    refused: z.number(),
    /** 0…100, `null` without decisions. */
    rate: z.number().nullable(),
  }),
  enrollmentsByStage: z.array(stageCount),
  visasByStage: z.array(stageCount),
  upcomingAppointments: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      scheduledAt: z.string(),
      applicant: z.string().nullable(),
    })
  ),
  missingDocuments: z.array(
    z.object({
      objectKey: z.string(),
      id: z.string(),
      number: z.string(),
      applicant: z.string().nullable(),
      missing: z.number(),
    })
  ),
  overdueInstallments: z.array(
    z.object({
      objectKey: z.string(),
      id: z.string(),
      number: z.string(),
      applicant: z.string().nullable(),
      amount: money,
      dueDate: z.string(),
    })
  ),
  intakeForecast: z.array(
    z.object({ year: z.number(), month: z.number(), count: z.number() })
  ),
  commission: z.object({ expected: z.number(), received: z.number() }),
})
export type VisaEducationDashboard = z.infer<
  typeof visaEducationDashboardSchema
>
