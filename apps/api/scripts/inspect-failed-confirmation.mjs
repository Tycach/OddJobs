import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client.ts"

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL })
const client = new PrismaClient({ adapter })
try {
  const job = await client.job.findUnique({ where: { id: "88155e0e-5b64-4d88-a118-9d86d200bb56" }, select: { id: true, status: true, completionSubmittedAt: true } })
  process.stdout.write(`${JSON.stringify(job)}\n`)
} catch {
  process.stderr.write("Could not inspect the job status.\n")
  process.exitCode = 1
} finally {
  await client.$disconnect()
}
