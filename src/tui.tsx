/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { TextAttributes, type InputRenderable, type ScrollBoxRenderable } from "@opentui/core"
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { formatSessionTime, groupSessions, sortRootSessions, truncateTitle, type SessionItem } from "./sessions"

const PLUGIN_ID = "opencode-sidebar-sessions"
const SESSION_LIMIT = 100
const SESSION_PANE_HEIGHT = 12
const SIDEBAR_TITLE_WIDTH = 35

type LoadState = "idle" | "loading" | "ready" | "error"

function RenameSessionDialog(props: {
  api: TuiPluginApi
  value: string
  onConfirm: (value: string) => void | Promise<void>
}) {
  const theme = () => props.api.theme.current
  let input: InputRenderable | undefined

  const confirm = (value = input?.value ?? props.value) => {
    props.api.ui.dialog.clear()
    return props.onConfirm(value)
  }

  onMount(() => {
    props.api.ui.dialog.setSize("medium")
    const timer = setTimeout(() => {
      if (!input || input.isDestroyed) return
      input.focus()
      input.gotoLineEnd()
    }, 1)
    onCleanup(() => clearTimeout(timer))
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme().text}>
          Rename Session
        </text>
        <text fg={theme().textMuted} onMouseUp={() => props.api.ui.dialog.clear()}>
          esc
        </text>
      </box>
      <box paddingBottom={1}>
        <input
          id={`${PLUGIN_ID}:rename-input`}
          ref={(value: InputRenderable) => {
            input = value
          }}
          value={props.value}
          placeholder="Session title"
          placeholderColor={theme().textMuted}
          textColor={theme().text}
          focusedTextColor={theme().text}
          cursorColor={theme().text}
          on:enter={(value: string) => confirm(value)}
        />
      </box>
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1}>
        <box paddingLeft={1} paddingRight={1} onMouseUp={() => props.api.ui.dialog.clear()}>
          <text fg={theme().textMuted}>Cancel</text>
        </box>
        <box
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={theme().primary}
          onMouseUp={() => confirm()}
        >
          <text fg={theme().selectedListItemText}>Rename</text>
        </box>
      </box>
    </box>
  )
}

