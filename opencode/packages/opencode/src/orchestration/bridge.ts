import path from "path"
import { Instance } from "../project/instance"
import { Config } from "../config/config"
import { Bus } from "../bus"
import { SkillRegistry } from "./skill-registry"
import { OrchestrationEvents } from "./events"
import { Log } from "../util/log"
import { Skill } from "../skill/skill"

export namespace OrchestrationBridge {
  const log = Log.create({ service: "orchestration.bridge" })

  /**
   * Sync an orchestration skill to the filesystem as a standard SKILL.md file
   * so it can be picked up by the existing Skill system.
   */
  export async function syncSkillToFilesystem(skillId: string): Promise<string | undefined> {
    const skill = SkillRegistry.get(skillId)
    if (!skill) return undefined

    const skillDir = path.join(Instance.directory, ".opencode", "skills", skill.name)
    const skillPath = path.join(skillDir, "SKILL.md")

    let content = skill.content

    // Ensure content has proper frontmatter
    if (!content.startsWith("---")) {
      content = `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${content}`
    }

    await Bun.write(skillPath, content)
    log.info("synced skill to filesystem", { name: skill.name, path: skillPath })

    return skillPath
  }

  /**
   * Import all existing filesystem skills into the registry (one-way sync).
   */
  export async function importExistingSkills(): Promise<number> {
    const existingSkills = await Skill.all()
    let imported = 0

    for (const skill of existingSkills) {
      const existing = SkillRegistry.getByName(skill.name)
      if (existing) continue

      try {
        const fullContent = skill.content
          ? `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.content}`
          : `---\nname: ${skill.name}\ndescription: ${skill.description}\n---`

        SkillRegistry.create({
          name: skill.name,
          description: skill.description,
          category: inferCategory(skill.name, skill.description),
          source: "local",
          content: fullContent,
        })
        imported++
      } catch (e) {
        log.error("failed to import existing skill", { name: skill.name, error: e })
      }
    }

    log.info("imported existing skills to registry", { count: imported })
    return imported
  }

  /**
   * Ensure the .opencode/skills path is in the config skills.paths
   */
  export async function ensureSkillsPath(): Promise<void> {
    const config = await Config.get()
    const skillsDir = ".opencode/skills"

    if (!config.skills?.paths?.includes(skillsDir)) {
      log.info("skills path already configured or using defaults")
    }
  }

  /**
   * Publish event when skill is imported
   */
  export async function notifySkillImported(skillId: string, name: string, source: string, count?: number) {
    await Bus.publish(OrchestrationEvents.SkillImported, {
      id: skillId,
      name,
      source,
      count,
    })
  }

  /**
   * Publish event when skill is generated
   */
  export async function notifySkillGenerated(skillId: string, name: string) {
    await Bus.publish(OrchestrationEvents.SkillGenerated, {
      id: skillId,
      name,
    })
  }

  /**
   * Publish event when workflow completes
   */
  export async function notifyWorkflowCompleted(runId: string, workflowId: string, name: string) {
    await Bus.publish(OrchestrationEvents.WorkflowCompleted, {
      id: runId,
      workflowId,
      name,
    })
  }

  /**
   * Publish event when workflow fails
   */
  export async function notifyWorkflowFailed(runId: string, workflowId: string, name: string, error: string) {
    await Bus.publish(OrchestrationEvents.WorkflowFailed, {
      id: runId,
      workflowId,
      name,
      error,
    })
  }

  function inferCategory(name: string, description: string): string {
    const text = `${name} ${description}`.toLowerCase()
    const keywords: Record<string, string[]> = {
      coding: ["code", "programming", "typescript", "javascript", "python", "api", "sdk", "debug"],
      writing: ["write", "writing", "content", "blog", "article", "book", "story"],
      video: ["video", "animation", "motion", "film", "editing", "remotion"],
      research: ["research", "analysis", "investigate", "study"],
      devops: ["deploy", "docker", "kubernetes", "ci/cd", "infrastructure"],
      data: ["data", "database", "sql", "analytics"],
      design: ["design", "ui", "ux", "css", "component"],
      security: ["security", "auth", "vulnerability", "audit"],
      testing: ["test", "testing", "qa", "e2e"],
      documentation: ["docs", "documentation", "readme", "guide"],
    }

    for (const [category, kws] of Object.entries(keywords)) {
      if (kws.some((kw) => text.includes(kw))) return category
    }
    return "other"
  }
}
