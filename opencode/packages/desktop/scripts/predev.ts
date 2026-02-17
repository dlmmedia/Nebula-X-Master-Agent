import { $ } from "bun"

import { copyBinaryToSidecarFolder, getCurrentSidecar, detectRustTarget, windowsify } from "./utils"

const RUST_TARGET = Bun.env.TAURI_ENV_TARGET_TRIPLE || detectRustTarget()

console.log(`Building sidecar for target: ${RUST_TARGET}`)

const sidecarConfig = getCurrentSidecar(RUST_TARGET)

const binaryPath = windowsify(`../opencode/dist/${sidecarConfig.ocBinary}/bin/opencode`)

try {
  await (sidecarConfig.ocBinary.includes("-baseline")
    ? $`cd ../opencode && bun run build --single --baseline`
    : $`cd ../opencode && bun run build --single`)
} catch (e) {
  console.error(`Failed to build CLI sidecar: ${e instanceof Error ? e.message : e}`)
  console.error("The desktop app may not be able to start its local server.")
  process.exit(1)
}

await copyBinaryToSidecarFolder(binaryPath, RUST_TARGET)
