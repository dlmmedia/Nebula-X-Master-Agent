#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@opencode-ai/script"

console.log("=== publishing Nebula X ===\n")

const pkgjsons = await Array.fromAsync(
  new Bun.Glob("**/package.json").scan({
    absolute: true,
  }),
).then((arr) => arr.filter((x) => !x.includes("node_modules") && !x.includes("dist")))

for (const file of pkgjsons) {
  let pkg = await Bun.file(file).text()
  pkg = pkg.replaceAll(/"version": "[^"]+"/g, `"version": "${Script.version}"`)
  console.log("updated:", file)
  await Bun.file(file).write(pkg)
}

await $`bun install`

// Build SDK if it exists
try {
  await import(`../packages/sdk/js/script/build.ts`)
} catch (e) {
  console.log("SDK build skipped (not found or failed):", e instanceof Error ? e.message : e)
}

if (Script.release) {
  await $`git commit -am "release: Nebula X v${Script.version}"`.nothrow()
  await $`git tag v${Script.version}`.nothrow()
  await $`git push origin HEAD --tags --no-verify --force-with-lease`.nothrow()
  await new Promise((resolve) => setTimeout(resolve, 5_000))
  await $`gh release edit v${Script.version} --draft=false`
}

console.log("\n=== cli ===\n")
await import(`../packages/opencode/script/publish.ts`)

// SDK and plugin publishing (optional - skip if not configured)
try {
  console.log("\n=== sdk ===\n")
  await import(`../packages/sdk/js/script/publish.ts`)
} catch (e) {
  console.log("SDK publish skipped:", e instanceof Error ? e.message : e)
}

try {
  console.log("\n=== plugin ===\n")
  await import(`../packages/plugin/script/publish.ts`)
} catch (e) {
  console.log("Plugin publish skipped:", e instanceof Error ? e.message : e)
}

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)
