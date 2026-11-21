import { createContext, useContext } from "react"
import type { DemoStore } from "./model"

type DemoStoreUpdate =
  | Partial<DemoStore>
  | ((current: DemoStore) => DemoStore)

export const DemoContext = createContext<{
  store: DemoStore
  updateStore: (update: DemoStoreUpdate) => void
} | null>(null)

export function useDemoStore() {
  const context = useContext(DemoContext)
  if (!context) throw new Error("DemoStoreProvider is required.")
  return context
}
