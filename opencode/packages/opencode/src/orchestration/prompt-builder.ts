import z from "zod"
import { ulid } from "ulid"
import { eq, like, and, or } from "drizzle-orm"
import { Database } from "../storage/db"
import { PromptTemplateTable } from "./orchestration.sql"
import { GeminiService } from "./gemini"
import { Log } from "../util/log"

export namespace PromptBuilder {
  const log = Log.create({ service: "orchestration.prompt-builder" })

  export const PromptEntry = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    content: z.string(),
    variables: z.array(z.string()).nullable(),
    category: z.string().nullable(),
    tags: z.array(z.string()).nullable(),
    skillIds: z.array(z.string()).nullable(),
    timeCreated: z.number(),
    timeUpdated: z.number(),
  })
  export type PromptEntry = z.infer<typeof PromptEntry>

  export const CreateInput = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    content: z.string().min(1),
    variables: z.array(z.string()).optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    skillIds: z.array(z.string()).optional(),
  })
  export type CreateInput = z.infer<typeof CreateInput>

  export const UpdateInput = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    content: z.string().optional(),
    variables: z.array(z.string()).optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    skillIds: z.array(z.string()).optional(),
  })
  export type UpdateInput = z.infer<typeof UpdateInput>

  function rowToEntry(row: typeof PromptTemplateTable.$inferSelect): PromptEntry {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      content: row.content,
      variables: row.variables,
      category: row.category,
      tags: row.tags,
      skillIds: row.skill_ids,
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }
  }

  export function list(input?: {
    category?: string
    search?: string
    limit?: number
    offset?: number
  }): PromptEntry[] {
    const filters = input || {}
    return Database.use((db) => {
      const conditions = []
      if (filters.category) {
        conditions.push(eq(PromptTemplateTable.category, filters.category))
      }
      if (filters.search) {
        const term = `%${filters.search}%`
        conditions.push(
          or(
            like(PromptTemplateTable.name, term),
            like(PromptTemplateTable.description, term),
            like(PromptTemplateTable.content, term),
          )!,
        )
      }

      return db
        .select()
        .from(PromptTemplateTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(filters.limit ?? 50)
        .offset(filters.offset ?? 0)
        .orderBy(PromptTemplateTable.time_updated)
        .all()
        .map(rowToEntry)
    })
  }

  export function get(id: string): PromptEntry | undefined {
    return Database.use((db) => {
      const row = db.select().from(PromptTemplateTable).where(eq(PromptTemplateTable.id, id)).get()
      return row ? rowToEntry(row) : undefined
    })
  }

  export function create(input: CreateInput): PromptEntry {
    const id = ulid()
    const now = Date.now()

    const variables = input.variables ?? extractVariables(input.content)

    return Database.use((db) => {
      db.insert(PromptTemplateTable)
        .values({
          id,
          name: input.name,
          description: input.description,
          content: input.content,
          variables,
          category: input.category ?? null,
          tags: input.tags ?? null,
          skill_ids: input.skillIds ?? null,
          time_created: now,
          time_updated: now,
        })
        .run()
      return get(id)!
    })
  }

  export function update(id: string, input: UpdateInput): PromptEntry | undefined {
    return Database.use((db) => {
      const existing = get(id)
      if (!existing) return undefined

      const updates: Record<string, any> = { time_updated: Date.now() }
      if (input.name !== undefined) updates.name = input.name
      if (input.description !== undefined) updates.description = input.description
      if (input.content !== undefined) {
        updates.content = input.content
        updates.variables = input.variables ?? extractVariables(input.content)
      }
      if (input.category !== undefined) updates.category = input.category
      if (input.tags !== undefined) updates.tags = input.tags
      if (input.skillIds !== undefined) updates.skill_ids = input.skillIds

      db.update(PromptTemplateTable).set(updates).where(eq(PromptTemplateTable.id, id)).run()
      return get(id)!
    })
  }

  export function remove(id: string): boolean {
    return Database.use((db) => {
      const result = db.delete(PromptTemplateTable).where(eq(PromptTemplateTable.id, id)).run()
      return result.changes > 0
    })
  }

  export async function generate(input: {
    goal: string
    skills?: string[]
    context?: string
    style?: "concise" | "detailed" | "step-by-step"
  }): Promise<PromptEntry> {
    const result = await GeminiService.generatePrompt(input)

    return create({
      name: `Generated: ${input.goal.slice(0, 50)}`,
      description: input.goal,
      content: result.prompt,
      variables: result.variables,
      tags: ["generated"],
    })
  }

  export function render(
    template: string,
    variables: Record<string, string>,
  ): string {
    let result = template
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value)
    }
    return result
  }

  export function extractVariables(content: string): string[] {
    const matches = content.match(/\{\{(\w+)\}\}/g) || []
    return [...new Set(matches.map((v) => v.replace(/[{}]/g, "")))]
  }

  export const BUILTIN_TEMPLATES: Array<{
    name: string
    description: string
    content: string
    category: string
    variables: string[]
  }> = [
    {
      name: "General Agent",
      description: "A versatile system prompt for a general-purpose AI agent",
      category: "general",
      variables: ["agent_name", "domain", "constraints"],
      content: `You are {{agent_name}}, an AI agent specialized in {{domain}}.

Your core responsibilities:
1. Understand user requests thoroughly before acting
2. Break down complex tasks into manageable steps
3. Use available tools and skills effectively
4. Provide clear, actionable responses

Constraints: {{constraints}}

Always explain your reasoning and ask for clarification when the task is ambiguous.`,
    },
    {
      name: "Content Writer",
      description: "System prompt for content creation tasks",
      category: "writing",
      variables: ["tone", "audience", "format"],
      content: `You are an expert content writer. Your writing style should be {{tone}}.

Target audience: {{audience}}
Output format: {{format}}

Guidelines:
- Research the topic thoroughly before writing
- Use clear, engaging language
- Structure content with headings and sections
- Include relevant examples and data
- Proofread for grammar and clarity
- Maintain consistent tone throughout`,
    },
    {
      name: "Code Reviewer",
      description: "System prompt for thorough code review",
      category: "coding",
      variables: ["language", "standards", "focus_areas"],
      content: `You are an expert code reviewer for {{language}} projects.

Coding standards: {{standards}}
Focus areas: {{focus_areas}}

Review checklist:
1. Code correctness and logic errors
2. Performance and efficiency
3. Security vulnerabilities
4. Code style and readability
5. Test coverage
6. Documentation quality
7. Error handling
8. Edge cases

Provide specific, actionable feedback with code examples for improvements.`,
    },
    {
      name: "Research Assistant",
      description: "System prompt for research and analysis tasks",
      category: "research",
      variables: ["topic", "depth", "output_format"],
      content: `You are a thorough research assistant investigating {{topic}}.

Research depth: {{depth}}
Output format: {{output_format}}

Research methodology:
1. Identify key questions and sub-topics
2. Gather information from multiple sources
3. Cross-reference and verify facts
4. Synthesize findings into coherent analysis
5. Highlight uncertainties and knowledge gaps
6. Provide citations and sources

Be objective, thorough, and clearly distinguish facts from analysis.`,
    },
  ]
}
