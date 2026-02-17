import z from "zod"
import { ulid } from "ulid"
import { eq, sql } from "drizzle-orm"
import { Database } from "../storage/db"
import { WorkflowDefinitionTable, WorkflowRunTable } from "./orchestration.sql"
import { GeminiService } from "./gemini"
import { Session } from "../session"
import { SessionPrompt } from "../session/prompt"
import { Agent } from "../agent/agent"
import { Identifier } from "../id/id"
import { Log } from "../util/log"

export namespace WorkflowEngine {
  const log = Log.create({ service: "orchestration.workflow" })

  export const StepType = z.enum(["skill", "prompt", "shell", "api", "condition"])
  export type StepType = z.infer<typeof StepType>

  export const Step = z.object({
    id: z.string(),
    name: z.string(),
    type: StepType,
    config: z.record(z.string(), z.any()),
    dependsOn: z.array(z.string()),
  })
  export type Step = z.infer<typeof Step>

  export const Definition = z.object({
    steps: z.array(Step),
  })
  export type Definition = z.infer<typeof Definition>

  export const WorkflowEntry = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    definition: Definition,
    category: z.string().nullable(),
    tags: z.array(z.string()).nullable(),
    enabled: z.boolean(),
    timeCreated: z.number(),
    timeUpdated: z.number(),
  })
  export type WorkflowEntry = z.infer<typeof WorkflowEntry>

  export const RunEntry = z.object({
    id: z.string(),
    workflowId: z.string(),
    status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
    result: z.record(z.string(), z.any()).nullable(),
    error: z.string().nullable(),
    timeCreated: z.number(),
    timeUpdated: z.number(),
  })
  export type RunEntry = z.infer<typeof RunEntry>

  export const CreateInput = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    definition: Definition,
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  export type CreateInput = z.infer<typeof CreateInput>

  export const UpdateInput = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    definition: Definition.optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
  })
  export type UpdateInput = z.infer<typeof UpdateInput>

  function rowToEntry(row: typeof WorkflowDefinitionTable.$inferSelect): WorkflowEntry {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      definition: row.definition as Definition,
      category: row.category,
      tags: row.tags,
      enabled: row.enabled,
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }
  }

  function runRowToEntry(row: typeof WorkflowRunTable.$inferSelect): RunEntry {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      result: row.result,
      error: row.error,
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }
  }

  export function list(): WorkflowEntry[] {
    return Database.use((db) => {
      return db
        .select()
        .from(WorkflowDefinitionTable)
        .orderBy(WorkflowDefinitionTable.time_updated)
        .all()
        .map(rowToEntry)
    })
  }

  export function get(id: string): WorkflowEntry | undefined {
    return Database.use((db) => {
      const row = db.select().from(WorkflowDefinitionTable).where(eq(WorkflowDefinitionTable.id, id)).get()
      return row ? rowToEntry(row) : undefined
    })
  }

  export function create(input: CreateInput): WorkflowEntry {
    const id = ulid()
    const now = Date.now()
    return Database.use((db) => {
      db.insert(WorkflowDefinitionTable)
        .values({
          id,
          name: input.name,
          description: input.description,
          definition: input.definition,
          category: input.category ?? null,
          tags: input.tags ?? null,
          enabled: true,
          time_created: now,
          time_updated: now,
        })
        .run()
      return get(id)!
    })
  }

  export function update(id: string, input: UpdateInput): WorkflowEntry | undefined {
    return Database.use((db) => {
      const existing = get(id)
      if (!existing) return undefined

      const updates: Record<string, any> = { time_updated: Date.now() }
      if (input.name !== undefined) updates.name = input.name
      if (input.description !== undefined) updates.description = input.description
      if (input.definition !== undefined) updates.definition = input.definition
      if (input.category !== undefined) updates.category = input.category
      if (input.tags !== undefined) updates.tags = input.tags
      if (input.enabled !== undefined) updates.enabled = input.enabled

      db.update(WorkflowDefinitionTable).set(updates).where(eq(WorkflowDefinitionTable.id, id)).run()
      return get(id)!
    })
  }

  export function remove(id: string): boolean {
    return Database.use((db) => {
      const result = db.delete(WorkflowDefinitionTable).where(eq(WorkflowDefinitionTable.id, id)).run()
      return result.changes > 0
    })
  }

  export async function generate(input: {
    name: string
    description: string
    steps?: string[]
  }): Promise<WorkflowEntry> {
    const result = await GeminiService.generateWorkflow(input)

    return create({
      name: result.name,
      description: result.description,
      definition: { steps: result.steps },
      tags: ["generated"],
    })
  }

  export interface RunOptions {
    sendToAgent?: boolean
  }

  export async function run(id: string, options?: RunOptions): Promise<RunEntry> {
    const workflow = get(id)
    if (!workflow) throw new Error(`Workflow not found: ${id}`)

    const runId = ulid()
    const now = Date.now()

    Database.use((db) => {
      db.insert(WorkflowRunTable)
        .values({
          id: runId,
          workflow_id: id,
          status: "running",
          result: null,
          error: null,
          time_created: now,
          time_updated: now,
        })
        .run()
    })

    try {
      const result = await executeWorkflow(workflow)

      Database.use((db) => {
        db.update(WorkflowRunTable)
          .set({
            status: "completed",
            result,
            time_updated: Date.now(),
          })
          .where(eq(WorkflowRunTable.id, runId))
          .run()
      })

      const runEntry = getRun(runId)!

      if (options?.sendToAgent) {
        void sendWorkflowResultsToAgent(workflow, result).catch((err) => {
          log.error("failed to send workflow results to agent", { error: err })
        })
      }

      return runEntry
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)

      Database.use((db) => {
        db.update(WorkflowRunTable)
          .set({
            status: "failed",
            error,
            time_updated: Date.now(),
          })
          .where(eq(WorkflowRunTable.id, runId))
          .run()
      })

      return getRun(runId)!
    }
  }

  async function sendWorkflowResultsToAgent(
    workflow: WorkflowEntry,
    results: Record<string, any>,
  ): Promise<void> {
    let promptText = `## Workflow Results: ${workflow.name}\n\n`
    promptText += `${workflow.description}\n\n`

    for (const [stepId, stepOutput] of Object.entries(results)) {
      const step = workflow.definition.steps.find((s) => s.id === stepId)
      const stepName = step?.name || stepId
      promptText += `### Step: ${stepName} (${step?.type || "unknown"})\n`
      promptText += `${typeof stepOutput === "string" ? stepOutput : JSON.stringify(stepOutput, null, 2)}\n\n`
    }

    promptText += `Please review these workflow results and take appropriate action.`

    const session = await Session.create({})
    const messageID = Identifier.ascending("message")
    const agentName = await Agent.defaultAgent()

    void SessionPrompt.prompt({
      sessionID: session.id,
      messageID,
      agent: agentName,
      parts: [{ type: "text", text: promptText }],
    })

    log.info("sent workflow results to agent", {
      workflowId: workflow.id,
      sessionId: session.id,
    })
  }

  export function getRun(id: string): RunEntry | undefined {
    return Database.use((db) => {
      const row = db.select().from(WorkflowRunTable).where(eq(WorkflowRunTable.id, id)).get()
      return row ? runRowToEntry(row) : undefined
    })
  }

  export function listRuns(workflowId: string): RunEntry[] {
    return Database.use((db) => {
      return db
        .select()
        .from(WorkflowRunTable)
        .where(eq(WorkflowRunTable.workflow_id, workflowId))
        .orderBy(WorkflowRunTable.time_created)
        .all()
        .map(runRowToEntry)
    })
  }

  async function executeWorkflow(workflow: WorkflowEntry): Promise<Record<string, any>> {
    const { steps } = workflow.definition
    const results: Record<string, any> = {}
    const completed = new Set<string>()

    const topological = topologicalSort(steps)

    for (const step of topological) {
      log.info("executing step", { step: step.id, type: step.type })

      const allDepsCompleted = step.dependsOn.every((dep) => completed.has(dep))
      if (!allDepsCompleted) {
        throw new Error(`Dependencies not met for step ${step.id}`)
      }

      const depResults: Record<string, any> = {}
      for (const dep of step.dependsOn) {
        depResults[dep] = results[dep]
      }

      results[step.id] = await executeStep(step, depResults)
      completed.add(step.id)
    }

    return results
  }

  async function executeStep(step: Step, depResults: Record<string, any>): Promise<any> {
    switch (step.type) {
      case "prompt": {
        const prompt = step.config.prompt as string
        const result = await GeminiService.generatePrompt({
          goal: prompt,
          context: JSON.stringify(depResults),
        })
        return result
      }
      case "skill": {
        return {
          type: "skill",
          skillName: step.config.skillName,
          applied: true,
          config: step.config,
        }
      }
      case "shell": {
        return {
          type: "shell",
          command: step.config.command,
          status: "queued",
        }
      }
      case "api": {
        return {
          type: "api",
          url: step.config.url,
          method: step.config.method || "GET",
          status: "queued",
        }
      }
      case "condition": {
        const conditionField = step.config.field as string
        const conditionValue = step.config.value
        const input = depResults[step.dependsOn[0]]
        return {
          type: "condition",
          matched: input?.[conditionField] === conditionValue,
          field: conditionField,
          value: conditionValue,
        }
      }
      default:
        throw new Error(`Unknown step type: ${step.type}`)
    }
  }

  function topologicalSort(steps: Step[]): Step[] {
    const visited = new Set<string>()
    const sorted: Step[] = []
    const stepMap = new Map(steps.map((s) => [s.id, s]))

    function visit(step: Step) {
      if (visited.has(step.id)) return
      visited.add(step.id)

      for (const dep of step.dependsOn) {
        const depStep = stepMap.get(dep)
        if (depStep) visit(depStep)
      }

      sorted.push(step)
    }

    for (const step of steps) {
      visit(step)
    }

    return sorted
  }

  export const TEMPLATES: Array<{
    name: string
    description: string
    category: string
    definition: Definition
  }> = [
    {
      name: "Content Pipeline",
      description: "Research, write, and polish content on any topic",
      category: "writing",
      definition: {
        steps: [
          {
            id: "research",
            name: "Research Topic",
            type: "prompt",
            config: { prompt: "Research the topic thoroughly and provide key findings" },
            dependsOn: [],
          },
          {
            id: "outline",
            name: "Create Outline",
            type: "prompt",
            config: { prompt: "Create a detailed outline based on the research" },
            dependsOn: ["research"],
          },
          {
            id: "write",
            name: "Write Draft",
            type: "prompt",
            config: { prompt: "Write a full draft based on the outline" },
            dependsOn: ["outline"],
          },
          {
            id: "polish",
            name: "Polish & Edit",
            type: "skill",
            config: { skillName: "humanizer" },
            dependsOn: ["write"],
          },
        ],
      },
    },
    {
      name: "Code Review Pipeline",
      description: "Analyze, review, and improve code quality",
      category: "coding",
      definition: {
        steps: [
          {
            id: "analyze",
            name: "Analyze Code",
            type: "prompt",
            config: { prompt: "Analyze the code for patterns, issues, and improvement areas" },
            dependsOn: [],
          },
          {
            id: "security",
            name: "Security Check",
            type: "skill",
            config: { skillName: "security-audit" },
            dependsOn: [],
          },
          {
            id: "review",
            name: "Generate Review",
            type: "prompt",
            config: { prompt: "Generate a comprehensive code review based on analysis and security findings" },
            dependsOn: ["analyze", "security"],
          },
        ],
      },
    },
    {
      name: "Video Script Pipeline",
      description: "Create video scripts with research and storyboarding",
      category: "video",
      definition: {
        steps: [
          {
            id: "research",
            name: "Research Topic",
            type: "prompt",
            config: { prompt: "Research the video topic and find key talking points" },
            dependsOn: [],
          },
          {
            id: "script",
            name: "Write Script",
            type: "prompt",
            config: { prompt: "Write an engaging video script with hooks and transitions" },
            dependsOn: ["research"],
          },
          {
            id: "storyboard",
            name: "Create Storyboard",
            type: "prompt",
            config: { prompt: "Create a visual storyboard outline for the video" },
            dependsOn: ["script"],
          },
        ],
      },
    },
  ]
}
