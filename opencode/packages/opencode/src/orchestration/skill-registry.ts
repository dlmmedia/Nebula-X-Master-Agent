import z from "zod"
import { ulid } from "ulid"
import { eq, like, and, or, sql } from "drizzle-orm"
import { Database } from "../storage/db"
import { SkillRegistryTable } from "./orchestration.sql"
import { GeminiService } from "./gemini"
import { Log } from "../util/log"

export namespace SkillRegistry {
  const log = Log.create({ service: "orchestration.skill-registry" })

  export const CATEGORIES = [
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
  ] as const

  export type Category = (typeof CATEGORIES)[number]

  export const SkillEntry = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    category: z.string(),
    tags: z.array(z.string()).nullable(),
    source: z.enum(["github", "generated", "imported", "local"]),
    sourceUrl: z.string().nullable(),
    content: z.string(),
    version: z.number(),
    enabled: z.boolean(),
    timeCreated: z.number(),
    timeUpdated: z.number(),
  })
  export type SkillEntry = z.infer<typeof SkillEntry>

  export const CreateInput = z.object({
    name: z.string().min(1).max(64).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    description: z.string().min(1).max(1024),
    category: z.string(),
    tags: z.array(z.string()).optional(),
    source: z.enum(["github", "generated", "imported", "local"]).default("local"),
    sourceUrl: z.string().optional(),
    content: z.string(),
  })
  export type CreateInput = z.infer<typeof CreateInput>

  export const UpdateInput = z.object({
    name: z.string().min(1).max(64).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).optional(),
    description: z.string().min(1).max(1024).optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    content: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  export type UpdateInput = z.infer<typeof UpdateInput>

  export const ListInput = z.object({
    category: z.string().optional(),
    source: z.enum(["github", "generated", "imported", "local"]).optional(),
    search: z.string().optional(),
    enabled: z.boolean().optional(),
    limit: z.number().min(1).max(200).default(50),
    offset: z.number().min(0).default(0),
  })
  export type ListInput = z.infer<typeof ListInput>

  function rowToEntry(row: typeof SkillRegistryTable.$inferSelect): SkillEntry {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      tags: row.tags,
      source: row.source,
      sourceUrl: row.source_url,
      content: row.content,
      version: row.version,
      enabled: row.enabled,
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }
  }

  export function list(input?: ListInput): SkillEntry[] {
    const filters = input || { limit: 50, offset: 0 }
    return Database.use((db) => {
      const conditions = []
      if (filters.category) {
        conditions.push(eq(SkillRegistryTable.category, filters.category))
      }
      if (filters.source) {
        conditions.push(eq(SkillRegistryTable.source, filters.source))
      }
      if (filters.enabled !== undefined) {
        conditions.push(eq(SkillRegistryTable.enabled, filters.enabled))
      }
      if (filters.search) {
        const term = `%${filters.search}%`
        conditions.push(
          or(
            like(SkillRegistryTable.name, term),
            like(SkillRegistryTable.description, term),
            like(SkillRegistryTable.content, term),
          )!,
        )
      }

      const query = db
        .select()
        .from(SkillRegistryTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(filters.limit)
        .offset(filters.offset)
        .orderBy(SkillRegistryTable.time_updated)

      return query.all().map(rowToEntry)
    })
  }

  export function get(id: string): SkillEntry | undefined {
    return Database.use((db) => {
      const row = db.select().from(SkillRegistryTable).where(eq(SkillRegistryTable.id, id)).get()
      return row ? rowToEntry(row) : undefined
    })
  }

  export function getByName(name: string): SkillEntry | undefined {
    return Database.use((db) => {
      const row = db.select().from(SkillRegistryTable).where(eq(SkillRegistryTable.name, name)).get()
      return row ? rowToEntry(row) : undefined
    })
  }

  export function create(input: CreateInput): SkillEntry {
    const id = ulid()
    const now = Date.now()
    return Database.use((db) => {
      db.insert(SkillRegistryTable)
        .values({
          id,
          name: input.name,
          description: input.description,
          category: input.category,
          tags: input.tags ?? null,
          source: input.source,
          source_url: input.sourceUrl ?? null,
          content: input.content,
          version: 1,
          enabled: true,
          time_created: now,
          time_updated: now,
        })
        .run()
      return get(id)!
    })
  }

  export function update(id: string, input: UpdateInput): SkillEntry | undefined {
    return Database.use((db) => {
      const existing = get(id)
      if (!existing) return undefined

      const updates: Record<string, any> = { time_updated: Date.now() }
      if (input.name !== undefined) updates.name = input.name
      if (input.description !== undefined) updates.description = input.description
      if (input.category !== undefined) updates.category = input.category
      if (input.tags !== undefined) updates.tags = input.tags
      if (input.content !== undefined) {
        updates.content = input.content
        updates.version = existing.version + 1
      }
      if (input.enabled !== undefined) updates.enabled = input.enabled

      db.update(SkillRegistryTable).set(updates).where(eq(SkillRegistryTable.id, id)).run()
      return get(id)!
    })
  }

  export function remove(id: string): boolean {
    return Database.use((db) => {
      const result = db.delete(SkillRegistryTable).where(eq(SkillRegistryTable.id, id)).run()
      return result.changes > 0
    })
  }

  export function count(category?: string): number {
    return Database.use((db) => {
      const condition = category ? eq(SkillRegistryTable.category, category) : undefined
      const result = db
        .select({ count: sql<number>`count(*)` })
        .from(SkillRegistryTable)
        .where(condition)
        .get()
      return result?.count ?? 0
    })
  }

  export function categories(): Array<{ category: string; count: number }> {
    return Database.use((db) => {
      return db
        .select({
          category: SkillRegistryTable.category,
          count: sql<number>`count(*)`,
        })
        .from(SkillRegistryTable)
        .groupBy(SkillRegistryTable.category)
        .all()
    })
  }

  export async function importFromGitHub(input: {
    repoUrl: string
    category?: string
  }): Promise<SkillEntry[]> {
    log.info("importing skills from github", { url: input.repoUrl })

    const match = input.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) throw new Error("Invalid GitHub URL")

    const [, owner, repo] = match
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`

    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "opencode-orchestration",
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const tree = await response.json()
    const skillFiles = (tree.tree as Array<{ path: string; type: string }>).filter(
      (item) => item.type === "blob" && item.path.endsWith("SKILL.md"),
    )

    const imported: SkillEntry[] = []

    for (const file of skillFiles.slice(0, 100)) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${file.path}`
        const contentResponse = await fetch(rawUrl)
        if (!contentResponse.ok) continue

        const content = await contentResponse.text()
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
        if (!frontmatterMatch) continue

        const lines = frontmatterMatch[1].split("\n")
        let name = ""
        let description = ""

        for (const line of lines) {
          const nameMatch = line.match(/^name:\s*(.+)/)
          const descMatch = line.match(/^description:\s*(.+)/)
          if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, "")
          if (descMatch) description = descMatch[1].trim().replace(/^["']|["']$/g, "")
        }

        if (!name || !description) continue

        const nameValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) && name.length <= 64
        if (!nameValid) {
          name = name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 64)
        }

        if (!name) continue

        const existing = getByName(name)
        if (existing) {
          log.info("skipping duplicate skill", { name })
          continue
        }

        const dirName = file.path.split("/").slice(-2, -1)[0] || "other"
        const category = input.category || inferCategory(name, description)

        const entry = create({
          name,
          description: description.slice(0, 1024),
          category,
          tags: [dirName],
          source: "github",
          sourceUrl: `https://github.com/${owner}/${repo}/blob/main/${file.path}`,
          content,
        })

        imported.push(entry)
      } catch (e) {
        log.error("failed to import skill", { path: file.path, error: e })
      }
    }

    log.info("imported skills from github", { count: imported.length })
    return imported
  }

  export async function generate(input: {
    name: string
    description: string
    category: string
    details?: string
  }): Promise<SkillEntry> {
    const result = await GeminiService.generateSkill(input)

    const entry = create({
      name: input.name,
      description: input.description,
      category: input.category,
      tags: ["generated"],
      source: "generated",
      content: result.content,
    })

    return entry
  }

  function inferCategory(name: string, description: string): string {
    const text = `${name} ${description}`.toLowerCase()
    const categoryKeywords: Record<string, string[]> = {
      coding: ["code", "programming", "developer", "typescript", "javascript", "python", "rust", "api", "sdk", "debug"],
      writing: ["write", "writing", "content", "blog", "article", "copy", "text", "book", "story"],
      video: ["video", "animation", "motion", "film", "editing", "remotion", "render"],
      research: ["research", "analysis", "investigate", "study", "find", "discover", "explore"],
      humanizer: ["humanize", "humanizer", "natural", "tone", "voice", "rewrite"],
      devops: ["deploy", "docker", "kubernetes", "ci/cd", "infrastructure", "cloud", "aws", "terraform"],
      data: ["data", "database", "sql", "analytics", "etl", "pipeline", "csv", "json"],
      design: ["design", "ui", "ux", "figma", "css", "layout", "component", "theme"],
      marketing: ["marketing", "seo", "social", "campaign", "brand", "ads"],
      automation: ["automate", "automation", "workflow", "bot", "schedule", "trigger"],
      security: ["security", "auth", "encrypt", "vulnerability", "audit", "permission"],
      testing: ["test", "testing", "qa", "e2e", "unit test", "integration"],
      documentation: ["docs", "documentation", "readme", "guide", "tutorial", "manual"],
    }

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((kw) => text.includes(kw))) {
        return category
      }
    }

    return "other"
  }
}
