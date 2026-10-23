// Pure calendar logic: no DOM, no Firebase, no network — ICS parsing and
// date/color helpers only (same separation as gym.js/nutrition.js; app.js
// owns the actual fetch() call and all Firestore/DOM wiring).

export const DEFAULT_EVENT_COLOR = "#3fae6a";
export const DEFAULT_FEED_COLOR = "#4f8ef7";
export const GYM_EVENT_COLOR = "#c77dff";

export function dateKeyFor(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeOf(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// A webcal:// link is just an https:// ics feed with a different scheme —
// calendar apps treat it specially (open-in-app), browsers/fetch don't.
export function normalizeFeedUrl(url) {
  return url.trim().replace(/^webcal:\/\//i, "https://");
}

function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Expands a repeat pattern into the list of dateKeys it covers (inclusive),
// for building one event doc per occurrence rather than making a user add
// a recurring work shift or class one day at a time. "weekly"/"monthly"
// recur on the same weekday / day-of-month as startDateKey. Capped at
// maxOccurrences so a mistaken multi-year range can't create thousands of
// documents.
export function generateRecurrenceDates(startDateKey, pattern, untilDateKey, maxOccurrences = 366) {
  if (!pattern || pattern === "none") return [startDateKey];
  const start = parseDateKey(startDateKey);
  const until = parseDateKey(untilDateKey);
  const dates = [];
  const cur = new Date(start);
  while (cur <= until && dates.length < maxOccurrences) {
    const dow = cur.getDay();
    const include =
      pattern === "daily" ||
      (pattern === "weekday" && dow >= 1 && dow <= 5) ||
      (pattern === "weekend" && (dow === 0 || dow === 6)) ||
      (pattern === "weekly" && dow === start.getDay()) ||
      (pattern === "monthly" && cur.getDate() === start.getDate()) ||
      (pattern === "yearly" && cur.getDate() === start.getDate() && cur.getMonth() === start.getMonth());
    if (include) dates.push(dateKeyFor(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// Does this event occupy the given day? Multi-day events (start/end keys
// differing) span every date in between, inclusive.
export function occursOnDate(event, dateKey) {
  const endKey = event.endDateKey || event.dateKey;
  return dateKey >= event.dateKey && dateKey <= endKey;
}

// "Expired" means: the event's whole span is before today, or it ends
// earlier today (by clock time, for timed events only — an all-day event
// isn't "expired" until the calendar moves past its date entirely, handled
// by the first check since endDateKey < today covers that).
export function isEventExpired(event, nowDate = new Date()) {
  const todayKey = dateKeyFor(nowDate);
  const endKey = event.endDateKey || event.dateKey;
  if (endKey < todayKey) return true;
  if (endKey > todayKey) return false;
  if (event.allDay || !event.endTime) return false;
  const [hh, mm] = event.endTime.split(":").map(Number);
  const eventEnd = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), hh, mm, 0, 0);
  return nowDate > eventEnd;
}

function unescapeICSText(s) {
  return s.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

// VALUE=DATE (all-day) or a bare YYYYMMDD → local midnight, all-day.
// YYYYMMDDTHHMMSSZ → UTC, converted to local via Date.UTC + local getters.
// YYYYMMDDTHHMMSS (no Z, possibly with an ignored TZID param — no timezone
// database here, so a named-zone time is taken at face value, not adjusted;
// a documented, good-enough limitation, not a silent one) → local wall clock.
function parseICSDateValue(value, params) {
  if (params.VALUE === "DATE" || /^\d{8}$/.test(value)) {
    const y = Number(value.slice(0, 4));
    const mo = Number(value.slice(4, 6));
    const d = Number(value.slice(6, 8));
    return { date: new Date(y, mo - 1, d), allDay: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, hh, mi, ss, z] = m;
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi, +ss))
    : new Date(+y, +mo - 1, +d, +hh, +mi, +ss);
  return { date, allDay: false };
}

function toEventFields(raw) {
  const startDate = raw.start.date;
  const allDay = raw.start.allDay;
  let endDate = raw.end?.date || startDate;
  // ICS all-day DTEND is exclusive (the day *after* the last day) — pull it
  // back one day so a 3-day all-day event's endDateKey is its actual last day.
  if (allDay && endDate > startDate) endDate = new Date(endDate.getTime() - 86400000);

  return {
    externalUid: raw.uid,
    title: raw.title,
    allDay,
    dateKey: dateKeyFor(startDate),
    endDateKey: dateKeyFor(endDate < startDate ? startDate : endDate),
    startTime: allDay ? null : timeOf(startDate),
    endTime: allDay ? null : timeOf(endDate),
    // RRULE expansion isn't implemented — a recurring event shows only the
    // one occurrence its DTSTART/DTEND describe. Flagged (not silently
    // dropped) so the UI can say so next to the event.
    recurring: !!raw.recurring
  };
}

// Parses VEVENT blocks out of raw .ics text. Returns plain event objects
// (see toEventFields) ready to upsert into Firestore — this function does
// no I/O itself.
export function parseICS(text) {
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const lines = unfolded.split("\n");
  const rawEvents = [];
  let cur = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") { if (cur) rawEvents.push(cur); cur = null; continue; }
    if (!cur) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const left = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const [key, ...paramParts] = left.split(";");
    const params = Object.fromEntries(paramParts.map((p) => p.split("=")));

    switch (key) {
      case "UID":
        cur.uid = value;
        break;
      case "SUMMARY":
        cur.title = unescapeICSText(value);
        break;
      case "DTSTART":
        cur.start = parseICSDateValue(value, params);
        break;
      case "DTEND":
        cur.end = parseICSDateValue(value, params);
        break;
      case "RRULE":
        cur.recurring = true;
        break;
    }
  }

  return rawEvents
    .filter((e) => e.uid && e.title && e.start)
    .map(toEventFields);
}
