import { createSignal, onMount, Show, Suspense, lazy, ErrorBoundary } from "solid-js"
import { useSearchParams } from "@solidjs/router"
import { OrchestrationProvider } from "@/context/orchestration"

const SkillBrowser = lazy(() => import("@/components/orchestration/skill-browser"))
const WorkflowBuilder = lazy(() => import("@/components/orchestration/workflow-builder"))
const PromptStudio = lazy(() => import("@/components/orchestration/prompt-studio"))
const AgentConfigurator = lazy(() => import("@/components/orchestration/agent-configurator"))
const ResearchPanel = lazy(() => import("@/components/orchestration/research-panel"))

type Tab = "skills" | "workflows" | "prompts" | "agents" | "research"

const VALID_TABS: Tab[] = ["skills", "workflows", "prompts", "agents", "research"]

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "skills", label: "Skills", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { id: "workflows", label: "Workflows", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { id: "prompts", label: "Prompts", icon: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { id: "agents", label: "Agents", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { id: "research", label: "Research", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
]

export default function OrchestrationPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = VALID_TABS.includes(searchParams.tab as Tab) ? (searchParams.tab as Tab) : "skills"
  const [activeTab, setActiveTab] = createSignal<Tab>(initialTab)

  function switchTab(tab: Tab) {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  onMount(() => {
    if (searchParams.tab && VALID_TABS.includes(searchParams.tab as Tab)) {
      setActiveTab(searchParams.tab as Tab)
    }
  })

  return (
    <OrchestrationProvider>
      <div class="flex flex-col h-full bg-background-base">
        {/* Header */}
        <div class="shrink-0 border-b border-border-base px-6 pt-4 pb-0">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
            </div>
            <div>
              <h1 class="text-lg font-semibold text-color-primary">Orchestration</h1>
              <p class="text-xs text-color-dimmed">Manage skills, workflows, prompts, and agents</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav class="flex gap-1">
            {TABS.map((tab) => (
              <button
                class={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab() === tab.id
                    ? "bg-background-surface text-color-primary border-b-2 border-blue-500"
                    : "text-color-dimmed hover:text-color-secondary hover:bg-background-surface/50"
                }`}
                onClick={() => switchTab(tab.id)}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div class="flex-1 min-h-0 overflow-auto">
          <ErrorBoundary fallback={(err, reset) => <OrchestrationError error={err} reset={reset} tab={activeTab()} />}>
            <Suspense fallback={<LoadingSpinner />}>
              <Show when={activeTab() === "skills"}>
                <SkillBrowser />
              </Show>
              <Show when={activeTab() === "workflows"}>
                <WorkflowBuilder />
              </Show>
              <Show when={activeTab() === "prompts"}>
                <PromptStudio />
              </Show>
              <Show when={activeTab() === "agents"}>
                <AgentConfigurator />
              </Show>
              <Show when={activeTab() === "research"}>
                <ResearchPanel />
              </Show>
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </OrchestrationProvider>
  )
}

function LoadingSpinner() {
  return (
    <div class="flex items-center justify-center h-64">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  )
}

function OrchestrationError(props: { error: Error; reset: () => void; tab: string }) {
  return (
    <div class="flex flex-col items-center justify-center h-64 gap-4">
      <div class="p-3 rounded-full bg-red-500/10">
        <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <div class="text-center">
        <p class="text-sm font-medium text-color-primary mb-1">
          Failed to load {props.tab}
        </p>
        <p class="text-xs text-color-dimmed max-w-md">
          {props.error?.message || "An unexpected error occurred. Make sure the server is running."}
        </p>
      </div>
      <button
        class="px-4 py-2 text-sm bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
        onClick={props.reset}
      >
        Try Again
      </button>
    </div>
  )
}
