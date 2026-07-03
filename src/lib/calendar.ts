import type { CalendarEvent } from "./types";

type IcsEvent = {
  UID?: string;
  SUMMARY?: string;
  LOCATION?: string;
  DTSTART?: ParsedIcsDate;
  DTEND?: ParsedIcsDate;
};

type ParsedIcsDate = {
  value: string;
  date: Date;
  allDay: boolean;
};

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

    if (baseKey === "UID" || baseKey === "SUMMARY" || baseKey === "LOCATION") {
      current[baseKey] = value;
    }
  }

  const now = Date.now();
  const rangeEnd = now + 1000 * 60 * 60 * 24 * 7;

  return events
    .filter((event): event is Required<Pick<IcsEvent, "DTSTART">> & IcsEvent => {
      const startsAt = event.DTSTART?.date.getTime();
      return Boolean(startsAt && startsAt >= now - 1000 * 60 * 60 * 24 && startsAt <= rangeEnd);
    })
    .map((event) => ({
      uid: `${sourceId}:${event.UID ?? `${event.DTSTART.value}-${event.SUMMARY ?? "event"}`}`,
      title: event.SUMMARY ?? "제목 없는 일정",
      calendarName,
      location: event.LOCATION,
      startsAt: event.DTSTART.date.toISOString(),
      endsAt: event.DTEND?.date.toISOString(),
      allDay: event.DTSTART.allDay
    }))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, 8);
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

  if (rawUrls) {
    return parseCalendarUrlValue(rawUrls, "GOOGLE_CALENDAR_ICAL_URLS");
  }

  return process.env.GOOGLE_CALENDAR_ICAL_URL
    ? parseCalendarUrlValue(process.env.GOOGLE_CALENDAR_ICAL_URL, "GOOGLE_CALENDAR_ICAL_URL")
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
    .slice(0, 8);
}
