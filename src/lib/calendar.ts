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

function parseIcs(text: string): CalendarEvent[] {
  const lines = unfoldIcs(text);
  const events: IcsEvent[] = [];
  let current: IcsEvent | null = null;

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

    if (!current) continue;

    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) continue;

    const rawKey = line.slice(0, separatorIndex);
    const baseKey = rawKey.split(";")[0] as keyof IcsEvent;
    const value = unescapeIcs(line.slice(separatorIndex + 1));

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
      uid: event.UID ?? `${event.DTSTART.value}-${event.SUMMARY ?? "event"}`,
      title: event.SUMMARY ?? "제목 없는 일정",
      location: event.LOCATION,
      startsAt: event.DTSTART.date.toISOString(),
      endsAt: event.DTEND?.date.toISOString(),
      allDay: event.DTSTART.allDay
    }))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, 8);
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL;

  if (!icalUrl) {
    return [];
  }

  const response = await fetch(icalUrl, {
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error(`Calendar request failed: ${response.status}`);
  }

  return parseIcs(await response.text());
}
