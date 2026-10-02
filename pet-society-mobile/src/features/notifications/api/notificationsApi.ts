import { Platform } from "react-native";

import { apiRequestWithFallback } from "@/services/apiClient";
import type { Id } from "@/types/adoption";
import { devWarn } from "@/utils/logger";

export type AppNotification = {
  id: string | number;
  user_id?: string | number;
  match_id?: string | number | null;
  type?: string | null;
  title: string;
  message: string;
  data?: {
    match_id?: string | number;
    my_pet_id?: string | number;
    matched_pet_id?: string | number;
    my_pet_name?: string;
    matched_pet_name?: string;
    deep_link?: string;
    [key: string]: unknown;
  } | null;
  is_read?: boolean;
  read_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type NotificationsPayload = {
  notifications?: unknown;
  data?: unknown;
  items?: unknown;
};

export type RegisterDeviceTokenPayload = {
  token: string;
  platform?: string;
  device_id?: string;
  provider?: string;
};

function extractNotificationArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const container = payload as NotificationsPayload;

    if (Array.isArray(container.notifications)) return container.notifications;
    if (Array.isArray(container.data)) return container.data;
    if (Array.isArray(container.items)) return container.items;
  }

  return [];
}

function stringField(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function normalizeNotifications(
  raw: unknown,
  context: string,
): AppNotification[] {
  if (!Array.isArray(raw)) {
    if (raw != null) {
      devWarn(
        `[notificationsApi] normalizeNotifications (${context}): expected array, got`,
        typeof raw,
      );
    }

    return [];
  }

  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const notification = item as Record<string, unknown>;

    if (notification.id == null) return [];

    return [{
      ...notification,
      id: notification.id as string | number,
      type: typeof notification.type === "string" ? notification.type : undefined,
      title: stringField(notification.title, "Notification"),
      message: stringField(
        notification.message,
        stringField(notification.body, ""),
      ),
      data:
        notification.data && typeof notification.data === "object"
          ? notification.data as AppNotification["data"]
          : undefined,
      is_read: Boolean(notification.is_read),
      read_at:
        typeof notification.read_at === "string" ? notification.read_at : null,
      created_at:
        typeof notification.created_at === "string"
          ? notification.created_at
          : null,
      updated_at:
        typeof notification.updated_at === "string"
          ? notification.updated_at
          : null,
    } satisfies AppNotification];
  });
}

export async function getNotificationsRequest(
  token: string,
): Promise<AppNotification[]> {
  const payload = await apiRequestWithFallback<unknown>(token, [
    "/api/notifications",
    "/api/auth/notifications",
  ], {
    fallbackMessage: "We could not load notifications. Please try again.",
  });

  return normalizeNotifications(
    extractNotificationArray(payload),
    "fetchNotifications",
  );
}

export function markNotificationReadRequest(token: string, id: Id) {
  return apiRequestWithFallback(token, [
    `/api/notifications/${id}/read`,
    `/api/auth/notifications/${id}/read`,
  ], {
    method: "PATCH",
    fallbackMessage: "We could not mark this notification as read.",
  });
}

export function markAllNotificationsReadRequest(token: string) {
  return apiRequestWithFallback(token, [
    "/api/notifications/read-all",
    "/api/auth/notifications/read-all",
  ], {
    method: "PATCH",
    fallbackMessage: "We could not mark notifications as read.",
  });
}

export function registerDeviceTokenRequest(
  token: string,
  payload: RegisterDeviceTokenPayload,
) {
  return apiRequestWithFallback(token, [
    "/api/device-tokens",
    "/api/auth/device-tokens",
  ], {
    method: "POST",
    body: {
      platform: payload.platform ?? Platform.OS,
      provider: payload.provider ?? "expo",
      ...payload,
    },
    fallbackMessage: "We could not register this device for notifications.",
  });
}

export function unregisterDeviceTokenRequest(
  token: string,
  payload: { token: string },
) {
  return apiRequestWithFallback(token, [
    "/api/device-tokens/unregister",
    "/api/auth/device-tokens/unregister",
  ], {
    method: "POST",
    body: payload,
    fallbackMessage: "We could not unregister this device token.",
  });
}
