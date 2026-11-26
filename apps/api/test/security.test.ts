import assert from "node:assert/strict"

import test from "node:test"

import { buildApp } from "../src/app.js"

import type { AccessTokenVerifier, AuthenticatedPrincipal, MarketplaceJob, MarketplaceQuote, MarketplaceStore, UserProfile, UserProfileStore } from "../src/auth/types.js"

import { loadConfig } from "../src/config.js"

const config = loadConfig({ NODE_ENV: "test" })

const principal: AuthenticatedPrincipal = { id: "a1b2c3d4-18f4-4d3e-80f7-287991c7a212", email: "customer@example.com", phone: null, displayName: "Customer" }

const adminPrincipal: AuthenticatedPrincipal = { id: "b2c3d4e5-46b4-40e5-a1e5-f7a1b364c701", email: "admin@example.com", phone: null, displayName: "Admin" }

const providerPrincipal: AuthenticatedPrincipal = { id: "c3d4e5f6-a9de-4569-9d0d-fc22a31d0140", email: "provider@example.com", phone: null, displayName: "Provider" }

const authVerifier: AccessTokenVerifier = {
  verify: async (t) => {
    if (t === "valid-token") return principal
    if (t === "admin-token") return adminPrincipal
    if (t === "provider-token") return providerPrincipal
    return null
  },
}

const profileFor = (userId: string): UserProfile | null => {
  if (userId === principal.id) return { id: userId, displayName: "Customer", status: "active", roles: ["consumer"] }
  if (userId === providerPrincipal.id) return { id: userId, displayName: "Provider", status: "active", roles: ["provider"] }
  if (userId === adminPrincipal.id) return { id: userId, displayName: "Admin", status: "active", roles: ["admin"] }
  return null
}
const profileStore: UserProfileStore = {
  bootstrapProfile: async (p) => profileFor(p.id) ?? { id: p.id, displayName: p.displayName ?? "User", status: "active", roles: [] },
  getProfile: async (u) => profileFor(u),
  recordPolicyConsents: async () => undefined,
  submitProviderApplication: async () => ({ publicName: "Test", bio: "", region: "", status: "in_review" }),
}

function createTestSecurityStore(): MarketplaceStore {
  let job: MarketplaceJob | null = null
  const quotes: MarketplaceQuote[] = []
  return {
    listJobs: async (u, r, v) => { if (r === "consumer" && v === "mine") return job?.customerId === u && job ? [job] : []; if (r === "provider" && v === "feed") { if (!job || job.status !== "open" || job.customerId === u) return []; return [job] } if (r === "provider" && v === "mine") return quotes.some((q) => q.providerId === u && q.status === "accepted") && job ? [job] : []; return [] },
    getJob: async (u, r, j) => { if (!job || job.id !== j) return null; if (r === "consumer") return job.customerId === u ? job : null; if (r === "provider") { if (job.customerId === u) return null; const inv = quotes.some((q) => q.jobId === j && q.providerId === u); return inv ? job : null } return null },
    listQuotes: async (u, r, j) => { if (!job || job.id !== j) return null; if (r === "consumer") return job.customerId === u ? [...quotes] : null; if (r === "provider") return quotes.filter((q) => q.providerId === u); return null },
    createJob: async (u, i) => { job = { id: "a1a1a1a1-0000-4000-8000-000000000001", jobReference: "OJ-0000000001", customerId: u, ...i, budgetMinor: i.budgetMinor, currency: "KES", status: "open", requestedFor: i.requestedFor ?? null, completionMedia: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), quoteCount: 0 }; return job },
    submitQuote: async (u, j, i) => { if (!job || job.id !== j || job.customerId === u || job.status !== "open") return null; const n = new Date().toISOString(); const q: MarketplaceQuote = { id: "b2b2b2b2-0000-4000-8000-000000000002", jobId: j, providerId: u, providerName: "Provider Name", amountMinor: i.amountMinor, currency: "KES", message: i.message, availability: i.availability, status: "submitted", createdAt: n, updatedAt: n }; quotes.push(q); return q },
    acceptQuote: async (u, j, qId) => { if (!job || job.id !== j || job.customerId !== u) return null; const q = quotes.find((q) => q.id === qId && q.providerId === u); if (!q || q.status !== "submitted") return null; job.status = "awarded"; q.status = "accepted"; job.updatedAt = new Date().toISOString(); q.updatedAt = new Date().toISOString(); return { ...job } },
    transitionJob: async (u, j, t) => { if (!job || job.id !== j || job.customerId !== u) return null; if (t === "cancel") { job.status = "cancelled" } else if (t === "start") { job.status = "in_progress" } else if (t === "submit_completion") { job.status = "completion_pending" } else if (t === "confirm_completion") { job.status = "completed" } job.updatedAt = new Date().toISOString(); return { ...job } },
  } satisfies MarketplaceStore
}

test("job posting, discovery, and proposals are available only to the right roles", async () => {
  const store = createTestSecurityStore()
  const app = await buildApp({ config, database: null, authVerifier, profileStore, marketplaceStore: store })
  const create = await app.inject({ method: "POST", url: "/v1/jobs", headers: { authorization: "Bearer valid-token" }, payload: { title: "Repair a leaking tap", description: "The kitchen tap is leaking.", category: "Plumbing", locationLabel: "Nairobi", budgetMinor: 250000, requestedFor: null } })
  assert.equal(create.statusCode, 201)
  const pf = await app.inject({ method: "GET", url: "/v1/jobs?view=feed", headers: { authorization: "Bearer provider-token" } })
  assert.equal(pf.statusCode, 200)
  assert.equal(pf.json().length, 1)
  const quote = await app.inject({ method: "POST", url: "/v1/jobs/a1a1a1a1-0000-4000-8000-000000000001/quotes", headers: { authorization: "Bearer provider-token" }, payload: { amountMinor: 230000, message: "I can fix it tomorrow.", availability: "Tomorrow" } })
  assert.equal(quote.statusCode, 201)
  await app.close()
})
