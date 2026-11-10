export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  }).format(new Date(iso));
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  }).format(new Date(iso));
}

const dayKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(d); // YYYY-MM-DD

/** "Today", "Tomorrow" or e.g. "Mon 9 Nov" (clinic time zone). */
export function formatDayLabel(iso: string, now: Date) {
  const day = dayKey(new Date(iso));
  if (day === dayKey(now)) return "Today";
  if (day === dayKey(new Date(now.getTime() + 86_400_000))) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Kyiv",
  }).format(new Date(iso));
}

/** Current time; kept out of components so render stays pure for the linter. */
export function nowDate() {
  return new Date();
}

/** Minutes Kyiv is ahead of UTC at the given instant (120 in winter, 180 in summer). */
function kyivOffsetMinutes(at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Kyiv",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/** "2026-11-12" + "14:30" in clinic time → ISO instant in UTC. Null if invalid. */
export function kyivLocalToISO(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const naive = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;
  // Two passes handle the days when clocks change.
  let instant = new Date(naive.getTime() - kyivOffsetMinutes(naive) * 60000);
  instant = new Date(naive.getTime() - kyivOffsetMinutes(instant) * 60000);
  return instant.toISOString();
}

/** Next `count` calendar days in clinic time as "YYYY-MM-DD", starting today. */
export function kyivNextDays(now: Date, count: number) {
  const [y, m, d] = dayKey(now).split("-").map(Number);
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a "YYYY-MM-DD" date. */
export function isoWeekday(day: string) {
  const w = new Date(`${day}T12:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
}

/** "YYYY-MM-DD" → "Wed 11 Nov". */
export function formatDay(day: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T12:00:00Z`),
  );
}

/** Today's date in clinic time, "YYYY-MM-DD" (for date inputs). */
export function kyivToday(now: Date) {
  return dayKey(now);
}

/** Appointments from the last 12 hours onwards (keeps today's earlier visits visible). */
export function recentCutoff() {
  return new Date(Date.now() - 12 * 3600_000).toISOString();
}
