import { apiUrl } from "@/config/realtime";
import type { FieldErrors } from "@/types/adoption";

export const REQUEST_TIMEOUT_MS = 12000;
export const NETWORK_ERROR_MESSAGE =
  "Could not connect. Please check your internet connection and try again.";
export const TIMEOUT_ERROR_MESSAGE = "The request timed out. Please try again.";

let unauthorizedHandler: (() => void | Promise<void>) | null = null;
let lastUnauthorizedAt = 0;

export function setUnauthorizedHandler(handler: (() => void | Promise<void>) | null) {
  unauthorizedHandler = handler;

  return () => {
    if (unauthorizedHandler === handler) {
      unauthorizedHandler = null;
    }
  };
}

export function handleUnauthorizedResponse(status: number) {
  if (status !== 401) return false;

  const now = Date.now();

  if (now - lastUnauthorizedAt > 1000) {
    lastUnauthorizedAt = now;
    void unauthorizedHandler?.();
  }

  return true;
}

export type ApiRequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  skipContentType?: boolean;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  errors?: FieldErrors;
  raw: unknown;
  status: number;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  errors?: FieldErrors;
  raw?: unknown;

  constructor({
    message,
    status,
    code,
    errors,
    raw,
  }: {
    message: string;
    status: number;
    code?: string;
    errors?: FieldErrors;
    raw?: unknown;
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.raw = raw;
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function authHeaders(
  token: string,
  extra?: Record<string, string>,
  contentType = "application/json",
) {
  return {
    Accept: "application/json",
    "Content-Type": contentType,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

export function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

export function normalizeFieldErrors(errors: unknown): FieldErrors | undefined {
  if (!errors || typeof errors !== "object") return undefined;

  const out: FieldErrors = {};

  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      out[key] = value.filter(Boolean).join("\n");
    } else if (typeof value === "string") {
      out[key] = value;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function normalizeApiData<T = unknown>(json: unknown): T {
  if (json && typeof json === "object" && "data" in json) {
    return (json as { data: T }).data;
  }

  return json as T;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
  codeMessages?: Record<string, string>,
) {
  if (error instanceof ApiError) {
    if (error.code && codeMessages?.[error.code]) {
      return codeMessages[error.code];
    }

    if (error.message) return error.message;
  }

  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;

    if (typeof code === "string" && codeMessages?.[code]) {
      return codeMessages[code];
    }
  }

  return fallback;
}

export function getApiValidationErrors(error: unknown) {
  if (error instanceof ApiError) return error.errors ?? {};

  return {};
}

type ApiRequestConfig = ApiRequestOptions & {
  errorCodeMessages?: Record<string, string>;
  fallbackMessage?: string;
  skipUnauthorizedHandler?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function safeErrorInfo(error: unknown) {
  if (!isRecord(error)) {
    return { message: typeof error === "string" ? error : undefined };
  }

  return {
    name: typeof error.name === "string" ? error.name : undefined,
    message: typeof error.message === "string" ? error.message : undefined,
  };
}

function sanitizeApiBody(body: unknown) {
  if (!isRecord(body)) {
    return {
      success: undefined,
      message: undefined,
      errorKeys: [],
    };
  }

  const errors = isRecord(body.errors) ? Object.keys(body.errors) : [];

  return {
    success: typeof body.success === "boolean" ? body.success : undefined,
    message: firstString(body.message, body.error),
    errorKeys: errors,
  };
}

function debugLog(label: string, details: Record<string, unknown>) {
  if (!__DEV__) return;

  console.log(label, details);
}

function requestUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : apiUrl(path);
}

function requestBody(body: unknown): BodyInit | undefined {
  if (body == null) return undefined;
  if (typeof body === "string" || body instanceof FormData) {
    return body as BodyInit;
  }

  return JSON.stringify(body);
}

function requestHeaders({
  token,
  headers,
  skipContentType,
}: {
  token?: string;
  headers?: Record<string, string>;
  skipContentType?: boolean;
}) {
  if (token) {
    return skipContentType
      ? {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...headers,
        }
      : authHeaders(token, headers);
  }

  return skipContentType
    ? {
        Accept: "application/json",
        ...headers,
      }
    : {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
      };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException && error.name === "AbortError"
  ) || (
    error instanceof Error && error.name === "AbortError"
  );
}

function networkApiError(error: unknown, fallbackMessage?: string) {
  return new ApiError({
    message:
      fallbackMessage ??
      (isAbortError(error) ? TIMEOUT_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE),
    status: 0,
    raw: error,
  });
}

async function requestApiEnvelope<T>({
  token,
  path,
  options = {},
}: {
  token?: string;
  path: string;
  options?: ApiRequestConfig;
}): Promise<ApiEnvelope<T>> {
  const {
    errorCodeMessages,
    fallbackMessage,
    skipContentType,
    skipUnauthorizedHandler,
    timeoutMs,
    body,
    headers,
    ...fetchOptions
  } = options;

  let res: Response;
  const url = requestUrl(path);
  const method = fetchOptions.method ?? "GET";

  debugLog("[API] request", {
    method,
    url,
    path,
    hasBody: body != null,
  });

  try {
    res = await fetchWithTimeout(
      url,
      {
        ...fetchOptions,
        headers: requestHeaders({ token, headers, skipContentType }),
        body: requestBody(body),
      },
      timeoutMs,
    );
  } catch (error) {
    debugLog("[API] catch", {
      url,
      path,
      ...safeErrorInfo(error),
    });

    throw networkApiError(error, fallbackMessage);
  }

  const json = await readJson(res);

  debugLog("[API] response", {
    status: res.status,
    ok: res.ok,
    path,
    ...sanitizeApiBody(json),
  });

  const success = isRecord(json) ? json.success : undefined;
  const data = normalizeApiData<T>(json);

  if (!res.ok || success === false) {
    if (!skipUnauthorizedHandler) {
      handleUnauthorizedResponse(res.status);
    }

    const code = isRecord(json)
      ? firstString(json.code, json.error_code, (json.data as { code?: unknown })?.code)
      : null;
    const message =
      (code && errorCodeMessages?.[code]) ||
      (isRecord(json) ? firstString(json.message, json.error) : null) ||
      fallbackMessage ||
      "Something went wrong. Please try again.";

    throw new ApiError({
      message,
      status: res.status,
      code: code ?? undefined,
      errors: isRecord(json) ? normalizeFieldErrors(json.errors) : undefined,
      raw: json,
    });
  }

  return {
    success: success === undefined ? res.ok : Boolean(success),
    message:
      (isRecord(json) ? firstString(json.message) : null) ??
      fallbackMessage ??
      "OK",
    data,
    errors: isRecord(json) ? normalizeFieldErrors(json.errors) : undefined,
    raw: json,
    status: res.status,
  };
}

export async function apiRequest<T>(
  token: string,
  path: string,
  options: ApiRequestConfig = {},
): Promise<T> {
  const envelope = await requestApiEnvelope<T>({ token, path, options });

  return envelope.data as T;
}

export function apiRequestEnvelope<T>(
  token: string,
  path: string,
  options: ApiRequestConfig = {},
): Promise<ApiEnvelope<T>> {
  return requestApiEnvelope<T>({ token, path, options });
}

export async function publicApiRequest<T>(
  path: string,
  options: ApiRequestConfig = {},
): Promise<T> {
  const envelope = await requestApiEnvelope<T>({
    path,
    options: {
      ...options,
      skipUnauthorizedHandler: options.skipUnauthorizedHandler ?? true,
    },
  });

  return envelope.data as T;
}

export function publicApiEnvelope<T>(
  path: string,
  options: ApiRequestConfig = {},
): Promise<ApiEnvelope<T>> {
  return requestApiEnvelope<T>({
    path,
    options: {
      ...options,
      skipUnauthorizedHandler: options.skipUnauthorizedHandler ?? true,
    },
  });
}

export async function apiRequestWithFallback<T>(
  token: string,
  paths: string[],
  options: ApiRequestConfig = {},
) {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      return await apiRequest<T>(token, path, options);
    } catch (error) {
      lastError = error;

      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError;
}
