import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { lazy } from "../../util/lazy"
import { errors } from "../error"
import { SkillRegistry } from "../../orchestration/skill-registry"
import { WorkflowEngine } from "../../orchestration/workflow"
import { PromptBuilder } from "../../orchestration/prompt-builder"
import { GeminiService } from "../../orchestration/gemini"
import { Agent } from "../../agent/agent"
import { OrchestrationBridge } from "../../orchestration/bridge"

export const OrchestrationRoutes = lazy(() =>
  new Hono()
    // ─── Skills ──────────────────────────────────────────────
    .get(
      "/skills",
      describeRoute({
        summary: "List orchestration skills",
        operationId: "orchestration.skills.list",
        responses: {
          200: {
            description: "List of skills",
            content: {
              "application/json": {
                schema: resolver(z.object({ items: SkillRegistry.SkillEntry.array(), total: z.number() })),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          category: z.string().optional(),
          source: z.enum(["github", "generated", "imported", "local"]).optional(),
          search: z.string().optional(),
          enabled: z
            .string()
            .optional()
            .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
          limit: z
            .string()
            .optional()
            .transform((v) => (v ? parseInt(v) : 50)),
          offset: z
            .string()
            .optional()
            .transform((v) => (v ? parseInt(v) : 0)),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const items = SkillRegistry.list(query as any)
        const total = SkillRegistry.count(query.category)
        return c.json({ items, total })
      },
    )
    .get(
      "/skills/categories",
      describeRoute({
        summary: "List skill categories with counts",
        operationId: "orchestration.skills.categories",
        responses: {
          200: {
            description: "Skill categories",
            content: {
              "application/json": {
                schema: resolver(z.array(z.object({ category: z.string(), count: z.number() }))),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(SkillRegistry.categories())
      },
    )
    .get(
      "/skills/:id",
      describeRoute({
        summary: "Get skill by ID",
        operationId: "orchestration.skills.get",
        responses: {
          200: {
            description: "Skill details",
            content: { "application/json": { schema: resolver(SkillRegistry.SkillEntry) } },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => {
        const skill = SkillRegistry.get(c.req.valid("param").id)
        if (!skill) return c.json({ error: "Not found" }, 404)
        return c.json(skill)
      },
    )
    .post(
      "/skills",
      describeRoute({
        summary: "Create a new skill",
        operationId: "orchestration.skills.create",
        responses: {
          200: {
            description: "Created skill",
            content: { "application/json": { schema: resolver(SkillRegistry.SkillEntry) } },
          },
          ...errors(400),
        },
      }),
      validator("json", SkillRegistry.CreateInput),
      async (c) => {
        const input = c.req.valid("json")
        const skill = SkillRegistry.create(input)
        return c.json(skill)
      },
    )
    .put(
      "/skills/:id",
      describeRoute({
        summary: "Update skill",
        operationId: "orchestration.skills.update",
        responses: {
          200: {
            description: "Updated skill",
            content: { "application/json": { schema: resolver(SkillRegistry.SkillEntry) } },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      validator("json", SkillRegistry.UpdateInput),
      async (c) => {
        const result = SkillRegistry.update(c.req.valid("param").id, c.req.valid("json"))
        if (!result) return c.json({ error: "Not found" }, 404)
        return c.json(result)
      },
    )
    .delete(
      "/skills/:id",
      describeRoute({
        summary: "Delete skill",
        operationId: "orchestration.skills.delete",
        responses: {
          200: {
            description: "Deleted",
            content: { "application/json": { schema: resolver(z.boolean()) } },
          },
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => {
        const result = SkillRegistry.remove(c.req.valid("param").id)
        return c.json(result)
      },
    )
    .post(
      "/skills/import",
      describeRoute({
        summary: "Import skills from GitHub",
        operationId: "orchestration.skills.import",
        responses: {
          200: {
            description: "Imported skills",
            content: { "application/json": { schema: resolver(SkillRegistry.SkillEntry.array()) } },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        z.object({
          repoUrl: z.string().url(),
          category: z.string().optional(),
        }),
      ),
      async (c) => {
        const input = c.req.valid("json")
        const skills = await SkillRegistry.importFromGitHub(input)
        return c.json(skills)
      },
    )
    .post(
      "/skills/generate",
      describeRoute({
        summary: "Generate skill via Gemini",
        operationId: "orchestration.skills.generate",
        responses: {
          200: {
            description: "Generated skill",
            content: { "application/json": { schema: resolver(SkillRegistry.SkillEntry) } },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        z.object({
          name: z.string(),
          description: z.string(),
          category: z.string(),
          details: z.string().optional(),
        }),
      ),
      async (c) => {
        const skill = await SkillRegistry.generate(c.req.valid("json"))
        return c.json(skill)
      },
    )
    // ─── Workflows ───────────────────────────────────────────
    .get(
      "/workflows",
      describeRoute({
        summary: "List workflows",
        operationId: "orchestration.workflows.list",
        responses: {
          200: {
            description: "Workflows",
            content: { "application/json": { schema: resolver(WorkflowEngine.WorkflowEntry.array()) } },
          },
        },
      }),
      async (c) => {
        return c.json(WorkflowEngine.list())
      },
    )
    .get(
      "/workflows/templates",
      describeRoute({
        summary: "List workflow templates",
        operationId: "orchestration.workflows.templates",
        responses: {
          200: {
            description: "Workflow templates",
            content: {
              "application/json": {
                schema: resolver(
                  z.array(
                    z.object({
                      name: z.string(),
                      description: z.string(),
                      category: z.string(),
                      definition: WorkflowEngine.Definition,
                    }),
                  ),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(WorkflowEngine.TEMPLATES)
      },
    )
    .get(
      "/workflows/:id",
      describeRoute({
        summary: "Get workflow",
        operationId: "orchestration.workflows.get",
        responses: {
          200: {
            description: "Workflow",
            content: { "application/json": { schema: resolver(WorkflowEngine.WorkflowEntry) } },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => {
        const wf = WorkflowEngine.get(c.req.valid("param").id)
        if (!wf) return c.json({ error: "Not found" }, 404)
        return c.json(wf)
      },
    )
    .post(
      "/workflows",
      describeRoute({
        summary: "Create workflow",
        operationId: "orchestration.workflows.create",
        responses: {
          200: {
            description: "Created workflow",
            content: { "application/json": { schema: resolver(WorkflowEngine.WorkflowEntry) } },
          },
          ...errors(400),
        },
      }),
      validator("json", WorkflowEngine.CreateInput),
      async (c) => {
        return c.json(WorkflowEngine.create(c.req.valid("json")))
      },
    )
    .put(
      "/workflows/:id",
      describeRoute({
        summary: "Update workflow",
        operationId: "orchestration.workflows.update",
        responses: {
          200: {
            description: "Updated workflow",
            content: { "application/json": { schema: resolver(WorkflowEngine.WorkflowEntry) } },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      validator("json", WorkflowEngine.UpdateInput),
      async (c) => {
        const result = WorkflowEngine.update(c.req.valid("param").id, c.req.valid("json"))
        if (!result) return c.json({ error: "Not found" }, 404)
        return c.json(result)
      },
    )
    .delete(
      "/workflows/:id",
      describeRoute({
        summary: "Delete workflow",
        operationId: "orchestration.workflows.delete",
        responses: {
          200: {
            description: "Deleted",
            content: { "application/json": { schema: resolver(z.boolean()) } },
          },
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => {
        return c.json(WorkflowEngine.remove(c.req.valid("param").id))
      },
    )
    .post(
      "/workflows/:id/run",
      describeRoute({
        summary: "Run workflow",
        operationId: "orchestration.workflows.run",
        responses: {
          200: {
            description: "Workflow run",
            content: { "application/json": { schema: resolver(WorkflowEngine.RunEntry) } },
          },
          ...errors(400),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => {
        const run = await WorkflowEngine.run(c.req.valid("param").id)
        return c.json(run)
      },
    )
    .post(
      "/workflows/generate",
      describeRoute({
        summary: "Generate workflow via Gemini",
        operationId: "orchestration.workflows.generate",
        responses: {
          200: {
            description: "Generated workflow",
            content: { "application/json": { schema: resolver(WorkflowEngine.WorkflowEntry) } },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        z.object({
          name: z.string(),
          description: z.string(),
          steps: z.array(z.string()).optional(),
        }),
      ),
      async (c) => {
        const wf = await WorkflowEngine.generate(c.req.valid("json"))
        return c.json(wf)
      },
    )
    // ─── Prompts ─────────────────────────────────────────────
    .get(
      "/prompts",
      describeRoute({
        summary: "List prompt templates",
        operationId: "orchestration.prompts.list",
        responses: {
          200: {
            description: "Prompt templates",
            content: { "application/json": { schema: resolver(PromptBuilder.PromptEntry.array()) } },
          },
        },
      }),
      validator(
        "query",
        z.object({
          category: z.string().optional(),
          search: z.string().optional(),
        }),
      ),
      async (c) => {
        return c.json(PromptBuilder.list(c.req.valid("query")))
      },
    )
    .get(
      "/prompts/builtin",
      describeRoute({
        summary: "List built-in prompt templates",
        operationId: "orchestration.prompts.builtin",
        responses: {
          200: {
            description: "Built-in templates",
            content: {
              "application/json": {
                schema: resolver(
                  z.array(
                    z.object({
                      name: z.string(),
                      description: z.string(),
                      content: z.string(),
                      category: z.string(),
                      variables: z.array(z.string()),
                    }),
                  ),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(PromptBuilder.BUILTIN_TEMPLATES)
      },
    )
    .get(
      "/prompts/:id",
      describeRoute({
        summary: "Get prompt template",
        operationId: "orchestration.prompts.get",
        responses: {
          200: {
            description: "Prompt template",
            content: { "application/json": { schema: resolver(PromptBuilder.PromptEntry) } },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => {
        const prompt = PromptBuilder.get(c.req.valid("param").id)
        if (!prompt) return c.json({ error: "Not found" }, 404)
        return c.json(prompt)
      },
    )
    .post(
      "/prompts",
      describeRoute({
        summary: "Create prompt template",
        operationId: "orchestration.prompts.create",
        responses: {
          200: {
            description: "Created prompt",
            content: { "application/json": { schema: resolver(PromptBuilder.PromptEntry) } },
          },
          ...errors(400),
        },
      }),
      validator("json", PromptBuilder.CreateInput),
      async (c) => {
        return c.json(PromptBuilder.create(c.req.valid("json")))
      },
    )
    .put(
      "/prompts/:id",
      describeRoute({
        summary: "Update prompt template",
        operationId: "orchestration.prompts.update",
        responses: {
          200: {
            description: "Updated prompt",
            content: { "application/json": { schema: resolver(PromptBuilder.PromptEntry) } },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      validator("json", PromptBuilder.UpdateInput),
      async (c) => {
        const result = PromptBuilder.update(c.req.valid("param").id, c.req.valid("json"))
        if (!result) return c.json({ error: "Not found" }, 404)
        return c.json(result)
      },
    )
    .delete(
      "/prompts/:id",
      describeRoute({
        summary: "Delete prompt template",
        operationId: "orchestration.prompts.delete",
        responses: {
          200: {
            description: "Deleted",
            content: { "application/json": { schema: resolver(z.boolean()) } },
          },
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => {
        return c.json(PromptBuilder.remove(c.req.valid("param").id))
      },
    )
    .post(
      "/prompts/generate",
      describeRoute({
        summary: "Generate prompt via Gemini",
        operationId: "orchestration.prompts.generate",
        responses: {
          200: {
            description: "Generated prompt",
            content: { "application/json": { schema: resolver(PromptBuilder.PromptEntry) } },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        z.object({
          goal: z.string(),
          skills: z.array(z.string()).optional(),
          context: z.string().optional(),
          style: z.enum(["concise", "detailed", "step-by-step"]).optional(),
        }),
      ),
      async (c) => {
        const prompt = await PromptBuilder.generate(c.req.valid("json"))
        return c.json(prompt)
      },
    )
    .post(
      "/prompts/render",
      describeRoute({
        summary: "Render prompt with variables",
        operationId: "orchestration.prompts.render",
        responses: {
          200: {
            description: "Rendered prompt",
            content: { "application/json": { schema: resolver(z.object({ rendered: z.string() })) } },
          },
        },
      }),
      validator(
        "json",
        z.object({
          template: z.string(),
          variables: z.record(z.string(), z.string()),
        }),
      ),
      async (c) => {
        const { template, variables } = c.req.valid("json")
        return c.json({ rendered: PromptBuilder.render(template, variables) })
      },
    )
    // ─── Research ─────────────────────────────────────────────
    .post(
      "/research",
      describeRoute({
        summary: "Research a topic",
        operationId: "orchestration.research",
        responses: {
          200: {
            description: "Research results",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    summary: z.string(),
                    findings: z.array(
                      z.object({
                        title: z.string(),
                        description: z.string(),
                        source: z.string().optional(),
                      }),
                    ),
                    suggestedSkills: z.array(
                      z.object({
                        name: z.string(),
                        description: z.string(),
                      }),
                    ),
                  }),
                ),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        z.object({
          topic: z.string(),
          context: z.string().optional(),
        }),
      ),
      async (c) => {
        const result = await GeminiService.research(c.req.valid("json"))
        return c.json(result)
      },
    )
    // ─── Agents ──────────────────────────────────────────────
    .get(
      "/agents",
      describeRoute({
        summary: "List agent configurations",
        operationId: "orchestration.agents.list",
        responses: {
          200: {
            description: "Agent configurations",
            content: { "application/json": { schema: resolver(Agent.Info.array()) } },
          },
        },
      }),
      async (c) => {
        return c.json(await Agent.list())
      },
    )
    // ─── Status ──────────────────────────────────────────────
    // ─── Bridge ───────────────────────────────────────────
    .post(
      "/bridge/sync/:id",
      describeRoute({
        summary: "Sync skill to filesystem",
        operationId: "orchestration.bridge.sync",
        responses: {
          200: {
            description: "Synced skill path",
            content: { "application/json": { schema: resolver(z.object({ path: z.string().nullable() })) } },
          },
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => {
        const result = await OrchestrationBridge.syncSkillToFilesystem(c.req.valid("param").id)
        return c.json({ path: result ?? null })
      },
    )
    .post(
      "/bridge/import-existing",
      describeRoute({
        summary: "Import existing filesystem skills to registry",
        operationId: "orchestration.bridge.importExisting",
        responses: {
          200: {
            description: "Import result",
            content: { "application/json": { schema: resolver(z.object({ imported: z.number() })) } },
          },
        },
      }),
      async (c) => {
        const count = await OrchestrationBridge.importExistingSkills()
        return c.json({ imported: count })
      },
    )
    // ─── Status ──────────────────────────────────────────────
    .get(
      "/status",
      describeRoute({
        summary: "Orchestration system status",
        operationId: "orchestration.status",
        responses: {
          200: {
            description: "Status",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    geminiAvailable: z.boolean(),
                    skillCount: z.number(),
                    workflowCount: z.number(),
                    promptCount: z.number(),
                    categories: z.array(z.object({ category: z.string(), count: z.number() })),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const geminiAvailable = await GeminiService.checkAvailability()
        const skillCount = SkillRegistry.count()
        const workflowCount = WorkflowEngine.list().length
        const promptCount = PromptBuilder.list().length
        const categories = SkillRegistry.categories()
        return c.json({ geminiAvailable, skillCount, workflowCount, promptCount, categories })
      },
    ),
)
