export enum Capability {
  // Consumer (job poster / customer) capabilities
  CREATE_JOB = "create_job",
  READ_OWN_JOBS = "read_own_jobs",
  READ_OTHERS_OPEN_JOBS = "read_others_open_jobs",
  READ_OWN_JOBS_QUOTES = "read_own_jobs_quotes",
  SUBMIT_QUOTE_ON_OTHERS_JOB = "submit_quote_on_others_job",
  ACCEPT_OWN_QUOTE = "accept_own_quote",
  WITHDRAW_OWN_OPEN_JOB = "withdraw_own_open_job",
  MONITOR_INVOLVEMENT = "monitor_involvement",

  // Provider capabilities
  READ_FEED = "read_feed",
  READ_OWN_QUOTES = "read_own_quotes",
  SUBMIT_QUOTE = "submit_quote",
  ADVANCE_JOB_FROM_AWARDED = "advance_job_from_awarded",
  SUBMIT_COMPLETION = "submit_completion",
  CREATE_LISTING = "create_listing",
  READ_OWN_LISTINGS = "read_own_listings",
  DISCOVER_LISTINGS = "discover_listings",
  CLAIM_LISTING = "claim_listing",

  // Admin capabilities
  READ_ALL_JOBS = "read_all_jobs",
  READ_ALL_LISTINGS = "read_all_listings",
  READ_ALL_QUOTES = "read_all_quotes",
  MONITOR_PLATFORM_ACTIVITY = "monitor_platform_activity",
  INTERVENE = "intervene",
}

/** Role names as stored in the database. */
export enum Role {
  CONSUMER = "consumer",
  PROVIDER = "provider",
  ADMIN = "admin",
  SUPPORT = "support",
  PARTNER = "partner",
}

/** Trusted, server-side role set. Never derived from client-supplied claims. */
export type RoleSet = Role[];

/** A capability is tied to a role and enforced against ownership/scope. */
export interface CapabilityRule {
  readonly role: Role;
  readonly capability: Capability;
  readonly requiresOwnership?: boolean;
  /** Additional DB-scoped predicate applied when the capability is used against an entity.
   * The caller must also enforce ownership; this is an extra guard for platform-wide data. */
  readonly scopePredicate?: (userId: string, targetUserId: string, targetStatus: string) => boolean;
}

/** Capability matrix derived from product intent. */
export const capabilityRules: CapabilityRule[] = [
  // Consumer capabilities
  { role: Role.CONSUMER, capability: Capability.DISCOVER_LISTINGS, requiresOwnership: false },
  { role: Role.CONSUMER, capability: Capability.CLAIM_LISTING, requiresOwnership: false },
  { role: Role.CONSUMER, capability: Capability.READ_OWN_JOBS, requiresOwnership: true },

  // Provider capabilities
  { role: Role.PROVIDER, capability: Capability.CREATE_LISTING, requiresOwnership: false },
  { role: Role.PROVIDER, capability: Capability.READ_OWN_LISTINGS, requiresOwnership: true },

  // Admin capabilities
  { role: Role.ADMIN, capability: Capability.READ_ALL_JOBS, requiresOwnership: false },
  { role: Role.ADMIN, capability: Capability.READ_ALL_LISTINGS, requiresOwnership: false },
  { role: Role.ADMIN, capability: Capability.READ_ALL_QUOTES, requiresOwnership: false },
  { role: Role.ADMIN, capability: Capability.MONITOR_PLATFORM_ACTIVITY, requiresOwnership: false },
  { role: Role.ADMIN, capability: Capability.INTERVENE, requiresOwnership: false },
];

/** Default set of exposed capabilities per role for API-level auditing. */
export const roleCapabilities: Record<Role, Capability[]> = {
  [Role.CONSUMER]: [
    Capability.READ_OWN_JOBS,
    Capability.DISCOVER_LISTINGS,
    Capability.CLAIM_LISTING,
  ],
  [Role.PROVIDER]: [
    Capability.CREATE_LISTING,
    Capability.READ_OWN_LISTINGS,
  ],
  [Role.ADMIN]: [
    Capability.READ_ALL_JOBS,
    Capability.READ_ALL_LISTINGS,
    Capability.READ_ALL_QUOTES,
    Capability.MONITOR_PLATFORM_ACTIVITY,
    Capability.INTERVENE,
  ],
  [Role.SUPPORT]: [],
  [Role.PARTNER]: [],
};
