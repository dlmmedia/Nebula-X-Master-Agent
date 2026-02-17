import { createContext, useContext, createMemo, type ParentProps } from "solid-js"
import { createOrchestrationClient, type OrchestrationClient } from "@/lib/orchestration-client"
import { useServer } from "@/context/server"

const OrchestrationContext = createContext<OrchestrationClient>()

function getAuthHeaders(isLocal: boolean): Record<string, string> | undefined {
  const password =
    typeof window !== "undefined" ? window.__OPENCODE__?.serverPassword : undefined
  if (!password || !isLocal) return undefined
  return {
    Authorization: `Basic ${btoa(`opencode:${password}`)}`,
  }
}

export function OrchestrationProvider(props: ParentProps) {
  const server = useServer()
  const directory = createMemo(() => server.projects.last())
  const auth = getAuthHeaders(server.isLocal())
  const client = createOrchestrationClient(
    server.url ?? "http://localhost:4096",
    directory(),
    auth,
  )

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
