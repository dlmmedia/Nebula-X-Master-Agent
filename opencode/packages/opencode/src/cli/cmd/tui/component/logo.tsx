import { TextAttributes } from "@opentui/core"
import { For } from "solid-js"
import { useTheme, tint } from "@tui/context/theme"
import { logo } from "@/cli/logo"

export function Logo() {
  const { theme } = useTheme()

  return (
    <box>
      <For each={logo.art}>
        {(line) => (
          <box flexDirection="row">
            <text
              fg={theme.text}
              attributes={TextAttributes.BOLD}
              selectable={false}
            >
              {line}
            </text>
          </box>
        )}
      </For>
      <box height={1} />
      <box flexDirection="row" justifyContent="center">
        <text
          fg={tint(theme.background, theme.text, 0.5)}
          selectable={false}
        >
          {logo.tagline}
        </text>
      </box>
    </box>
  )
}
