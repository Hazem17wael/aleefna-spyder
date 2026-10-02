import {
    isRealtimeAdoptionCompletedEventName,
    isRealtimeAdoptionMessageSentEventName,
    isRealtimeMatchCreatedEventName,
    isRealtimeMessageSentEventName,
    noopRealtimeDisconnect,
    subscribeRealtimeChannel,
    userRealtimeChannelName,
    type RealtimeDisconnect,
} from "@/services/realtimeClient";
import {
    markLiveDebugRealtimeEvent,
    setLiveDebugReverbConnected,
    setLiveDebugUserChannelSubscribed,
} from "@/services/liveDebug";
import { devLog, devWarn } from "@/utils/logger";

type ConnectMatchRealtimeParams = {
    token: string;
    userId: string | number;
    baseUrl: string;
    reverbKey: string;
    wsHost: string;
    wsPort: number;
    wsScheme?: string;
    onMatchCreated: (payload: any) => void;
    onMessageSent?: (payload: any) => void;
    onAdoptionMessageSent?: (payload: any) => void;
    onAdoptionCompleted?: (payload: any) => void;
};

export function connectMatchRealtime({
    token,
    userId,
    baseUrl,
    reverbKey,
    wsHost,
    wsPort,
    wsScheme = "http",
    onMatchCreated,
    onMessageSent,
    onAdoptionMessageSent,
    onAdoptionCompleted,
}: ConnectMatchRealtimeParams): RealtimeDisconnect {
    if (!token) {
        devWarn("[Realtime] missing token", {
            action: "missing_token",
            channel: userId ? userRealtimeChannelName(userId) : null,
        });
        return noopRealtimeDisconnect;
    }

    if (!userId) {
        devWarn("[Realtime] missing user id", {
            action: "missing_user_id",
        });
        return noopRealtimeDisconnect;
    }

    if (!reverbKey || !wsHost || !wsPort || !wsScheme) {
        devWarn("[Realtime] realtime disabled", {
            action: "disabled",
            reason: "Missing Reverb connection config.",
            keyExists: Boolean(reverbKey),
            hostExists: Boolean(wsHost),
            portExists: Boolean(wsPort),
            schemeExists: Boolean(wsScheme),
        });
        return noopRealtimeDisconnect;
    }

    const channelName = userRealtimeChannelName(userId);

    const disconnect = subscribeRealtimeChannel({
        token,
        baseUrl,
        channelName,
        callbacks: {
            onSubscriptionSucceeded: () => {
                setLiveDebugReverbConnected(true);
                setLiveDebugUserChannelSubscribed(true);
            },
            onSubscriptionError: () => {
                setLiveDebugUserChannelSubscribed(false);
            },
            onEvent: (event, payload) => {
                if (isRealtimeMatchCreatedEventName(event.eventName)) {
                    markLiveDebugRealtimeEvent();
                    devLog("[Realtime] user channel event received", {
                        event: event.eventName,
                        channel: event.channelName,
                        action: "received",
                    });
                    onMatchCreated(payload);
                    return;
                }

                if (onMessageSent && isRealtimeMessageSentEventName(event.eventName)) {
                    markLiveDebugRealtimeEvent();
                    devLog("[Realtime] user channel event received", {
                        event: event.eventName,
                        channel: event.channelName,
                        action: "received",
                    });
                    onMessageSent(payload);
                    return;
                }

                if (
                    onAdoptionMessageSent &&
                    isRealtimeAdoptionMessageSentEventName(event.eventName)
                ) {
                    markLiveDebugRealtimeEvent();
                    devLog("[Realtime] user channel event received", {
                        event: event.eventName,
                        channel: event.channelName,
                        action: "received",
                    });
                    onAdoptionMessageSent(payload);
                    return;
                }

                if (
                    onAdoptionCompleted &&
                    isRealtimeAdoptionCompletedEventName(event.eventName)
                ) {
                    markLiveDebugRealtimeEvent();
                    devLog("[Realtime] user channel event received", {
                        event: event.eventName,
                        channel: event.channelName,
                        action: "received",
                    });
                    onAdoptionCompleted(payload);
                }
            },
        },
    });

    if (disconnect === noopRealtimeDisconnect) return noopRealtimeDisconnect;

    let isDisconnected = false;

    return () => {
        if (isDisconnected) return;

        isDisconnected = true;
        setLiveDebugUserChannelSubscribed(false);
        setLiveDebugReverbConnected(false);
        disconnect();
    };
}
