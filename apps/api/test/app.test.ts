import assert from "node:assert/strict"
import test from "node:test"
import { buildApp } from "../src/app.js"
import type {
  AccessTokenVerifier,
  AuthenticatedPrincipal,
  UserProfile,
  UserProfileStore,
} from "../src/auth/types.js"
import { loadConfig } from "../src/config.js"
import type { ReadinessDatabase } from "../src/database.js"

const config = loadConfig({ NODE_ENV: "test" })

function createDatabase(check: () => Promise<void>): ReadinessDatabase {
  return { check, close: async () => {} }
}

const principal: AuthenticatedPrincipal = {
  id: "4231bc49-18f4-4d3e-80f7-287991c7a212",
  email: "customer@example.com",
  phone: null,
  displayName: "Customer",
}

const profile: UserProfile = {
  id: principal.id,
  displayName: "Customer",
  status: "active",
  roles: ["consumer"],
}

const authVerifier: AccessTokenVerifier = {
  verify: async (token) => (token === "valid-token" ? principal : null),
}

const profileStore: UserProfileStore = {
  bootstrapProfile: async (authenticatedPrincipal) => {
    assert.equal(authenticatedPrincipal.id, principal.id)
    return profile
  },
  getProfile: async (userId) => (userId === principal.id ? profile : null),
  recordPolicyConsents: async (userId, termsVersion, privacyVersion) => {
    assert.equal(userId, principal.id)
    assert.equal(termsVersion, "2026-11-05-v1")
    assert.equal(privacyVersion, "2026-11-05-v1")
  },
  submitProviderApplication: async (userId, application) => {
    assert.equal(userId, principal.id)
    return { ...application, status: "in_review" }
  },
}

test("liveness reports the process is running and returns a request ID", async () => {
  const app = await buildApp({ config, database: null })
  const response = await app.inject({ method: "GET", url: "/health/live" })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { status: "ok" })
  assert.match(response.headers["x-request-id"] as string, /^[0-9a-f-]{36}$/)
  await app.close()
})

test("a valid request ID is preserved", async () => {
  const app = await buildApp({ config, database: null })
  const response = await app.inject({
    method: "GET",
    url: "/health/live",
    headers: { "x-request-id": "health-check_01" },
  })

  assert.equal(response.headers["x-request-id"], "health-check_01")
  await app.close()
})
test("security headers are applied to API responses", async () => {
  const app = await buildApp({ config, database: null })
  const response = await app.inject({ method: "GET", url: "/health/live" })
  assert.equal(response.headers["x-content-type-options"], "nosniff")
  assert.equal(response.headers["x-frame-options"], "SAMEORIGIN")
  await app.close()
})
test("CORS allows only the configured web origin", async () => {
  const app = await buildApp({ config, database: null })
  const allowed = await app.inject({
    method: "GET",
    url: "/health/live",
    headers: { origin: config.webOrigin },
  })
  const rejected = await app.inject({
    method: "GET",
    url: "/health/live",
    headers: { origin: "https://attacker.invalid" },
  })
  assert.equal(allowed.headers["access-control-allow-origin"], config.webOrigin)
  assert.equal(rejected.headers["access-control-allow-origin"], undefined)
  await app.close()
})

test("readiness fails closed when the database is not configured", async () => {
  const app = await buildApp({ config, database: null })
  const response = await app.inject({ method: "GET", url: "/health/ready" })

  assert.equal(response.statusCode, 503)
  assert.deepEqual(response.json(), {
    status: "not_ready",
    checks: { database: "unavailable" },
  })
  await app.close()
})

test("readiness reports a successful database probe", async () => {
  const database = createDatabase(async () => {})
  const app = await buildApp({ config, database })
  const response = await app.inject({ method: "GET", url: "/health/ready" })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    status: "ready",
    checks: { database: "ok" },
  })
  await app.close()
})

test("readiness hides dependency error details", async () => {
  const database = createDatabase(async () => {
    throw new Error("sensitive connection detail")
  })
  const app = await buildApp({ config, database })
  const response = await app.inject({ method: "GET", url: "/health/ready" })

  assert.equal(response.statusCode, 503)
  assert.equal(response.body.includes("sensitive connection detail"), false)
  await app.close()
})

test("OpenAPI describes the health endpoints", async () => {
  const app = await buildApp({ config, database: null })
  await app.ready()
  const document = app.swagger()
  const paths = document.paths ?? {}

  assert.ok(paths["/health/live"])
  assert.ok(paths["/health/ready"])
  assert.ok(paths["/v1/me"])
  assert.ok(paths["/v1/me/bootstrap"])
  assert.ok(paths["/v1/me/policy-consents"])
  assert.ok(paths["/v1/provider-applications"])
  await app.close()
})

test("protected profile routes require a bearer token", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
  })
  const response = await app.inject({ method: "GET", url: "/v1/me" })

  assert.equal(response.statusCode, 401)
  await app.close()
})

