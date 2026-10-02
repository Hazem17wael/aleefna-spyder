import type { ChatMessage } from "@/services/chat/chatApi";
import {
    conversationRealtimeChannelName,
    isRealtimeMessageSentEventName,
    noopRealtimeDisconnect,
    subscribeRealtimeChannel,
    type RealtimeDisconnect,
} from "@/services/realtimeClient";
import {
    markLiveDebugRealtimeEvent,
    setLiveDebugNormalChatChannel,
} from "@/services/liveDebug";
import { devLog } from "@/utils/logger";

type MessageSentPayload = {
    message?: ChatMessage;
};

type ConnectConversationRealtimeParams = {
    token: string;
    conversationId: string | number;
    baseUrl: string;
    onMessageSent: (message: ChatMessage) => void;
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

function parsePayload(payload: unknown): MessageSentPayload {
    const parsed = typeof payload === "string" ? tryParseJson(payload) : payload;

    if (!isRecord(parsed)) return {};

    if (isRecord(parsed.message)) {
        return parsed as MessageSentPayload;
    }

    const nestedData = parsed.data;

    if (typeof nestedData === "string") {
        const nested = tryParseJson(nestedData);

        if (isRecord(nested) && isRecord(nested.message)) {
            return nested as MessageSentPayload;
        }
    }

    if (isRecord(nestedData) && isRecord(nestedData.message)) {
        return nestedData as MessageSentPayload;
    }

    if (parsed.id != null && parsed.conversation_id != null) {
        return { message: parsed as ChatMessage };
    }

    return parsed as MessageSentPayload;
}

function hasMessageId(message?: ChatMessage): message is ChatMessage {
    return message?.id !== undefined && message.id !== null;
}

function normalizeChatMessage(message: ChatMessage): ChatMessage {
    const record = message as ChatMessage & {
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
        explicitType ?? (message.type === "message" ? "text" : message.type);

    return {
        ...message,
        type,
    };
}

function handleIncomingMessage(
    rawPayload: unknown,
    onMessageSent: (message: ChatMessage) => void,
    deliveredMessageIds: Set<string>,
) {
    const payload = parsePayload(rawPayload);

    if (hasMessageId(payload.message)) {
        const message = normalizeChatMessage(payload.message);
        const messageId = String(message.id);

        if (deliveredMessageIds.has(messageId)) {
            devLog("[Realtime] normal chat message ignored", {
                message_id: messageId,
                action: "ignored",
            });
            return;
        }

        deliveredMessageIds.add(messageId);
        markLiveDebugRealtimeEvent();
        devLog("[Realtime] normal chat message accepted", {
            message_id: messageId,
            conversation_id: message.conversation_id,
            action: "appended",
        });
        onMessageSent(message);
        return;
    }

    devLog("[Realtime] normal chat message ignored", {
        reason: "payload_not_normalized",
        action: "ignored",
    });
}

export function connectConversationRealtime({
    token,
    conversationId,
    baseUrl,
    onMessageSent,
}: ConnectConversationRealtimeParams): RealtimeDisconnect {
    // Backend channel: private-conversations.{conversationId}
    // Events: message.sent / .message.sent
    // Payload: { message: ChatMessage } or equivalent nested data.message.
    const channelName = conversationRealtimeChannelName(conversationId);
    const deliveredMessageIds = new Set<string>();
    setLiveDebugNormalChatChannel(null);

    const disconnect = subscribeRealtimeChannel({
        token,
        baseUrl,
        channelName,
        callbacks: {
            onEvent: (event, payload) => {
                if (!isRealtimeMessageSentEventName(event.eventName)) return;

                devLog("[Realtime] normal chat event received", {
                    event: event.eventName,
                    channel: event.channelName,
                    action: "received",
                });
                handleIncomingMessage(
                    payload,
                    onMessageSent,
                    deliveredMessageIds,
                );
            },
            onSubscriptionSucceeded: () => {
                setLiveDebugNormalChatChannel(conversationId);
            },
            onSubscriptionError: () => {
                setLiveDebugNormalChatChannel(null);
            },
        },
    });

    if (disconnect === noopRealtimeDisconnect) return noopRealtimeDisconnect;

    let isDisconnected = false;

    return () => {
        if (isDisconnected) return;

        isDisconnected = true;
        setLiveDebugNormalChatChannel(null);
        disconnect();
    };
}
