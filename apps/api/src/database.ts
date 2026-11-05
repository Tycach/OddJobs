import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "./generated/prisma/client.ts"
import type {
  AuthenticatedPrincipal,
  ProviderApplication,
  ProviderApplicationInput,
  UserProfile,
  UserProfileStore,
} from "./auth/types.js"

export interface ReadinessDatabase {
  check(): Promise<void>
  close(): Promise<void>
}

export class PrismaDatabase implements ReadinessDatabase, UserProfileStore {
  readonly client: PrismaClient

  constructor(connectionString: string) {
    const adapter = new PrismaPg({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30000,
    })
    this.client = new PrismaClient({ adapter })
  }

  async check(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`
  }

  async bootstrapProfile(
    principal: AuthenticatedPrincipal,
  ): Promise<UserProfile> {
    const displayName =
      principal.displayName?.trim() ||
      principal.phone ||
      principal.email?.split("@")[0] ||
      "OddJobs member"
    const user = await this.client.user.upsert({
      where: { id: principal.id },
      create: {
        id: principal.id,
        displayName: displayName.slice(0, 120),
        status: "ACTIVE",
        roleAssignments: { create: { role: "CONSUMER" } },
      },
      update: {},
      include: { roleAssignments: { select: { role: true } } },
    })

    return {
      id: user.id,
      displayName: user.displayName,
      status: user.status.toLowerCase(),
      roles: user.roleAssignments.map((assignment) =>
        assignment.role.toLowerCase(),
      ),
    }
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      include: { roleAssignments: { select: { role: true } } },
    })
    if (!user) return null

    return {
      id: user.id,
      displayName: user.displayName,
      status: user.status.toLowerCase(),
      roles: user.roleAssignments.map((assignment) =>
        assignment.role.toLowerCase(),
      ),
    }
  }
  async recordPolicyConsents(
    userId: string,
    termsVersion: string,
    privacyVersion: string,
  ): Promise<void> {
    await this.client.policyConsent.createMany({
      data: [
        { userId, document: "TERMS", version: termsVersion },
        { userId, document: "PRIVACY", version: privacyVersion },
      ],
      skipDuplicates: true,
    })
  }
  async submitProviderApplication(
    userId: string,
    application: ProviderApplicationInput,
  ): Promise<ProviderApplication> {
    const profile = await this.client.providerProfile.upsert({
      where: { userId },
      create: {
        userId,
        publicName: application.publicName,
        bio: application.bio,
        region: application.region,
        verificationStatus: "IN_REVIEW",
      },
      update: {},
    })
    return {
      publicName: profile.publicName,
      bio: profile.bio ?? "",
      region: profile.region ?? "",
      status: profile.verificationStatus.toLowerCase(),
    }
  }

  async close(): Promise<void> {
    await this.client.$disconnect()
  }
}