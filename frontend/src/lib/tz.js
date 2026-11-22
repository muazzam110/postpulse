// Timezone maths without a library. Times are stored and sent as UTC; people think and type in their own zone.
const cache = {};
const formatter = (tz) => (cache[tz] ??= new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** The wall-clock date and time in `tz` at an instant. `dow` is 0 for Monday. */
export function parts(when, tz) {
  const p = Object.fromEntries(formatter(tz).formatToParts(new Date(when)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second, date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, dow: DAYS.indexOf(p.weekday) };
}

const offsetMs = (ms, tz) => { const p = parts(ms, tz); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000; };

/** "2026-10-25" + "09:00" typed in `tz` -> the UTC instant. Looked up twice so a daylight-saving change in between is handled. */
export function zonedToUtc(date, time, tz) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  return new Date(wall - offsetMs(wall - offsetMs(wall, tz), tz));
}

export function offsetLabel(tz, at = new Date()) {
  const min = Math.round(offsetMs(at.getTime(), tz) / 60000);
  const abs = Math.abs(min);
  return `UTC${min < 0 ? "−" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export const fmt = (when, tz, opts) => new Intl.DateTimeFormat(undefined, { timeZone: tz, ...opts }).format(new Date(when));
export const clock = (when, tz) => fmt(when, tz, { hour: "numeric", minute: "2-digit" });

/** Calendar maths on plain dates (no zone involved): the Monday-first weeks of a month. */
export function monthCells(y, m) {
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`)];
}
export const nextMonday = (tz) => {
  const p = parts(new Date(), tz);
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + (7 - p.dow)));
  return d.toISOString().slice(0, 10);
};
export const addDays = (date, n) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

// The browser lists ICU's canonical names ("Asia/Calcutta"); these are the names people actually look for.
const MODERN = ["Asia/Kolkata", "Asia/Kathmandu", "Asia/Ho_Chi_Minh", "Asia/Yangon", "Europe/Kyiv"];
export const zoneList = (current) => [...new Set([current, "UTC", ...MODERN, ...(Intl.supportedValuesOf?.("timeZone") ?? [])])].sort();
