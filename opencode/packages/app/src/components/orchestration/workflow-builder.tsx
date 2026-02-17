import { createSignal, createResource, For, Show, createMemo } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { useOrchestration } from "@/context/orchestration"
import { useServer } from "@/context/server"
import { setSessionHandoff } from "@/pages/session"
import type { WorkflowEntry, WorkflowStep, WorkflowTemplate } from "@/lib/orchestration-client"

const STEP_COLORS: Record<string, string> = {
  skill: "border-blue-500 bg-blue-500/10",
  prompt: "border-purple-500 bg-purple-500/10",
  shell: "border-green-500 bg-green-500/10",
  api: "border-orange-500 bg-orange-500/10",
  condition: "border-yellow-500 bg-yellow-500/10",
}

const STEP_ICONS: Record<string, string> = {
  skill: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  prompt: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  shell: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  api: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  condition: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
}

export default function WorkflowBuilder() {
  const client = useOrchestration()
  const navigate = useNavigate()
  const server = useServer()
  const [activeWorkflow, setActiveWorkflow] = createSignal<WorkflowEntry | null>(null)
  const [editSteps, setEditSteps] = createSignal<WorkflowStep[]>([])
  const [showCreateDialog, setShowCreateDialog] = createSignal(false)
  const [showGenerateDialog, setShowGenerateDialog] = createSignal(false)
  const [showTemplates, setShowTemplates] = createSignal(false)
  const [showAddStep, setShowAddStep] = createSignal(false)
  const [selectedStep, setSelectedStep] = createSignal<WorkflowStep | null>(null)
  const [generateLoading, setGenerateLoading] = createSignal(false)
  const [runResult, setRunResult] = createSignal<any>(null)

  const [workflows, { refetch }] = createResource(() => client.workflows.list())
  const [templates] = createResource(() => client.workflows.templates())

  // Create workflow
  const [createName, setCreateName] = createSignal("")
  const [createDesc, setCreateDesc] = createSignal("")

  async function handleCreate() {
    if (!createName() || !createDesc()) return
    try {
      const wf = await client.workflows.create({
        name: createName(),
        description: createDesc(),
        definition: { steps: editSteps() },
      })
      setActiveWorkflow(wf)
      setShowCreateDialog(false)
      setCreateName("")
      setCreateDesc("")
      refetch()
    } catch (e) {
      console.error("Create failed:", e)
    }
  }

  // Generate
  const [genName, setGenName] = createSignal("")
  const [genDesc, setGenDesc] = createSignal("")

  async function handleGenerate() {
    if (!genName() || !genDesc()) return
    setGenerateLoading(true)
    try {
      const wf = await client.workflows.generate({
        name: genName(),
        description: genDesc(),
      })
      setActiveWorkflow(wf)
      setEditSteps(wf.definition.steps)
      setShowGenerateDialog(false)
      setGenName("")
      setGenDesc("")
      refetch()
    } catch (e) {
      console.error("Generate failed:", e)
    } finally {
      setGenerateLoading(false)
    }
  }

  // Use template
  function useTemplate(template: WorkflowTemplate) {
    setEditSteps(template.definition.steps)
    setCreateName(template.name)
    setCreateDesc(template.description)
    setShowTemplates(false)
    setShowCreateDialog(true)
  }

  // Add step
  const [newStepName, setNewStepName] = createSignal("")
  const [newStepType, setNewStepType] = createSignal<WorkflowStep["type"]>("prompt")

  function addStep() {
    if (!newStepName()) return
    const step: WorkflowStep = {
      id: `step-${Date.now()}`,
      name: newStepName(),
      type: newStepType(),
      config: {},
      dependsOn: [],
    }
    setEditSteps([...editSteps(), step])
    setShowAddStep(false)
    setNewStepName("")
  }

  function removeStep(stepId: string) {
    setEditSteps(editSteps().filter((s) => s.id !== stepId))
    if (selectedStep()?.id === stepId) setSelectedStep(null)
  }

  // Save workflow
  async function handleSave() {
    const wf = activeWorkflow()
    if (!wf) return
    await client.workflows.update(wf.id, {
      definition: { steps: editSteps() },
    })
    refetch()
  }

  // Run workflow
  async function handleRun() {
    const wf = activeWorkflow()
    if (!wf) return
    try {
      const result = await client.workflows.run(wf.id)
      setRunResult(result)
    } catch (e) {
      console.error("Run failed:", e)
    }
  }

  async function handleDelete(wf: WorkflowEntry) {
    if (!confirm(`Delete workflow "${wf.name}"?`)) return
    await client.workflows.delete(wf.id)
    if (activeWorkflow()?.id === wf.id) {
      setActiveWorkflow(null)
      setEditSteps([])
    }
    refetch()
  }

  function sendResultsToAgent() {
    const lastProject = server.projects.last()
    if (!lastProject) {
      alert("Please open a project first.")
      return
    }
    const result = runResult()
    const wf = activeWorkflow()
    if (!result || !wf) return

    let promptText = `## Workflow Results: ${wf.name}\n\n`
    promptText += `Status: ${result.status}\n\n`

    if (result.result) {
      const stepResults = result.result as Record<string, any>
      for (const [stepId, stepOutput] of Object.entries(stepResults)) {
        const step = wf.definition.steps.find((s) => s.id === stepId)
        const stepName = step?.name || stepId
        promptText += `### Step: ${stepName}\n`
        promptText += `${typeof stepOutput === "string" ? stepOutput : JSON.stringify(stepOutput, null, 2)}\n\n`
      }
    }

    if (result.error) {
      promptText += `### Error\n${result.error}\n\n`
    }

    promptText += `Please review these workflow results and take appropriate action based on the outputs above.`

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
      {/* Workflow List */}
      <div class="w-64 shrink-0 border-r border-border-base bg-background-surface/50 flex flex-col">
        <div class="p-3 border-b border-border-base">
          <h3 class="text-sm font-medium text-color-primary mb-2">Workflows</h3>
          <div class="flex gap-1">
            <button
              class="flex-1 px-2 py-1.5 text-xs bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20"
              onClick={() => setShowTemplates(true)}
            >
              Templates
            </button>
            <button
              class="flex-1 px-2 py-1.5 text-xs bg-purple-500/10 text-purple-400 rounded hover:bg-purple-500/20"
              onClick={() => setShowGenerateDialog(true)}
            >
              Generate
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          <Show when={workflows.loading}>
            <div class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
            </div>
          </Show>
          <Show when={workflows.error}>
            <div class="flex flex-col items-center py-4 gap-2">
              <p class="text-xs text-red-400">Failed to load</p>
              <button class="text-[10px] text-blue-400 hover:underline" onClick={() => refetch()}>Retry</button>
            </div>
          </Show>
          <For each={workflows()}>
            {(wf) => (
              <div
                class={`px-3 py-2 rounded-md cursor-pointer mb-1 group ${
                  activeWorkflow()?.id === wf.id
                    ? "bg-blue-500/10 text-blue-400"
                    : "hover:bg-background-surface text-color-secondary"
                }`}
                onClick={() => {
                  setActiveWorkflow(wf)
                  setEditSteps(wf.definition.steps)
                  setRunResult(null)
                }}
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-medium truncate">{wf.name}</span>
                  <button
                    class="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:bg-red-500/10 rounded"
                    onClick={(e) => { e.stopPropagation(); handleDelete(wf) }}
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <span class="text-[10px] text-color-dimmed">{wf.definition.steps.length} steps</span>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Workflow Canvas */}
      <div class="flex-1 flex flex-col min-w-0">
        <div class="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border-base">
          <span class="text-xs font-medium text-color-dimmed uppercase">
            {activeWorkflow() ? activeWorkflow()!.name : "Workflow Editor"}
          </span>
          <div class="flex gap-2">
            <button
              class="px-3 py-1 text-xs bg-background-surface text-color-secondary rounded hover:bg-background-surface/80"
              onClick={() => setShowAddStep(true)}
            >
              + Add Step
            </button>
            <Show when={activeWorkflow()}>
              <button
                class="px-3 py-1 text-xs bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20"
                onClick={handleSave}
              >
                Save
              </button>
              <button
                class="px-3 py-1 text-xs bg-green-500/10 text-green-400 rounded hover:bg-green-500/20"
                onClick={handleRun}
              >
                Run
              </button>
            </Show>
            <Show when={!activeWorkflow() && editSteps().length > 0}>
              <button
                class="px-3 py-1 text-xs bg-green-500/10 text-green-400 rounded hover:bg-green-500/20"
                onClick={() => setShowCreateDialog(true)}
              >
                Save As
              </button>
            </Show>
          </div>
        </div>

        {/* DAG View */}
        <div class="flex-1 overflow-auto p-6">
          <Show when={editSteps().length === 0}>
            <div class="flex flex-col items-center justify-center h-full text-center">
              <svg class="w-12 h-12 text-color-dimmed mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p class="text-sm text-color-dimmed">No steps yet</p>
              <p class="text-xs text-color-dimmed mt-1">Add steps, use a template, or generate with Gemini</p>
            </div>
          </Show>

          <div class="flex flex-col items-center gap-2">
            <For each={editSteps()}>
              {(step, index) => (
                <>
                  <Show when={index() > 0}>
                    <div class="w-px h-6 bg-border-base" />
                    <svg class="w-4 h-4 text-color-dimmed" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <div class="w-px h-2 bg-border-base" />
                  </Show>

                  <div
                    class={`w-72 border-2 rounded-lg p-3 cursor-pointer transition-all ${
                      STEP_COLORS[step.type] || "border-border-base bg-background-surface"
                    } ${selectedStep()?.id === step.id ? "ring-2 ring-blue-500" : ""}`}
                    onClick={() => setSelectedStep(step)}
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={STEP_ICONS[step.type] || STEP_ICONS.prompt} />
                      </svg>
                      <span class="text-sm font-medium text-color-primary flex-1">{step.name}</span>
                      <button
                        class="p-0.5 text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); removeStep(step.id) }}
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] px-2 py-0.5 rounded-full bg-background-base/50 text-color-dimmed capitalize">{step.type}</span>
                      <Show when={step.dependsOn.length > 0}>
                        <span class="text-[10px] text-color-dimmed">depends on: {step.dependsOn.join(", ")}</span>
                      </Show>
                    </div>
                  </div>
                </>
              )}
            </For>
          </div>
        </div>

        {/* Run Result */}
        <Show when={runResult()}>
          <div class="shrink-0 border-t border-border-base p-4 max-h-48 overflow-auto">
            <div class="flex items-center justify-between mb-2">
              <p class="text-xs font-medium text-color-dimmed uppercase">Run Result</p>
              <button
                class="flex items-center gap-1.5 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                onClick={sendResultsToAgent}
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Send to Agent
              </button>
            </div>
            <div class={`text-xs px-3 py-2 rounded ${runResult()?.status === "completed" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              Status: {runResult()?.status}
            </div>
            <Show when={runResult()?.result}>
              <pre class="text-[10px] text-color-secondary mt-2 whitespace-pre-wrap">
                {JSON.stringify(runResult()?.result, null, 2)}
              </pre>
            </Show>
            <Show when={runResult()?.error}>
              <p class="text-xs text-red-400 mt-2">{runResult()?.error}</p>
            </Show>
          </div>
        </Show>
      </div>

      {/* Step Config Sidebar */}
      <Show when={selectedStep()}>
        {(step) => (
          <div class="w-72 shrink-0 border-l border-border-base bg-background-surface/50 overflow-y-auto p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-color-primary">Step Config</h3>
              <button class="text-color-dimmed hover:text-color-primary" onClick={() => setSelectedStep(null)}>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="text-[10px] text-color-dimmed uppercase">Name</label>
                <p class="text-sm text-color-primary">{step().name}</p>
              </div>
              <div>
                <label class="text-[10px] text-color-dimmed uppercase">Type</label>
                <p class="text-sm text-color-primary capitalize">{step().type}</p>
              </div>
              <div>
                <label class="text-[10px] text-color-dimmed uppercase">Dependencies</label>
                <p class="text-sm text-color-primary">{step().dependsOn.length > 0 ? step().dependsOn.join(", ") : "None"}</p>
              </div>
              <div>
                <label class="text-[10px] text-color-dimmed uppercase">Config</label>
                <pre class="text-xs text-color-secondary bg-background-base rounded p-2 mt-1 whitespace-pre-wrap">
                  {JSON.stringify(step().config, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Add Step Dialog */}
      <Show when={showAddStep()}>
        <DialogOverlay onClose={() => setShowAddStep(false)}>
          <div class="bg-background-surface border border-border-base rounded-xl p-6 w-[400px]">
            <h2 class="text-lg font-semibold text-color-primary mb-4">Add Step</h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm text-color-secondary mb-1">Step Name</label>
                <input
                  type="text"
                  placeholder="Step name"
                  class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500"
                  value={newStepName()}
                  onInput={(e) => setNewStepName(e.currentTarget.value)}
                />
              </div>
              <div>
                <label class="block text-sm text-color-secondary mb-1">Type</label>
                <div class="grid grid-cols-2 gap-2">
                  <For each={(["skill", "prompt", "shell", "api", "condition"] as const)}>
                    {(type) => (
                      <button
                        class={`px-3 py-2 text-xs rounded-lg border transition-colors capitalize ${
                          newStepType() === type
                            ? STEP_COLORS[type]
                            : "border-border-base text-color-secondary hover:bg-background-surface"
                        }`}
                        onClick={() => setNewStepType(type)}
                      >
                        {type}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>
            <div class="flex justify-end gap-2 mt-4">
              <button class="px-4 py-2 text-sm text-color-secondary" onClick={() => setShowAddStep(false)}>Cancel</button>
              <button
                class="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                onClick={addStep}
                disabled={!newStepName()}
              >
                Add
              </button>
            </div>
          </div>
        </DialogOverlay>
      </Show>

      {/* Templates Dialog */}
      <Show when={showTemplates()}>
        <DialogOverlay onClose={() => setShowTemplates(false)}>
          <div class="bg-background-surface border border-border-base rounded-xl p-6 w-[500px]">
            <h2 class="text-lg font-semibold text-color-primary mb-4">Workflow Templates</h2>
            <div class="space-y-3">
              <For each={templates()}>
                {(template) => (
                  <button
                    class="w-full text-left p-3 border border-border-base rounded-lg hover:bg-background-surface/80 transition-colors"
                    onClick={() => useTemplate(template)}
                  >
                    <span class="text-sm font-medium text-color-primary block">{template.name}</span>
                    <span class="text-xs text-color-dimmed">{template.description}</span>
                    <span class="text-[10px] text-color-dimmed block mt-1">{template.definition.steps.length} steps</span>
                  </button>
                )}
              </For>
            </div>
            <div class="flex justify-end mt-4">
              <button class="px-4 py-2 text-sm text-color-secondary" onClick={() => setShowTemplates(false)}>Close</button>
            </div>
          </div>
        </DialogOverlay>
      </Show>

      {/* Generate Dialog */}
      <Show when={showGenerateDialog()}>
        <DialogOverlay onClose={() => setShowGenerateDialog(false)}>
          <div class="bg-background-surface border border-border-base rounded-xl p-6 w-[500px]">
            <h2 class="text-lg font-semibold text-color-primary mb-4">Generate Workflow with Gemini</h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm text-color-secondary mb-1">Workflow Name</label>
                <input type="text" placeholder="My Workflow" class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500" value={genName()} onInput={(e) => setGenName(e.currentTarget.value)} />
              </div>
              <div>
                <label class="block text-sm text-color-secondary mb-1">Description</label>
                <textarea placeholder="Describe what this workflow should do..." class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500 h-24 resize-none" value={genDesc()} onInput={(e) => setGenDesc(e.currentTarget.value)} />
              </div>
            </div>
            <div class="flex justify-end gap-2 mt-4">
              <button class="px-4 py-2 text-sm text-color-secondary" onClick={() => setShowGenerateDialog(false)}>Cancel</button>
              <button class="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50" onClick={handleGenerate} disabled={!genName() || !genDesc() || generateLoading()}>
                {generateLoading() ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </DialogOverlay>
      </Show>

      {/* Create Dialog */}
      <Show when={showCreateDialog()}>
        <DialogOverlay onClose={() => setShowCreateDialog(false)}>
          <div class="bg-background-surface border border-border-base rounded-xl p-6 w-[400px]">
            <h2 class="text-lg font-semibold text-color-primary mb-4">Save Workflow</h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm text-color-secondary mb-1">Name</label>
                <input type="text" class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500" value={createName()} onInput={(e) => setCreateName(e.currentTarget.value)} />
              </div>
              <div>
                <label class="block text-sm text-color-secondary mb-1">Description</label>
                <input type="text" class="w-full px-3 py-2 text-sm bg-background-base border border-border-base rounded-lg text-color-primary focus:outline-none focus:border-blue-500" value={createDesc()} onInput={(e) => setCreateDesc(e.currentTarget.value)} />
              </div>
            </div>
            <div class="flex justify-end gap-2 mt-4">
              <button class="px-4 py-2 text-sm text-color-secondary" onClick={() => setShowCreateDialog(false)}>Cancel</button>
              <button class="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50" onClick={handleCreate} disabled={!createName() || !createDesc()}>Save</button>
            </div>
          </div>
        </DialogOverlay>
      </Show>
    </div>
  )
}

function DialogOverlay(props: { children: any; onClose: () => void }) {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) props.onClose() }}>
      {props.children}
    </div>
  )
}
