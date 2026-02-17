import { Log } from "../util/log"
import { Config } from "../config/config"
import { Auth } from "../auth"

export namespace GeminiService {
  const log = Log.create({ service: "orchestration.gemini" })

  const DEFAULT_MODEL = "gemini-2.5-flash"

  async function getApiKey(): Promise<string | undefined> {
    const config = await Config.get()
    const providerConfig = config.provider?.["google"]
    if (providerConfig?.options?.apiKey) return providerConfig.options.apiKey as string

    const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (envKey) return envKey

    try {
      const auth = await Auth.get("google")
      if (auth?.apiKey) return auth.apiKey
    } catch {
      // Auth not configured
    }

    // Fallback to build-time embedded key (Nebula X default)
    declare const NEBULA_X_GEMINI_API_KEY: string
    try {
      if (typeof NEBULA_X_GEMINI_API_KEY === "string" && NEBULA_X_GEMINI_API_KEY.length > 0) {
        return NEBULA_X_GEMINI_API_KEY
      }
    } catch {
      // Not available (dev mode)
    }

    return undefined
  }

  async function callGemini(opts: {
    prompt: string
    systemInstruction?: string
    temperature?: number
  }): Promise<string> {
    const apiKey = await getApiKey()
    if (!apiKey) {
      throw new Error(
        "Gemini API key not configured. Set GEMINI_API_KEY env var or configure google provider in opencode.json",
      )
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`

    const body: any = {
      contents: [
        {
          parts: [{ text: opts.prompt }],
        },
      ],
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        maxOutputTokens: 8192,
      },
    }

    if (opts.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: opts.systemInstruction }],
      }
    }

    log.info("calling gemini", { model: DEFAULT_MODEL })

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      log.error("gemini api error", { status: response.status, error })
      throw new Error(`Gemini API error (${response.status}): ${error}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new Error("No response from Gemini API")
    }

    return text
  }

  export async function generateSkill(input: {
    name: string
    description: string
    category: string
    details?: string
  }): Promise<{ name: string; description: string; content: string }> {
    const systemInstruction = `You are an expert at creating Agent Skills in the SKILL.md format.
The SKILL.md format uses YAML frontmatter with required 'name' and 'description' fields, followed by markdown instructions.

Rules for the name field:
- 1-64 characters
- Lowercase alphanumeric with single hyphens only
- Pattern: ^[a-z0-9]+(-[a-z0-9]+)*$
- Must match the directory name

Rules for the description field:
- 1-1024 characters
- Describes what the skill does and WHEN to use it (this is critical for agent discovery)

The markdown body should contain:
- Clear, actionable instructions for the agent
- Step-by-step guidance when appropriate
- Examples if helpful
- Any constraints or best practices
- Keep it concise to preserve context window space`

    const prompt = `Create a SKILL.md file for the following skill:

Name: ${input.name}
Description: ${input.description}
Category: ${input.category}
${input.details ? `Additional Details: ${input.details}` : ""}

Return ONLY the complete SKILL.md file content, starting with the --- frontmatter delimiter. Do not wrap in code blocks.`

    const result = await callGemini({
      prompt,
      systemInstruction,
      temperature: 0.7,
    })

    const cleaned = result.replace(/^```[a-z]*\n?/gm, "").replace(/```$/gm, "").trim()

    const frontmatterMatch = cleaned.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!frontmatterMatch) {
      return {
        name: input.name,
        description: input.description,
        content: cleaned,
      }
    }

    return {
      name: input.name,
      description: input.description,
      content: cleaned,
    }
  }

  export async function generatePrompt(input: {
    goal: string
    skills?: string[]
    context?: string
    style?: "concise" | "detailed" | "step-by-step"
  }): Promise<{ prompt: string; variables: string[] }> {
    const systemInstruction = `You are an expert prompt engineer. Create system prompts for AI agents.
Your prompts should be clear, actionable, and well-structured.
Use {{variable_name}} syntax for any dynamic parts that should be filled in later.
Return the prompt text only, no additional commentary.`

    const skillsContext = input.skills?.length
      ? `\nThe agent has access to these skills: ${input.skills.join(", ")}`
      : ""

    const prompt = `Create a system prompt for an AI agent with the following goal:

Goal: ${input.goal}
Style: ${input.style || "detailed"}${skillsContext}
${input.context ? `Additional Context: ${input.context}` : ""}

Return ONLY the system prompt text. Use {{variable_name}} for any dynamic parts.`

    const result = await callGemini({
      prompt,
      systemInstruction,
      temperature: 0.7,
    })

    const variableMatches = result.match(/\{\{(\w+)\}\}/g) || []
    const variables = [...new Set(variableMatches.map((v) => v.replace(/[{}]/g, "")))]

    return {
      prompt: result.trim(),
      variables,
    }
  }

  export async function generateWorkflow(input: {
    name: string
    description: string
    steps?: string[]
  }): Promise<{
    name: string
    description: string
    steps: Array<{
      id: string
      name: string
      type: "skill" | "prompt" | "shell" | "api" | "condition"
      config: Record<string, any>
      dependsOn: string[]
    }>
  }> {
    const systemInstruction = `You are an expert at designing AI agent workflows as directed acyclic graphs (DAGs).
Return a JSON object with name, description, and steps array.
Each step has: id (string), name (string), type ("skill"|"prompt"|"shell"|"api"|"condition"), config (object with type-specific settings), dependsOn (array of step ids).
Return ONLY valid JSON, no markdown or commentary.`

    const prompt = `Design a workflow for:

Name: ${input.name}
Description: ${input.description}
${input.steps?.length ? `Suggested steps: ${input.steps.join(", ")}` : ""}

Return a JSON workflow definition.`

    const result = await callGemini({
      prompt,
      systemInstruction,
      temperature: 0.5,
    })

    try {
      const jsonStr = result.replace(/^```[a-z]*\n?/gm, "").replace(/```$/gm, "").trim()
      return JSON.parse(jsonStr)
    } catch (e) {
      log.error("failed to parse workflow json", { error: e })
      return {
        name: input.name,
        description: input.description,
        steps: [],
      }
    }
  }

  export async function research(input: {
    topic: string
    context?: string
  }): Promise<{
    summary: string
    findings: Array<{ title: string; description: string; source?: string }>
    suggestedSkills: Array<{ name: string; description: string }>
  }> {
    const systemInstruction = `You are a research assistant that helps discover AI agent skills and workflows.
Return a JSON object with:
- summary: A brief overview of findings
- findings: Array of {title, description, source?} with key discoveries
- suggestedSkills: Array of {name, description} for skills that could be created based on the research

Return ONLY valid JSON.`

    const prompt = `Research the following topic for AI agent skill development:

Topic: ${input.topic}
${input.context ? `Context: ${input.context}` : ""}

Find relevant approaches, tools, best practices, and suggest skills that could be created.`

    const result = await callGemini({
      prompt,
      systemInstruction,
      temperature: 0.7,
    })

    try {
      const jsonStr = result.replace(/^```[a-z]*\n?/gm, "").replace(/```$/gm, "").trim()
      return JSON.parse(jsonStr)
    } catch (e) {
      log.error("failed to parse research json", { error: e })
      return {
        summary: result,
        findings: [],
        suggestedSkills: [],
      }
    }
  }

  export async function checkAvailability(): Promise<boolean> {
    const apiKey = await getApiKey()
    return !!apiKey
  }
}
