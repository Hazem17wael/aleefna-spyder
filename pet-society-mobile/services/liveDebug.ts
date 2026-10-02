import { API_BASE_URL, REVERB_CONFIG } from "@/config/realtime";

type LiveDebugSnapshot = {
  apiBaseUrl: string;
  userId: string | null;
  pushTokenRegistered: boolean;
  pushPermissionStatus: string | null;
  realtimeEnabled: boolean;
  reverbConnected: boolean;
  userChannelSubscribed: boolean;
  normalChatChannelSubscribed: string | null;
  adoptionChatChannelSubscribed: string | null;
  lastRealtimeEventAt: string | null;
  lastPushReceivedAt: string | null;
  lastPushRoute: string | null;
  lastAppCountsRefreshAt: string | null;
};

const state: LiveDebugSnapshot = {
  apiBaseUrl: API_BASE_URL,
  userId: null,
  pushTokenRegistered: false,
  pushPermissionStatus: null,
  realtimeEnabled: REVERB_CONFIG.enabled,
  reverbConnected: false,
  userChannelSubscribed: false,
  normalChatChannelSubscribed: null,
  adoptionChatChannelSubscribed: null,
  lastRealtimeEventAt: null,
  lastPushReceivedAt: null,
  lastPushRoute: null,
  lastAppCountsRefreshAt: null,
};

function touch(field: keyof LiveDebugSnapshot, value: LiveDebugSnapshot[keyof LiveDebugSnapshot]) {
  state[field] = value as never;
}

export function setLiveDebugUserId(userId: string | number | null) {
  touch("userId", userId == null ? null : String(userId));
}

export function setLiveDebugPushTokenRegistered(registered: boolean) {
  touch("pushTokenRegistered", registered);
}

export function setLiveDebugPushPermissionStatus(status: string | null) {
  touch("pushPermissionStatus", status);
}

export function setLiveDebugReverbConnected(connected: boolean) {
  touch("reverbConnected", connected);
}

export function setLiveDebugUserChannelSubscribed(subscribed: boolean) {
  touch("userChannelSubscribed", subscribed);
}

export function setLiveDebugNormalChatChannel(conversationId: string | number | null) {
  touch(
    "normalChatChannelSubscribed",
    conversationId == null ? null : String(conversationId),
  );
}

export function setLiveDebugAdoptionChatChannel(conversationId: string | number | null) {
  touch(
    "adoptionChatChannelSubscribed",
    conversationId == null ? null : String(conversationId),
  );
}

export function markLiveDebugRealtimeEvent() {
  touch("lastRealtimeEventAt", new Date().toISOString());
}

export function markLiveDebugPushReceived(route?: string | null) {
  touch("lastPushReceivedAt", new Date().toISOString());

  if (route) {
    touch("lastPushRoute", route);
  }
}

export function markLiveDebugAppCountsRefresh() {
  touch("lastAppCountsRefreshAt", new Date().toISOString());
}

export function getLiveDebugSnapshot(): LiveDebugSnapshot {
  return { ...state };
}

export function formatLiveDebugSnapshot() {
  const snapshot = getLiveDebugSnapshot();

  return [
    `API: ${snapshot.apiBaseUrl}`,
    `User: ${snapshot.userId ?? "none"}`,
    `Push token: ${snapshot.pushTokenRegistered ? "yes" : "no"}`,
    `Push permission: ${snapshot.pushPermissionStatus ?? "unknown"}`,
    `Realtime enabled: ${snapshot.realtimeEnabled ? "yes" : "no"}`,
    `Reverb connected: ${snapshot.reverbConnected ? "yes" : "no"}`,
    `User channel: ${snapshot.userChannelSubscribed ? "yes" : "no"}`,
    `Match chat channel: ${snapshot.normalChatChannelSubscribed ?? "none"}`,
    `Adoption chat channel: ${snapshot.adoptionChatChannelSubscribed ?? "none"}`,
    `Last realtime: ${snapshot.lastRealtimeEventAt ?? "never"}`,
    `Last push: ${snapshot.lastPushReceivedAt ?? "never"}`,
    `Last push route: ${snapshot.lastPushRoute ?? "none"}`,
    `Last app-counts: ${snapshot.lastAppCountsRefreshAt ?? "never"}`,
  ].join("\n");
}
