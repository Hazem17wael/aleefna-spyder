import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";
import type { ComponentType } from "react";

import { APP_ENV } from "@/config/realtime";

const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /authorization/i,
  /cookie/i,
  /password/i,
  /otp/i,
  /secret/i,
  /email/i,
  /phone/i,
  /address/i,
  /latitude/i,
  /longitude/i,
  /location/i,
  /photo/i,
  /image/i,
  /avatar/i,
  /message/i,
  /body/i,
  /pet/i,
  /user/i,
  /name/i,
];

let isMonitoringEnabled = false;

type ExpoConfigLike = {
  slug?: string;
  version?: string;
  ios?: { buildNumber?: string };
  android?: { versionCode?: number };
};

type SentryOptions = Parameters<typeof Sentry.init>[0];
type SentryBeforeSend = NonNullable<SentryOptions["beforeSend"]>;
type SentryBeforeSendEvent = Parameters<SentryBeforeSend>[0];

function expoConfig(): ExpoConfigLike {
  return (Constants.expoConfig ?? {}) as ExpoConfigLike;
}

function appVersion() {
  return expoConfig().version ?? "0.0.0";
}

function nativeBuildNumber() {
  const config = expoConfig();

  return config.ios?.buildNumber ?? String(config.android?.versionCode ?? "");
}

function releaseName() {
  const config = expoConfig();
  const slug = config.slug ?? "aleefna-mobile";

  return `${slug}@${appVersion()}`;
}

function shouldScrubKey(key: string) {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function scrubValue(value: unknown, key = "", depth = 0): unknown {
  if (shouldScrubKey(key)) return "[Filtered]";
  if (value == null || depth > 5) return value;

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, "", depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};

    for (const [childKey, childValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[childKey] = scrubValue(childValue, childKey, depth + 1);
    }

    return out;
  }

  return value;
}

function scrubEvent(event: SentryBeforeSendEvent): SentryBeforeSendEvent {
  const scrubbed = scrubValue(event) as SentryBeforeSendEvent;

  if (scrubbed.user) {
    scrubbed.user = {
      id: typeof event.user?.id === "string" ? event.user.id : undefined,
    };
  }

  return scrubbed;
}

export function initializeMonitoring() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

  if (!dsn || isMonitoringEnabled) {
    return isMonitoringEnabled;
  }

  Sentry.init({
    dsn,
    environment: APP_ENV,
    release: releaseName(),
    dist: nativeBuildNumber() || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });

  Sentry.setTag("app.version", appVersion());
  Sentry.setTag("app.build", nativeBuildNumber() || "unknown");
  Sentry.setTag("app.environment", APP_ENV);

  isMonitoringEnabled = true;

  return true;
}

export function wrapRootComponent<TProps>(
  component: ComponentType<TProps>,
): ComponentType<TProps> {
  return isMonitoringEnabled
    ? (Sentry.wrap(component as ComponentType<Record<string, unknown>>) as unknown as ComponentType<TProps>)
    : component;
}

export function captureBoundaryError(error: Error, componentStack: string) {
  if (!isMonitoringEnabled) return;

  Sentry.captureException(error, {
    contexts: {
      react: {
        componentStack,
      },
    },
  });
}

export function setMonitoringUserId(userId: string | number | null | undefined) {
  if (!isMonitoringEnabled) return;

  Sentry.setUser(userId == null ? null : { id: String(userId) });
}
