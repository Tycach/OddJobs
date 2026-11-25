import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { getHeapStatistics } from "node:v8"
import { buildApp } from "./app.js"
import { SupabaseTokenVerifier } from "./auth/supabase-verifier.js"
import { loadConfig } from "./config.js"
import { PrismaDatabase } from "./database.js"

export async function startServer(): Promise<void> {
  const config = loadConfig()
  const database = config.databaseUrl
    ? new PrismaDatabase(config.databaseUrl, config.databasePoolMax)
    : null
  const authVerifier =
    config.supabaseUrl && config.supabaseApiKey
      ? new SupabaseTokenVerifier(config.supabaseUrl, config.supabaseApiKey)
      : null
  const app = await buildApp({
    config,
    database,
    authVerifier,
    profileStore: database,
    adminStore: database,
    marketplaceStore: database,
  })

  try {
    await app.listen({ host: config.host, port: config.port })
    app.log.info({ host: config.host, port: config.port }, "OddJobs API listening")
  } catch (error) {
    app.log.error(error, "Unable to start OddJobs API")
    await app.close()
    process.exitCode = 1
    return
  }

  let reminderRunActive = false
  const runReminders = async () => {
    if (!database || reminderRunActive) return
    reminderRunActive = true
    try {
      const counts = await database.runMarketplaceReminders()
      if (counts.completionReviews || counts.commissions) app.log.info(counts, "Marketplace reminders queued")
    } catch (error) {
      app.log.error(error, "Unable to queue marketplace reminders")
    } finally {
      reminderRunActive = false
    }
  }
  void runReminders()
  const reminderTimer = database ? setInterval(() => void runReminders(), 15 * 60 * 1000) : null

  let monitoringRunActive = false
  const runMonitoringCheck = async () => {
    if (!database || monitoringRunActive) return
    monitoringRunActive = true
    try {
      const checkStartedAt = performance.now()
      await database.check()
      const databaseLatencyMs = Math.round(performance.now() - checkStartedAt)
      const signals = await database.getAdminMonitoringSnapshot()
      const memory = process.memoryUsage()
      const heapLimitBytes = getHeapStatistics().heap_size_limit
      const alerts: { severity: "critical" | "warning"; code: string; message: string }[] = []
      if (signals.pendingVerifications >= 20) alerts.push({ severity: "warning", code: "verification_backlog", message: signals.pendingVerifications + " provider verifications are waiting for review." })
      if (signals.pendingCustomerVerifications >= 20) alerts.push({ severity: "warning", code: "customer_verification_backlog", message: signals.pendingCustomerVerifications + " hirer identity checks are waiting for review." })
      if (signals.openReports >= 20) alerts.push({ severity: "warning", code: "moderation_backlog", message: signals.openReports + " moderation reports are open or being reviewed." })
      if (signals.openSupportCases >= 20) alerts.push({ severity: "warning", code: "support_backlog", message: signals.openSupportCases + " support cases are still active." })
      if (signals.overdueCommissionCount > 0) alerts.push({ severity: "warning", code: "overdue_commissions", message: signals.overdueCommissionCount + " hirer commission payments are overdue." })
      if (databaseLatencyMs >= 1000) alerts.push({ severity: "warning", code: "database_latency", message: "Database health check took " + databaseLatencyMs + " ms." })
      if (memory.heapUsed / heapLimitBytes >= 0.9) alerts.push({ severity: "warning", code: "memory_pressure", message: "API heap usage is above 90% of the current heap limit." })
      await database.syncAdminAlerts(alerts)
      await database.recordAdminMonitoringSnapshot({
        database: "ok",
        pendingVerifications: signals.pendingVerifications,
        openReports: signals.openReports,
        heapUsedBytes: memory.heapUsed,
        heapLimitBytes,
        alerts,
      })
    } catch (error) {
      app.log.error(error, "Unable to record scheduled monitoring check")
    } finally {
      monitoringRunActive = false
    }
  }
  void runMonitoringCheck()
  const monitoringTimer = database ? setInterval(() => void runMonitoringCheck(), 60 * 1000) : null
  monitoringTimer?.unref()

  const shutdown = async (signal: NodeJS.Signals) => {
    app.log.info({ signal }, "Shutting down OddJobs API")
    if (reminderTimer) clearInterval(reminderTimer)
    if (monitoringTimer) clearInterval(monitoringTimer)
    await app.close()
  }

  process.once("SIGINT", () => void shutdown("SIGINT"))
  process.once("SIGTERM", () => void shutdown("SIGTERM"))
}

const entryPath = process.argv[1]
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  void startServer().catch((error: unknown) => {
    console.error("Unable to initialize OddJobs API", error)
    process.exitCode = 1
  })
}
