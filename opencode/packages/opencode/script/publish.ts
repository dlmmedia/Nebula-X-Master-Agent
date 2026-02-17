#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@opencode-ai/script"
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const binaries: Record<string, string> = {}
for (const filepath of new Bun.Glob("*/package.json").scanSync({ cwd: "./dist" })) {
  const pkg = await Bun.file(`./dist/${filepath}`).json()
  binaries[pkg.name] = pkg.version
}
console.log("binaries", binaries)
const version = Object.values(binaries)[0]

await $`mkdir -p ./dist/nebula-x`
await $`cp -r ./bin ./dist/nebula-x/bin`
await $`cp ./script/postinstall.mjs ./dist/nebula-x/postinstall.mjs`

// Copy LICENSE if it exists
try {
  await Bun.file(`./dist/nebula-x/LICENSE`).write(await Bun.file("../../LICENSE").text())
} catch {
  console.log("LICENSE file not found, skipping")
}

await Bun.file(`./dist/nebula-x/package.json`).write(
  JSON.stringify(
    {
      name: "nebula-x",
      bin: {
        "nebula-x": `./bin/${pkg.name}`,
      },
      scripts: {
        postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs",
      },
      version: version,
      license: pkg.license,
      optionalDependencies: binaries,
    },
    null,
    2,
  ),
)

const tasks = Object.entries(binaries).map(async ([name]) => {
  if (process.platform !== "win32") {
    await $`chmod -R 755 .`.cwd(`./dist/${name}`)
  }
  await $`bun pm pack`.cwd(`./dist/${name}`)
  try {
    await $`npm publish *.tgz --access public --tag ${Script.channel}`.cwd(`./dist/${name}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("You cannot publish over the previously published versions")) {
      console.log(`${name} already published, skipping`)
    } else {
      throw e
    }
  }
})
await Promise.all(tasks)
try {
  await $`cd ./dist/nebula-x && bun pm pack && npm publish *.tgz --access public --tag ${Script.channel}`
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes("You cannot publish over the previously published versions")) {
    console.log("nebula-x already published, skipping")
  } else {
    throw e
  }
}

// Docker image
const image = "ghcr.io/dlmmedia/nebula-x"
const platforms = "linux/amd64"
const tags = [`${image}:${version}`, `${image}:${Script.channel}`]
const tagFlags = tags.flatMap((t) => ["-t", t])
try {
  await $`docker buildx build --platform ${platforms} ${tagFlags} --push .`
} catch (e) {
  console.log("Docker build/push failed (may not have Dockerfile or docker configured):", e instanceof Error ? e.message : e)
}

// Package registries (only for non-preview releases)
if (!Script.preview) {
  // Calculate SHA values for release assets
  const arm64Sha = await $`sha256sum ./dist/nebula-x-linux-arm64.tar.gz | cut -d' ' -f1`.text().then((x) => x.trim()).catch(() => "SKIP")
  const x64Sha = await $`sha256sum ./dist/nebula-x-linux-x64.tar.gz | cut -d' ' -f1`.text().then((x) => x.trim()).catch(() => "SKIP")
  const macX64Sha = await $`sha256sum ./dist/nebula-x-darwin-x64.zip | cut -d' ' -f1`.text().then((x) => x.trim()).catch(() => "SKIP")
  const macArm64Sha = await $`sha256sum ./dist/nebula-x-darwin-arm64.zip | cut -d' ' -f1`.text().then((x) => x.trim()).catch(() => "SKIP")

  // Homebrew formula
  if (macX64Sha !== "SKIP" && macArm64Sha !== "SKIP") {
    const homebrewFormula = [
      "# typed: false",
      "# frozen_string_literal: true",
      "",
      "class NebulX < Formula",
      `  desc "Nebula X - AI Coding Agent by DLM Media"`,
      `  homepage "https://github.com/dlmmedia/Nebula-X-Master-Agent"`,
      `  version "${Script.version.split("-")[0]}"`,
      "",
      "  on_macos do",
      "    if Hardware::CPU.intel?",
      `      url "https://github.com/dlmmedia/Nebula-X-Master-Agent/releases/download/v${Script.version}/nebula-x-darwin-x64.zip"`,
      `      sha256 "${macX64Sha}"`,
      "",
      "      def install",
      '        bin.install "nebula-x"',
      "      end",
      "    end",
      "    if Hardware::CPU.arm?",
      `      url "https://github.com/dlmmedia/Nebula-X-Master-Agent/releases/download/v${Script.version}/nebula-x-darwin-arm64.zip"`,
      `      sha256 "${macArm64Sha}"`,
      "",
      "      def install",
      '        bin.install "nebula-x"',
      "      end",
      "    end",
      "  end",
      "",
      "  on_linux do",
      "    if Hardware::CPU.intel? and Hardware::CPU.is_64_bit?",
      `      url "https://github.com/dlmmedia/Nebula-X-Master-Agent/releases/download/v${Script.version}/nebula-x-linux-x64.tar.gz"`,
      `      sha256 "${x64Sha}"`,
      "      def install",
      '        bin.install "nebula-x"',
      "      end",
      "    end",
      "    if Hardware::CPU.arm? and Hardware::CPU.is_64_bit?",
      `      url "https://github.com/dlmmedia/Nebula-X-Master-Agent/releases/download/v${Script.version}/nebula-x-linux-arm64.tar.gz"`,
      `      sha256 "${arm64Sha}"`,
      "      def install",
      '        bin.install "nebula-x"',
      "      end",
      "    end",
      "  end",
      "end",
      "",
      "",
    ].join("\n")

    const token = process.env.GITHUB_TOKEN
    if (token) {
      try {
        const tap = `https://x-access-token:${token}@github.com/dlmmedia/homebrew-tap.git`
        await $`rm -rf ./dist/homebrew-tap`
        await $`git clone ${tap} ./dist/homebrew-tap`
        await Bun.file("./dist/homebrew-tap/nebula-x.rb").write(homebrewFormula)
        await $`cd ./dist/homebrew-tap && git add nebula-x.rb`
        await $`cd ./dist/homebrew-tap && git commit -m "Update Nebula X to v${Script.version}"`
        await $`cd ./dist/homebrew-tap && git push`
        console.log("Homebrew tap updated successfully")
      } catch (e) {
        console.log("Homebrew tap update failed:", e instanceof Error ? e.message : e)
      }
    } else {
      console.log("GITHUB_TOKEN not set, skipping Homebrew tap update")
    }
  }
}
