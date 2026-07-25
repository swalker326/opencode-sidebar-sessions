/** @jsxImportSource @opentui/solid */
import { expect, mock, test } from "bun:test"
import { InputRenderable, RGBA } from "@opentui/core"
import { testRender, type JSX } from "@opentui/solid"
import type { TuiPluginApi, TuiPluginMeta, TuiSlotPlugin } from "@opencode-ai/plugin/tui"
import { Show } from "solid-js"
import plugin from "../src/tui"

type KeymapLayer = Parameters<TuiPluginApi["keymap"]["registerLayer"]>[0]
type ConfirmProps = {
  title: string
  message: string
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
}
const color = RGBA.fromHex("#ffffff")
const theme = {
  primary: color,
  text: color,
  textMuted: color,
  error: color,
  backgroundPanel: RGBA.fromHex("#111111"),
  backgroundElement: RGBA.fromHex("#222222"),
  borderActive: color,
  selectedListItemText: RGBA.fromHex("#000000"),
}

test("focuses and scrolls the session list with OpenCode's selector bindings", async () => {
  const now = new Date(2026, 6, 24, 16).getTime()
  const sessions = Array.from({ length: 20 }, (_, index) => ({
    id: `session-${index + 1}`,
    title: `Session ${index + 1}`,
    time: { updated: now - index * 60_000 },
  }))
  const route = { name: "session", params: { sessionID: "session-1" } }
  const navigate = mock((_name: string, params: { sessionID: string }) => {
    route.params.sessionID = params.sessionID
  })
  const dispatchCommand = mock(async () => ({ ok: true as const }))
  const handlers = new Map<string, (event: unknown) => void>()
  const layers: KeymapLayer[] = []
  const gathered: string[][] = []
  const update = mock(async (input: { sessionID: string; title?: string; time?: { archived: number } }) => {
    const index = sessions.findIndex((item) => item.id === input.sessionID)
    const session = sessions[index]
    if (!session) return { data: undefined }
    const updated =
      input.title !== undefined
        ? { ...session, title: input.title }
        : { ...session, time: { ...session.time, archived: input.time?.archived } }
    sessions[index] = updated
    return { data: updated }
  })
  let dialogFactory: (() => JSX.Element) | undefined
  const replaceDialog = mock((render: () => JSX.Element) => {
    dialogFactory = render
  })
  const toast = mock(() => {})
  const clearDialog = mock(() => {})
  let confirmation: ConfirmProps | undefined
  let slotOrder: number | undefined
  let renderTitle: (() => JSX.Element) | undefined
  let renderSidebar: (() => JSX.Element) | undefined
  let renderPrompt: (() => JSX.Element) | undefined

  const Prompt = (props: { visible?: boolean; right?: JSX.Element }) => (
    <Show when={props.visible}>
      <box>
        <text>Prompt</text>
        {props.right}
      </box>
    </Show>
  )
  const Slot = () => null
  const DialogConfirm = (props: ConfirmProps) => {
    confirmation = props
    return null
  }
  const api = {
    theme: { current: theme },
    client: { session: { list: async () => ({ data: sessions }), update } },
    lifecycle: { signal: new AbortController().signal, onDispose: () => () => {} },
    route: { current: route, navigate },
    ui: {
      Prompt,
      Slot,
      DialogConfirm,
      dialog: { replace: replaceDialog, clear: clearDialog, setSize: () => {} },
      toast,
    },
    keys: { formatSequence: () => "ctrl+x f" },
    tuiConfig: {
      keybinds: {
        gather(_name: string, commands: string[]) {
          gathered.push(commands)
          return commands.map((command) => ({ key: command, cmd: command }))
        },
      },
    },
    keymap: {
      dispatchCommand,
      getCommandBindings() {
        return new Map()
      },
      registerLayer(layer: KeymapLayer) {
        layers.push(layer)
        return () => {}
      },
    },
    event: {
      on(type: string, handler: (event: unknown) => void) {
        handlers.set(type, handler)
        return () => handlers.delete(type)
      },
    },
    slots: {
      register(input: TuiSlotPlugin) {
        slotOrder = input.order
        const title = input.slots.sidebar_title
        const content = input.slots.sidebar_content
        const prompt = input.slots.session_prompt
        if (title) {
          renderTitle = () =>
            title(
              { theme: api.theme as never },
              { session_id: "session-1", title: "GitHub work by Shane Walker (swalker326)" },
            )
        }
        if (content) renderSidebar = () => content({ theme: api.theme as never }, { session_id: "session-1" })
        if (prompt) {
          renderPrompt = () =>
            prompt(
              { theme: api.theme as never },
              { session_id: "session-1", visible: true, on_submit: () => {}, ref: () => {} },
            )
        }
        return "test-slot"
      },
    },
  } as unknown as TuiPluginApi

  await plugin.tui(api, undefined, {} as TuiPluginMeta)
  for (const session of sessions) {
    handlers.get("session.created")?.({ properties: { info: session } })
  }

  const focusLayer = layers.find((layer) => layer.commands?.some((command) => command.name === "session.sidebar.focus"))
  const navigationLayer = layers.find((layer) => layer.commands?.some((command) => command.name === "dialog.select.next"))
  focusLayer?.commands?.find((command) => command.name === "session.sidebar.focus")?.run({} as never)
  const next = navigationLayer?.commands?.find((command) => command.name === "dialog.select.next")
  expect(next).toBeDefined()
  for (let index = 0; index < 12; index++) next?.run({} as never)
  navigationLayer?.commands?.find((command) => command.name === "dialog.select.submit")?.run({} as never)
  expect(navigate).toHaveBeenLastCalledWith("session", { sessionID: "session-13" })
  focusLayer?.commands?.find((command) => command.name === "session.sidebar.focus")?.run({} as never)

  const app = await testRender(
    () => (
      <box flexDirection="column">
        {renderTitle?.()}
        {renderSidebar?.()}
        {renderPrompt?.()}
      </box>
    ),
    { width: 42, height: 20 },
  )
  try {
    const initial = await app.waitForFrame((frame) => frame.includes("> Session 13"))
    const titleLine = initial.split("\n").find((line) => line.includes("GitHub work by Shane"))
    expect(titleLine).toContain("...")
    expect(titleLine).not.toContain("swalker326")
    expect(initial).toContain("move ↑↓")
    expect(initial).toContain("open ↵")
    expect(initial).toContain("rename ctrl+r")
    expect(initial).toContain("archive a")
    expect(initial).toContain("esc")
    const sessionsLine = initial.split("\n").find((line) => line.includes("Sessions"))
    expect(sessionsLine).toContain("move ↑↓")
    expect(sessionsLine).toContain("open ↵")
    expect(initial).toContain("back esc")
    expect(initial.indexOf("rename ctrl+r")).toBeGreaterThan(initial.indexOf("> Session 13"))
    expect(initial).not.toContain("Prompt")
    expect(initial).toContain("Sessions")
    expect(initial).not.toContain("Session 1 ")

    expect(gathered).toEqual([
      [
        "dialog.select.prev",
        "dialog.select.next",
        "dialog.select.page_up",
        "dialog.select.page_down",
        "dialog.select.home",
        "dialog.select.end",
        "dialog.select.submit",
      ],
    ])
    expect(focusLayer?.mode).toBe("base")
    expect(navigationLayer?.mode).toBe("base")
    expect(slotOrder).toBe(150)
    expect(focusLayer?.bindings).toContainEqual({
      key: "<leader>f",
      cmd: "session.sidebar.focus",
      desc: "Focus session sidebar",
    })

    expect((navigationLayer?.enabled as () => boolean)()).toBe(true)
    expect(navigationLayer?.bindings).toContainEqual({
      key: "ctrl+r",
      cmd: "session.sidebar.rename",
      desc: "Rename selected session",
    })
    expect(navigationLayer?.bindings).toContainEqual({
      key: "a",
      cmd: "session.sidebar.archive",
      desc: "Archive selected session",
    })
    const rename = navigationLayer?.commands?.find((command) => command.name === "session.sidebar.rename")
    rename?.run({} as never)
    expect(replaceDialog).toHaveBeenCalledTimes(1)
    const renameApp = await testRender(() => dialogFactory?.(), { width: 60, height: 8 })
    try {
      const renameDialog = await renameApp.waitForFrame((frame) => frame.includes("Rename Session"))
      expect(renameDialog).toMatch(/Cancel\s+Rename/)
      const renameInput = renameApp.renderer.root.findDescendantById("opencode-sidebar-sessions:rename-input")
      expect(renameInput).toBeInstanceOf(InputRenderable)
      expect((renameInput as InputRenderable).value).toBe("Session 13")
      expect(update).not.toHaveBeenCalled()
      ;(renameInput as InputRenderable).value = "Renamed session"
      ;(renameInput as InputRenderable).submit()
      await renameApp.waitFor(() => update.mock.calls.length === 1)
      expect(clearDialog).toHaveBeenCalledTimes(1)
    } finally {
      renameApp.renderer.destroy()
    }
    expect(update).toHaveBeenCalledWith({
      sessionID: "session-13",
      title: "Renamed session",
    })
    rename?.run({} as never)
    const updatedRenameApp = await testRender(() => dialogFactory?.(), { width: 60, height: 8 })
    try {
      const updatedInput = updatedRenameApp.renderer.root.findDescendantById("opencode-sidebar-sessions:rename-input")
      expect((updatedInput as InputRenderable).value).toBe("Renamed session")
    } finally {
      updatedRenameApp.renderer.destroy()
    }
    update.mockClear()

    const archive = navigationLayer?.commands?.find((command) => command.name === "session.sidebar.archive")
    archive?.run({} as never)
    expect(replaceDialog).toHaveBeenCalledTimes(3)
    dialogFactory?.()
    expect(confirmation?.title).toBe("Archive session")
    expect(confirmation?.message).toBe('Archive session "Renamed session"?')
    expect(update).not.toHaveBeenCalled()
    await confirmation?.onConfirm?.()
    expect(update).toHaveBeenCalledWith({
      sessionID: "session-13",
      time: { archived: expect.any(Number) },
    })
    expect(toast).not.toHaveBeenCalled()
    expect((archive?.enabled as () => boolean)()).toBe(false)
    navigationLayer?.commands?.find((command) => command.name === "dialog.select.submit")?.run({} as never)
    expect(navigate).toHaveBeenCalledWith("session", { sessionID: "session-13" })
    expect(dispatchCommand).not.toHaveBeenCalledWith("session.list")
  } finally {
    app.renderer.destroy()
  }
})
