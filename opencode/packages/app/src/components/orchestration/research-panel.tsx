import { createSignal, For, Show } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { useOrchestration } from "@/context/orchestration"
import { useServer } from "@/context/server"
import { setSessionHandoff } from "@/pages/session"
import type { ResearchResult } from "@/lib/orchestration-client"

export default function ResearchPanel() {
  const client = useOrchestration()
  const navigate = useNavigate()
  const server = useServer()
  const [query, setQuery] = createSignal("")
  const [context, setContext] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [result, setResult] = createSignal<ResearchResult | null>(null)
  const [history, setHistory] = createSignal<Array<{ query: string; result: ResearchResult }>>([])
  const [importingSkill, setImportingSkill] = createSignal<string | null>(null)

  async function handleResearch() {
    if (!query() || loading()) return
    setLoading(true)
    try {
      const res = await client.research(query(), context() || undefined)
      setResult(res)
      setHistory([{ query: query(), result: res }, ...history()])
    } catch (e) {
      console.error("Research failed:", e)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSkill(suggestion: { name: string; description: string }) {
    setImportingSkill(suggestion.name)
    try {
      const skillName = suggestion.name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 64)

      await client.skills.generate({
        name: skillName,
        description: suggestion.description,
        category: "other",
        details: `Based on research: ${query()}`,
      })
    } catch (e) {
      console.error("Failed to create skill:", e)
    } finally {
      setImportingSkill(null)
    }
  }

  function sendResearchToAgent() {
    const lastProject = server.projects.last()
    if (!lastProject) {
      alert("Please open a project first.")
      return
    }
    const res = result()
    if (!res) return

    let promptText = `## Research Results\n\n`
    promptText += `**Topic:** ${query()}\n\n`
    promptText += `### Summary\n${res.summary}\n\n`

    if (res.findings.length > 0) {
      promptText += `### Key Findings\n`
      for (const finding of res.findings) {
        promptText += `- **${finding.title}**: ${finding.description}\n`
        if (finding.source) promptText += `  Source: ${finding.source}\n`
      }
      promptText += `\n`
    }

    if (res.suggestedSkills.length > 0) {
      promptText += `### Suggested Skills\n`
      for (const skill of res.suggestedSkills) {
        promptText += `- **${skill.name}**: ${skill.description}\n`
      }
      promptText += `\n`
    }

    promptText += `Please use these research findings to help complete the task at hand.`

    const dir = base64Encode(lastProject)
    setSessionHandoff(dir, {
      prompt: promptText,
      source: "orchestration",
      autoSubmit: true,
    })
    navigate(`/${dir}/session`)
  }

  return (
    <div class="flex h-full">
      {/* Research Input */}
      <div class="flex-1 flex flex-col min-w-0">
        <div class="shrink-0 p-6 border-b border-border-base">
          <h2 class="text-lg font-semibold text-color-primary mb-3">Research</h2>
          <p class="text-sm text-color-dimmed mb-4">
            Research topics using Gemini AI to discover skills, tools, and best practices
          </p>

          <div class="space-y-3">
            <div>
              <label class="block text-sm text-color-secondary mb-1">Research Topic</label>
              <div class="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., Video editing workflows, Content humanization techniques..."
                  class="flex-1 px-4 py-2.5 text-sm bg-background-surface border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500"
                  value={query()}
                  onInput={(e) => setQuery(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleResearch() }}
                />
                <button
                  class="px-6 py-2.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                  onClick={handleResearch}
                  disabled={!query() || loading()}
                >
                  {loading() ? (
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    "Research"
                  )}
                </button>
              </div>
            </div>
            <div>
              <label class="block text-sm text-color-secondary mb-1">Additional Context (optional)</label>
              <input
                type="text"
                placeholder="Any specific focus areas or constraints..."
                class="w-full px-4 py-2 text-sm bg-background-surface border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500"
                value={context()}
                onInput={(e) => setContext(e.currentTarget.value)}
              />
            </div>
          </div>

          {/* Quick Topics */}
          <div class="flex flex-wrap gap-2 mt-3">
            {[
              "Video editing agent skills",
              "Content humanization techniques",
              "Book writing workflows",
              "Code review best practices",
              "SEO optimization skills",
              "Data analysis pipelines",
            ].map((topic) => (
              <button
                class="px-3 py-1 text-xs bg-background-surface border border-border-base rounded-full text-color-secondary hover:text-color-primary hover:bg-background-surface/80 transition-colors"
                onClick={() => { setQuery(topic); handleResearch() }}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div class="flex-1 overflow-auto p-6">
          <Show when={loading()}>
            <div class="flex flex-col items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3" />
              <p class="text-sm text-color-dimmed">Researching with Gemini...</p>
            </div>
          </Show>

          <Show when={!loading() && result()}>
            {(res) => (
              <div class="space-y-6 max-w-3xl">
                {/* Action Bar */}
                <div class="flex items-center justify-end">
                  <button
                    class="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    onClick={sendResearchToAgent}
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Send to Agent
                  </button>
                </div>

                {/* Summary */}
                <div>
                  <h3 class="text-sm font-semibold text-color-primary mb-2">Summary</h3>
                  <div class="bg-background-surface border border-border-base rounded-lg p-4">
                    <p class="text-sm text-color-secondary leading-relaxed">{res().summary}</p>
                  </div>
                </div>

                {/* Findings */}
                <Show when={res().findings.length > 0}>
                  <div>
                    <h3 class="text-sm font-semibold text-color-primary mb-2">Key Findings</h3>
                    <div class="space-y-2">
                      <For each={res().findings}>
                        {(finding) => (
                          <div class="border border-border-base rounded-lg p-3">
                            <h4 class="text-sm font-medium text-color-primary">{finding.title}</h4>
                            <p class="text-xs text-color-secondary mt-1">{finding.description}</p>
                            <Show when={finding.source}>
                              <a
                                href={finding.source}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-[10px] text-blue-400 hover:underline mt-1 block"
                              >
                                {finding.source}
                              </a>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                {/* Suggested Skills */}
                <Show when={res().suggestedSkills.length > 0}>
                  <div>
                    <h3 class="text-sm font-semibold text-color-primary mb-2">Suggested Skills</h3>
                    <p class="text-xs text-color-dimmed mb-3">Skills that can be created based on research findings</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <For each={res().suggestedSkills}>
                        {(suggestion) => (
                          <div class="border border-border-base rounded-lg p-3">
                            <div class="flex items-start justify-between">
                              <div class="flex-1 min-w-0">
                                <h4 class="text-sm font-medium text-color-primary">{suggestion.name}</h4>
                                <p class="text-xs text-color-dimmed mt-0.5">{suggestion.description}</p>
                              </div>
                              <button
                                class="shrink-0 ml-2 px-2 py-1 text-[10px] bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                onClick={() => handleCreateSkill(suggestion)}
                                disabled={importingSkill() === suggestion.name}
                              >
                                {importingSkill() === suggestion.name ? "Creating..." : "Create Skill"}
                              </button>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            )}
          </Show>

          <Show when={!loading() && !result()}>
            <div class="flex flex-col items-center justify-center h-full text-center">
              <svg class="w-16 h-16 text-color-dimmed mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p class="text-sm text-color-dimmed">Enter a topic to start researching</p>
              <p class="text-xs text-color-dimmed mt-1">Gemini AI will find relevant tools, skills, and best practices</p>
            </div>
          </Show>
        </div>
      </div>

      {/* Research History */}
      <Show when={history().length > 0}>
        <div class="w-64 shrink-0 border-l border-border-base bg-background-surface/50 overflow-y-auto">
          <div class="p-3 border-b border-border-base">
            <h3 class="text-xs font-medium text-color-dimmed uppercase">Research History</h3>
          </div>
          <div class="p-2">
            <For each={history()}>
              {(item) => (
                <button
                  class="w-full text-left px-3 py-2 rounded-md hover:bg-background-surface transition-colors mb-1"
                  onClick={() => setResult(item.result)}
                >
                  <span class="text-xs text-color-primary block truncate">{item.query}</span>
                  <span class="text-[10px] text-color-dimmed">
                    {item.result.findings.length} findings, {item.result.suggestedSkills.length} skills
                  </span>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
