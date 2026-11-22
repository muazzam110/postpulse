import { afterEach, describe, expect, it, vi } from "vitest";
import { addDays, fmt, monthCells, nextMonday, offsetLabel, parts, zoneList, zonedToUtc } from "@/lib/tz";

afterEach(() => vi.useRealTimers());

describe("timezone maths", () => {
  it("reads the wall clock in a zone", () => {
    expect(parts("2026-10-24T20:00:00Z", "Asia/Kolkata")).toMatchObject({ date: "2026-10-25", time: "01:30", dow: 6 });
    expect(parts("2026-10-24T20:00:00Z", "UTC")).toMatchObject({ date: "2026-10-24", time: "20:00", dow: 5 });
    expect(parts("2026-10-24T00:00:00Z", "UTC").time).toBe("00:00"); // midnight is 00, never 24
  });

  it.each([
    ["2026-01-15", "09:00", "Asia/Kolkata", "2026-01-15T03:30:00.000Z"],
    ["2026-01-15", "09:00", "America/New_York", "2026-01-15T14:00:00.000Z"],
    ["2026-07-15", "09:00", "America/New_York", "2026-07-15T13:00:00.000Z"], // daylight saving
    ["2026-03-07", "09:00", "America/New_York", "2026-03-07T14:00:00.000Z"], // the day before it starts
    ["2026-03-08", "09:00", "America/New_York", "2026-03-08T13:00:00.000Z"], // the day it starts
    ["2026-10-25", "00:30", "Asia/Kolkata", "2026-10-24T19:00:00.000Z"], // the UTC date is the day before
    ["2026-06-01", "23:30", "Pacific/Auckland", "2026-06-01T11:30:00.000Z"],
  ])("%s %s in %s is %s in UTC", (date, time, tz, utc) => {
    expect(zonedToUtc(date, time, tz).toISOString()).toBe(utc);
  });

  it("round-trips through any zone", () => {
    for (const tz of ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London", "Australia/Lord_Howe", "Pacific/Auckland"]) {
      for (const date of ["2026-01-10", "2026-03-29", "2026-07-04", "2026-11-01"]) {
        const p = parts(zonedToUtc(date, "14:45", tz), tz);
        expect([p.date, p.time]).toEqual([date, "14:45"]);
      }
    }
  });

  it("labels the offset, including half hours and daylight saving", () => {
    expect(offsetLabel("Asia/Kolkata")).toBe("UTC+05:30");
    expect(offsetLabel("UTC")).toBe("UTC+00:00");
    expect(offsetLabel("America/New_York", new Date("2026-01-15T12:00:00Z"))).toBe("UTC−05:00");
    expect(offsetLabel("America/New_York", new Date("2026-07-15T12:00:00Z"))).toBe("UTC−04:00");
  });

  it("formats an instant in the chosen zone, not the browser's", () => {
    expect(fmt("2026-10-24T20:00:00Z", "Asia/Kolkata", { day: "numeric", month: "short" })).toMatch(/25/);
    expect(fmt("2026-10-24T20:00:00Z", "UTC", { day: "numeric", month: "short" })).toMatch(/24/);
  });

  it("lays out a month Monday-first", () => {
    const cells = monthCells(2026, 10); // 1 Oct 2026 is a Thursday
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells[3]).toBe("2026-10-01");
    expect(cells.at(-1)).toBe("2026-10-31");
    expect(monthCells(2026, 6)[0]).toBe("2026-06-01"); // a Monday: no blanks
    expect(monthCells(2028, 2).filter(Boolean)).toHaveLength(29);
  });

  it("finds the coming Monday in the user's zone", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T08:00:00Z")); // a Friday
    expect(nextMonday("UTC")).toBe("2026-10-26");
    vi.setSystemTime(new Date("2026-10-25T20:00:00Z")); // Sunday evening in UTC, already Monday morning in Kolkata
    expect(nextMonday("UTC")).toBe("2026-10-26");
    expect(nextMonday("Asia/Kolkata")).toBe("2026-11-02");
    vi.setSystemTime(new Date("2026-10-26T08:00:00Z")); // a Monday: the next one, not today
    expect(nextMonday("UTC")).toBe("2026-11-02");
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-10-28", 6)).toBe("2026-11-03");
    expect(addDays("2026-12-28", 6)).toBe("2027-01-03");
  });

  it("lists the zone people look for, even where the browser uses an older name", () => {
    const zones = zoneList("Asia/Calcutta");
    expect(zones).toEqual(expect.arrayContaining(["UTC", "Asia/Kolkata", "Asia/Calcutta"]));
    expect(new Set(zones).size).toBe(zones.length);
    expect(zoneList("Mars/Base")).toContain("Mars/Base"); // whatever is saved is always selectable
  });
});
