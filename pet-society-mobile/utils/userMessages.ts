export const GENERIC_ERROR_MESSAGE =
  "Something went wrong. Please try again in a moment.";

export const CONNECTION_ERROR_MESSAGE =
  "Connection problem. Please check your internet and try again.";

export const SESSION_EXPIRED_MESSAGE =
  "Your session expired. Please log in again.";

export const VALIDATION_ERROR_MESSAGE =
  "Please check the highlighted fields.";

export function friendlyErrorMessage(
  message?: unknown,
  fallback = GENERIC_ERROR_MESSAGE,
) {
  if (typeof message !== "string") return fallback;

  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) return fallback;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return fallback;

  if (
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("internet") ||
    lower.includes("connection") ||
    lower.includes("abort") ||
    lower.includes("timeout")
  ) {
    return CONNECTION_ERROR_MESSAGE;
  }

  if (
    lower.includes("unauthorized") ||
    lower.includes("unauthenticated") ||
    lower.includes("session expired")
  ) {
    return SESSION_EXPIRED_MESSAGE;
  }

  if (
    lower.includes("server response") ||
    lower.includes("unexpected token") ||
    lower.includes("json parse") ||
    lower.includes("internal server error")
  ) {
    return fallback;
  }

  return trimmed;
}

export function firstValidationMessage(errors?: unknown) {
  if (!errors || typeof errors !== "object") return "";

  const firstValue = Object.values(errors as Record<string, unknown>)[0];

  if (Array.isArray(firstValue) && typeof firstValue[0] === "string") {
    return friendlyErrorMessage(firstValue[0], VALIDATION_ERROR_MESSAGE);
  }

  if (typeof firstValue === "string") {
    return friendlyErrorMessage(firstValue, VALIDATION_ERROR_MESSAGE);
  }

  return "";
}
