import "dotenv/config"
import { z } from "zod"

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  WEB_ORIGIN: z.string().url().default("http://localhost:8443"),
  DATABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
}).superRefine((config, context) => {
  const hasAuthKey = Boolean(
    config.SUPABASE_PUBLISHABLE_KEY || config.SUPABASE_ANON_KEY,
  )
  if (Boolean(config.SUPABASE_URL) !== hasAuthKey) {
    context.addIssue({
      code: "custom",
      message: "SUPABASE_URL and a Supabase publishable/anon key must be configured together.",
    })
  }
})

export type AppConfig = {
  environment: "development" | "test" | "production"
  host: string
  port: number
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent"
  webOrigin: string
  databaseUrl?: string
  supabaseUrl?: string
  supabaseApiKey?: string
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvironmentSchema.safeParse(environment)

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")
    throw new Error(`Invalid API configuration: ${problems}`)
  }

  if (parsed.data.NODE_ENV === "production" && !parsed.data.DATABASE_URL) {
    throw new Error("Invalid API configuration: DATABASE_URL is required in production.")
  }
  if (
    parsed.data.NODE_ENV === "production" &&
    (!parsed.data.SUPABASE_URL ||
      (!parsed.data.SUPABASE_PUBLISHABLE_KEY && !parsed.data.SUPABASE_ANON_KEY))
  ) {
    throw new Error(
      "Invalid API configuration: Supabase Auth settings are required in production.",
    )
  }
  const supabaseApiKey =
    parsed.data.SUPABASE_PUBLISHABLE_KEY ?? parsed.data.SUPABASE_ANON_KEY

  return {
    environment: parsed.data.NODE_ENV,
    host:
      parsed.data.HOST ??
      (parsed.data.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
    port: parsed.data.PORT,
    logLevel: parsed.data.LOG_LEVEL,
    webOrigin: parsed.data.WEB_ORIGIN,
    ...(parsed.data.DATABASE_URL
      ? { databaseUrl: parsed.data.DATABASE_URL }
      : {}),
    ...(parsed.data.SUPABASE_URL
      ? { supabaseUrl: parsed.data.SUPABASE_URL }
      : {}),
    ...(supabaseApiKey ? { supabaseApiKey } : {}),
  }
}