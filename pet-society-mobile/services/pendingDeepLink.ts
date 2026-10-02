import AsyncStorage from "@react-native-async-storage/async-storage";

export type PendingDeepLinkDestination =
  | string
  | {
      pathname: string;
      params?: Record<string, string>;
    };

const PENDING_DEEP_LINK_KEY = "aleefna:pending-deep-link";

function isSafePath(pathname: string) {
  if (!pathname.startsWith("/")) return false;
  if (pathname.startsWith("//")) return false;
  if (/^\/(?:login|register|onboarding|forgot-password|verify-otp)(?:\/|$)/.test(pathname)) {
    return false;
  }

  return true;
}

function normalizeParams(params?: Record<string, unknown>) {
  if (!params) return undefined;

  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;

    out[key] = String(value);
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function sanitizePendingDeepLink(
  destination: PendingDeepLinkDestination | null | undefined,
): PendingDeepLinkDestination | null {
  if (!destination) return null;

  if (typeof destination === "string") {
    return isSafePath(destination) ? destination : null;
  }

  if (!isSafePath(destination.pathname)) return null;

  return {
    pathname: destination.pathname,
    params: normalizeParams(destination.params),
  };
}

export async function storePendingDeepLink(
  destination: PendingDeepLinkDestination,
) {
  const safeDestination = sanitizePendingDeepLink(destination);

  if (!safeDestination) return false;

  await AsyncStorage.setItem(
    PENDING_DEEP_LINK_KEY,
    JSON.stringify(safeDestination),
  );

  return true;
}

export async function consumePendingDeepLink() {
  const raw = await AsyncStorage.getItem(PENDING_DEEP_LINK_KEY);

  if (!raw) return null;

  await AsyncStorage.removeItem(PENDING_DEEP_LINK_KEY);

  try {
    return sanitizePendingDeepLink(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearPendingDeepLink() {
  return AsyncStorage.removeItem(PENDING_DEEP_LINK_KEY);
}
