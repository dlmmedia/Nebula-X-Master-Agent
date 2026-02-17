import { createSignal, createResource, For, Show, createMemo } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { useOrchestration } from "@/context/orchestration"
import { useServer } from "@/context/server"
import { setSessionHandoff } from "@/pages/session"
import type { SkillEntry } from "@/lib/orchestration-client"

const CATEGORIES = [
  "all",
  "coding",
  "writing",
  "video",
  "research",
  "humanizer",
  "devops",
  "data",
  "design",
  "marketing",
  "automation",
  "security",
  "testing",
  "documentation",
  "other",
]

const KNOWN_REPOS = [
  { name: "VoltAgent Awesome Skills", url: "https://github.com/VoltAgent/awesome-agent-skills" },
  { name: "OpenAI Skills Catalog", url: "https://github.com/openai/skills" },
]

export default function SkillBrowser() {
  const client = useOrchestration()
  const navigate = useNavigate()
  const server = useServer()
  const [activeCategory, setActiveCategory] = createSignal("all")
  const [searchQuery, setSearchQuery] = createSignal("")
  const [viewMode, setViewMode] = createSignal<"grid" | "list">("grid")
  const [showImportDialog, setShowImportDialog] = createSignal(false)
  const [showGenerateDialog, setShowGenerateDialog] = createSignal(false)
  const [showCreateDialog, setShowCreateDialog] = createSignal(false)
  const [selectedSkill, setSelectedSkill] = createSignal<SkillEntry | null>(null)
  const [importLoading, setImportLoading] = createSignal(false)
  const [generateLoading, setGenerateLoading] = createSignal(false)

  const [skills, { refetch }] = createResource(
    () => ({ category: activeCategory(), search: searchQuery() }),
    async (params) => {
      const result = await client.skills.list({
        category: params.category === "all" ? undefined : params.category,
        search: params.search || undefined,
        limit: 100,
      })
      return result
    },
  )

  const [categories] = createResource(() => client.skills.categories())

  const categoryCount = createMemo(() => {
    const cats = categories()
    if (!cats) return {} as Record<string, number>
    return Object.fromEntries(cats.map((c) => [c.category, c.count]))
  })

  // Import from GitHub
  const [importUrl, setImportUrl] = createSignal("")
  const [importCategory, setImportCategory] = createSignal("")

  async function handleImport() {
    const url = importUrl()
    if (!url) return
    setImportLoading(true)
    try {
      await client.skills.import(url, importCategory() || undefined)
      setShowImportDialog(false)
      setImportUrl("")
      refetch()
    } catch (e) {
      console.error("Import failed:", e)
    } finally {
      setImportLoading(false)
    }
  }

  // Generate with Gemini
  const [genName, setGenName] = createSignal("")
  const [genDesc, setGenDesc] = createSignal("")
  const [genCategory, setGenCategory] = createSignal("coding")
  const [genDetails, setGenDetails] = createSignal("")

  async function handleGenerate() {
    if (!genName() || !genDesc()) return
    setGenerateLoading(true)
    try {
      await client.skills.generate({
        name: genName(),
        description: genDesc(),
        category: genCategory(),
        details: genDetails() || undefined,
      })
      setShowGenerateDialog(false)
      setGenName("")
      setGenDesc("")
      setGenDetails("")
      refetch()
    } catch (e) {
      console.error("Generate failed:", e)
    } finally {
      setGenerateLoading(false)
    }
  }

  // Create manually
  const [createName, setCreateName] = createSignal("")
  const [createDesc, setCreateDesc] = createSignal("")
  const [createCategory, setCreateCategory] = createSignal("coding")
  const [createContent, setCreateContent] = createSignal("")

  async function handleCreate() {
    if (!createName() || !createDesc() || !createContent()) return
    try {
      await client.skills.create({
        name: createName(),
        description: createDesc(),
        category: createCategory(),
        content: createContent(),
      })
      setShowCreateDialog(false)
      setCreateName("")
      setCreateDesc("")
      setCreateContent("")
      refetch()
    } catch (e) {
      console.error("Create failed:", e)
    }
  }

  async function handleToggle(skill: SkillEntry) {
    await client.skills.update(skill.id, { enabled: !skill.enabled })
    refetch()
  }

  async function handleDelete(skill: SkillEntry) {
    if (!confirm(`Delete skill "${skill.name}"?`)) return
    await client.skills.delete(skill.id)
    refetch()
  }

  function useWithAgent(skill: SkillEntry) {
    const lastProject = server.projects.last()
    if (!lastProject) {
      alert("Please open a project first before using a skill with the agent.")
      return
    }
    const dir = base64Encode(lastProject)
    const promptText = `Use the following skill instructions to complete the task:\n\n## Skill: ${skill.name}\n\n${skill.content}`
    setSessionHandoff(dir, {
      prompt: promptText,
      source: "orchestration",
      autoSubmit: true,
    })
    navigate(`/${dir}/session`)
  }

  return (
    <div class="flex h-full">
      {/* Category Sidebar */}
      <div class="w-48 shrink-0 border-r border-border-base bg-background-surface/50 overflow-y-auto">
        <div class="p-3">
          <p class="text-xs font-medium text-color-dimmed uppercase tracking-wider mb-2">Categories</p>
          <For each={CATEGORIES}>
            {(cat) => (
              <button
                class={`w-full text-left px-3 py-1.5 text-sm rounded-md mb-0.5 transition-colors ${
                  activeCategory() === cat
                    ? "bg-blue-500/10 text-blue-400 font-medium"
                    : "text-color-secondary hover:bg-background-surface"
                }`}
                onClick={() => setActiveCategory(cat)}
              >
                <span class="capitalize">{cat}</span>
                <Show when={cat !== "all" && categoryCount()[cat]}>
                  <span class="ml-1 text-xs text-color-dimmed">({categoryCount()[cat]})</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Main Content */}
      <div class="flex-1 min-w-0 flex flex-col">
        {/* Toolbar */}
        <div class="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border-base">
          <div class="flex-1 relative">
            <svg
              class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-color-dimmed"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search skills..."
              class="w-full pl-10 pr-4 py-2 text-sm bg-background-surface border border-border-base rounded-lg text-color-primary placeholder:text-color-dimmed focus:outline-none focus:border-blue-500"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
            />
          </div>

          <div class="flex items-center gap-1 border border-border-base rounded-lg overflow-hidden">
            <button
              class={`p-2 ${viewMode() === "grid" ? "bg-background-surface text-color-primary" : "text-color-dimmed"}`}
              onClick={() => setViewMode("grid")}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              class={`p-2 ${viewMode() === "list" ? "bg-background-surface text-color-primary" : "text-color-dimmed"}`}
              onClick={() => setViewMode("list")}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <button
            class="px-3 py-2 text-sm bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
            onClick={() => setShowImportDialog(true)}
          >
            Import
          </button>
          <button
            class="px-3 py-2 text-sm bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-colors"
            onClick={() => setShowGenerateDialog(true)}
          >
            Generate
          </button>
          <button
            class="px-3 py-2 text-sm bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors"
            onClick={() => setShowCreateDialog(true)}
          >
            Create
          </button>
        </div>

        {/* Skills Grid/List */}
        <div class="flex-1 overflow-y-auto p-4">
          <Show when={skills.loading}>
            <div class="flex items-center justify-center h-32">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          </Show>

          <Show when={skills.error}>
            <div class="flex flex-col items-center justify-center h-32 gap-3">
              <p class="text-sm text-red-400">Failed to load skills</p>
              <p class="text-xs text-color-dimmed max-w-sm text-center">
                {skills.error?.message || "Could not connect to the orchestration API."}
              </p>
              <button
                class="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
                onClick={() => refetch()}
              >
                Retry
              </button>
            </div>
          </Show>

          <Show when={!skills.loading && !skills.error && skills()?.items.length === 0}>
            <div class="text-center py-12">
              <p class="text-color-dimmed text-sm">No skills found</p>
              <p class="text-color-dimmed text-xs mt-1">Import from GitHub or generate with Gemini</p>
            </div>
          </Show>

          <Show when={!skills.loading && !skills.error && (skills()?.items.length ?? 0) > 0}>
            <div
              class={
                viewMode() === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
                  : "flex flex-col gap-2"
              }
            >
              <For each={skills()?.items}>
                {(skill) => (
                  <SkillCard
                    skill={skill}
                    viewMode={viewMode()}
                    onSelect={() => setSelectedSkill(skill)}
                    onToggle={() => handleToggle(skill)}
                    onDelete={() => handleDelete(skill)}
                    onUseWithAgent={() => useWithAgent(skill)}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>

      {/* Detail Panel */}
      <Show when={selectedSkill()}>
        {(skill) => (
          <div class="w-80 shrink-0 border-l border-border-base bg-background-surface/50 overflow-y-auto">
            <div class="p-4">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-color-primary">{skill().name}</h3>
                <button class="text-color-dimmed hover:text-color-primary" onClick={() => setSelectedSkill(null)}>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p class="text-xs text-color-secondary mb-3">{skill().description}</p>
              <div class="flex gap-2 mb-3">
                <span class="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-400">{skill().category}</span>
                <span class="px-2 py-0.5 text-xs rounded-full bg-gray-500/10 text-color-dimmed">{skill().source}</span>
                <span class="px-2 py-0.5 text-xs rounded-full bg-gray-500/10 text-color-dimmed">v{skill().version}</span>
              </div>
              <Show when={skill().tags?.length}>
                <div class="flex flex-wrap gap-1 mb-3">
                  <For each={skill().tags!}>
                    {(tag) => (
                      <span class="px-2 py-0.5 text-[10px] rounded bg-background-surface text-color-dimmed">{tag}</span>
                    )}
                  </For>
                </div>
              </Show>
              <div class="border-t border-border-base pt-3 mb-3">
                <button
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  onClick={() => useWithAgent(skill())}
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Use with Agent
                </button>
              </div>
              <div class="border-t border-border-base pt-3">
                <p class="text-xs font-medium text-color-dimmed uppercase mb-2">Content</p>
                <pre class="text-xs text-color-secondary bg-background-base rounded-lg p-3 overflow-x-auto max-h-96 whitespace-pre-wrap">
                  {skill().content}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Import Dialog */}
      <Show when={showImportDialog()}>
        <DialogOverlay onClose={() => setShowImportDialog(false)}>
          <div class="bg-background-surface border border-border-base rounded-xl p-6 w-[500px] max-w-[90vw]">
            <h2 class="text-lg font-semibold text-color-primary mb-4">Import Skills from GitHub</h2>

            <div class="mb-4">
              <p class="text-xs text-color-dimmed uppercase mb-2">Known Repositories</p>
              <div class="flex flex-col gap-2">
                <For each={KNOWN_REPOS}>
                  {(repo) => (
                    <button
                      class="text-left px-3 py-2 text-sm border border-border-base rounded-lg hover:bg-background-surface transition-colors"
                      onClick={() => setImportUrl(repo.url)}
                    >
                      <span class="text-color-primary font-medium">{repo.name}</span>
                      <span class="block text-xs text-color-dimmed">{repo.url}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>

            <div class="mb-4">
              <label class="block text-sm text-color-secondary mb-1">Repository URL</label>
              <input
                type="text"
                placeholder="https://github.com/owner/repo"
                class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500"
                value={importUrl()}
                onInput={(e) => setImportUrl(e.currentTarget.value)}
              />
            </div>

            <div class="mb-4">
              <label class="block text-sm text-color-secondary mb-1">Default Category (optional)</label>
              <select
                class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary"
                value={importCategory()}
                onChange={(e) => setImportCategory(e.currentTarget.value)}
              >
                <option value="">Auto-detect</option>
                <For each={CATEGORIES.filter((c) => c !== "all")}>
                  {(cat) => <option value={cat}>{cat}</option>}
                </For>
              </select>
            </div>

            <div class="flex justify-end gap-2">
              <button
                class="px-4 py-2 text-sm text-color-secondary hover:text-color-primary transition-colors"
                onClick={() => setShowImportDialog(false)}
              >
                Cancel
              </button>
              <button
                class="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                onClick={handleImport}
                disabled={!importUrl() || importLoading()}
              >
                {importLoading() ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </DialogOverlay>
      </Show>

      {/* Generate Dialog */}
      <Show when={showGenerateDialog()}>
        <DialogOverlay onClose={() => setShowGenerateDialog(false)}>
          <div class="bg-background-surface border border-border-base rounded-xl p-6 w-[500px] max-w-[90vw]">
            <h2 class="text-lg font-semibold text-color-primary mb-4">Generate Skill with Gemini</h2>

            <div class="space-y-4">
              <div>
                <label class="block text-sm text-color-secondary mb-1">Skill Name</label>
                <input
                  type="text"
                  placeholder="my-skill-name"
                  class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500"
                  value={genName()}
                  onInput={(e) => setGenName(e.currentTarget.value)}
                />
                <p class="text-[10px] text-color-dimmed mt-1">Lowercase, hyphens only (e.g. "video-editor")</p>
              </div>

              <div>
                <label class="block text-sm text-color-secondary mb-1">Description</label>
                <input
                  type="text"
                  placeholder="What this skill does and when to use it"
                  class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500"
                  value={genDesc()}
                  onInput={(e) => setGenDesc(e.currentTarget.value)}
                />
              </div>

              <div>
                <label class="block text-sm text-color-secondary mb-1">Category</label>
                <select
                  class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary"
                  value={genCategory()}
                  onChange={(e) => setGenCategory(e.currentTarget.value)}
                >
                  <For each={CATEGORIES.filter((c) => c !== "all")}>
                    {(cat) => <option value={cat}>{cat}</option>}
                  </For>
                </select>
              </div>

              <div>
                <label class="block text-sm text-color-secondary mb-1">Additional Details (optional)</label>
                <textarea
                  placeholder="Any extra context for Gemini to generate better instructions..."
                  class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500 h-24 resize-none"
                  value={genDetails()}
                  onInput={(e) => setGenDetails(e.currentTarget.value)}
                />
              </div>
            </div>

            <div class="flex justify-end gap-2 mt-4">
              <button
                class="px-4 py-2 text-sm text-color-secondary hover:text-color-primary transition-colors"
                onClick={() => setShowGenerateDialog(false)}
              >
                Cancel
              </button>
              <button
                class="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                onClick={handleGenerate}
                disabled={!genName() || !genDesc() || generateLoading()}
              >
                {generateLoading() ? "Generating..." : "Generate with Gemini"}
              </button>
            </div>
          </div>
        </DialogOverlay>
      </Show>

      {/* Create Dialog */}
      <Show when={showCreateDialog()}>
        <DialogOverlay onClose={() => setShowCreateDialog(false)}>
          <div class="bg-background-surface border border-border-base rounded-xl p-6 w-[600px] max-w-[90vw]">
            <h2 class="text-lg font-semibold text-color-primary mb-4">Create Skill</h2>

            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-color-secondary mb-1">Name</label>
                  <input
                    type="text"
                    placeholder="my-skill"
                    class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500"
                    value={createName()}
                    onInput={(e) => setCreateName(e.currentTarget.value)}
                  />
                </div>
                <div>
                  <label class="block text-sm text-color-secondary mb-1">Category</label>
                  <select
                    class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary"
                    value={createCategory()}
                    onChange={(e) => setCreateCategory(e.currentTarget.value)}
                  >
                    <For each={CATEGORIES.filter((c) => c !== "all")}>
                      {(cat) => <option value={cat}>{cat}</option>}
                    </For>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-sm text-color-secondary mb-1">Description</label>
                <input
                  type="text"
                  placeholder="What this skill does"
                  class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500"
                  value={createDesc()}
                  onInput={(e) => setCreateDesc(e.currentTarget.value)}
                />
              </div>

              <div>
                <label class="block text-sm text-color-secondary mb-1">SKILL.md Content</label>
                <textarea
                  placeholder="---&#10;name: my-skill&#10;description: What this skill does&#10;---&#10;&#10;## Instructions&#10;..."
                  class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500 h-48 resize-none font-mono"
                  value={createContent()}
                  onInput={(e) => setCreateContent(e.currentTarget.value)}
                />
              </div>
            </div>

            <div class="flex justify-end gap-2 mt-4">
              <button
                class="px-4 py-2 text-sm text-color-secondary hover:text-color-primary transition-colors"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </button>
              <button
                class="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                onClick={handleCreate}
                disabled={!createName() || !createDesc() || !createContent()}
              >
                Create Skill
              </button>
            </div>
          </div>
        </DialogOverlay>
      </Show>
    </div>
  )
}

function SkillCard(props: {
  skill: SkillEntry
  viewMode: "grid" | "list"
  onSelect: () => void
  onToggle: () => void
  onDelete: () => void
  onUseWithAgent: () => void
}) {
  const sourceColor = () => {
    switch (props.skill.source) {
      case "github": return "text-blue-400 bg-blue-500/10"
      case "generated": return "text-purple-400 bg-purple-500/10"
      case "imported": return "text-green-400 bg-green-500/10"
      default: return "text-color-dimmed bg-background-surface"
    }
  }

  if (props.viewMode === "list") {
    return (
      <div
        class="flex items-center gap-3 px-4 py-2.5 border border-border-base rounded-lg hover:bg-background-surface/50 cursor-pointer transition-colors"
        onClick={props.onSelect}
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-color-primary truncate">{props.skill.name}</span>
            <span class={`px-1.5 py-0.5 text-[10px] rounded-full ${sourceColor()}`}>{props.skill.source}</span>
          </div>
          <p class="text-xs text-color-dimmed truncate">{props.skill.description}</p>
        </div>
        <span class="text-xs text-color-dimmed capitalize">{props.skill.category}</span>
        <button
          class="px-2 py-1 text-xs bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); props.onUseWithAgent() }}
        >
          Use
        </button>
        <button
          class={`w-8 h-4 rounded-full relative transition-colors ${props.skill.enabled ? "bg-blue-500" : "bg-gray-600"}`}
          onClick={(e) => { e.stopPropagation(); props.onToggle() }}
        >
          <div class={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${props.skill.enabled ? "left-4" : "left-0.5"}`} />
        </button>
      </div>
    )
  }

  return (
    <div
      class="border border-border-base rounded-lg p-4 hover:bg-background-surface/50 cursor-pointer transition-colors group"
      onClick={props.onSelect}
    >
      <div class="flex items-start justify-between mb-2">
        <h3 class="text-sm font-medium text-color-primary truncate flex-1">{props.skill.name}</h3>
        <div class="flex items-center gap-1 ml-2">
          <button
            class="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded transition-all"
            onClick={(e) => { e.stopPropagation(); props.onDelete() }}
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            class={`w-8 h-4 rounded-full relative transition-colors ${props.skill.enabled ? "bg-blue-500" : "bg-gray-600"}`}
            onClick={(e) => { e.stopPropagation(); props.onToggle() }}
          >
            <div class={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${props.skill.enabled ? "left-4" : "left-0.5"}`} />
          </button>
        </div>
      </div>
      <p class="text-xs text-color-dimmed line-clamp-2 mb-3">{props.skill.description}</p>
      <div class="flex items-center gap-2">
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-background-surface text-color-dimmed capitalize">{props.skill.category}</span>
        <span class={`text-[10px] px-2 py-0.5 rounded-full ${sourceColor()}`}>{props.skill.source}</span>
        <button
          class="opacity-0 group-hover:opacity-100 ml-auto px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 rounded-full hover:bg-blue-500/20 transition-all"
          onClick={(e) => { e.stopPropagation(); props.onUseWithAgent() }}
        >
          Use with Agent
        </button>
        <span class="text-[10px] text-color-dimmed group-hover:hidden ml-auto">v{props.skill.version}</span>
      </div>
    </div>
  )
}

function DialogOverlay(props: { children: any; onClose: () => void }) {
  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose() }}
    >
      {props.children}
    </div>
  )
}
