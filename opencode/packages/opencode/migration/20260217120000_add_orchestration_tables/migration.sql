CREATE TABLE IF NOT EXISTS `skill_registry` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text NOT NULL,
  `category` text NOT NULL,
  `tags` text,
  `source` text NOT NULL,
  `source_url` text,
  `content` text NOT NULL,
  `version` integer NOT NULL DEFAULT 1,
  `enabled` integer NOT NULL DEFAULT 1,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `skill_registry_name_idx` ON `skill_registry` (`name`);
CREATE INDEX IF NOT EXISTS `skill_registry_category_idx` ON `skill_registry` (`category`);
CREATE INDEX IF NOT EXISTS `skill_registry_source_idx` ON `skill_registry` (`source`);

CREATE TABLE IF NOT EXISTS `workflow_definition` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text NOT NULL,
  `definition` text NOT NULL,
  `category` text,
  `tags` text,
  `enabled` integer NOT NULL DEFAULT 1,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `workflow_name_idx` ON `workflow_definition` (`name`);

CREATE TABLE IF NOT EXISTS `prompt_template` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text NOT NULL,
  `content` text NOT NULL,
  `variables` text,
  `category` text,
  `tags` text,
  `skill_ids` text,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `prompt_template_name_idx` ON `prompt_template` (`name`);
CREATE INDEX IF NOT EXISTS `prompt_template_category_idx` ON `prompt_template` (`category`);

CREATE TABLE IF NOT EXISTS `workflow_run` (
  `id` text PRIMARY KEY NOT NULL,
  `workflow_id` text NOT NULL REFERENCES `workflow_definition`(`id`) ON DELETE CASCADE,
  `status` text NOT NULL,
  `result` text,
  `error` text,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `workflow_run_workflow_idx` ON `workflow_run` (`workflow_id`);
CREATE INDEX IF NOT EXISTS `workflow_run_status_idx` ON `workflow_run` (`status`);
