type ReverbScheme = "https";

const publicEnv = {
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_REALTIME_ENABLED: process.env.EXPO_PUBLIC_REALTIME_ENABLED,
    EXPO_PUBLIC_REVERB_KEY: process.env.EXPO_PUBLIC_REVERB_KEY,
    EXPO_PUBLIC_REVERB_HOST: process.env.EXPO_PUBLIC_REVERB_HOST,
    EXPO_PUBLIC_REVERB_PORT: process.env.EXPO_PUBLIC_REVERB_PORT,
    EXPO_PUBLIC_REVERB_SCHEME: process.env.EXPO_PUBLIC_REVERB_SCHEME,
};

type PublicEnvName = keyof typeof publicEnv;

function envValue(name: PublicEnvName) {
    const value = publicEnv[name];

    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const APP_ENV = "production" as const;

function requiredConfig(name: PublicEnvName) {
    const value = envValue(name);

    if (value) return value;

    throw new Error(
        `[Config] ${name} is required for production builds. Set it in Expo/EAS environment variables.`,
    );
}

function parseBoolean(value?: string) {
    return ["1", "true", "yes", "on"].includes(value?.toLowerCase() ?? "");
}

function parsePort(value?: string) {
    if (!value) return undefined;

    const port = Number(value);

    if (!Number.isInteger(port) || port <= 0) {
        return undefined;
    }

    return port;
}

function parseScheme(value?: string): ReverbScheme | undefined {
    if (!value) return undefined;
    if (value.toLowerCase() === "https") return "https";

    return undefined;
}

function normalizeBaseUrl(value: string) {
    return value.replace(/\/+$/, "");
}

export function joinApiUrl(baseUrl: string, path: string) {
    const normalizedBase = normalizeBaseUrl(baseUrl);
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const baseIncludesApi = /\/api$/i.test(normalizedBase);
    const pathIncludesApi =
        normalizedPath === "/api" || normalizedPath.startsWith("/api/");

    if (baseIncludesApi && pathIncludesApi) {
        return `${normalizedBase}${normalizedPath.slice("/api".length)}`;
    }

    return `${normalizedBase}${normalizedPath}`;
}

const apiBaseUrl = normalizeBaseUrl(
    requiredConfig("EXPO_PUBLIC_API_BASE_URL"),
);

if (!/^https:\/\//i.test(apiBaseUrl)) {
    throw new Error(
        "[Config] EXPO_PUBLIC_API_BASE_URL must use HTTPS for production builds.",
    );
}

export const API_BASE_URL = apiBaseUrl;

export function apiUrl(path: string) {
    return joinApiUrl(API_BASE_URL, path);
}

const realtimeRequested = parseBoolean(envValue("EXPO_PUBLIC_REALTIME_ENABLED"));
const reverbScheme = parseScheme(envValue("EXPO_PUBLIC_REVERB_SCHEME"));
const reverbPort = parsePort(envValue("EXPO_PUBLIC_REVERB_PORT"));
const reverbKey = envValue("EXPO_PUBLIC_REVERB_KEY");
const reverbHost = envValue("EXPO_PUBLIC_REVERB_HOST");
const realtimeEnabled = Boolean(
    realtimeRequested &&
    reverbKey &&
    reverbHost &&
    reverbPort &&
    reverbScheme,
);
const activeScheme: ReverbScheme = "https";

export const REVERB_CONFIG = {
    enabled: realtimeEnabled,
    key: reverbKey ?? "",
    host: reverbHost ?? "",
    port: reverbPort ?? 0,
    scheme: activeScheme,
    useTLS: true,
    enabledTransports: ["wss"],
};
