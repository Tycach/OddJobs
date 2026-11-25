import "dotenv/config"
import { createInterface } from "node:readline/promises"
import { stdin, stdout, env, argv } from "node:process"
import { PrismaDatabase } from "../dist/database.js"

const email = (argv[2] ?? "coderpro254@gmail.com").trim().toLowerCase()
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run admin:bootstrap -- [auth-user-email]")
  process.exit(1)
}

if (env.NODE_ENV !== "development") {
  console.error("Refusing to run: set NODE_ENV=development in apps/api/.env first.")
  process.exit(1)
}

if (!env.SUPABASE_URL || !env.DATABASE_URL) {
  console.error("SUPABASE_URL and DATABASE_URL must be set in apps/api/.env.")
  process.exit(1)
}

const projectRef = new URL(env.SUPABASE_URL).hostname.split(".")[0]
const databaseHost = new URL(env.DATABASE_URL).hostname
const terminal = createInterface({ input: stdin, output: stdout })
console.log(`Supabase project: ${projectRef}`)
console.log(`Database host: ${databaseHost}`)
console.log("Only continue if these point to your dedicated development project.")
const confirmation = (await terminal.question("Type the Supabase project ref to continue: ")).trim()
terminal.close()
if (confirmation !== projectRef) {
  console.error("Project confirmation did not match; no changes were made.")
  process.exit(1)
}

const database = new PrismaDatabase(env.DATABASE_URL, Number(env.DATABASE_POOL_MAX ?? 5))
try {
  const authUsers = await database.client.$queryRaw`
    SELECT id::text AS id,
           email,
           email_confirmed_at,
           raw_user_meta_data ->> 'full_name' AS display_name
    FROM auth.users
    WHERE lower(email) = ${email}
    LIMIT 2
  `

  if (authUsers.length !== 1) {
    throw new Error("Expected exactly one matching account in Supabase Auth. Create it there first, then retry.")
  }

  const authUser = authUsers[0]
  if (!authUser.email_confirmed_at) {
    throw new Error("Confirm this account's email in Supabase Auth before granting admin access.")
  }

  await database.bootstrapProfile({
    id: authUser.id,
    email: authUser.email,
    phone: null,
    displayName: authUser.display_name,
  })

  const profile = await database.client.user.findUnique({
    where: { id: authUser.id },
    select: { status: true },
  })
  if (profile?.status !== "ACTIVE") {
    throw new Error("The OddJobs account is not active; no admin role was granted.")
  }

  await database.client.userRoleAssignment.upsert({
    where: { userId_role: { userId: authUser.id, role: "ADMIN" } },
    create: { userId: authUser.id, role: "ADMIN" },
    update: {},
  })

  console.log(`Admin access is enabled for ${authUser.email}. Sign out and back in to OddJobs.`)
} finally {
  await database.close()
}
