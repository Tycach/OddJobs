import { useCallback, useEffect, useState } from "react"
import {
  useAuth,
  type MarketplaceJob,
  type MarketplaceProvider,
  type MarketplaceQuote,
} from "../../auth/AuthProvider"

export function useMarketplaceJobs(view: "consumer" | "provider" | "feed") {
  const auth = useAuth()
  const [jobs, setJobs] = useState<MarketplaceJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    setError("")
    try {
      setJobs(await auth.getMarketplaceJobs(view))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn't load marketplace jobs. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [auth.getMarketplaceJobs, view])

  useEffect(() => {
    void refresh()
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = auth.subscribeMarketplaceChanges(() => void refresh())
    } catch (subscriptionError) {
      console.error("Unable to subscribe to marketplace updates.", subscriptionError)
    }
    return () => unsubscribe?.()
  }, [auth.subscribeMarketplaceChanges, refresh])

  return { jobs, loading, error, refresh }
}

export function useMarketplaceJobData(jobId: string | null | undefined, role: "consumer" | "provider") {
  const auth = useAuth()
  const [job, setJob] = useState<MarketplaceJob | null>(null)
  const [quotes, setQuotes] = useState<MarketplaceQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    if (!jobId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
      setJob(null)
      setQuotes([])
      setError("")
      setLoading(false)
      return
    }

    setError("")
    try {
      const [nextJob, nextQuotes] = await Promise.all([
        auth.getMarketplaceJob(jobId, role),
        auth.getMarketplaceQuotes(jobId, role),
      ])
      setJob(nextJob)
      setQuotes(nextQuotes)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn't load this job. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [auth.getMarketplaceJob, auth.getMarketplaceQuotes, jobId, role])

  useEffect(() => {
    setLoading(true)
    void refresh()
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = auth.subscribeMarketplaceChanges(() => void refresh())
    } catch (subscriptionError) {
      console.error("Unable to subscribe to marketplace updates.", subscriptionError)
    }
    return () => unsubscribe?.()
  }, [auth.subscribeMarketplaceChanges, refresh])

  return { job, quotes, loading, error, refresh }
}

export function useMarketplaceProviders(search: string, region: string, limit = 100, offset = 0) {
  const auth = useAuth()
  const [settledSearch, setSettledSearch] = useState(search)
  const [settledRegion, setSettledRegion] = useState(region)
  const [providers, setProviders] = useState<MarketplaceProvider[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettledSearch(search)
      setSettledRegion(region)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [region, search])
  const refresh = useCallback(async () => {
    setError("")
    setLoading(true)
    try {
      const page = await auth.getMarketplaceProviders(settledSearch, settledRegion, limit, offset)
      setProviders(page.items)
      setTotal(page.total)
    } catch (caught) {
      setProviders([])
      setTotal(0)
      setError(caught instanceof Error ? caught.message : "Could not load approved providers.")
    } finally {
      setLoading(false)
    }
  }, [auth.getMarketplaceProviders, limit, offset, settledRegion, settledSearch])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { providers, total, loading, error, refresh }
}
