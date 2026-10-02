const mockSubscribeArgs = new Map<string, any>();
const mockPusher = {
  channels: new Map(),
  connectionState: "DISCONNECTED",
  initArgs: null as any,
  init: jest.fn(async (args: any) => {
    mockPusher.initArgs = args;
  }),
  subscribe: jest.fn(async (args: any) => {
    mockSubscribeArgs.set(args.channelName, args);
    return { channelName: args.channelName };
  }),
  unsubscribe: jest.fn(async ({ channelName }: { channelName: string }) => {
    mockSubscribeArgs.delete(channelName);
  }),
  connect: jest.fn(async () => {}),
  disconnect: jest.fn(async () => {}),
};

jest.mock("@pusher/pusher-websocket-react-native", () => ({
  Pusher: {
    getInstance: jest.fn(() => mockPusher),
  },
  PusherEvent: class MockPusherEvent {},
}));

jest.mock("@/config/realtime", () => ({
  API_BASE_URL: "https://api.aleefna.cloud",
  REVERB_CONFIG: {
    enabled: true,
    key: "reverb-key",
    host: "api.aleefna.cloud",
    port: 443,
    scheme: "https",
    useTLS: true,
    enabledTransports: ["wss"],
  },
  joinApiUrl: (baseUrl: string, path: string) => {
    const normalizedBase = baseUrl.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const baseIncludesApi = /\/api$/i.test(normalizedBase);
    const pathIncludesApi =
      normalizedPath === "/api" || normalizedPath.startsWith("/api/");

    if (baseIncludesApi && pathIncludesApi) {
      return `${normalizedBase}${normalizedPath.slice("/api".length)}`;
    }

    return `${normalizedBase}${normalizedPath}`;
  },
}));

jest.mock("@/utils/logger", () => ({
  devError: jest.fn(),
  devLog: jest.fn(),
  devWarn: jest.fn(),
}));

import {
  adoptionConversationRealtimeChannelName,
  conversationRealtimeChannelName,
  isRealtimeAdoptionMessageSentEventName,
  isRealtimeMatchCreatedEventName,
  isRealtimeMessageSentEventName,
  normalizeRealtimeWsHost,
  parseRealtimePayload,
  realtimeAuthEndpoint,
  realtimeAuthHeaders,
  subscribeRealtimeChannel,
  userRealtimeChannelName,
} from "@/services/realtimeClient";
import { connectMatchRealtime } from "@/services/realtime";
import { devLog } from "@/utils/logger";

async function flushRealtimeTasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