function SessionList(props: {
  api: TuiPluginApi
  currentSessionID: string
  sessions: () => readonly SessionItem[]
  state: () => LoadState
  focused: () => boolean
  selectedSessionID: () => string | undefined
  refresh: () => Promise<void>
  focus: () => void
  activate: (sessionID: string) => void
  mounted: (value: boolean) => void
}) {
  const theme = () => props.api.theme.current
  const groups = createMemo(() => groupSessions(props.sessions()))
  const focusShortcut = () => {
    const binding = props.api.keymap
      .getCommandBindings({ visibility: "registered", commands: ["session.sidebar.focus"] })
      .get("session.sidebar.focus")?.[0]
    return props.api.keys.formatSequence(binding?.sequence) || "leader f"
  }
  let scroll: ScrollBoxRenderable | undefined

  const revealSelected = () => {
    const sessionID = props.selectedSessionID()
    if (sessionID) scroll?.scrollChildIntoView(`${PLUGIN_ID}:${sessionID}`)
  }

  createEffect(() => {
    props.selectedSessionID()
    props.sessions()
    if (scroll) {
      const rows = groups().reduce((total, group) => total + group.sessions.length + 1, 0)
      scroll.verticalScrollBar.visible = rows > SESSION_PANE_HEIGHT
    }
    revealSelected()
  })

  onMount(() => {
    props.mounted(true)
    void props.refresh()
    setTimeout(revealSelected, 0)
  })
  onCleanup(() => {
    scroll?.off("layout-changed", revealSelected)
    props.mounted(false)
  })

  return (
    <box flexDirection="column" gap={1}>
      <box width="100%" flexDirection="row" justifyContent="space-between" onMouseUp={props.focus}>
        <text fg={theme().text}>
          <b>Sessions</b>
        </text>
        <Show when={props.focused()}>
          <box flexDirection="row" gap={2}>
            <text fg={theme().text} wrapMode="none">
              <b>move</b> <span style={{ fg: theme().textMuted }}>↑↓</span>
            </text>
            <text fg={theme().text} wrapMode="none">
              <b>open</b> <span style={{ fg: theme().textMuted }}>↵</span>
            </text>
          </box>
        </Show>
      </box>

      <Show when={props.state() !== "loading" || props.sessions().length > 0} fallback={<text fg={theme().textMuted}>Loading...</text>}>
        <Show when={props.state() !== "error"} fallback={<text fg={theme().error}>Unable to load sessions</text>}>
          <Show when={groups().length > 0} fallback={<text fg={theme().textMuted}>No sessions yet</text>}>
            <scrollbox
              ref={(value) => {
                scroll = value
                const rows = groups().reduce((total, group) => total + group.sessions.length + 1, 0)
                value.verticalScrollBar.visible = rows > SESSION_PANE_HEIGHT
                value.on("layout-changed", revealSelected)
              }}
              height={SESSION_PANE_HEIGHT}
              verticalScrollbarOptions={{
                trackOptions: {
                  backgroundColor: theme().backgroundPanel,
                  foregroundColor: theme().borderActive,
                },
              }}
            >
              <For each={groups()}>
                {(group) => (
                  <box flexDirection="column">
                    <text fg={theme().textMuted}>{group.label}</text>
                    <For each={group.sessions}>
                      {(session) => {
                        const current = () => session.id === props.currentSessionID
                        const selected = () => props.focused() && session.id === props.selectedSessionID()
                        const color = () =>
                          selected()
                            ? theme().selectedListItemText
                            : session.time.archived !== undefined
                              ? theme().textMuted
                              : current()
                                ? theme().primary
                                : theme().text
                        return (
                          <box
                            id={`${PLUGIN_ID}:${session.id}`}
                            width="100%"
                            flexDirection="row"
                            paddingLeft={1}
                            paddingRight={1}
                            backgroundColor={selected() ? theme().primary : current() ? theme().backgroundElement : undefined}
                            onMouseUp={() => props.activate(session.id)}
                          >
                            <text fg={color()} flexShrink={0}>
                              {selected() ? "> " : current() ? "* " : "  "}
                            </text>
                            <text
                              fg={color()}
                              attributes={session.time.archived !== undefined ? TextAttributes.STRIKETHROUGH : undefined}
                              flexGrow={1}
                              wrapMode="none"
                            >
                              {truncateTitle(session.title, 25)}
                            </text>
                            <text fg={theme().textMuted} flexShrink={0}>
                              {formatSessionTime(session.time.updated)}
                            </text>
                          </box>
                        )
                      }}
                    </For>
                  </box>
                )}
              </For>
            </scrollbox>
          </Show>
        </Show>
      </Show>
      <Show
        when={props.focused()}
        fallback={
          <box width="100%" flexDirection="row">
            <text fg={theme().textMuted} wrapMode="none">
              <span style={{ fg: theme().text }}>{focusShortcut()}</span> focus
            </text>
          </box>
        }
      >
        <box width="100%" flexDirection="row" justifyContent="space-between">
          <text fg={theme().text} wrapMode="none">
            <b>rename</b> <span style={{ fg: theme().textMuted }}>r</span>
          </text>
          <text fg={theme().text} wrapMode="none">
            <b>archive</b> <span style={{ fg: theme().textMuted }}>a</span>
          </text>
          <text fg={theme().text} wrapMode="none">
            <b>back</b> <span style={{ fg: theme().textMuted }}>esc</span>
          </text>
        </box>
      </Show>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  const [sessions, setSessions] = createSignal<SessionItem[]>([])
  const [state, setState] = createSignal<LoadState>("idle")
  const [focused, setFocused] = createSignal(false)
  const [selectedSessionID, setSelectedSessionID] = createSignal<string>()
  const [sidebarMounted, setSidebarMounted] = createSignal(false)
  let request = 0

  const refresh = async () => {
    const currentRequest = ++request
    if (sessions().length === 0) setState("loading")

    try {
      const response = await api.client.session.list({
        scope: "project",
        roots: true,
        limit: SESSION_LIMIT,
      })
      if (api.lifecycle.signal.aborted || currentRequest !== request) return
      setSessions((response.data ?? []).slice(0, SESSION_LIMIT))
      setState("ready")
    } catch {
      if (api.lifecycle.signal.aborted || currentRequest !== request) return
      setState(sessions().length > 0 ? "ready" : "error")
    }
  }

  const upsert = (session: SessionItem) => {
    setSessions((current) => {
      const existing = current.find((item) => item.id === session.id)
      if (
        existing &&
        existing.title === session.title &&
        existing.parentID === session.parentID &&
        existing.time.updated === session.time.updated &&
        existing.time.archived === session.time.archived
      ) {
        return current
      }
      const remaining = current.filter((item) => item.id !== session.id)
      if (session.parentID !== undefined) return remaining
      return sortRootSessions([session, ...remaining]).slice(0, SESSION_LIMIT)
    })
    setState("ready")
  }

  const ordered = () => sortRootSessions(sessions())
  const currentSessionID = () => {
    const route = api.route.current
    if (route.name !== "session" || !route.params || typeof route.params.sessionID !== "string") return undefined
    return route.params.sessionID
  }

  const leaveSidebar = () => {
    setFocused(false)
    setSelectedSessionID(undefined)
  }

  const focusSidebar = () => {
    if (focused()) {
      leaveSidebar()
      return
    }
    const current = currentSessionID()
    const list = ordered()
    if (!current || list.length === 0) return
    setSelectedSessionID(list.some((session) => session.id === current) ? current : list[0]?.id)
    setFocused(true)
    if (!sidebarMounted()) void api.keymap.dispatchCommand("session.sidebar.toggle")
  }

  const move = (direction: number) => {
    const list = ordered()
    if (list.length === 0) return
    const current = list.findIndex((session) => session.id === selectedSessionID())
    let next = current + direction
    if (next < 0) next = list.length - 1
    if (next >= list.length) next = 0
    setSelectedSessionID(list[next]?.id)
  }

  const moveTo = (index: number) => {
    const list = ordered()
    if (list.length === 0) return
    setSelectedSessionID(list[Math.max(0, Math.min(list.length - 1, index))]?.id)
  }

  const activate = (sessionID: string) => {
    leaveSidebar()
    api.route.navigate("session", { sessionID })
  }

  const rename = async (session: SessionItem, title: string) => {
    try {
      const response = await api.client.session.update({
        sessionID: session.id,
        title,
      })
      if (response.error) throw new Error(String(response.error))
      upsert(response.data ?? { ...session, title })
    } catch (error) {
      api.ui.toast({
        variant: "error",
        title: "Failed to rename session",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const promptRename = () => {
    const session = ordered().find((item) => item.id === selectedSessionID())
    if (!session) return
    api.ui.dialog.replace(() => (
      <RenameSessionDialog
        api={api}
        value={session.title}
        onConfirm={(title) => rename(session, title)}
      />
    ))
  }

  const archive = async (session: SessionItem) => {
    const archived = Date.now()
    try {
      const response = await api.client.session.update({
        sessionID: session.id,
        time: { archived },
      })
      if (response.error) throw new Error(String(response.error))
      upsert(response.data ?? { ...session, time: { ...session.time, archived } })
    } catch (error) {
      api.ui.toast({
        variant: "error",
        title: "Failed to archive session",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const archiveSelected = () => {
    const session = ordered().find((item) => item.id === selectedSessionID())
    if (!session || session.time.archived !== undefined) return
    void archive(session)
  }

  api.event.on("session.created", (event) => upsert(event.properties.info))
  api.event.on("session.updated", (event) => upsert(event.properties.info))
  api.event.on("session.deleted", (event) => {
    setSessions((current) => current.filter((session) => session.id !== event.properties.info.id))
  })

  api.keymap.registerLayer({
    mode: "base",
    commands: [
      {
        name: "session.sidebar.focus",
        title: "Focus session sidebar",
        category: "Session",
        namespace: "palette",
        enabled: () => currentSessionID() !== undefined && sessions().length > 0,
        run: focusSidebar,
      },
    ],
    bindings: [{ key: "<leader>f", cmd: "session.sidebar.focus", desc: "Focus session sidebar" }],
  })

  api.keymap.registerLayer({
    mode: "base",
    enabled: focused,
    priority: 10,
    commands: [
      { name: "dialog.select.prev", run: () => move(-1) },
      { name: "dialog.select.next", run: () => move(1) },
      { name: "dialog.select.page_up", run: () => move(-10) },
      { name: "dialog.select.page_down", run: () => move(10) },
      { name: "dialog.select.home", run: () => moveTo(0) },
      { name: "dialog.select.end", run: () => moveTo(ordered().length - 1) },
      {
        name: "dialog.select.submit",
        run: () => {
          const sessionID = selectedSessionID()
          if (sessionID) activate(sessionID)
        },
      },
      {
        name: "session.sidebar.rename",
        title: "Rename selected session",
        category: "Session",
        enabled: () => selectedSessionID() !== undefined,
        run: promptRename,
      },
      {
        name: "session.sidebar.archive",
        title: "Archive selected session",
        category: "Session",
        enabled: () => ordered().find((session) => session.id === selectedSessionID())?.time.archived === undefined,
        run: archiveSelected,
      },
    ],
    bindings: [
      ...api.tuiConfig.keybinds.gather("session.sidebar", [
        "dialog.select.prev",
        "dialog.select.next",
        "dialog.select.page_up",
        "dialog.select.page_down",
        "dialog.select.home",
        "dialog.select.end",
        "dialog.select.submit",
      ]),
      { key: "r", cmd: "session.sidebar.rename", desc: "Rename selected session" },
      { key: "a", cmd: "session.sidebar.archive", desc: "Archive selected session" },
      { key: "escape", cmd: leaveSidebar, desc: "Leave session sidebar" },
      { key: "ctrl+c", cmd: leaveSidebar, desc: "Leave session sidebar" },
    ],
  })

  api.lifecycle.onDispose(leaveSidebar)

  void refresh()

  const Prompt = api.ui.Prompt
  const Slot = api.ui.Slot
  api.slots.register({
    order: 150,
    slots: {
      sidebar_title(_context, props) {
        return (
          <box paddingRight={1}>
            <text fg={api.theme.current.text} wrapMode="none">
              <b>{truncateTitle(props.title, SIDEBAR_TITLE_WIDTH)}</b>
            </text>
            <Show when={props.share_url}>
              <text fg={api.theme.current.textMuted} wrapMode="none">
                {truncateTitle(props.share_url ?? "", SIDEBAR_TITLE_WIDTH)}
              </text>
            </Show>
          </box>
        )
      },
      sidebar_content(_context, props) {
        return (
          <SessionList
            api={api}
            currentSessionID={props.session_id}
            sessions={sessions}
            state={state}
            focused={focused}
            selectedSessionID={selectedSessionID}
            refresh={refresh}
            focus={focusSidebar}
            activate={activate}
            mounted={(value) => {
              setSidebarMounted(value)
              if (!value && focused()) leaveSidebar()
            }}
          />
        )
      },
      session_prompt(_context, props) {
        return (
          <Prompt
            sessionID={props.session_id}
            visible={props.visible !== false && !focused()}
            disabled={props.disabled}
            onSubmit={props.on_submit}
            ref={props.ref}
            right={<Slot name="session_prompt_right" session_id={props.session_id} />}
          />
        )
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: PLUGIN_ID,
  tui,
}

export default plugin
