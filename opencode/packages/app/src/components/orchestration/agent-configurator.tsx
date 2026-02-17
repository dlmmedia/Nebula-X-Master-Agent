import { createSignal, createResource, For, Show } from "solid-js"
import { useOrchestration } from "@/context/orchestration"

export default function AgentConfigurator() {
  const client = useOrchestration()
  const [selectedAgent, setSelectedAgent] = createSignal<any>(null)
  const [skills] = createResource(async () => {
    const result = await client.skills.list({ limit: 200, enabled: true })
    return result.items
  })

  const [agents, { refetch }] = createResource(() => client.agents.list())

  return (
    <div class="flex h-full">
      {/* Agent List */}
      <div class="w-72 shrink-0 border-r border-border-base bg-background-surface/50 flex flex-col">
        <div class="p-3 border-b border-border-base">
          <h3 class="text-sm font-medium text-color-primary">Agents</h3>
          <p class="text-[10px] text-color-dimmed mt-1">Configure and manage agent instances</p>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          <Show when={agents.loading}>
            <div class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
            </div>
          </Show>
          <For each={agents()}>
            {(agent) => (
              <div
                class={`px-3 py-2.5 rounded-md cursor-pointer mb-1 transition-colors ${
                  selectedAgent()?.name === agent.name
                    ? "bg-blue-500/10 text-blue-400"
                    : "hover:bg-background-surface text-color-secondary"
                }`}
                onClick={() => setSelectedAgent(agent)}
              >
                <div class="flex items-center gap-2">
                  <div
                    class="w-2 h-2 rounded-full"
                    style={{ "background-color": agent.color || "#6b7280" }}
                  />
                  <span class="text-sm font-medium">{agent.name}</span>
                  <Show when={agent.native}>
                    <span class="text-[10px] px-1.5 py-0.5 bg-background-surface text-color-dimmed rounded">built-in</span>
                  </Show>
                </div>
                <Show when={agent.description}>
                  <p class="text-[10px] text-color-dimmed mt-0.5 ml-4">{agent.description}</p>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Agent Detail */}
      <div class="flex-1 min-w-0 overflow-auto">
        <Show when={selectedAgent()} fallback={
          <div class="flex flex-col items-center justify-center h-full text-center">
            <svg class="w-12 h-12 text-color-dimmed mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p class="text-sm text-color-dimmed">Select an agent to view its configuration</p>
          </div>
        }>
          {(agent) => (
            <div class="p-6 max-w-3xl">
              <div class="flex items-center gap-3 mb-6">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                  style={{ "background-color": agent().color || "#6b7280" }}
                >
                  {agent().name[0].toUpperCase()}
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-color-primary">{agent().name}</h2>
                  <Show when={agent().description}>
                    <p class="text-sm text-color-secondary">{agent().description}</p>
                  </Show>
                </div>
              </div>

              {/* Properties */}
              <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="border border-border-base rounded-lg p-3">
                  <p class="text-[10px] text-color-dimmed uppercase mb-1">Mode</p>
                  <p class="text-sm text-color-primary capitalize">{agent().mode}</p>
                </div>
                <div class="border border-border-base rounded-lg p-3">
                  <p class="text-[10px] text-color-dimmed uppercase mb-1">Native</p>
                  <p class="text-sm text-color-primary">{agent().native ? "Yes" : "No"}</p>
                </div>
                <Show when={agent().model}>
                  <div class="border border-border-base rounded-lg p-3">
                    <p class="text-[10px] text-color-dimmed uppercase mb-1">Model</p>
                    <p class="text-sm text-color-primary">{agent().model?.providerID}/{agent().model?.modelID}</p>
                  </div>
                </Show>
                <Show when={agent().temperature !== undefined}>
                  <div class="border border-border-base rounded-lg p-3">
                    <p class="text-[10px] text-color-dimmed uppercase mb-1">Temperature</p>
                    <p class="text-sm text-color-primary">{agent().temperature}</p>
                  </div>
                </Show>
                <Show when={agent().steps !== undefined}>
                  <div class="border border-border-base rounded-lg p-3">
                    <p class="text-[10px] text-color-dimmed uppercase mb-1">Max Steps</p>
                    <p class="text-sm text-color-primary">{agent().steps}</p>
                  </div>
                </Show>
              </div>

              {/* System Prompt */}
              <Show when={agent().prompt}>
                <div class="mb-6">
                  <h3 class="text-sm font-medium text-color-primary mb-2">System Prompt</h3>
                  <pre class="text-xs text-color-secondary bg-background-surface border border-border-base rounded-lg p-4 overflow-auto max-h-64 whitespace-pre-wrap">
                    {agent().prompt}
                  </pre>
                </div>
              </Show>

              {/* Permissions */}
              <Show when={agent().permission}>
                <div class="mb-6">
                  <h3 class="text-sm font-medium text-color-primary mb-2">Permissions</h3>
                  <div class="bg-background-surface border border-border-base rounded-lg p-4">
                    <pre class="text-xs text-color-secondary whitespace-pre-wrap">
                      {JSON.stringify(agent().permission, null, 2)}
                    </pre>
                  </div>
                </div>
              </Show>

              {/* Available Skills */}
              <div>
                <h3 class="text-sm font-medium text-color-primary mb-2">Available Skills ({skills()?.length ?? 0})</h3>
                <div class="grid grid-cols-2 gap-2">
                  <For each={skills()?.slice(0, 20)}>
                    {(skill) => (
                      <div class="px-3 py-2 border border-border-base rounded-lg">
                        <span class="text-xs font-medium text-color-primary">{skill.name}</span>
                        <span class="text-[10px] text-color-dimmed block">{skill.category}</span>
                      </div>
                    )}
                  </For>
                  <Show when={(skills()?.length ?? 0) > 20}>
                    <div class="px-3 py-2 border border-border-base rounded-lg flex items-center justify-center">
                      <span class="text-xs text-color-dimmed">+{(skills()?.length ?? 0) - 20} more</span>
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  )
}
