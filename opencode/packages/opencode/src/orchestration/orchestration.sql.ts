import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../storage/schema.sql"

export const SkillRegistryTable = sqliteTable(
  "skill_registry",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    description: text().notNull(),
    category: text().notNull(),
    tags: text({ mode: "json" }).$type<string[]>(),
    source: text().notNull().$type<"github" | "generated" | "imported" | "local">(),
    source_url: text(),
    content: text().notNull(),
    version: integer().notNull().default(1),
    enabled: integer({ mode: "boolean" }).notNull().default(true),
    ...Timestamps,
  },
  (table) => [
    index("skill_registry_name_idx").on(table.name),
    index("skill_registry_category_idx").on(table.category),
    index("skill_registry_source_idx").on(table.source),
  ],
)

export const WorkflowDefinitionTable = sqliteTable(
  "workflow_definition",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    description: text().notNull(),
    definition: text({ mode: "json" }).notNull().$type<{
      steps: Array<{
        id: string
        name: string
        type: "skill" | "prompt" | "shell" | "api" | "condition"
        config: Record<string, any>
        dependsOn: string[]
      }>
    }>(),
    category: text(),
    tags: text({ mode: "json" }).$type<string[]>(),
    enabled: integer({ mode: "boolean" }).notNull().default(true),
    ...Timestamps,
  },
  (table) => [index("workflow_name_idx").on(table.name)],
)

export const PromptTemplateTable = sqliteTable(
  "prompt_template",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    description: text().notNull(),
    content: text().notNull(),
    variables: text({ mode: "json" }).$type<string[]>(),
    category: text(),
    tags: text({ mode: "json" }).$type<string[]>(),
    skill_ids: text({ mode: "json" }).$type<string[]>(),
    ...Timestamps,
  },
  (table) => [
    index("prompt_template_name_idx").on(table.name),
    index("prompt_template_category_idx").on(table.category),
  ],
)

export const WorkflowRunTable = sqliteTable(
  "workflow_run",
  {
    id: text().primaryKey(),
    workflow_id: text()
      .notNull()
      .references(() => WorkflowDefinitionTable.id, { onDelete: "cascade" }),
    status: text().notNull().$type<"pending" | "running" | "completed" | "failed" | "cancelled">(),
    result: text({ mode: "json" }).$type<Record<string, any>>(),
    error: text(),
    ...Timestamps,
  },
  (table) => [
    index("workflow_run_workflow_idx").on(table.workflow_id),
    index("workflow_run_status_idx").on(table.status),
  ],
)
