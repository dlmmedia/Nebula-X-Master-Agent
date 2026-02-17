export interface SkillEntry {
  id: string
  name: string
  description: string
  category: string
  tags: string[] | null
  source: "github" | "generated" | "imported" | "local"
  sourceUrl: string | null
  content: string
  version: number
  enabled: boolean
  timeCreated: number
  timeUpdated: number
}

export interface WorkflowStep {
  id: string
  name: string
  type: "skill" | "prompt" | "shell" | "api" | "condition"
  config: Record<string, any>
  dependsOn: string[]
}

export interface WorkflowEntry {
  id: string
  name: string
  description: string
  definition: { steps: WorkflowStep[] }
  category: string | null
  tags: string[] | null
  enabled: boolean
  timeCreated: number
  timeUpdated: number
}

export interface WorkflowRunEntry {
  id: string
  workflowId: string
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  result: Record<string, any> | null
  error: string | null
  timeCreated: number
  timeUpdated: number
}

export interface PromptEntry {
  id: string
  name: string
  description: string
  content: string
  variables: string[] | null
  category: string | null
  tags: string[] | null
  skillIds: string[] | null
  timeCreated: number
  timeUpdated: number
}

export interface BuiltinTemplate {
  name: string
  description: string
  content: string
  category: string
  variables: string[]
}

export interface WorkflowTemplate {
  name: string
  description: string
  category: string
  definition: { steps: WorkflowStep[] }
}

export interface ResearchResult {
  summary: string
  findings: Array<{ title: string; description: string; source?: string }>
  suggestedSkills: Array<{ name: string; description: string }>
}

export interface OrchestrationStatus {
  geminiAvailable: boolean
  skillCount: number
  workflowCount: number
  promptCount: number
  categories: Array<{ category: string; count: number }>
}

export function createOrchestrationClient(
  baseUrl: string,
  directory?: string,
  authHeaders?: Record<string, string>,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeaders,
  }
  if (directory) {
    headers["x-opencode-directory"] = directory
  }

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${baseUrl}/orchestration${path}`
    let res: Response
    try {
      res = await fetch(url, {
        ...options,
        headers: { ...headers, ...options?.headers },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Orchestration API network error: ${message}. Ensure the server is running at ${baseUrl}`,
      )
    }
    if (!res.ok) {
      let text: string
      try {
        text = await res.text()
      } catch {
        text = `HTTP ${res.status}`
      }
      throw new Error(`Orchestration API error (${res.status}): ${text}`)
    }
    try {
      return await res.json() as T
    } catch {
      throw new Error(`Orchestration API error: Invalid JSON response from ${path}`)
    }
  }

  return {
    // Skills
    skills: {
      list: (params?: {
        category?: string
        source?: string
        search?: string
        enabled?: boolean
        limit?: number
        offset?: number
      }) => {
        const query = new URLSearchParams()
        if (params?.category) query.set("category", params.category)
        if (params?.source) query.set("source", params.source)
        if (params?.search) query.set("search", params.search)
        if (params?.enabled !== undefined) query.set("enabled", String(params.enabled))
        if (params?.limit) query.set("limit", String(params.limit))
        if (params?.offset) query.set("offset", String(params.offset))
        const qs = query.toString()
        return request<{ items: SkillEntry[]; total: number }>(`/skills${qs ? `?${qs}` : ""}`)
      },
      get: (id: string) => request<SkillEntry>(`/skills/${id}`),
      create: (data: {
        name: string
        description: string
        category: string
        tags?: string[]
        source?: string
        sourceUrl?: string
        content: string
      }) => request<SkillEntry>("/skills", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: Record<string, any>) =>
        request<SkillEntry>(`/skills/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id: string) => request<boolean>(`/skills/${id}`, { method: "DELETE" }),
      categories: () => request<Array<{ category: string; count: number }>>("/skills/categories"),
      import: (repoUrl: string, category?: string) =>
        request<SkillEntry[]>("/skills/import", {
          method: "POST",
          body: JSON.stringify({ repoUrl, category }),
        }),
      generate: (data: { name: string; description: string; category: string; details?: string }) =>
        request<SkillEntry>("/skills/generate", { method: "POST", body: JSON.stringify(data) }),
    },

    // Workflows
    workflows: {
      list: () => request<WorkflowEntry[]>("/workflows"),
      get: (id: string) => request<WorkflowEntry>(`/workflows/${id}`),
      create: (data: {
        name: string
        description: string
        definition: { steps: WorkflowStep[] }
        category?: string
        tags?: string[]
      }) => request<WorkflowEntry>("/workflows", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: Record<string, any>) =>
        request<WorkflowEntry>(`/workflows/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id: string) => request<boolean>(`/workflows/${id}`, { method: "DELETE" }),
      run: (id: string, options?: { sendToAgent?: boolean }) =>
        request<WorkflowRunEntry>(`/workflows/${id}/run`, {
          method: "POST",
          body: JSON.stringify(options ?? {}),
        }),
      generate: (data: { name: string; description: string; steps?: string[] }) =>
        request<WorkflowEntry>("/workflows/generate", { method: "POST", body: JSON.stringify(data) }),
      templates: () => request<WorkflowTemplate[]>("/workflows/templates"),
    },

    // Prompts
    prompts: {
      list: (params?: { category?: string; search?: string }) => {
        const query = new URLSearchParams()
        if (params?.category) query.set("category", params.category)
        if (params?.search) query.set("search", params.search)
        const qs = query.toString()
        return request<PromptEntry[]>(`/prompts${qs ? `?${qs}` : ""}`)
      },
      get: (id: string) => request<PromptEntry>(`/prompts/${id}`),
      create: (data: {
        name: string
        description: string
        content: string
        variables?: string[]
        category?: string
        tags?: string[]
        skillIds?: string[]
      }) => request<PromptEntry>("/prompts", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: Record<string, any>) =>
        request<PromptEntry>(`/prompts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id: string) => request<boolean>(`/prompts/${id}`, { method: "DELETE" }),
      generate: (data: {
        goal: string
        skills?: string[]
        context?: string
        style?: "concise" | "detailed" | "step-by-step"
      }) => request<PromptEntry>("/prompts/generate", { method: "POST", body: JSON.stringify(data) }),
      builtin: () => request<BuiltinTemplate[]>("/prompts/builtin"),
      render: (template: string, variables: Record<string, string>) =>
        request<{ rendered: string }>("/prompts/render", {
          method: "POST",
          body: JSON.stringify({ template, variables }),
        }),
    },

    // Research
    research: (topic: string, context?: string) =>
      request<ResearchResult>("/research", {
        method: "POST",
        body: JSON.stringify({ topic, context }),
      }),

    // Agents
    agents: {
      list: () => request<any[]>("/agents"),
    },

    // Bridge
    bridge: {
      syncToFilesystem: (id: string) =>
        request<{ path: string | null }>(`/bridge/sync/${id}`, { method: "POST" }),
      importExisting: () =>
        request<{ imported: number }>("/bridge/import-existing", { method: "POST" }),
    },

    // Send to Agent
    sendToAgent: (
      prompt: string,
      options?: {
        sessionId?: string
        agent?: string
        model?: { providerID: string; modelID: string }
      },
    ) =>
      request<{ sessionId: string; messageId: string }>("/send-to-agent", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          sessionId: options?.sessionId,
          agent: options?.agent,
          model: options?.model,
        }),
      }),

    // Status
    status: () => request<OrchestrationStatus>("/status"),
  }
}

export type OrchestrationClient = ReturnType<typeof createOrchestrationClient>
