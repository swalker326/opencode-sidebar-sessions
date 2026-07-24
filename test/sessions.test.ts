import { describe, expect, test } from "bun:test"
import { formatSessionTime, groupSessions, truncateTitle, type SessionItem } from "../src/sessions"

function timestamp(day: number, hour: number, minute = 0) {
  return new Date(2026, 6, day, hour, minute).getTime()
}

function session(id: string, updated: number, parentID?: string, archived?: number): SessionItem {
  return {
    id,
    title: `Session ${id}`,
    parentID,
    time: { updated, archived },
  }
}

describe("groupSessions", () => {
  test("groups by local day and sorts each day by most recent activity", () => {
    const result = groupSessions(
      [session("older", timestamp(23, 9)), session("latest", timestamp(24, 16)), session("earlier", timestamp(24, 8))],
      timestamp(24, 20),
    )

    expect(result.map((group) => group.label)).toEqual(["Today", "Yesterday"])
    expect(result[0]?.sessions.map((item) => item.id)).toEqual(["latest", "earlier"])
    expect(result[1]?.sessions.map((item) => item.id)).toEqual(["older"])
  })

  test("excludes child sessions", () => {
    const result = groupSessions(
      [session("root", timestamp(24, 8)), session("child", timestamp(24, 9), "root")],
      timestamp(24, 20),
    )

    expect(result[0]?.sessions.map((item) => item.id)).toEqual(["root"])
  })

  test("places archived sessions at the bottom of their activity day", () => {
    const result = groupSessions(
      [
        session("archived-newest", timestamp(24, 16), undefined, timestamp(24, 17)),
        session("active", timestamp(24, 12)),
        session("archived-older", timestamp(24, 10), undefined, timestamp(24, 18)),
        session("yesterday", timestamp(23, 18)),
      ],
      timestamp(24, 20),
    )

    expect(result[0]?.sessions.map((item) => item.id)).toEqual(["active", "archived-newest", "archived-older"])
    expect(result[1]?.sessions.map((item) => item.id)).toEqual(["yesterday"])
  })
})

test("truncateTitle preserves short titles and truncates long ones", () => {
  expect(truncateTitle("short", 10)).toBe("short")
  expect(truncateTitle("a long session title", 10)).toBe("a long ...")
})

test("formatSessionTime includes the local hour and minute", () => {
  expect(formatSessionTime(timestamp(24, 7, 5))).toMatch(/07:05|7:05/)
})
