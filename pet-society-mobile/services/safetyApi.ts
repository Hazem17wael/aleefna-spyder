import { apiRequest, getApiErrorMessage } from "@/services/apiClient";

const SAFETY_ERROR_MESSAGES: Record<string, string> = {
  CANNOT_BLOCK_SELF: "You cannot block yourself.",
  USER_BLOCKED: "This interaction is blocked.",
  NOT_MATCH_PARTICIPANT: "Only match participants can unmatch.",
  MATCH_NOT_ACTIVE: "This match is no longer active.",
};

export function getSafetyErrorMessage(error: unknown, fallback?: string) {
  return getApiErrorMessage(
    error,
    fallback ?? "We could not complete this safety action. Please try again.",
    SAFETY_ERROR_MESSAGES,
  );
}

export function unmatch(token: string, matchId: string | number) {
  return apiRequest<unknown>(token, `/api/matches/${encodeURIComponent(String(matchId))}`, {
    method: "DELETE",
    errorCodeMessages: SAFETY_ERROR_MESSAGES,
    fallbackMessage: "We could not unmatch right now.",
  });
}

export function blockUser(token: string, userId: string | number, reason?: string) {
  return apiRequest<unknown>(token, `/api/users/${encodeURIComponent(String(userId))}/block`, {
    method: "POST",
    body: reason ? { reason } : {},
    errorCodeMessages: SAFETY_ERROR_MESSAGES,
    fallbackMessage: "We could not block this user right now.",
  });
}

export function unblockUser(token: string, userId: string | number) {
  return apiRequest<unknown>(token, `/api/users/${encodeURIComponent(String(userId))}/block`, {
    method: "DELETE",
    errorCodeMessages: SAFETY_ERROR_MESSAGES,
    fallbackMessage: "We could not unblock this user right now.",
  });
}

export function getBlockedUsers(token: string) {
  return apiRequest<unknown>(token, "/api/blocked-users", {
    errorCodeMessages: SAFETY_ERROR_MESSAGES,
  });
}

export function deleteAccount(token: string) {
  return apiRequest<null>(token, "/api/account", {
    method: "DELETE",
    errorCodeMessages: SAFETY_ERROR_MESSAGES,
    fallbackMessage: "We could not delete your account right now.",
  });
}
