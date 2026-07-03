import type { CalendarEvent } from "./types";

type IcsEvent = {
  UID?: string;
  SUMMARY?: string;
  LOCATION?: string;
  DTSTART?: ParsedIcsDate;
  DTEND?: ParsedIcsDate;
  RRULE?: string;
  EXDATE?: ParsedIcsDate[];
};

type ParsedIcsDate = {
  value: string;
  date: Date;
  allDay: boolean;
};

const DAY_MS = 1000 * 60 * 60 * 24;
const EVENT_LOOKBACK_DAYS = 1;
const EVENT_LOOKAHEAD_DAYS = 45;
const MAX_EVENTS = 80;
const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const KOREA_DATE_PARTS = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul"
});
const KOREA_WEEKDAY = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "Asia/Seoul"
});

function unfoldIcs(text: string): string[] {
  return text
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .split(/\r?\n/);
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function koreaDateKey(date: Date): string {
  return KOREA_DATE_PARTS.format(date);
}

function koreaWeekdayCode(date: Date): (typeof WEEKDAY_CODES)[number] {
  const label = KOREA_WEEKDAY.format(date).toUpperCase().slice(0, 2);
  if (label === "SU") return "SU";
  if (label === "MO") return "MO";
  if (label === "TU") return "TU";
  if (label === "WE") return "WE";
  if (label === "TH") return "TH";
  if (label === "FR") return "FR";
  return "SA";
}

function koreaDayStart(date: Date): Date {
  return new Date(`${koreaDateKey(date)}T00:00:00+09:00`);
}

function daysBetween(start: Date, end: Date): number {
  return Math.floor((koreaDayStart(end).getTime() - koreaDayStart(start).getTime()) / DAY_MS);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function parseIcsDate(rawKey: string, value: string): ParsedIcsDate | null {
  const allDay = rawKey.includes("VALUE=DATE") || /^\d{8}$/.test(value);
  const offset = process.env.CALENDAR_TIMEZONE_OFFSET ?? "+09:00";

  if (allDay) {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match) return null;
    const [, year, month, day] = match;
    return {
      value,
      allDay: true,
      date: new Date(`${year}-${month}-${day}T00:00:00${offset}`)
    };
  }

  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/
  );

  if (!match) return null;

  const [, year, month, day, hour, minute, second, zulu] = match;
  const suffix = zulu === "Z" ? "Z" : offset;

  return {
    value,
    allDay: false,
    date: new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${suffix}`)
  };
}

function parseRrule(value: string): Record<string, string> {
  return value.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ruleValue] = part.split("=");
    if (key && ruleValue) acc[key] = ruleValue;
    return acc;
  }, {});
}

function rruleUntil(rule: Record<string, string>): Date | null {
  return rule.UNTIL ? parseIcsDate("UNTIL", rule.UNTIL)?.date ?? null : null;
}

function exdateKey(date: Date): number {
  return date.getTime();
}

function isExcluded(date: Date, event: IcsEvent): boolean {
  return Boolean(event.EXDATE?.some((excluded) => exdateKey(excluded.date) === exdateKey(date)));
}

function eventDuration(event: IcsEvent): number {
  const start = event.DTSTART?.date.getTime();
  const end = event.DTEND?.date.getTime();
  return start && end && end > start ? end - start : 0;
}

function eventToCalendarEvent(
  event: Required<Pick<IcsEvent, "DTSTART">> & IcsEvent,
  sourceId: string,
  calendarName: string | undefined,
  occurrenceStart = event.DTSTART.date
): CalendarEvent {
  const duration = eventDuration(event);
  const occurrenceEnd = duration > 0 ? new Date(occurrenceStart.getTime() + duration) : event.DTEND?.date;
  const occurrenceId = occurrenceStart.toISOString();

  return {
    uid: `${sourceId}:${event.UID ?? `${event.DTSTART.value}-${event.SUMMARY ?? "event"}`}:${occurrenceId}`,
    title: event.SUMMARY ?? "제목 없는 일정",
    calendarName,
    location: event.LOCATION,
    startsAt: occurrenceStart.toISOString(),
    endsAt: occurrenceEnd?.toISOString(),
    allDay: event.DTSTART.allDay
  };
}

function expandWeeklyEvent(
  event: Required<Pick<IcsEvent, "DTSTART" | "RRULE">> & IcsEvent,
  rule: Record<string, string>,
  rangeStart: number,
  rangeEnd: number,
  sourceId: string,
  calendarName: string | undefined
): CalendarEvent[] {
  const interval = Number.parseInt(rule.INTERVAL ?? "1", 10) || 1;
  const count = rule.COUNT ? Number.parseInt(rule.COUNT, 10) : null;
  const until = rruleUntil(rule)?.getTime() ?? Number.POSITIVE_INFINITY;
  const byDays = (rule.BYDAY?.split(",") ?? [koreaWeekdayCode(event.DTSTART.date)]).filter(
    (day): day is (typeof WEEKDAY_CODES)[number] => WEEKDAY_CODES.includes(day as (typeof WEEKDAY_CODES)[number])
  );
  const occurrences: CalendarEvent[] = [];
  let seen = 0;

  for (let cursor = new Date(event.DTSTART.date); cursor.getTime() <= rangeEnd && cursor.getTime() <= until; cursor = addDays(cursor, 1)) {
    const dayDiff = daysBetween(event.DTSTART.date, cursor);
    if (dayDiff < 0) continue;
    if (Math.floor(dayDiff / 7) % interval !== 0) continue;
    if (!byDays.includes(koreaWeekdayCode(cursor))) continue;

    seen += 1;
    if (count && seen > count) break;
    if (isExcluded(cursor, event)) continue;
    if (cursor.getTime() < rangeStart || cursor.getTime() > rangeEnd) continue;

    occurrences.push(eventToCalendarEvent(event, sourceId, calendarName, cursor));
  }

  return occurrences;
}

function expandDailyEvent(
  event: Required<Pick<IcsEvent, "DTSTART" | "RRULE">> & IcsEvent,
  rule: Record<string, string>,
  rangeStart: number,
  rangeEnd: number,
  sourceId: string,
  calendarName: string | undefined
): CalendarEvent[] {
  const interval = Number.parseInt(rule.INTERVAL ?? "1", 10) || 1;
  const count = rule.COUNT ? Number.parseInt(rule.COUNT, 10) : null;
  const until = rruleUntil(rule)?.getTime() ?? Number.POSITIVE_INFINITY;
  const occurrences: CalendarEvent[] = [];
  let seen = 0;

  for (let cursor = new Date(event.DTSTART.date); cursor.getTime() <= rangeEnd && cursor.getTime() <= until; cursor = addDays(cursor, interval)) {
    seen += 1;
    if (count && seen > count) break;
    if (isExcluded(cursor, event)) continue;
    if (cursor.getTime() < rangeStart || cursor.getTime() > rangeEnd) continue;

    occurrences.push(eventToCalendarEvent(event, sourceId, calendarName, cursor));
  }

  return occurrences;
}

function expandMonthlyEvent(
  event: Required<Pick<IcsEvent, "DTSTART" | "RRULE">> & IcsEvent,
  rule: Record<string, string>,
  rangeStart: number,
  rangeEnd: number,
  sourceId: string,
  calendarName: string | undefined
): CalendarEvent[] {
  const interval = Number.parseInt(rule.INTERVAL ?? "1", 10) || 1;
  const count = rule.COUNT ? Number.parseInt(rule.COUNT, 10) : null;
  const until = rruleUntil(rule)?.getTime() ?? Number.POSITIVE_INFINITY;
  const occurrences: CalendarEvent[] = [];
  let seen = 0;

  for (let cursor = new Date(event.DTSTART.date); cursor.getTime() <= rangeEnd && cursor.getTime() <= until; cursor = addMonths(cursor, interval)) {
    seen += 1;
    if (count && seen > count) break;
    if (rule.BYMONTHDAY && Number.parseInt(rule.BYMONTHDAY, 10) !== cursor.getDate()) continue;
    if (isExcluded(cursor, event)) continue;
    if (cursor.getTime() < rangeStart || cursor.getTime() > rangeEnd) continue;

    occurrences.push(eventToCalendarEvent(event, sourceId, calendarName, cursor));
  }

  return occurrences;
}

function expandEvent(
  event: IcsEvent,
  rangeStart: number,
  rangeEnd: number,
  sourceId: string,
  calendarName: string | undefined
): CalendarEvent[] {
  if (!event.DTSTART) return [];

  if (!event.RRULE) {
    const startsAt = event.DTSTART.date.getTime();
    return startsAt >= rangeStart && startsAt <= rangeEnd
      ? [eventToCalendarEvent(event as Required<Pick<IcsEvent, "DTSTART">> & IcsEvent, sourceId, calendarName)]
      : [];
  }

  const typedEvent = event as Required<Pick<IcsEvent, "DTSTART" | "RRULE">> & IcsEvent;
  const rule = parseRrule(event.RRULE);

  if (rule.FREQ === "WEEKLY") {
    return expandWeeklyEvent(typedEvent, rule, rangeStart, rangeEnd, sourceId, calendarName);
  }

  if (rule.FREQ === "DAILY") {
    return expandDailyEvent(typedEvent, rule, rangeStart, rangeEnd, sourceId, calendarName);
  }

  if (rule.FREQ === "MONTHLY") {
    return expandMonthlyEvent(typedEvent, rule, rangeStart, rangeEnd, sourceId, calendarName);
  }

  return [];
}

function parseIcs(text: string, sourceId: string): CalendarEvent[] {
  const lines = unfoldIcs(text);
  const events: IcsEvent[] = [];
  let current: IcsEvent | null = null;
  let calendarName: string | undefined;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) continue;

    const rawKey = line.slice(0, separatorIndex);
    const baseKey = rawKey.split(";")[0];
    const value = unescapeIcs(line.slice(separatorIndex + 1));

    if (!current) {
      if (baseKey === "X-WR-CALNAME") {
        calendarName = value;
      }
      continue;
    }

    if (baseKey === "DTSTART" || baseKey === "DTEND") {
      const parsed = parseIcsDate(rawKey, value);
      if (parsed) current[baseKey] = parsed;
      continue;
    }

    if (baseKey === "EXDATE") {
      const parsed = parseIcsDate(rawKey, value);
      if (parsed) current.EXDATE = [...(current.EXDATE ?? []), parsed];
      continue;
    }

    if (baseKey === "RRULE") {
      current.RRULE = value;
      continue;
    }

    if (baseKey === "UID" || baseKey === "SUMMARY" || baseKey === "LOCATION") {
      current[baseKey] = value;
    }
  }

  const now = Date.now();
  const rangeStart = now - DAY_MS * EVENT_LOOKBACK_DAYS;
  const rangeEnd = now + DAY_MS * EVENT_LOOKAHEAD_DAYS;

  return events
    .flatMap((event) => expandEvent(event, rangeStart, rangeEnd, sourceId, calendarName))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, MAX_EVENTS);
}

type FetchFreshOptions = {
  forceRefresh?: boolean;
};

function normalizeCalendarUrl(url: string): string {
  return url.trim().replace(/^webcal:\/\//, "https://");
}

function parseCalendarUrlValue(rawValue: string, envName: string): string[] {
  const trimmed = rawValue.trim();

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string")) {
        throw new Error(`${envName} must be a JSON string array`);
      }

      return parsed.map(normalizeCalendarUrl).filter(Boolean);
    } catch (error) {
      throw new Error(
        error instanceof Error ? `Invalid ${envName}: ${error.message}` : `Invalid ${envName}`
      );
    }
  }

  return trimmed ? [normalizeCalendarUrl(trimmed)] : [];
}

function parseCalendarIcalUrls(): string[] {
  const rawUrls = process.env.GOOGLE_CALENDAR_ICAL_URLS;
  const uniqueUrls = (urls: string[]) => Array.from(new Set(urls));

  if (rawUrls) {
    return uniqueUrls(parseCalendarUrlValue(rawUrls, "GOOGLE_CALENDAR_ICAL_URLS"));
  }

  return process.env.GOOGLE_CALENDAR_ICAL_URL
    ? uniqueUrls(parseCalendarUrlValue(process.env.GOOGLE_CALENDAR_ICAL_URL, "GOOGLE_CALENDAR_ICAL_URL"))
    : [];
}

export function hasCalendarIcalUrls(): boolean {
  return parseCalendarIcalUrls().length > 0;
}

async function fetchCalendarEvents(
  icalUrl: string,
  sourceId: string,
  options: FetchFreshOptions
): Promise<CalendarEvent[]> {
  const response = await fetch(
    icalUrl,
    options.forceRefresh ? { cache: "no-store" } : { next: { revalidate: 300 } }
  );

  if (!response.ok) {
    throw new Error(`Calendar request failed: ${response.status}`);
  }

  return parseIcs(await response.text(), sourceId);
}

export async function getCalendarEvents(options: FetchFreshOptions = {}): Promise<CalendarEvent[]> {
  const icalUrls = parseCalendarIcalUrls();

  if (icalUrls.length === 0) {
    return [];
  }

  const eventsByCalendar = await Promise.all(
    icalUrls.map((icalUrl, index) => fetchCalendarEvents(icalUrl, `calendar-${index + 1}`, options))
  );

  return eventsByCalendar
    .flat()
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, MAX_EVENTS);
}