describe("native realtime client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribeArgs.clear();
    mockPusher.channels.clear();
    mockPusher.connectionState = "DISCONNECTED";
    mockPusher.initArgs = null;
  });

  it("builds broadcasting auth endpoint with exactly one api segment", () => {
    expect(realtimeAuthEndpoint("https://api.aleefna.cloud")).toBe(
      "https://api.aleefna.cloud/api/broadcasting/auth",
    );
    expect(realtimeAuthEndpoint("https://api.aleefna.cloud/api")).toBe(
      "https://api.aleefna.cloud/api/broadcasting/auth",
    );
    expect(realtimeAuthEndpoint("https://api.aleefna.cloud/api/")).toBe(
      "https://api.aleefna.cloud/api/broadcasting/auth",
    );
  });

  it("builds native private auth headers without exposing token diagnostics", () => {
    expect(realtimeAuthHeaders("secret-token")).toEqual({
      Authorization: "Bearer secret-token",
      Accept: "application/json",
    });
  });

  it("normalizes websocket host for native pusher config", () => {
    expect(normalizeRealtimeWsHost("api.aleefna.cloud")).toBe("api.aleefna.cloud");
    expect(normalizeRealtimeWsHost("https://api.aleefna.cloud")).toBe(
      "api.aleefna.cloud",
    );
    expect(normalizeRealtimeWsHost("wss://api.aleefna.cloud/app")).toBe(
      "api.aleefna.cloud",
    );
  });

  it("generates exact private channel names", () => {
    expect(userRealtimeChannelName(7)).toBe("private-users.7");
    expect(conversationRealtimeChannelName(17)).toBe("private-conversations.17");
    expect(adoptionConversationRealtimeChannelName(23)).toBe(
      "private-adoption-conversations.23",
    );
  });

  it("routes exact and leading-dot realtime event names", () => {
    expect(isRealtimeMatchCreatedEventName("match.created")).toBe(true);
    expect(isRealtimeMatchCreatedEventName(".match.created")).toBe(true);
    expect(isRealtimeMessageSentEventName("message.sent")).toBe(true);
    expect(isRealtimeMessageSentEventName(".message.sent")).toBe(true);
    expect(isRealtimeAdoptionMessageSentEventName("adoption.message.sent")).toBe(
      true,
    );
    expect(
      isRealtimeAdoptionMessageSentEventName(".adoption.message.sent"),
    ).toBe(true);
    expect(isRealtimeMessageSentEventName("match.created")).toBe(false);
  });

  it("parses native event string payloads safely", () => {
    expect(parseRealtimePayload('{"message":{"id":1}}')).toEqual({
      message: { id: 1 },
    });
    expect(parseRealtimePayload("not-json")).toBe("not-json");
    expect(parseRealtimePayload({ ok: true })).toEqual({ ok: true });
  });

  it("avoids duplicate native subscriptions and cleans up after last release", async () => {
    const channelName = conversationRealtimeChannelName(17);
    const first = subscribeRealtimeChannel({
      token: "token-one",
      baseUrl: "https://api.aleefna.cloud",
      channelName,
      callbacks: {},
    });
    const second = subscribeRealtimeChannel({
      token: "token-one",
      baseUrl: "https://api.aleefna.cloud",
      channelName,
      callbacks: {},
    });

    await flushRealtimeTasks();

    expect(mockPusher.init).toHaveBeenCalledTimes(1);
    expect(mockPusher.initArgs).toEqual(
      expect.objectContaining({
        apiKey: "reverb-key",
        cluster: "mt1",
        host: "api.aleefna.cloud",
        wsPort: 443,
        wssPort: 443,
        useTLS: true,
      }),
    );
    expect(mockPusher.subscribe).toHaveBeenCalledTimes(1);
    expect(mockPusher.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ channelName }),
    );
    expect(mockPusher.connect).toHaveBeenCalledTimes(1);

    first();
    await flushRealtimeTasks();
    expect(mockPusher.unsubscribe).not.toHaveBeenCalled();

    second();
    await flushRealtimeTasks();
    expect(mockPusher.unsubscribe).toHaveBeenCalledWith({ channelName });
  });

  it("routes match and adoption user-channel events with parsed payloads", async () => {
    const onMatchCreated = jest.fn();
    const onAdoptionMessageSent = jest.fn();
    const disconnect = connectMatchRealtime({
      token: "token-two",
      userId: 7,
      baseUrl: "https://api.aleefna.cloud",
      reverbKey: "reverb-key",
      wsHost: "api.aleefna.cloud",
      wsPort: 443,
      wsScheme: "https",
      onMatchCreated,
      onMessageSent: jest.fn(),
      onAdoptionMessageSent,
      onAdoptionCompleted: jest.fn(),
    });

    await flushRealtimeTasks();

    const channelName = userRealtimeChannelName(7);
    const subscribeArgs = mockSubscribeArgs.get(channelName);
    expect(subscribeArgs).toBeTruthy();

    subscribeArgs.onEvent({
      channelName,
      eventName: "match.created",
      data: '{"match_id":42}',
    });
    subscribeArgs.onEvent({
      channelName,
      eventName: "adoption.message.sent",
      data: '{"message":{"id":99,"adoption_conversation_id":5}}',
    });

    expect(onMatchCreated).toHaveBeenCalledWith({ match_id: 42 });
    expect(onAdoptionMessageSent).toHaveBeenCalledWith({
      message: {
        id: 99,
        adoption_conversation_id: 5,
      },
    });
    expect(devLog).toHaveBeenCalledWith(
      "[Realtime] native event received",
      expect.objectContaining({
        action: "received",
        channel: channelName,
      }),
    );

    disconnect();
  });
});
