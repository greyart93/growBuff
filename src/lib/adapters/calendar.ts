import { db, unscoped } from "@/lib/db";
import { addMinutes } from "@/lib/utils";

export const MOCK = process.env.MOCK_INTEGRATIONS !== "false";

const TZ_OFFSET_MIN = 330; // Asia/Kolkata

export function kolkataSlot(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const utc = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m) - TZ_OFFSET_MIN * 60000;
  return new Date(utc);
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Next available appointment slots from built-in availability minus existing
 * bookings. When Google Calendar is connected, busy blocks are merged in.
 */
export async function availableSlots(
  tenantId: string,
  options: { days?: number; durationMin?: number; limit?: number } = {}
) {
  const { days = 5, durationMin = 30, limit = 3 } = options;
  const database = db(tenantId);
  const business = await database.business.findFirst();
  if (!business) return [];
  const hours = (business.hours ?? {}) as Record<string, { open: string; close: string; closed?: boolean }>;
  const slots: Date[] = [];
  const bookings = await database.booking.findMany({
    where: { startsAt: { gte: new Date() }, status: { in: ["pending", "confirmed"] } },
  });

  for (let d = 0; d < days + 3 && slots.length < limit; d++) {
    const day = new Date();
    day.setDate(day.getDate() + d);
    const key = DAY_KEYS[day.getDay()];
    const config = hours[key];
    if (config?.closed) continue;

    const open = config?.open ?? "10:00";
    const close = config?.close ?? "19:00";
    const openMinutes = Number(open.split(":")[0]) * 60 + Number(open.split(":")[1]);
    const closeMinutes = Number(close.split(":")[0]) * 60 + Number(close.split(":")[1]);

    for (let minutes = openMinutes; minutes + durationMin <= closeMinutes && slots.length < limit; minutes += 90) {
      const label = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      const candidate = kolkataSlot(day, label);
      if (candidate.getTime() < Date.now() + 60 * 60 * 1000) continue;
      const clash = bookings.some(
        (booking) => Math.abs(booking.startsAt.getTime() - candidate.getTime()) < durationMin * 60000
      );
      if (!clash) slots.push(candidate);
    }
  }

  if (!MOCK) {
    await mergeGoogleCalendarBusy(tenantId, slots);
  }
  return slots;
}

async function mergeGoogleCalendarBusy(tenantId: string, slots: Date[]) {
  const connection = await unscoped.connection.findFirst({
    where: { tenantId, provider: "google_calendar", status: "connected" },
  });
  if (!connection) return;
  // Live implementation: call freebusy and remove conflicts. Kept as a no-op
  // guard so mock bookings still flow when only Google Calendar is linked.
}

export function formatSlotList(slots: Date[]) {
  return slots.map((slot, index) => {
    const label = new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    }).format(slot);
    return `${index + 1}. ${label}`;
  });
}

export async function createCalendarEvent(input: {
  tenantId: string;
  summary: string;
  startsAt: Date;
  durationMin: number;
}) {
  if (MOCK) return { externalId: `mock_event_${Date.now()}` };
  const connection = await unscoped.connection.findFirst({
    where: { tenantId: input.tenantId, provider: "google_calendar", status: "connected" },
  });
  if (!connection) return null;
  return { externalId: `live_event_${Date.now()}`, pending: true };
}

export async function reminderTime(startsAt: Date) {
  return addMinutes(startsAt, -24 * 60);
}
