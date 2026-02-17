import z from "zod"
import { BusEvent } from "../bus/bus-event"

export namespace OrchestrationEvents {
  export const SkillImported = BusEvent.define(
    "orchestration.skill.imported",
    z.object({
      id: z.string(),
      name: z.string(),
      source: z.string(),
      count: z.number().optional(),
    }),
  )

  export const SkillGenerated = BusEvent.define(
    "orchestration.skill.generated",
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  )

  export const SkillUpdated = BusEvent.define(
    "orchestration.skill.updated",
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  )

  export const SkillDeleted = BusEvent.define(
    "orchestration.skill.deleted",
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  )

  export const WorkflowStarted = BusEvent.define(
    "orchestration.workflow.started",
    z.object({
      id: z.string(),
      workflowId: z.string(),
      name: z.string(),
    }),
  )

  export const WorkflowCompleted = BusEvent.define(
    "orchestration.workflow.completed",
    z.object({
      id: z.string(),
      workflowId: z.string(),
      name: z.string(),
    }),
  )

  export const WorkflowFailed = BusEvent.define(
    "orchestration.workflow.failed",
    z.object({
      id: z.string(),
      workflowId: z.string(),
      name: z.string(),
      error: z.string(),
    }),
  )

  export const PromptGenerated = BusEvent.define(
    "orchestration.prompt.generated",
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  )
}
