export type SessionItem = {
  id: string
  title: string
  parentID?: string
  time: {
    updated: number
    archived?: number
  }
}

export type SessionGroup = {
  key: string
  label: string
  sessions: SessionItem[]
}

export function sortRootSessions(sessions: readonly SessionItem[]) {
  return sessions
    .filter((session) => session.parentID === undefined)
    .slice()
    .sort((a, b) => {
      const day = localDayKey(b.time.updated).localeCompare(localDayKey(a.time.updated))
      if (day !== 0) return day
      const archived = Number(a.time.archived !== undefined) - Number(b.time.archived !== undefined)
      if (archived !== 0) return archived
      return b.time.updated - a.time.updated
    })
}

function localDayKey(timestamp: number) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function dayLabel(timestamp: number, now: number) {
  const key = localDayKey(timestamp)
  if (key === localDayKey(now)) return "Today"

  const yesterday = new Date(now)
  yesterday.setHours(0, 0, 0, 0)
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === localDayKey(yesterday.getTime())) return "Yesterday"

  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date(now).getFullYear() ? undefined : "numeric",
  })
}

export function groupSessions(sessions: readonly SessionItem[], now = Date.now()): SessionGroup[] {
  const groups = new Map<string, SessionGroup>()
  const sorted = sortRootSessions(sessions)

  for (const session of sorted) {
    const key = localDayKey(session.time.updated)
    const group = groups.get(key)
    if (group) {
      group.sessions.push(session)
      continue
    }
    groups.set(key, {
      key,
      label: dayLabel(session.time.updated, now),
      sessions: [session],
    })
  }

  return [...groups.values()]
}

export function formatSessionTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function truncateTitle(title: string, width: number) {
  if (title.length <= width) return title
  if (width <= 3) return title.slice(0, width)
  return `${title.slice(0, width - 3)}...`
}
