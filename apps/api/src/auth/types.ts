export type AuthenticatedPrincipal = {
  id: string
  email: string | null
  phone: string | null
  displayName: string | null
}

export type UserProfile = {
  id: string
  displayName: string
  status: string
  roles: string[]
}

export type ProviderApplicationInput = {
  publicName: string
  bio: string
  region: string
}
export type ProviderApplication = ProviderApplicationInput & {
  status: string
}
export interface AccessTokenVerifier {
  verify(accessToken: string): Promise<AuthenticatedPrincipal | null>
}

export interface UserProfileStore {
  bootstrapProfile(principal: AuthenticatedPrincipal): Promise<UserProfile>
  getProfile(userId: string): Promise<UserProfile | null>
  recordPolicyConsents(
    userId: string,
    termsVersion: string,
    privacyVersion: string,
  ): Promise<void>
  submitProviderApplication(
    userId: string,
    application: ProviderApplicationInput,
  ): Promise<ProviderApplication>
}