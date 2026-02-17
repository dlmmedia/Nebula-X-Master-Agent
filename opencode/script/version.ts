#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"

const output = [`version=${Script.version}`]

if (!Script.preview) {
  // Simple changelog: list commits since last tag
  let body = "No notable changes"
  try {
    const lastTag = await $`git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo ""`.text().then((x) => x.trim())
    if (lastTag) {
      const log = await $`git log ${lastTag}..HEAD --oneline --no-merges`.text()
      if (log.trim()) body = log.trim()
    } else {
      const log = await $`git log --oneline --no-merges -20`.text()
      if (log.trim()) body = log.trim()
    }
  } catch {
    console.log("Could not generate changelog, using default")
  }

  const dir = process.env.RUNNER_TEMP ?? "/tmp"
  const file = `${dir}/nebula-x-release-notes.txt`
  await Bun.write(file, body)
  await $`gh release create v${Script.version} -d --title "Nebula X v${Script.version}" --notes-file ${file}`
  const release = await $`gh release view v${Script.version} --json tagName,databaseId`.json()
  output.push(`release=${release.databaseId}`)
  output.push(`tag=${release.tagName}`)
}

if (process.env.GITHUB_OUTPUT) {
  await Bun.write(process.env.GITHUB_OUTPUT, output.join("\n"))
}

process.exit(0)
