import { API_BASE_URL, REVERB_CONFIG } from "@/config/realtime";
import { connectMatchRealtime } from "@/services/realtime";
import type { MessageAttachment } from "@/services/chat/messageAttachments";
import type { RealtimeDisconnect } from "@/services/realtimeClient";
import { devLog } from "@/utils/logger";

export const MATCH_EVENT_DEDUPE_MS = 15000;
export const MATCH_EVENT_CACHE_TTL_MS = 60000;

export type RealtimeChatMessage = {
  id: string | number;
  conversation_id: string | number;
  sender_id?: string | number;
  type?: string;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
  attachment?: MessageAttachment | null;
  attachments?: MessageAttachment[];
  created_at?: string | null;
  updated_at?: string | null;
};

function parseRealtimePayload(payload: unknown): unknown {
  if (typeof payload !== "string") return payload;

  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function normalizeMessageType(record: Record<string, unknown>, routingType: string) {
  const explicit = firstString(record.message_type, record.kind);

  if (explicit) return explicit;

  const type = firstString(record.type);

  return type === routingType ? "text" : type ?? "text";
}

export function extractRealtimeMatchId(payload: unknown): string | null {
  const root = parseRealtimePayload(payload);

  if (!isRecord(root)) return null;

  const data = parseRealtimePayload(root.data);
  const match = isRecord(root.match) ? root.match : null;
  const notification = isRecord(root.notification)
    ? root.notification
    : null;
  const notificationData = isRecord(notification?.data)
    ? notification.data
    : null;

  const matchId =
    match?.id ??
    notification?.match_id ??
    notificationData?.match_id ??
    root.match_id ??
    (isRecord(data) ? data.match_id : null) ??
    null;

  if (matchId == null || matchId === "") return null;

  return String(matchId);
}

export function extractRealtimeMessage(
  payload: unknown,
): RealtimeChatMessage | null {
  const root = parseRealtimePayload(payload);

  if (!isRecord(root)) return null;

  const data = parseRealtimePayload(root.data);
  const notification = parseRealtimePayload(root.notification);
  const notificationData = isRecord(notification)
    ? parseRealtimePayload(notification.data)
    : null;
  const rootMessage = root.id != null || root.message_id != null ? root : null;
  const dataMessage =
    isRecord(data) && (data.id != null || data.message_id != null)
      ? data
      : null;
  const notificationDataMessage =
    isRecord(notificationData) &&
    (notificationData.id != null || notificationData.message_id != null)
      ? notificationData
      : null;

  const message =
    root.message ??
    (isRecord(data) ? data.message : null) ??
    (isRecord(notificationData) ? notificationData.message : null) ??
    (isRecord(notification) ? notification.message_payload : null) ??
    dataMessage ??
    notificationDataMessage ??
    rootMessage ??
    null;

  const parsedMessage = parseRealtimePayload(message);

  if (!isRecord(parsedMessage)) return null;

  const messageId = parsedMessage.id ?? parsedMessage.message_id ?? root.message_id;
  const conversationId =
    parsedMessage.conversation_id ??
    (isRecord(data) ? data.conversation_id : null) ??
    root.conversation_id;

  if (messageId == null || conversationId == null) return null;

  return {
    ...(parsedMessage as RealtimeChatMessage),
    id: messageId as string | number,
    conversation_id: conversationId as string | number,
    type: normalizeMessageType(
      {
        ...root,
        ...parsedMessage,
      },
      "message",
    ),
  };
}

export function shouldUsePetsRealtime() {
  return REVERB_CONFIG.enabled;
}

export type RealtimeAdoptionMessage = {
  id: string | number;
  adoption_conversation_id: string | number;
  sender_id?: string | number;
  type?: string;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
  attachment?: MessageAttachment | null;
  attachments?: MessageAttachment[];
  created_at?: string | null;
  updated_at?: string | null;
};

function isAdoptionMessageRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function extractRealtimeAdoptionMessage(
  payload: unknown,
): RealtimeAdoptionMessage | null {
  const root = parseRealtimePayload(payload);

  if (!isAdoptionMessageRecord(root)) return null;

  const data = parseRealtimePayload(root.data);
  const nestedMessage = parseRealtimePayload(root.message);

  const message =
    nestedMessage ??
    (isAdoptionMessageRecord(data) ? data.message ?? data : null) ??
    root;

  const parsedMessage = parseRealtimePayload(message);

  if (!isAdoptionMessageRecord(parsedMessage)) return null;

  const conversationId =
    parsedMessage.adoption_conversation_id ??
    parsedMessage.adoptionConversationId ??
    root.adoption_conversation_id ??
    root.adoptionConversationId;

  const messageId = parsedMessage.id ?? parsedMessage.message_id ?? root.message_id;

  if (messageId == null || conversationId == null) return null;

  return {
    id: messageId as string | number,
    adoption_conversation_id: conversationId as string | number,
    sender_id: (parsedMessage.sender_id ?? root.sender_id) as string | number | undefined,
    type: (parsedMessage.message_type ??
      parsedMessage.kind ??
      (parsedMessage.type === "adoption_conversation" ? null : parsedMessage.type) ??
      root.message_type ??
      "text") as string,
    body: (parsedMessage.body ?? root.body ?? null) as string | null,
    metadata: (parsedMessage.metadata ?? root.metadata ?? null) as Record<string, unknown> | null,
    attachment: (parsedMessage.attachment ?? root.attachment ?? null) as MessageAttachment | null,
    attachments: (parsedMessage.attachments ?? root.attachments ?? []) as MessageAttachment[],
    created_at: (parsedMessage.created_at ?? root.created_at ?? null) as string | null,
    updated_at: (parsedMessage.updated_at ?? null) as string | null,
  };
}

export function connectPetsRealtime(params: {
  token: string;
  userId: string | number;
  onMatchCreated: (payload: unknown) => void;
  onMessageSent: (payload: unknown) => void;
  onAdoptionMessageSent?: (payload: unknown) => void;
  onAdoptionCompleted?: (payload: unknown) => void;
}): RealtimeDisconnect {
  return connectMatchRealtime({
    token: params.token,
    userId: params.userId,
    baseUrl: API_BASE_URL,
    reverbKey: REVERB_CONFIG.key,
    wsHost: REVERB_CONFIG.host,
    wsPort: REVERB_CONFIG.port,
    wsScheme: REVERB_CONFIG.scheme,
    onMatchCreated: params.onMatchCreated,
    onMessageSent: params.onMessageSent,
    onAdoptionMessageSent: params.onAdoptionMessageSent,
    onAdoptionCompleted: params.onAdoptionCompleted,
  });
}

export function shouldProcessDedupeKey(params: {
  cache: Map<string, number>;
  key: string | null;
  label?: string;
  dedupeMs?: number;
  ttlMs?: number;
}) {
  if (!params.key) {
    devLog("[Realtime] dedupe skipped missing key", {
      label: params.label ?? "unknown",
      action: "process",
    });
    return true;
  }

  const dedupeMs = params.dedupeMs ?? MATCH_EVENT_DEDUPE_MS;
  const ttlMs = params.ttlMs ?? MATCH_EVENT_CACHE_TTL_MS;
  const now = Date.now();
  const lastSeenAt = params.cache.get(params.key);

  if (lastSeenAt && now - lastSeenAt < dedupeMs) {
    devLog("[Realtime] dedupe ignored", {
      label: params.label ?? "unknown",
      key: params.key,
      ageMs: now - lastSeenAt,
      action: "ignored",
    });
    return false;
  }

  params.cache.set(params.key, now);
  devLog("[Realtime] dedupe accepted", {
    label: params.label ?? "unknown",
    key: params.key,
    action: "process",
  });

  for (const [storedKey, timestamp] of params.cache.entries()) {
    if (now - timestamp > ttlMs) {
      params.cache.delete(storedKey);
    }
  }

  return true;
}
