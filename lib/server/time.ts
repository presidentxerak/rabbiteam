/**
 * Heure locale d'une île sans dépendance : Intl.DateTimeFormat fait foi.
 * C'est ce qui rend le multi-fuseaux gratuit avec un seul cron.
 */
import "server-only";

export interface LocalTime {
  weekday: number; // 0=dimanche … 6=samedi (convention JS)
  hour: number;
  minute: number;
  /** "YYYY-MM-DD" local. */
  day: string;
}

const WEEKDAYS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function localTime(now: Date, timezone: string): LocalTime {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) parts[p.type] = p.value;
  return {
    weekday: WEEKDAYS[parts.weekday ?? "Mon"] ?? 1,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    day: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Le lundi ("YYYY-MM-DD") de la semaine locale courante. */
export function localMonday(now: Date, timezone: string): string {
  const lt = localTime(now, timezone);
  const d = new Date(lt.day + "T00:00:00Z");
  const delta = lt.weekday === 0 ? -6 : 1 - lt.weekday;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
