// GET /api/site/notifications and POST .../read: the bell in the top nav. in-app only.
// call results are written by the live engine when a call resolves
import { getDb } from "@/shared/db";
import type { NotificationsResponse } from "@/shared/types";
import type { Viewer } from "./identity";
import { makeNotifications } from "./notify";

export async function notificationsFor(viewer: Viewer, limit = 30): Promise<NotificationsResponse> {
  const user = viewer.user;
  const asOf = new Date().toISOString();
  if (!user) return { items: [], unread: 0, asOf, source: "db" };
  // the followed teams' and reminders' notifications are made here, when the bell asks
  await makeNotifications(user).catch((err) => console.warn(`site: notifications: ${(err as Error).message}`));
  const db = getDb();
  const [rows, unread] = await Promise.all([db.notifications.list(user.id, limit), db.notifications.unreadCount(user.id)]);
  return {
    items: rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, createdAt: n.createdAt, read: !!n.readAt })),
    unread,
    asOf,
    source: "db",
  };
}

export async function markRead(viewer: Viewer, id?: string): Promise<void> {
  if (viewer.user) await getDb().notifications.markRead(viewer.user.id, id);
}
