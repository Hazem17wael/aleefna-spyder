import type { AdoptionMessage } from "@/types/adoption";
import {
  adoptionConversationRealtimeChannelName,
  isRealtimeAdoptionCompletedEventName,
  isRealtimeAdoptionMessageSentEventName,
  noopRealtimeDisconnect,
  subscribeRealtimeChannel,
  type RealtimeDisconnect,
} from "@/services/realtimeClient";
import {
  markLiveDebugRealtimeEvent,
  setLiveDebugAdoptionChatChannel,
} from "@/services/liveDebug";
import { devLog } from "@/utils/logger";

type AdoptionMessagePayload = {
  message?: AdoptionMessage;
};

type ConnectAdoptionConversationRealtimeParams = {
  token: string;
  conversationId: string | number;
  baseUrl: string;
  onMessageSent: (message: AdoptionMessage) => void;
  onAdoptionCompleted?: (payload: unknown) => void;
};

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function parsePayload(payload: unknown): AdoptionMessagePayload {
  const parsed = typeof payload === "string" ? tryParseJson(payload) : payload;

  if (!isRecord(parsed)) return {};

  if (isRecord(parsed.message)) {
    return parsed as AdoptionMessagePayload;
  }

  const nestedData = parsed.data;

  if (typeof nestedData === "string") {
    const nested = tryParseJson(nestedData);

    if (isRecord(nested) && isRecord(nested.message)) {
      return nested as AdoptionMessagePayload;
    }
  }

  if (isRecord(nestedData) && isRecord(nestedData.message)) {
    return nestedData as AdoptionMessagePayload;
  }

  if (parsed.id != null && parsed.adoption_conversation_id != null) {
    return { message: parsed as AdoptionMessage };
  }

  return {};
}

function hasMessageId(message?: AdoptionMessage): message is AdoptionMessage {
  return message?.id !== undefined && message.id !== null;
}

function normalizeAdoptionMessage(message: AdoptionMessage): AdoptionMessage {
  const record = message as AdoptionMessage & {
    message_type?: unknown;
    kind?: unknown;
  };
  const explicitType =
    typeof record.message_type === "string" && record.message_type.trim()
      ? record.message_type.trim()
      : typeof record.kind === "string" && record.kind.trim()
        ? record.kind.trim()
        : null;
  const type =
    explicitType ??
    (message.type === "adoption_conversation" ? "text" : message.type);

  return {
    ...message,
    type,
  };
}

function handleIncomingMessage(
  rawPayload: unknown,
  onMessageSent: (message: AdoptionMessage) => void,
  deliveredMessageIds: Set<string>,
) {
  const payload = parsePayload(rawPayload);

  if (hasMessageId(payload.message)) {
    const message = normalizeAdoptionMessage(payload.message);
    const messageId = String(message.id);

    if (deliveredMessageIds.has(messageId)) {
      devLog("[Realtime] adoption chat message ignored", {
        message_id: messageId,
        action: "ignored",
      });
      return;
    }

    deliveredMessageIds.add(messageId);
    markLiveDebugRealtimeEvent();
    devLog("[Realtime] adoption chat message accepted", {
      message_id: messageId,
      adoption_conversation_id: message.adoption_conversation_id,
      action: "appended",
    });
    onMessageSent(message);
    return;
  }

  devLog("[Realtime] adoption chat message ignored", {
    reason: "payload_not_normalized",
    action: "ignored",
  });
}

export function connectAdoptionConversationRealtime({
  token,
  conversationId,
  baseUrl,
  onMessageSent,
  onAdoptionCompleted,
}: ConnectAdoptionConversationRealtimeParams): RealtimeDisconnect {
  const channelName = adoptionConversationRealtimeChannelName(conversationId);
  const deliveredMessageIds = new Set<string>();
  setLiveDebugAdoptionChatChannel(null);

  const disconnect = subscribeRealtimeChannel({
    token,
    baseUrl,
    channelName,
    callbacks: {
      onEvent: (event, payload) => {
        if (isRealtimeAdoptionMessageSentEventName(event.eventName)) {
          devLog("[Realtime] adoption chat event received", {
            event: event.eventName,
            channel: event.channelName,
            action: "received",
          });
          handleIncomingMessage(payload, onMessageSent, deliveredMessageIds);
          return;
        }

        if (
          onAdoptionCompleted &&
          isRealtimeAdoptionCompletedEventName(event.eventName)
        ) {
          markLiveDebugRealtimeEvent();
          devLog("[Realtime] adoption completion event received", {
            event: event.eventName,
            channel: event.channelName,
            action: "received",
          });
          onAdoptionCompleted(payload);
        }
      },
      onSubscriptionSucceeded: () => {
        setLiveDebugAdoptionChatChannel(conversationId);
      },
      onSubscriptionError: () => {
        setLiveDebugAdoptionChatChannel(null);
      },
    },
  });

  if (disconnect === noopRealtimeDisconnect) return noopRealtimeDisconnect;

  let isDisconnected = false;

  return () => {
    if (isDisconnected) return;

    isDisconnected = true;
    setLiveDebugAdoptionChatChannel(null);
    disconnect();
  };
}
