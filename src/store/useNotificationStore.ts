import { create } from "zustand";

export interface NotificationItem {
  id: string;
  type: "deadline" | "rescue" | "completion" | "pace" | "brief";
  title: string;
  message: string;
  timestamp: string; // ISO datetime string
  read: boolean;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;

  addNotification: (
    type: "deadline" | "rescue" | "completion" | "pace" | "brief",
    title: string,
    message: string
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => {
  // Load initial notifications from localStorage for persistent judging
  const stored = localStorage.getItem("crunch_notifications");
  const initialNotifications: NotificationItem[] = stored
    ? JSON.parse(stored)
    : [];

  const updateLocalStorage = (notifications: NotificationItem[]) => {
    localStorage.setItem("crunch_notifications", JSON.stringify(notifications));
  };

  return {
    notifications: initialNotifications,
    unreadCount: initialNotifications.filter((n) => !n.read).length,

    addNotification: (type, title, message) => {
      const newNotif: NotificationItem = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type,
        title,
        message,
        timestamp: new Date().toISOString(),
        read: false,
      };

      const updated = [newNotif, ...get().notifications];
      updateLocalStorage(updated);
      set({
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      });
    },

    markAsRead: (id) => {
      const updated = get().notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      updateLocalStorage(updated);
      set({
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      });
    },

    markAllAsRead: () => {
      const updated = get().notifications.map((n) => ({ ...n, read: true }));
      updateLocalStorage(updated);
      set({
        notifications: updated,
        unreadCount: 0,
      });
    },

    clearNotifications: () => {
      updateLocalStorage([]);
      set({
        notifications: [],
        unreadCount: 0,
      });
    },
  };
});
