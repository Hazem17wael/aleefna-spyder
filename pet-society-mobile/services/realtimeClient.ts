import {
  Pusher,
  type PusherAuthorizerResult,
  type PusherEvent,
} from "@pusher/pusher-websocket-react-native";

import { joinApiUrl, REVERB_CONFIG } from "@/config/realtime";
import { ApiError, firstString } from "@/services/apiClient";
import { devError, devLog, devWarn } from "@/utils/logger";

export type RealtimeDisconnect = () => void;

export const noopRealtimeDisconnect: RealtimeDisconnect = () => {};

export type RealtimeNativeEvent = Pick<
  PusherEvent,
  "channelName" | "eventName" | "data" | "userId"
>;

export type RealtimeNativeSubscriptionCallbacks = {
  onEvent?: (event: RealtimeNativeEvent, payload: unknown) => void;
  onSubscriptionSucceeded?: () => void;
  onSubscriptionError?: (error: unknown) => void;
};

type NativePusherInstance = ReturnType<typeof Pusher.getInstance>;
type NativePusherInitArgs = Parameters<NativePusherInstance["init"]>[0] & {
  host?: string;
  wsPort?: number;
  wssPort?: number;
  path?: string;
};

type RealtimeConnectionConfig = {
  host: string;
  wsPort: number;
  wssPort: number;
  useTLS: boolean;
  websocketAttemptUrl: string;
};

type RealtimeSubscriptionRecord = {
  channelName: string;
  refs: number;
  handlers: Map<symbol, RealtimeNativeSubscriptionCallbacks>;
  subscribed: boolean;
  subscribePromise: Promise<void> | null;
};

type NativeRealtimeManager = {
  cacheKey: string;
  token: string;
  baseUrl: string;
  authEndpoint: string;
  config: RealtimeConnectionConfig;
  pusher: NativePusherInstance;
  connectionState: string;
  initialized: boolean;
  initPromise: Promise<void> | null;
  connectPromise: Promise<void> | null;
  lastInitAt: number;
  lastStaleReinitAt: number;
  subscriptions: Map<string, RealtimeSubscriptionRecord>;
  recentEvents: Map<string, number>;
};

const NATIVE_USABLE_STATES = new Set([
  "CONNECTED",
  "CONNECTING",
  "RECONNECTING",
]);
const NATIVE_STALE_STATES = new Set([
  "DISCONNECTED",
  "FAILED",
  "UNAVAILABLE",
]);
const REINIT_DEBOUNCE_MS = 5000;
const EVENT_DEDUPE_MS = 250;

let nativeRealtimeManager: NativeRealtimeManager | null = null;

export function realtimeAuthEndpoint(baseUrl: string) {
  return joinApiUrl(baseUrl, "/api/broadcasting/auth");
}

export function realtimeAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

function realtimeAuthFormHeaders(token: string) {
  return {
    ...realtimeAuthHeaders(token),
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function summarizeBody(value: unknown): unknown {
  if (typeof value === "string") {
    return value.slice(0, 240);
  }

  if (!isRecord(value)) return undefined;

  const errorKeys = isRecord(value.errors) ? Object.keys(value.errors) : [];

  return {
    success: typeof value.success === "boolean" ? value.success : undefined,
    message: firstString(value.message, value.error),
    code: firstString(value.code, value.error_code),
    errorKeys,
  };
}

export function summarizeRealtimeError(error: unknown): Record<string, unknown> {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      message: error.message,
      code: error.code,
      body: summarizeBody(error.raw),
    };
  }

  if (isRecord(error)) {
    const status =
      typeof error.status === "number"
        ? error.status
        : typeof error.statusCode === "number"
          ? error.statusCode
          : undefined;
    const body =
      error.body ??
      error.responseText ??
      error.data ??
      (isRecord(error.response) ? error.response.data : undefined);

    return {
      status,
      message: firstString(error.message, error.error, error.reason),
      body: summarizeBody(body),
    };
  }

  return {
    message: typeof error === "string" ? error : undefined,
  };
}

