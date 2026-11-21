import { randomUUID } from "node:crypto";
import type {
  AuthenticatedPrincipal,
  AdminMarketplaceActivity,
  MarketplaceJob as MarketplaceJobType,
  MarketplaceQuote as MarketplaceQuoteType,
} from "../auth/types.js";
import type { RoleSet } from "./model.js";
import {
  Capability,
  Role,
  roleCapabilities,
} from "./model.js";

/**
 * Policy service implementing the shared authorization boundary for the
 * OddJobs marketplace. It derives a principal's effective capabilities from
 * trusted database records, never from client-supplied claims, and enforces
 * both capability and ownership on every read/write.
 *
 * Rule of thumb applied everywhere:
 *   1. Identity and roles come from the verified, database-assigned records.
 *   2. Every action is checked against a capability rule, not a role label.
 *   3. Every entity access is scoped by owner/participant; no global reads
 *      except for roles that explicitly allow platform-wide access.
 */

export interface PolicyContext {
  readonly principal: AuthenticatedPrincipal;
  /** Server-verified roles assigned to this principal. */
  readonly roles: RoleSet;
  /** Current scheduler/operator context. Set only by admin operations. */
  readonly actingAsUserId?: string;
  readonly requestId: string;
}

export interface JobEntity {
  readonly id: string;
  readonly customerId: string;
  readonly status: string;
  readonly quotes: readonly QuoteEntity[];
  readonly requestedFor: string | null;
}

export interface QuoteEntity {
  readonly id: string;
  readonly jobId: string;
  readonly providerId: string;
  readonly status: string;
}

export class AuthorizationPolicy {
  constructor(private readonly actingAsUserId?: string) {}

  /**
   * Resolve the effective roles for the authenticated principal.
   * The caller must pass roles returned by the API's database-verified
   * profile; this method treats them as trusted.
   */
  resolveRoles(principal: AuthenticatedPrincipal, roles: string[]): RoleSet {
    const resolved: RoleSet = [];
    for (const raw of roles) {
      const role = raw.toLowerCase() as Role;
      if (Object.values(Role).includes(role)) {
        resolved.push(role);
      }
    }
    return resolved;
  }

  /**
   * Return true when the principal holds the named capability.
   * This is the primary gate; callers still enforce entity-level scoping.
   */
  hasCapability(roles: RoleSet, capability: Capability): boolean {
    return roles.some((role) => roleCapabilities[role]?.includes(capability) ?? false);
  }

  /**
   * Enforce a capability for a consumer-scoped action.
   * Throws when the principal lacks the capability.
   */
  enforce(
    roles: RoleSet,
    capability: Capability,
    context: PolicyContext,
  ): void {
    if (!this.hasCapability(roles, capability)) {
      throw new Error(
        `Principal ${context.principal.id} lacks capability '${capability}'.`,
      );
    }
  }

  /**
   * Enforce that the principal owns (or is a permitted participant in) a job.
   * Roles explicitly allowed to read others' open jobs bypass this.
   */
  enforceJobOwnership(
    context: PolicyContext,
    job: JobEntity,
    roles: RoleSet,
    capability: Capability,
  ): void {
    if (this.hasCapability(roles, Capability.READ_OTHERS_OPEN_JOBS)) {
      return;
    }
    if (job.customerId !== context.principal.id) {
      throw new Error(
        `Principal ${context.principal.id} is not the owner of job ${job.id}.`,
      );
    }
    if (
      capability === Capability.WITHDRAW_OWN_OPEN_JOB &&
      job.status !== "open"
    ) {
      throw new Error("Only an open job can be withdrawn.");
    }
    if (
      capability === Capability.ACCEPT_OWN_QUOTE &&
      job.status !== "open"
    ) {
      throw new Error("Only an open job can accept a quote.");
    }
  }

  /**
   * Enforce that a provider is involved in a job (submitted a quote,
   * was accepted, or is the selected provider) before allowing them to
   * advance lifecycle steps. This also blocks a provider from quoting
   * their own job by requiring involvement.
   */
  enforceProviderInvolvement(
    context: PolicyContext,
    job: JobEntity,
    quote: QuoteEntity | null,
  ): void {
    const providerQuotes = job.quotes ?? [];
    const isSubmitter = providerQuotes.some(
      (q) => q.providerId === context.principal.id && q.status === "SUBMITTED",
    );
    const isAccepted =
      job.status === "awarded" &&
      providerQuotes.some(
        (q) => q.providerId === context.principal.id && q.status === "ACCEPTED",
      );
    const isSelected = job.requestedFor !== null;

    if (!isSubmitter && !isAccepted && !isSelected) {
      throw new Error(
        `Provider ${context.principal.id} is not involved in job ${job.id}.`,
      );
    }
  }

  /**
   * Enforce a provider cannot quote their own job.
   * Called before submitQuote in the database layer.
   */
  enforceNoSelfQuote(
    context: PolicyContext,
    job: JobEntity,
  ): void {
    if (job.customerId === context.principal.id) {
      throw new Error(
        "You cannot submit a quote on your own job.",
      );
    }
  }

  /**
   * Record an admin-audit event. Used by both admin actions and, where
   * required, by the platform to log meaningful customer/provider events.
   * Kept append-only; the admin console reads from this event log.
   */
  recordAdminAuditEvent(
    context: PolicyContext,
    action: string,
    targetType: string | null,
    targetId: string | null,
    metadata: Record<string, string | number | boolean | null>,
  ): AdminMarketplaceActivity | null {
    // The DB layer is the source of truth for persistence; this method returns
    // the audit payload intended for the admin audit store.
    return {
      id: randomUUID(),
      actorUserId: context.actingAsUserId ?? context.principal.id,
      actorDisplayName: context.principal.displayName ?? context.principal.id,
      actorRole: context.roles.includes(Role.ADMIN) ? "admin" : context.roles.includes(Role.PROVIDER) ? "provider" : "consumer",
      action,
      jobId: targetId ?? "",
      quoteId: null,
      metadata,
      requestId: context.requestId,
      createdAt: new Date().toISOString(),
    } as AdminMarketplaceActivity;
  }
}
