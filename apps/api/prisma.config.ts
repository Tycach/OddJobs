import "dotenv/config"
import { argv, env } from "node:process"
import { defineConfig } from "prisma/config"

const migrationCommand =
  argv.includes("migrate") && !argv.includes("diff")
if (migrationCommand && !env.DIRECT_URL) {
  throw new Error("DIRECT_URL is required to run Prisma migrations.")
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url:
      env.DIRECT_URL ??
      env.DATABASE_URL ??
      "postgresql://oddjobs:oddjobs_local_only@127.0.0.1:5433/oddjobs",
  },
})