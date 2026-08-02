// Minimal shim for the few helpers ScheduleVisit + visits.ts pull from
// the original property-genius `lib/bookos.ts`. The full bookos store is
// intentionally NOT carried over — the main Impact Queue / CRM store
// already owns bookings, payments, activity, notifications.

import { PGS } from "@/property-genius/data/pgs";
import { emit } from "@/lib/connectors";
import { useNotifications, type NotifChannel, type NotifSeverity } from "@/lib/notifications";
import type { Role } from "@/lib/types";

export const uid = (p = "id") =>
  `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export function pgName(id: string) {
  return PGS.find((p) => p.id === id)?.name ?? id;
}

// Property Genius activity and reminders are bridged into the shared CRM.
export function logActivity(action: string, entity: string, ref?: string, actor = "you") {
  emit({
    kind: entity === "room" ? "owner.room_updated" : "tour.scheduled",
    actorRole: entity === "room" ? "hr" : "flow-ops",
    actorId: actor,
    text: `${action}${ref ? `: ${ref}` : ""}`,
  });
}

export function pushNotification(notification: {
  title?: string;
  body?: string;
  type?: "reminder" | "success" | "warning" | "error";
  channel?: "inapp" | "todo" | "calendar" | "email";
}) {
  const severity: NotifSeverity = notification.type === "error"
    ? "urgent"
    : notification.type === "warning"
      ? "warn"
      : notification.type === "success"
        ? "success"
        : "info";
  const channel: NotifChannel = notification.channel === "todo"
    ? "todo"
    : notification.channel === "calendar"
      ? "calendar"
      : notification.channel === "email"
        ? "email"
        : "in-app";

  useNotifications.getState().push({
    audience: ["flow-ops", "tcm", "hr"] as Role[],
    severity,
    title: notification.title ?? "Property update",
    body: notification.body ?? "A property operation needs attention.",
    kind: "system",
    channels: [channel],
    emailQueued: channel === "email",
    todoDone: channel === "todo" ? false : undefined,
    href: "/inbox",
  });
}
