import { createContext, useContext, type ParentProps } from "solid-js"
import { createOrchestrationClient, type OrchestrationClient } from "@/lib/orchestration-client"
import { useServer } from "@/context/server"

const OrchestrationContext = createContext<OrchestrationClient>()

export function OrchestrationProvider(props: ParentProps) {
  const server = useServer()
  const client = createOrchestrationClient(server.url ?? "http://localhost:4096")

  return (
    <OrchestrationContext.Provider value={client}>
      {props.children}
    </OrchestrationContext.Provider>
  )
}

export function useOrchestration(): OrchestrationClient {
  const ctx = useContext(OrchestrationContext)
  if (!ctx) throw new Error("useOrchestration must be used within OrchestrationProvider")
  return ctx
}
