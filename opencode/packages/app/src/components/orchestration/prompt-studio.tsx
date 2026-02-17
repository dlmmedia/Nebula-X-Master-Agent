import { createSignal, createResource, For, Show, createEffect } from "solid-js"
import { useOrchestration } from "@/context/orchestration"
import type { PromptEntry, BuiltinTemplate } from "@/lib/orchestration-client"

export default function PromptStudio() {
  const client = useOrchestration()
  const [activePrompt, setActivePrompt] = createSignal<PromptEntry | null>(null)
  const [editorContent, setEditorContent] = createSignal("")
  const [previewVars, setPreviewVars] = createSignal<Record<string, string>>({})
  const [renderedPreview, setRenderedPreview] = createSignal("")
  const [showGenerateDialog, setShowGenerateDialog] = createSignal(false)
  const [showCreateDialog, setShowCreateDialog] = createSignal(false)
  const [generateLoading, setGenerateLoading] = createSignal(false)
  const [showBuiltins, setShowBuiltins] = createSignal(false)

  const [prompts, { refetch }] = createResource(() => client.prompts.list())
  const [builtins] = createResource(() => client.prompts.builtin())

  // Update editor when prompt selected
  createEffect(() => {
    const prompt = activePrompt()
    if (prompt) {
      setEditorContent(prompt.content)
      const vars: Record<string, string> = {}
      for (const v of prompt.variables || []) {
        vars[v] = ""
      }
      setPreviewVars(vars)
    }
  })

  // Update preview when content or vars change
  createEffect(() => {
    const content = editorContent()
    const vars = previewVars()
    let rendered = content
    for (const [key, value] of Object.entries(vars)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || `{{${key}}}`)
    }
    setRenderedPreview(rendered)
  })

  // Extract variables from content
  function detectVariables(content: string): string[] {
    const matches = content.match(/\{\{(\w+)\}\}/g) || []
    return [...new Set(matches.map((v) => v.replace(/[{}]/g, "")))]
  }

  // Generate prompt
  const [genGoal, setGenGoal] = createSignal("")
  const [genStyle, setGenStyle] = createSignal<"concise" | "detailed" | "step-by-step">("detailed")

  async function handleGenerate() {
    if (!genGoal()) return
    setGenerateLoading(true)
    try {
      const result = await client.prompts.generate({
        goal: genGoal(),
        style: genStyle(),
      })
      setActivePrompt(result)
      setShowGenerateDialog(false)
      setGenGoal("")
      refetch()
    } catch (e) {
      console.error("Generate failed:", e)
    } finally {
      setGenerateLoading(false)
    }
  }

  // Create prompt
  const [createName, setCreateName] = createSignal("")
  const [createDesc, setCreateDesc] = createSignal("")

  async function handleCreate() {
    if (!createName() || !createDesc() || !editorContent()) return
    try {
      const result = await client.prompts.create({
        name: createName(),
        description: createDesc(),
        content: editorContent(),
        variables: detectVariables(editorContent()),
      })
      setActivePrompt(result)
      setShowCreateDialog(false)
      setCreateName("")
      setCreateDesc("")
      refetch()
    } catch (e) {
      console.error("Create failed:", e)
    }
  }

  // Save current prompt
  async function handleSave() {
    const prompt = activePrompt()
    if (!prompt) return
    await client.prompts.update(prompt.id, {
      content: editorContent(),
      variables: detectVariables(editorContent()),
    })
    refetch()
  }

  async function handleDelete(prompt: PromptEntry) {
    if (!confirm(`Delete prompt "${prompt.name}"?`)) return
    await client.prompts.delete(prompt.id)
    if (activePrompt()?.id === prompt.id) setActivePrompt(null)
    refetch()
  }

  function useBuiltin(template: BuiltinTemplate) {
    setEditorContent(template.content)
    const vars: Record<string, string> = {}
    for (const v of template.variables) {
      vars[v] = ""
    }
    setPreviewVars(vars)
    setShowBuiltins(false)
  }

  return (
    <div class="flex h-full">
      {/* Prompt List */}
      <div class="w-64 shrink-0 border-r border-border-base bg-background-surface/50 flex flex-col">
        <div class="p-3 border-b border-border-base">
          <div class="flex items-center gap-2 mb-2">
            <h3 class="text-sm font-medium text-color-primary flex-1">Prompt Templates</h3>
            <button
              class="p-1 text-color-dimmed hover:text-color-primary rounded transition-colors"
              onClick={() => setShowBuiltins(!showBuiltins())}
              title="Built-in Templates"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </button>
          </div>
          <div class="flex gap-1">
            <button
              class="flex-1 px-2 py-1.5 text-xs bg-purple-500/10 text-purple-400 rounded hover:bg-purple-500/20 transition-colors"
              onClick={() => setShowGenerateDialog(true)}
            >
              Generate
            </button>
            <button
              class="flex-1 px-2 py-1.5 text-xs bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-colors"
              onClick={() => {
                setActivePrompt(null)
                setEditorContent("")
                setPreviewVars({})
                setShowCreateDialog(true)
              }}
            >
              New
            </button>
          </div>
        </div>

        {/* Built-in Templates */}
        <Show when={showBuiltins()}>
          <div class="border-b border-border-base">
            <p class="px-3 pt-2 text-[10px] text-color-dimmed uppercase">Built-in Templates</p>
            <div class="p-2">
              <For each={builtins()}>
                {(template) => (
                  <button
                    class="w-full text-left px-3 py-2 rounded-md hover:bg-background-surface transition-colors"
                    onClick={() => useBuiltin(template)}
                  >
                    <span class="text-xs font-medium text-color-primary block">{template.name}</span>
                    <span class="text-[10px] text-color-dimmed">{template.description}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Saved Prompts */}
        <div class="flex-1 overflow-y-auto p-2">
          <Show when={prompts.loading}>
            <div class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
            </div>
          </Show>
          <For each={prompts()}>
            {(prompt) => (
              <div
                class={`px-3 py-2 rounded-md cursor-pointer mb-1 group ${
                  activePrompt()?.id === prompt.id
                    ? "bg-blue-500/10 text-blue-400"
                    : "hover:bg-background-surface text-color-secondary"
                }`}
                onClick={() => setActivePrompt(prompt)}
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-medium truncate">{prompt.name}</span>
                  <button
                    class="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:bg-red-500/10 rounded"
                    onClick={(e) => { e.stopPropagation(); handleDelete(prompt) }}
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <span class="text-[10px] text-color-dimmed">{prompt.description}</span>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Editor + Preview */}
      <div class="flex-1 flex min-w-0">
        {/* Editor */}
        <div class="flex-1 flex flex-col border-r border-border-base">
          <div class="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border-base">
            <span class="text-xs font-medium text-color-dimmed uppercase">Editor</span>
            <div class="flex gap-2">
              <Show when={activePrompt()}>
                <button
                  class="px-3 py-1 text-xs bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors"
                  onClick={handleSave}
                >
                  Save
                </button>
              </Show>
            </div>
          </div>
          <textarea
            class="flex-1 p-4 text-sm font-mono bg-background-base text-color-primary resize-none focus:outline-none"
            placeholder="Write your prompt template here...&#10;&#10;Use {{variable_name}} for dynamic parts."
            value={editorContent()}
            onInput={(e) => {
              setEditorContent(e.currentTarget.value)
              const vars = detectVariables(e.currentTarget.value)
              const current = previewVars()
              const newVars: Record<string, string> = {}
              for (const v of vars) {
                newVars[v] = current[v] || ""
              }
              setPreviewVars(newVars)
            }}
          />
        </div>

        {/* Preview + Variables */}
        <div class="w-80 shrink-0 flex flex-col">
          {/* Variables */}
          <Show when={Object.keys(previewVars()).length > 0}>
            <div class="shrink-0 border-b border-border-base p-3">
              <p class="text-[10px] text-color-dimmed uppercase mb-2">Variables</p>
              <div class="space-y-2">
                <For each={Object.entries(previewVars())}>
                  {([key, value]) => (
                    <div>
                      <label class="text-[10px] text-color-secondary block mb-0.5">{`{{${key}}}`}</label>
                      <input
                        type="text"
                        placeholder={key}
                        class="w-full px-2 py-1 text-xs bg-background-base border border-border-base rounded text-color-primary focus:outline-none focus:border-blue-500"
                        value={value}
                        onInput={(e) => setPreviewVars({ ...previewVars(), [key]: e.currentTarget.value })}
                      />
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Preview */}
          <div class="flex-1 flex flex-col">
            <div class="shrink-0 px-4 py-2 border-b border-border-base">
              <span class="text-xs font-medium text-color-dimmed uppercase">Preview</span>
            </div>
            <pre class="flex-1 p-4 text-xs text-color-secondary overflow-auto whitespace-pre-wrap">
              {renderedPreview() || "Write a prompt to see the preview..."}
            </pre>
          </div>
        </div>
      </div>

      {/* Generate Dialog */}
      <Show when={showGenerateDialog()}>
        <DialogOverlay onClose={() => setShowGenerateDialog(false)}>
          <div class="bg-background-surface border border-border-base rounded-xl p-6 w-[500px] max-w-[90vw]">
            <h2 class="text-lg font-semibold text-color-primary mb-4">Generate Prompt with Gemini</h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm text-color-secondary mb-1">What should this prompt do?</label>
                <textarea
                  placeholder="Describe the goal of this prompt..."
                  class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500 h-24 resize-none"
                  value={genGoal()}
                  onInput={(e) => setGenGoal(e.currentTarget.value)}
                />
              </div>
              <div>
                <label class="block text-sm text-color-secondary mb-1">Style</label>
                <select
                  class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary"
                  value={genStyle()}
                  onChange={(e) => setGenStyle(e.currentTarget.value as any)}
                >
                  <option value="concise">Concise</option>
                  <option value="detailed">Detailed</option>
                  <option value="step-by-step">Step-by-Step</option>
                </select>
              </div>
            </div>
            <div class="flex justify-end gap-2 mt-4">
              <button class="px-4 py-2 text-sm text-color-secondary" onClick={() => setShowGenerateDialog(false)}>
                Cancel
              </button>
              <button
                class="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                onClick={handleGenerate}
                disabled={!genGoal() || generateLoading()}
              >
                {generateLoading() ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </DialogOverlay>
      </Show>

      {/* Create Dialog */}
      <Show when={showCreateDialog()}>
        <DialogOverlay onClose={() => setShowCreateDialog(false)}>
          <div class="bg-background-surface border border-border-base rounded-xl p-6 w-[400px] max-w-[90vw]">
            <h2 class="text-lg font-semibold text-color-primary mb-4">Save Prompt Template</h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm text-color-secondary mb-1">Name</label>
                <input
                  type="text"
                  placeholder="My Prompt"
                  class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500"
                  value={createName()}
                  onInput={(e) => setCreateName(e.currentTarget.value)}
                />
              </div>
              <div>
                <label class="block text-sm text-color-secondary mb-1">Description</label>
                <input
                  type="text"
                  placeholder="What this prompt does"
                  class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500"
                  value={createDesc()}
                  onInput={(e) => setCreateDesc(e.currentTarget.value)}
                />
              </div>
            </div>
            <div class="flex justify-end gap-2 mt-4">
              <button class="px-4 py-2 text-sm text-color-secondary" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </button>
              <button
                class="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                onClick={handleCreate}
                disabled={!createName() || !createDesc()}
              >
                Save
              </button>
            </div>
          </div>
        </DialogOverlay>
      </Show>
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
