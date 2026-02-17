import z from "zod"
import { EOL } from "os"
import { NamedError } from "@opencode-ai/util/error"
import { logo } from "./logo"

export namespace UI {
  export const CancelledError = NamedError.create("UICancelledError", z.void())

  export const Style = {
    TEXT_HIGHLIGHT: "\x1b[38;5;141m",
    TEXT_HIGHLIGHT_BOLD: "\x1b[38;5;141m\x1b[1m",
    TEXT_DIM: "\x1b[38;5;60m",
    TEXT_DIM_BOLD: "\x1b[38;5;60m\x1b[1m",
    TEXT_NORMAL: "\x1b[0m",
    TEXT_NORMAL_BOLD: "\x1b[1m",
    TEXT_WARNING: "\x1b[38;5;220m",
    TEXT_WARNING_BOLD: "\x1b[38;5;220m\x1b[1m",
    TEXT_DANGER: "\x1b[38;5;210m",
    TEXT_DANGER_BOLD: "\x1b[38;5;210m\x1b[1m",
    TEXT_SUCCESS: "\x1b[38;5;79m",
    TEXT_SUCCESS_BOLD: "\x1b[38;5;79m\x1b[1m",
    TEXT_INFO: "\x1b[38;5;87m",
    TEXT_INFO_BOLD: "\x1b[38;5;87m\x1b[1m",
  }

  export function println(...message: string[]) {
    print(...message)
    Bun.stderr.write(EOL)
  }

  export function print(...message: string[]) {
    blank = false
    Bun.stderr.write(message.join(" "))
  }

  let blank = false
  export function empty() {
    if (blank) return
    println("" + Style.TEXT_NORMAL)
    blank = true
  }

  export function renderLogo(pad?: string) {
    const result: string[] = []
    const reset = "\x1b[0m"
    const artColor = "\x1b[38;5;141m"
    const starColor = "\x1b[38;5;60m"
    const dividerColor = "\x1b[38;5;60m"
    const taglineColor = "\x1b[38;5;87m"
    const p = pad ?? ""

    for (const line of logo.stars.top) {
      result.push(p + starColor + line + reset + EOL)
    }
    result.push(EOL)
    for (const line of logo.art) {
      result.push(p + artColor + line + reset + EOL)
    }
    result.push(EOL)
    result.push(p + dividerColor + logo.divider + reset + EOL)
    result.push(EOL)
    result.push(p + taglineColor + logo.tagline + reset + EOL)
    result.push(EOL)
    result.push(p + dividerColor + logo.divider + reset + EOL)
    result.push(EOL)
    for (const line of logo.stars.bottom) {
      result.push(p + starColor + line + reset + EOL)
    }

    return result.join("").trimEnd()
  }

  export async function input(prompt: string): Promise<string> {
    const readline = require("readline")
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question(prompt, (answer: string) => {
        rl.close()
        resolve(answer.trim())
      })
    })
  }

  export function error(message: string) {
    println(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message)
  }

  export function markdown(text: string): string {
    return text
  }
}
