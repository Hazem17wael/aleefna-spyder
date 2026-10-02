import type { PendingDeepLinkDestination } from "@/services/pendingDeepLink";
import { normalizeAppDeepLink } from "@/utils/adoptionDeepLinks";

const NOTIFICATIONS_FALLBACK = "/(tabs)/notifications";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function stringValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();

  return null;
}

function nestedData(payload: unknown) {
  if (!isRecord(payload)) return null;

  return isRecord(payload.data) ? payload.data : null;
}

function firstValue(payload: unknown, keys: string[]) {
  const records = [payload, nestedData(payload)].filter(isRecord);

  for (const record of records) {
    for (const key of keys) {
      const value = stringValue(record[key]);

      if (value) return value;
    }
  }

  return null;
}

function normalizedType(payload: unknown) {
  return (
    firstValue(payload, ["type", "notification_type", "notificationType"]) ?? ""
  ).toLowerCase();
}

function linkedRoute(payload: unknown) {
  const link = firstValue(payload, ["deep_link", "deepLink", "link", "url"]);

  return normalizeAppDeepLink(link);
}

function normalChatRoute(payload: unknown): PendingDeepLinkDestination | null {
  const matchId = firstValue(payload, ["match_id", "matchId"]);
  const conversationId = firstValue(payload, ["conversation_id", "conversationId"]);

  if (matchId) {
    return conversationId
      ? {
          pathname: "/chat/[matchId]",
          params: { matchId, conversationId },
        }
      : `/chat/${matchId}`;
  }

  if (conversationId) {
    return {
      pathname: "/chat/[matchId]",
      params: {
        matchId: conversationId,
        conversationId,
      },
    };
  }

  return null;
}

function adoptionRoute(payload: unknown, type: string): PendingDeepLinkDestination | null {
  const adoptionConversationId = firstValue(payload, [
    "adoption_conversation_id",
    "adoptionConversationId",
  ]);

  if (adoptionConversationId) {
    return `/adoption-chat/${adoptionConversationId}`;
  }

  const applicationId = firstValue(payload, [
    "adoption_application_id",
    "adoptionApplicationId",
    "application_id",
    "applicationId",
  ]);
  const listingId = firstValue(payload, [
    "adoption_listing_id",
    "adoptionListingId",
    "listing_id",
    "listingId",
  ]);

  if (type.includes("created") && listingId) {
    return `/my-adoption-listings/${listingId}/applications`;
  }

  if (type.includes("application") && applicationId) {
    return `/my-adoption-applications/${applicationId}`;
  }

  if (listingId) {
    return `/adopt/${listingId}`;
  }

  return null;
}

export function resolveNotificationRoute(
  payload: unknown,
): PendingDeepLinkDestination {
  const directRoute = linkedRoute(payload);

  if (directRoute) return directRoute;

  const type = normalizedType(payload);

  if (
    type === "message" ||
    type === "chat" ||
    type === "conversation" ||
    type.includes("message") ||
    type.includes("conversation")
  ) {
    const route = type.includes("adoption")
      ? adoptionRoute(payload, type)
      : normalChatRoute(payload);

    if (route) return route;
  }

  if (type.includes("match")) {
    const route = normalChatRoute(payload);

    if (route) return route;

    return "/(tabs)/matches";
  }

  if (type.includes("adoption")) {
    const route = adoptionRoute(payload, type);

    if (route) return route;
  }

  return NOTIFICATIONS_FALLBACK;
}
