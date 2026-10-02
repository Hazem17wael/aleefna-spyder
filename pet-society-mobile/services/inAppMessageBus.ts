// services/inAppMessageBus.ts

import type { Match } from "@/context/PetsContext";

export type InAppMessagePayload = {
    conversationId: string | number;
    matchId?: string | number | null;
    title: string;
    body: string;
    match?: Match | null;
};

type Listener = (payload: InAppMessagePayload) => void;

const listeners = new Set<Listener>();

let activeConversationId: string | number | null = null;
let activeAdoptionConversationId: string | number | null = null;

export function setActiveConversationId(
    conversationId: string | number | null,
): void {
    activeConversationId = conversationId;
}

export function getActiveConversationId(): string | number | null {
    return activeConversationId;
}

export function setActiveAdoptionConversationId(
    conversationId: string | number | null,
): void {
    activeAdoptionConversationId = conversationId;
}

export function getActiveAdoptionConversationId(): string | number | null {
    return activeAdoptionConversationId;
}

export function emitInAppMessageBanner(payload: InAppMessagePayload): void {
    if (
        activeConversationId != null &&
        String(activeConversationId) === String(payload.conversationId)
    ) {
        return;
    }

    listeners.forEach((listener) => {
        listener(payload);
    });
}

export function subscribeInAppMessageBanner(listener: Listener): () => void {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}
