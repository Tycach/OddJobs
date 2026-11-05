/**
 * Shared contracts and sample data for the browser-only prototype.
 * Replace these demo types with API contracts when a trusted backend exists.
 */
export type Role = "consumer" | "provider" | "admin" | "support" | "partner"

export type Screen =
  | "welcome"
  | "workspace"
  | "login"
  | "providerApply"
  | "home"
  | "search"
  | "map"
  | "profile"
  | "post"
  | "jobs"
  | "bids"
  | "checkout"
  | "track"
  | "chat"
  | "review"
  | "dispute"
  | "history"
  | "saved"
  | "notifications"
  | "settings"
  | "providerHome"
  | "onboarding"
  | "providerVerification"
  | "feed"
  | "jobDetail"
  | "management"
  | "wallet"
  | "reputation"
  | "training"
  | "plans"
  | "analytics"
  | "ads"
  | "overview"
  | "users"
  | "verification"
  | "categories"
  | "moderation"
  | "adApprovals"
  | "audit"
  | "config"
  | "disputes"
  | "inbox"
  | "knowledgeBase"
  | "programmes"
  | "impact"
  | "builder"

export type DemoBid = {
  provider: string
  price: number
  timing: string
  pitch: string
  trust: number
}

export type DemoJob = {
  id: string
  title: string
  category: string
  description: string
  budget: number
  location: string
  timing: string
  status: "Open" | "Active" | "Completed"
  bids: DemoBid[]
}

export type DemoStore = {
  jobs: DemoJob[]
  selectedJobId: string
  selectedBid: DemoBid
  savedProviders: string[]
  messages: string[]
  transactions: string[]
  notifications: string[]
  language: "EN" | "SW"
  reduceAds: boolean
  notificationPreferences: {
    jobs: boolean
    messages: boolean
    promotions: boolean
  }
  verificationStatus: "Not started" | "In review" | "Certified"
  completedLessons: string[]
  featureFlags: Record<string, boolean>
  adminActions: string[]
}

export const demoStorageKey = "oddjobs-demo-v1"
export const demoSessionKey = "oddjobs-demo-session-v1"

export const initialDemoStore: DemoStore = {
  selectedJobId: "OJ-2841",
  selectedBid: {
    provider: "Amina Hassan",
    price: 2300,
    timing: "Tomorrow · 3 hours",
    pitch: "I can bring eco-friendly supplies and arrive by 9am.",
    trust: 96,
  },
  jobs: [
    {
      id: "OJ-2841",
      title: "Deep clean my 2-bedroom flat",
      category: "Cleaning",
      description:
        "Kitchen, two bathrooms, floors and windows. Please bring cleaning supplies.",
      budget: 2500,
      location: "Kilimani, Nairobi",
      timing: "This week",
      status: "Open",
      bids: [
        {
          provider: "Amina Hassan",
          price: 2300,
          timing: "Tomorrow · 3 hours",
          pitch: "I can bring eco-friendly supplies and arrive by 9am.",
          trust: 96,
        },
        {
          provider: "Grace Wairimu",
          price: 2150,
          timing: "Friday · 4 hours",
          pitch: "I specialise in deep cleans and have all required equipment.",
          trust: 94,
        },
        {
          provider: "Mercy Atieno",
          price: 2500,
          timing: "Tomorrow · 3 hours",
          pitch: "Available tomorrow morning. Windows included in my quote.",
          trust: 92,
        },
      ],
    },
  ],
  savedProviders: [],
  messages: [
    "Hi, will the provider see my phone number before I accept a bid?",
    "No. Your contact details stay private until you hire a provider.",
  ],
  transactions: [],
  notifications: ["Amina Hassan sent a quote for your cleaning job."],
  language: "EN",
  reduceAds: false,
  notificationPreferences: { jobs: true, messages: true, promotions: false },
  verificationStatus: "Not started",
  completedLessons: [],
  featureFlags: {
    "Escrow v2": true,
    "Provider live location": true,
    "Saved search alerts": false,
  },
  adminActions: [],
}