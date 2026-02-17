import { createMemo, For, Match, Switch } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Splash } from "@opencode-ai/ui/logo"
import { useLayout } from "@/context/layout"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { Icon } from "@opencode-ai/ui/icon"
import { usePlatform } from "@/context/platform"
import { DateTime } from "luxon"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { DialogSelectServer } from "@/components/dialog-select-server"
import { useServer } from "@/context/server"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"

const STARS = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  left: `${Math.round(Math.random() * 100)}%`,
  top: `${Math.round(Math.random() * 100)}%`,
  size: 1 + Math.random() * 2,
  delay: Math.random() * 6,
  duration: 3 + Math.random() * 4,
  color: ["#67E8F9", "#F472B6", "#A78BFA", "#3B82F6"][Math.floor(Math.random() * 4)],
  opacity: 0.15 + Math.random() * 0.35,
}))

export default function Home() {
  const sync = useGlobalSync()
  const layout = useLayout()
  const platform = usePlatform()
  const dialog = useDialog()
  const navigate = useNavigate()
  const server = useServer()
  const language = useLanguage()
  const homedir = createMemo(() => sync.data.path.home)
  const recent = createMemo(() => {
    return sync.data.project
      .slice()
      .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
      .slice(0, 5)
  })

  const serverDotClass = createMemo(() => {
    const healthy = server.healthy()
    if (healthy === true) return "bg-icon-success-base"
    if (healthy === false) return "bg-icon-critical-base"
    return "bg-border-weak-base"
  })

  function openProject(directory: string) {
    layout.projects.open(directory)
    server.projects.touch(directory)
    navigate(`/${base64Encode(directory)}`)
  }

  async function chooseProject() {
    function resolve(result: string | string[] | null) {
      if (Array.isArray(result)) {
        for (const directory of result) {
          openProject(directory)
        }
      } else if (result) {
        openProject(result)
      }
    }

    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const result = await platform.openDirectoryPickerDialog?.({
        title: language.t("command.project.open"),
        multiple: true,
      })
      resolve(result)
    } else {
      dialog.show(
        () => <DialogSelectDirectory multiple={true} onSelect={resolve} />,
        () => resolve(null),
      )
    }
  }

  return (
    <div class="size-full flex flex-col items-center justify-center relative overflow-hidden">
      {/* Star field background */}
      <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
        <For each={STARS}>
          {(star) => (
            <div
              class="absolute rounded-full"
              style={{
                left: star.left,
                top: star.top,
                width: `${star.size}px`,
                height: `${star.size}px`,
                background: star.color,
                opacity: star.opacity,
                animation: `star-drift ${star.duration}s ease-in-out infinite`,
                "animation-delay": `${star.delay}s`,
              }}
            />
          )}
        </For>
      </div>

      {/* Hero section */}
      <div
        class="flex flex-col items-center gap-1 relative z-10"
        style={{
          animation: "float-up-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        <Splash animated class="w-28 h-28" />

        <div
          class="flex flex-col items-center gap-1 mt-3"
          style={{
            animation: "float-up-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards",
            opacity: 0,
          }}
        >
          <div
            class="text-text-strong font-medium tracking-widest"
            style={{ "font-size": "18px", "letter-spacing": "0.25em" }}
          >
            NEBULA X
          </div>
          <div class="text-text-weaker text-12-regular">by DLM Media</div>
        </div>
      </div>

      {/* Server status */}
      <div
        style={{
          animation: "float-up-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards",
          opacity: 0,
        }}
      >
        <Button
          size="large"
          variant="ghost"
          class="mt-4 text-14-regular text-text-weak"
          onClick={() => dialog.show(() => <DialogSelectServer />)}
        >
          <div
            classList={{
              "size-2 rounded-full": true,
              [serverDotClass()]: true,
            }}
          />
          {server.name}
        </Button>
      </div>

      {/* Projects section */}
      <div
        class="w-full md:w-md mt-10 px-4 relative z-10"
        style={{
          animation: "float-up-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.7s forwards",
          opacity: 0,
        }}
      >
        <Switch>
          <Match when={sync.data.project.length > 0}>
            <div class="w-full flex flex-col gap-3">
              <div class="flex gap-2 items-center justify-between pl-3">
                <div class="text-14-medium text-text-strong">{language.t("home.recentProjects")}</div>
                <Button icon="folder-add-left" size="normal" class="pl-2 pr-3" onClick={chooseProject}>
                  {language.t("command.project.open")}
                </Button>
              </div>
              <ul class="flex flex-col gap-1.5">
                <For each={recent()}>
                  {(project, i) => (
                    <li
                      class="fade-up-text"
                      style={{ "animation-delay": `${0.8 + i() * 0.08}s` }}
                    >
                      <Button
                        size="large"
                        variant="ghost"
                        class="w-full text-14-mono text-left justify-between px-3 transition-colors"
                        onClick={() => openProject(project.worktree)}
                      >
                        {project.worktree.replace(homedir(), "~")}
                        <div class="text-14-regular text-text-weak">
                          {DateTime.fromMillis(project.time.updated ?? project.time.created).toRelative()}
                        </div>
                      </Button>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Match>
          <Match when={true}>
            <div class="flex flex-col items-center gap-3">
              <Icon name="folder-add-left" size="large" class="text-text-weaker" />
              <div class="flex flex-col gap-1 items-center justify-center">
                <div class="text-14-medium text-text-strong">{language.t("home.empty.title")}</div>
                <div class="text-12-regular text-text-weak">{language.t("home.empty.description")}</div>
              </div>
              <Button
                class="px-5 mt-2 nebula-glow-active"
                onClick={chooseProject}
              >
                {language.t("command.project.open")}
              </Button>
            </div>
          </Match>
        </Switch>
      </div>
    </div>
  )
}