export function parseRealtimePayload(data: unknown): unknown {
  if (typeof data !== "string") return data;

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

export function normalizeRealtimeEventName(eventName: string) {
  return eventName.startsWith(".") ? eventName.slice(1) : eventName;
}

export function isRealtimeMatchCreatedEventName(eventName: string) {
  const normalized = normalizeRealtimeEventName(eventName);

  return (
    normalized === "match.created" ||
    normalized === "MatchCreated" ||
    normalized === "App\\Events\\MatchCreatedRealtime" ||
    normalized.endsWith("\\MatchCreatedRealtime")
  );
}

export function isRealtimeMessageSentEventName(eventName: string) {
  const normalized = normalizeRealtimeEventName(eventName);

  return (
    normalized === "message.sent" ||
    normalized === "message.created" ||
    normalized === "MessageSentRealtime" ||
    normalized === "App\\Events\\MessageSentRealtime" ||
    normalized.endsWith("\\MessageSentRealtime")
  );
}

export function isRealtimeAdoptionMessageSentEventName(eventName: string) {
  const normalized = normalizeRealtimeEventName(eventName);

  return (
    normalized === "adoption.message.sent" ||
    normalized === "AdoptionMessageSent" ||
    normalized === "App\\Events\\AdoptionMessageSent" ||
    normalized.endsWith("\\AdoptionMessageSent")
  );
}

export function isRealtimeAdoptionCompletedEventName(eventName: string) {
  const normalized = normalizeRealtimeEventName(eventName);

  return (
    normalized === "adoption.completed" ||
    normalized === "adoption_completed" ||
    normalized === "App\\Events\\AdoptionCompletedRealtime" ||
    normalized.endsWith("\\AdoptionCompletedRealtime")
  );
}

export function userRealtimeChannelName(userId: string | number) {
  return `private-users.${userId}`;
}

export function conversationRealtimeChannelName(
  conversationId: string | number,
) {
  return `private-conversations.${conversationId}`;
}

export function adoptionConversationRealtimeChannelName(
  conversationId: string | number,
) {
  return `private-adoption-conversations.${conversationId}`;
}

export function normalizeRealtimeWsHost(host: string) {
  const trimmed = host.trim();

  if (!trimmed) return "";

  try {
    const parsed = new URL(
      /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`,
    );

    return parsed.hostname;
  } catch {
    return trimmed
      .replace(/^[a-z][a-z\d+\-.]*:\/\//i, "")
      .split("/")[0]
      .split(":")[0]
      .trim();
  }
}

function resolveRealtimeConnectionConfig(): RealtimeConnectionConfig {
  const host = normalizeRealtimeWsHost(REVERB_CONFIG.host);
  const wssPort = 443;
  const wsPort = 443;

  return {
    host,
    wsPort,
    wssPort,
    useTLS: true,
    websocketAttemptUrl:
      `wss://${host}:${wssPort}/app/[key]` +
      "?protocol=7&client=native&version=pusher-websocket-react-native",
  };
}

function realtimeClientCacheKey({
  token,
  baseUrl,
}: {
  token: string;
  baseUrl: string;
}) {
  return `${baseUrl}|${token}`;
}

function normalizeNativeConnectionState(state: unknown) {
  return typeof state === "string" && state.trim()
    ? state.trim().toUpperCase()
    : "DISCONNECTED";
}

function isNativeConnectionStateUsable(state: string | null | undefined) {
  return NATIVE_USABLE_STATES.has(normalizeNativeConnectionState(state));
}

function isNativeConnectionStateStale(state: string | null | undefined) {
  return NATIVE_STALE_STATES.has(normalizeNativeConnectionState(state));
}

export function getRealtimePusherConnectionState() {
  return nativeRealtimeManager?.connectionState ?? null;
}

export function isSharedRealtimePusherConnectionUsable() {
  return isNativeConnectionStateUsable(nativeRealtimeManager?.connectionState);
}

async function authorizeNativePrivateChannel({
  authEndpoint,
  token,
  channelName,
  socketId,
}: {
  authEndpoint: string;
  token: string;
  channelName: string;
  socketId: string;
}): Promise<PusherAuthorizerResult> {
  devLog("[Realtime] private channel auth HTTP starting", {
    action: "auth_http_start",
    authEndpoint,
    channel: channelName,
    socketIdExists: Boolean(socketId),
    tokenExists: Boolean(token),
  });

  const body = new URLSearchParams();
  body.append("socket_id", socketId);
  body.append("channel_name", channelName);

  try {
    const response = await fetch(authEndpoint, {
      method: "POST",
      headers: realtimeAuthFormHeaders(token),
      body: body.toString(),
    });
    const text = await response.text();
    const data = parseRealtimePayload(text);

    devLog("[Realtime] private channel auth HTTP completed", {
      action: "auth_http_complete",
      channel: channelName,
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      devError("[Realtime] private channel auth error", {
        action: "auth_error",
        channel: channelName,
        status: response.status,
        body: summarizeBody(data),
      });

      return { auth: `<auth_failed_${response.status}>:error` };
    }

    if (!isRecord(data) || typeof data.auth !== "string") {
      devError("[Realtime] private channel auth error", {
        action: "auth_error",
        channel: channelName,
        status: response.status,
        message: "Authorization response was not an object with auth.",
      });

      return { auth: "<auth_invalid>:error" };
    }

    devLog("[Realtime] private channel auth success", {
      action: "auth_success",
      channel: channelName,
      status: response.status,
    });

    return {
      auth: data.auth,
      channel_data:
        typeof data.channel_data === "string" ? data.channel_data : undefined,
      shared_secret:
        typeof data.shared_secret === "string" ? data.shared_secret : undefined,
    };
  } catch (error) {
    devError("[Realtime] private channel auth exception", {
      action: "auth_exception",
      channel: channelName,
      message: error instanceof Error ? error.message : String(error),
    });

    return { auth: "<auth_exception>:error" };
  }
}

function notifySubscriptionError(
  record: RealtimeSubscriptionRecord | undefined,
  error: unknown,
) {
  record?.handlers.forEach((handler) => {
    handler.onSubscriptionError?.(error);
  });
}

function markNativeSubscriptionSucceeded(
  manager: NativeRealtimeManager,
  channelName: string,
  data: unknown,
) {
  const record = manager.subscriptions.get(channelName);

  if (record?.subscribed) return;

  if (record) {
    record.subscribed = true;
  }

  devLog("[Realtime] subscription succeeded", {
    action: "subscription_succeeded",
    channel: channelName,
    hasData: Boolean(data),
  });

  record?.handlers.forEach((handler) => {
    handler.onSubscriptionSucceeded?.();
  });
}

function markNativeSubscriptionError(
  manager: NativeRealtimeManager,
  channelName: string,
  message: string,
  error: unknown,
) {
  const record = manager.subscriptions.get(channelName);

  if (record) {
    record.subscribed = false;
    record.subscribePromise = null;
  }

  devError("[Realtime] subscription error", {
    action: "subscription_error",
    channel: channelName,
    message,
    errorMessage: error instanceof Error ? error.message : String(error ?? ""),
  });

  notifySubscriptionError(record, error ?? message);
}

function eventDedupeKey(event: RealtimeNativeEvent) {
  const data =
    typeof event.data === "string"
      ? event.data
      : JSON.stringify(event.data ?? null);

  return `${event.channelName}|${event.eventName}|${data}`;
}

function shouldDispatchNativeEvent(
  manager: NativeRealtimeManager,
  event: RealtimeNativeEvent,
) {
  const now = Date.now();
  const key = eventDedupeKey(event);
  const lastSeenAt = manager.recentEvents.get(key);

  if (lastSeenAt && now - lastSeenAt < EVENT_DEDUPE_MS) {
    return false;
  }

  manager.recentEvents.set(key, now);

  for (const [storedKey, timestamp] of manager.recentEvents.entries()) {
    if (now - timestamp > EVENT_DEDUPE_MS) {
      manager.recentEvents.delete(storedKey);
    }
  }

  return true;
}

function handleNativeRealtimeEvent(
  manager: NativeRealtimeManager,
  event: RealtimeNativeEvent,
) {
  if (!event.channelName || !event.eventName) return;
  if (!shouldDispatchNativeEvent(manager, event)) return;

  const payload = parseRealtimePayload(event.data);
  const record = manager.subscriptions.get(event.channelName);

  devLog("[Realtime] native event received", {
    action: "received",
    channel: event.channelName,
    event: event.eventName,
    handlerCount: record?.handlers.size ?? 0,
  });

  record?.handlers.forEach((handler) => {
    handler.onEvent?.(event, payload);
  });
}

function createNativeRealtimeManager({
  token,
  baseUrl,
}: {
  token: string;
  baseUrl: string;
}) {
  const authEndpoint = realtimeAuthEndpoint(baseUrl);
  const config = resolveRealtimeConnectionConfig();
  const pusher = Pusher.getInstance();

  return {
    cacheKey: realtimeClientCacheKey({ token, baseUrl }),
    token,
    baseUrl,
    authEndpoint,
    config,
    pusher,
    connectionState: normalizeNativeConnectionState(pusher.connectionState),
    initialized: false,
    initPromise: null,
    connectPromise: null,
    lastInitAt: 0,
    lastStaleReinitAt: 0,
    subscriptions: new Map(),
    recentEvents: new Map(),
  } satisfies NativeRealtimeManager;
}

async function disconnectNativeRealtimeManager(
  manager: NativeRealtimeManager,
  reason: string,
) {
  devLog("[Realtime] native cleanup/disconnect", {
    action: "disconnect",
    reason,
    activeChannels: manager.subscriptions.size,
  });

  manager.subscriptions.forEach((record) => {
    record.subscribed = false;
    record.subscribePromise = null;
  });

  try {
    await manager.pusher.disconnect();
  } catch (error) {
    devWarn("[Realtime] native disconnect failed", {
      action: "disconnect",
      reason,
      ...summarizeRealtimeError(error),
    });
  } finally {
    manager.connectionState = "DISCONNECTED";
    manager.initialized = false;
    manager.initPromise = null;
    manager.connectPromise = null;
  }
}

function ensureNativeRealtimeManager({
  token,
  baseUrl,
}: {
  token: string;
  baseUrl: string;
}) {
  const cacheKey = realtimeClientCacheKey({ token, baseUrl });

  if (nativeRealtimeManager?.cacheKey === cacheKey) {
    return nativeRealtimeManager;
  }

  if (nativeRealtimeManager) {
    const previousManager = nativeRealtimeManager;
    nativeRealtimeManager = null;
    void disconnectNativeRealtimeManager(
      previousManager,
      "auth_context_changed",
    );
  }

  nativeRealtimeManager = createNativeRealtimeManager({ token, baseUrl });

  return nativeRealtimeManager;
}

async function ensureNativePusherInitialized(
  manager: NativeRealtimeManager,
  reason: string,
) {
  if (manager.initPromise) {
    await manager.initPromise;
    return;
  }

  const state = normalizeNativeConnectionState(manager.connectionState);
  const now = Date.now();
  const shouldReinitializeStale =
    manager.initialized && isNativeConnectionStateStale(state);

  if (manager.initialized && !isNativeConnectionStateStale(state)) {
    return;
  }

  if (shouldReinitializeStale) {
    if (now - manager.lastStaleReinitAt < REINIT_DEBOUNCE_MS) {
      devWarn("[Realtime] native re-init skipped", {
        action: "reinit_skipped",
        reason,
        state,
        retryInMs: REINIT_DEBOUNCE_MS - (now - manager.lastStaleReinitAt),
      });
      return;
    }

    manager.lastStaleReinitAt = now;
  }

  if (shouldReinitializeStale) {
    manager.subscriptions.forEach((record) => {
      record.subscribed = false;
      record.subscribePromise = null;
    });
  }

  manager.initPromise = (async () => {
    manager.lastInitAt = Date.now();

    devLog("[Realtime] native realtime enabled", {
      action: "enabled",
      host: manager.config.host,
      wssPort: manager.config.wssPort,
      useTLS: manager.config.useTLS,
    });

    devLog("[Realtime] creating native pusher client", {
      action: "create",
      apiKeyExists: Boolean(REVERB_CONFIG.key),
      cluster: "mt1",
      host: manager.config.host,
      wsPort: manager.config.wsPort,
      wssPort: manager.config.wssPort,
      useTLS: manager.config.useTLS,
      authEndpoint: manager.authEndpoint,
      tokenExists: Boolean(manager.token),
      websocketAttemptUrl: manager.config.websocketAttemptUrl,
    });

    const initArgs: NativePusherInitArgs = {
      apiKey: REVERB_CONFIG.key,
      cluster: "mt1",
      host: manager.config.host,
      wsPort: manager.config.wsPort,
      wssPort: manager.config.wssPort,
      useTLS: manager.config.useTLS,
      authorizerTimeoutInSeconds: 15,
      onAuthorizer: (channelName, socketId) =>
        authorizeNativePrivateChannel({
          authEndpoint: manager.authEndpoint,
          token: manager.token,
          channelName,
          socketId,
        }),
      onConnectionStateChange: (currentState, previousState) => {
        const current = normalizeNativeConnectionState(currentState);
        const previous = normalizeNativeConnectionState(previousState);

        manager.connectionState = current;

        devLog("[Realtime] pusher native state_change", {
          action: "state_change",
          currentState: current,
          previousState: previous,
        });

        if (current === "CONNECTED") {
          devLog("[Realtime] pusher native connected", {
            action: "connected",
            currentState: current,
          });
        }

        if (current === "DISCONNECTED") {
          devWarn("[Realtime] pusher native disconnected", {
            action: "disconnected",
            currentState: current,
            previousState: previous,
          });
        }
      },
      onError: (message, code, error) => {
        devError("[Realtime] pusher native error", {
          action: "error",
          message,
          code,
          errorMessage:
            error instanceof Error ? error.message : String(error ?? ""),
        });
      },
      onSubscriptionSucceeded: (channelName, data) => {
        markNativeSubscriptionSucceeded(manager, channelName, data);
      },
      onSubscriptionError: (channelName, message, error) => {
        markNativeSubscriptionError(manager, channelName, message, error);
      },
      onEvent: (event) => {
        handleNativeRealtimeEvent(manager, event);
      },
    };

    await manager.pusher.init(initArgs);
    manager.initialized = true;
    manager.connectionState = normalizeNativeConnectionState(
      manager.pusher.connectionState,
    );
  })()
    .catch((error) => {
      manager.initialized = false;
      manager.connectionState = "FAILED";
      devError("[Realtime] native init failed", {
        action: "init_failed",
        ...summarizeRealtimeError(error),
      });
      throw error;
    })
    .finally(() => {
      manager.initPromise = null;
    });

  await manager.initPromise;
}

async function connectNativePusher(manager: NativeRealtimeManager) {
  if (isNativeConnectionStateUsable(manager.connectionState)) return;

  if (manager.connectPromise) {
    await manager.connectPromise;
    return;
  }

  devLog("[Realtime] pusher native connecting", {
    action: "connecting",
    state: manager.connectionState,
    websocketAttemptUrl: manager.config.websocketAttemptUrl,
  });

  manager.connectionState = "CONNECTING";

  manager.connectPromise = manager.pusher
    .connect()
    .catch((error) => {
      manager.connectionState = "FAILED";
      devError("[Realtime] pusher native failed", {
        action: "failed",
        ...summarizeRealtimeError(error),
      });
      throw error;
    })
    .finally(() => {
      manager.connectPromise = null;
    });

  await manager.connectPromise;
}

async function startNativeSubscription(
  manager: NativeRealtimeManager,
  record: RealtimeSubscriptionRecord,
) {
  if (record.subscribePromise) {
    await record.subscribePromise;
    return;
  }

  record.subscribePromise = (async () => {
    await ensureNativePusherInitialized(manager, `subscribe:${record.channelName}`);

    if (record.refs <= 0 || !manager.subscriptions.has(record.channelName)) {
      return;
    }

    devLog("[Realtime] subscribing channel", {
      action: "subscribing",
      channel: record.channelName,
    });

    await manager.pusher.subscribe({
      channelName: record.channelName,
      onEvent: (event) => {
        handleNativeRealtimeEvent(manager, event);
      },
      onSubscriptionSucceeded: (data) => {
        markNativeSubscriptionSucceeded(manager, record.channelName, data);
      },
      onSubscriptionError: (channelName, message, error) => {
        markNativeSubscriptionError(manager, channelName, message, error);
      },
    });

    devLog("[Realtime] native subscribe requested", {
      action: "subscribe_requested",
      channel: record.channelName,
    });

    await connectNativePusher(manager);

    manager.subscriptions.forEach((otherRecord) => {
      if (
        otherRecord !== record &&
        otherRecord.refs > 0 &&
        !otherRecord.subscribed &&
        !otherRecord.subscribePromise
      ) {
        void startNativeSubscription(manager, otherRecord);
      }
    });
  })().catch((error) => {
    record.subscribed = false;
    record.subscribePromise = null;
    devError("[Realtime] native subscription setup failed", {
      action: "subscription_setup_failed",
      channel: record.channelName,
      ...summarizeRealtimeError(error),
    });
    notifySubscriptionError(record, error);
  });

  await record.subscribePromise;
}

function releaseNativeSubscription({
  manager,
  channelName,
  handlerId,
}: {
  manager: NativeRealtimeManager;
  channelName: string;
  handlerId: symbol;
}) {
  const record = manager.subscriptions.get(channelName);

  if (!record) return;

  record.handlers.delete(handlerId);
  record.refs = Math.max(0, record.refs - 1);

  devLog("[Realtime] native subscription released", {
    action: "release",
    channel: channelName,
    refs: record.refs,
  });

  if (record.refs > 0) return;

  manager.subscriptions.delete(channelName);

  void manager.pusher
    .unsubscribe({ channelName })
    .then(() => {
      devLog("[Realtime] native cleanup/unsubscribe", {
        action: "unsubscribe",
        channel: channelName,
      });
    })
    .catch((error) => {
      devWarn("[Realtime] native unsubscribe failed", {
        action: "unsubscribe_failed",
        channel: channelName,
        ...summarizeRealtimeError(error),
      });
    })
    .finally(() => {
      if (manager.subscriptions.size === 0) {
        void disconnectNativeRealtimeManager(manager, "no_active_channels");
        if (nativeRealtimeManager === manager) {
          nativeRealtimeManager = null;
        }
      }
    });
}

export function subscribeRealtimeChannel({
  token,
  baseUrl,
  channelName,
  callbacks,
}: {
  token: string;
  baseUrl: string;
  channelName: string;
  callbacks: RealtimeNativeSubscriptionCallbacks;
}): RealtimeDisconnect {
  if (!REVERB_CONFIG.enabled) {
    devWarn("[Realtime] realtime disabled", {
      action: "disabled",
      reason: "Disabled or missing required Reverb config.",
    });
    return noopRealtimeDisconnect;
  }

  if (!REVERB_CONFIG.key || !REVERB_CONFIG.host || !REVERB_CONFIG.port) {
    devWarn("[Realtime] realtime disabled", {
      action: "disabled",
      reason: "Missing Reverb key, host, or port.",
      keyExists: Boolean(REVERB_CONFIG.key),
      hostExists: Boolean(REVERB_CONFIG.host),
      portExists: Boolean(REVERB_CONFIG.port),
    });
    return noopRealtimeDisconnect;
  }

  if (!token) {
    devWarn("[Realtime] missing token", {
      action: "missing_token",
      channel: channelName,
    });
    return noopRealtimeDisconnect;
  }

  const manager = ensureNativeRealtimeManager({ token, baseUrl });
  const handlerId = Symbol(channelName);
  let record = manager.subscriptions.get(channelName);

  if (!record) {
    record = {
      channelName,
      refs: 0,
      handlers: new Map(),
      subscribed: false,
      subscribePromise: null,
    };
    manager.subscriptions.set(channelName, record);
  }

  record.refs += 1;
  record.handlers.set(handlerId, callbacks);

  devLog("[Realtime] native channel registered", {
    action: "register",
    channel: channelName,
    refs: record.refs,
    duplicateSubscription: record.refs > 1,
  });

  void startNativeSubscription(manager, record);

  let released = false;

  return () => {
    if (released) return;

    released = true;
    releaseNativeSubscription({ manager, channelName, handlerId });
  };
}