test("invalid Supabase bearer tokens are rejected", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
  })
  const response = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: { authorization: "Bearer invalid-token" },
  })

  assert.equal(response.statusCode, 401)
  await app.close()
})

test("profile bootstrap uses the verified identity and server-assigned role", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
  })
  const response = await app.inject({
    method: "POST",
    url: "/v1/me/bootstrap",
    headers: { authorization: "Bearer valid-token" },
    payload: { id: "00000000-0000-4000-8000-000000000001", role: "admin" },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), profile)
  assert.equal(response.headers["cache-control"], "no-store")
  await app.close()
})

test("profile reads are scoped to the verified user ID", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
  })
  const response = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: { authorization: "Bearer valid-token" },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), profile)
  assert.equal(response.headers["cache-control"], "no-store")
  await app.close()
})
test("policy consent records the current versions for the verified active user", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
  })
  const response = await app.inject({
    method: "POST",
    url: "/v1/me/policy-consents",
    headers: { authorization: "Bearer valid-token" },
    payload: {
      termsVersion: "2026-11-05-v1",
      privacyVersion: "2026-11-05-v1",
    },
  })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { accepted: true })
  assert.equal(response.headers["cache-control"], "no-store")
  await app.close()
})
test("policy consent rejects stale document versions", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
  })
  const response = await app.inject({
    method: "POST",
    url: "/v1/me/policy-consents",
    headers: { authorization: "Bearer valid-token" },
    payload: {
      termsVersion: "outdated",
      privacyVersion: "2026-11-05-v1",
    },
  })
  assert.equal(response.statusCode, 400)
  await app.close()
})
test("policy consent requires authentication", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
  })
  const response = await app.inject({
    method: "POST",
    url: "/v1/me/policy-consents",
    payload: {
      termsVersion: "2026-11-05-v1",
      privacyVersion: "2026-11-05-v1",
    },
  })
  assert.equal(response.statusCode, 401)
  await app.close()
})
test("supplier applications require an authenticated active profile and do not assign provider roles", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
  })
  const response = await app.inject({
    method: "POST",
    url: "/v1/provider-applications",
    headers: { authorization: "Bearer valid-token" },
    payload: {
      publicName: "  Customer Services  ",
      bio: "  Home repairs and maintenance.  ",
      region: "  Nairobi ",
    },
  })
  assert.equal(response.statusCode, 201)
  assert.deepEqual(response.json(), {
    publicName: "Customer Services",
    bio: "Home repairs and maintenance.",
    region: "Nairobi",
    status: "in_review",
  })
  assert.equal(response.headers["cache-control"], "no-store")
  assert.deepEqual(profile.roles, ["consumer"])
  await app.close()
})
test("supplier applications reject unauthenticated callers", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
  })
  const response = await app.inject({
    method: "POST",
    url: "/v1/provider-applications",
    payload: {
      publicName: "Customer Services",
      bio: "Home repairs and maintenance.",
      region: "Nairobi",
    },
  })
  assert.equal(response.statusCode, 401)
  await app.close()
})
test("supplier applications reject unexpected fields", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
  })
  const response = await app.inject({
    method: "POST",
    url: "/v1/provider-applications",
    headers: { authorization: "Bearer valid-token" },
    payload: {
      publicName: "Customer Services",
      bio: "",
      region: "Nairobi",
      role: "provider",
    },
  })
  assert.equal(response.statusCode, 400)
  await app.close()
})
test("supplier applications reject blank profile details", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
  })
  const response = await app.inject({
    method: "POST",
    url: "/v1/provider-applications",
    headers: { authorization: "Bearer valid-token" },
    payload: { publicName: "  ", bio: "Repairs", region: "Nairobi" },
  })
  assert.equal(response.statusCode, 400)
  await app.close()
})
test("supplier applications are rate limited", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
  })
  const submit = () =>
    app.inject({
      method: "POST",
      url: "/v1/provider-applications",
      headers: { authorization: "Bearer valid-token" },
      payload: {
        publicName: "Customer Services",
        bio: "Home repairs and maintenance.",
        region: "Nairobi",
      },
    })
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await submit()
    assert.equal(response.statusCode, 201)
  }
  const limited = await submit()
  assert.equal(limited.statusCode, 429)
  assert.ok(limited.headers["retry-after"])
  await app.close()
})

test("production config requires a database URL", () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: "production" }),
    /DATABASE_URL is required in production/,
  )
})

test("production config listens on all interfaces by default", () => {
  const configured = loadConfig({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  })

  assert.equal(configured.host, "0.0.0.0")
  assert.equal(loadConfig({ NODE_ENV: "development" }).host, "127.0.0.1")
})

test("Supabase Auth accepts a publishable key", () => {
  const configured = loadConfig({
    NODE_ENV: "development",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  })

  assert.equal(configured.supabaseApiKey, "test-publishable-key")
})

test("Supabase Auth URL and a publishable/anon key must be configured together", () => {
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "development",
        SUPABASE_URL: "https://example.supabase.co",
      }),
    /SUPABASE_URL and a Supabase publishable\/anon key must be configured together/,
  )
})