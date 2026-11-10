import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { buildApp } from "./app.js"
import { SupabaseTokenVerifier } from "./auth/supabase-verifier.js"
import { loadConfig } from "./config.js"
import { PrismaDatabase } from "./database.js"

export async function startServer(): Promise<void> {
  const config = loadConfig()
  const database = config.databaseUrl
    ? new PrismaDatabase(config.databaseUrl)
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

  const shutdown = async (signal: NodeJS.Signals) => {
    app.log.info({ signal }, "Shutting down OddJobs API")
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