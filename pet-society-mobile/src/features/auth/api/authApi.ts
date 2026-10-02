import {
  ApiError,
  apiRequestEnvelope,
  getApiErrorMessage,
  getApiValidationErrors,
  publicApiEnvelope,
  type ApiEnvelope,
} from "@/services/apiClient";
import type { FieldErrors } from "@/types/adoption";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profile_image: string | null;
  email_verified_at: string | null;
  created_at?: string | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  phone?: string;
};

export type SocialLoginRequest =
  | {
      provider: "google";
      id_token: string;
    }
  | {
      provider: "apple";
      identity_token: string;
      authorization_code?: string;
      full_name?: string;
    };

export type AuthSessionData = {
  user?: AuthUser | null;
  token?: string | null;
  requires_verification?: boolean;
};

export type ProfileData = {
  user?: AuthUser | null;
};

export type ForgotOtpData = {
  reset_token?: string | null;
  resetToken?: string | null;
};

function tokenDebug(token?: string | null) {
  return {
    hasToken: Boolean(token),
    tokenLength: typeof token === "string" ? token.length : 0,
  };
}

function debugLog(label: string, details: Record<string, unknown>) {
  if (!__DEV__) return;

  console.log(label, details);
}

export function getAuthErrorMessage(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback);
}

export function getAuthValidationErrors(error: unknown): FieldErrors {
  return getApiValidationErrors(error);
}

export function isAuthUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function loginRequest(
  payload: LoginRequest,
): Promise<ApiEnvelope<AuthSessionData>> {
  return publicApiEnvelope<AuthSessionData>("/api/auth/login", {
    method: "POST",
    body: {
      email: payload.email.trim(),
      password: payload.password,
    },
    fallbackMessage: "Email or password is incorrect.",
  });
}

export function registerRequest(
  payload: RegisterRequest,
): Promise<ApiEnvelope<unknown>> {
  return publicApiEnvelope<unknown>("/api/auth/register", {
    method: "POST",
    body: payload,
    fallbackMessage: "Registration failed. Please try again.",
  });
}

export function socialLoginRequest(
  payload: SocialLoginRequest,
): Promise<ApiEnvelope<AuthSessionData>> {
  const googleToken =
    payload.provider === "google" ? payload.id_token : undefined;
  const appleToken =
    payload.provider === "apple" ? payload.identity_token : undefined;
  const authorizationCode =
    payload.provider === "apple" ? payload.authorization_code : undefined;
  const googleTokenDebug = tokenDebug(googleToken);
  const appleTokenDebug = tokenDebug(appleToken);
  const authorizationCodeDebug = tokenDebug(authorizationCode);

  debugLog("[SocialLoginRequest] payload", {
    provider: payload.provider,
    hasIdToken: googleTokenDebug.hasToken,
    idTokenLength: googleTokenDebug.tokenLength,
    hasIdentityToken: appleTokenDebug.hasToken,
    identityTokenLength: appleTokenDebug.tokenLength,
    hasAuthorizationCode: authorizationCodeDebug.hasToken,
    authorizationCodeLength: authorizationCodeDebug.tokenLength,
  });

  return publicApiEnvelope<AuthSessionData>("/api/auth/social", {
    method: "POST",
    body: payload,
    fallbackMessage: "Social sign in failed. Please try again.",
  });
}

export function verifyOtpRequest(params: {
  email: string;
  otp: string;
}): Promise<ApiEnvelope<AuthSessionData>> {
  return publicApiEnvelope<AuthSessionData>("/api/auth/verify-otp", {
    method: "POST",
    body: params,
    fallbackMessage: "That code was not accepted. Please try again.",
  });
}

export function resendOtpRequest(email: string): Promise<ApiEnvelope<unknown>> {
  return publicApiEnvelope<unknown>("/api/auth/resend-otp", {
    method: "POST",
    body: { email },
    fallbackMessage: "We could not resend the code. Please try again.",
  });
}

export function forgotPasswordRequest(
  email: string,
): Promise<ApiEnvelope<unknown>> {
  return publicApiEnvelope<unknown>("/api/auth/forget-password", {
    method: "POST",
    body: { email },
    fallbackMessage: "We could not send a reset code. Please try again.",
  });
}

export function verifyForgotOtpRequest(params: {
  email: string;
  otp: string;
}): Promise<ApiEnvelope<ForgotOtpData>> {
  return publicApiEnvelope<ForgotOtpData>("/api/auth/verify-forget-otp", {
    method: "POST",
    body: params,
    fallbackMessage: "That code was not accepted. Please try again.",
  });
}

export function resetPasswordRequest(params: {
  email: string;
  password: string;
  resetToken: string;
}): Promise<ApiEnvelope<unknown>> {
  return publicApiEnvelope<unknown>("/api/auth/reset-password", {
    method: "POST",
    body: {
      email: params.email,
      password: params.password,
      password_confirmation: params.password,
      reset_token: params.resetToken,
    },
    fallbackMessage: "We could not reset your password. Please try again.",
  });
}

export function getProfileRequest(
  token: string,
): Promise<ApiEnvelope<ProfileData>> {
  return apiRequestEnvelope<ProfileData>(token, "/api/auth/profile", {
    method: "GET",
    fallbackMessage: "We could not refresh your profile.",
  });
}

export function updateProfileRequest(
  token: string,
  data: Partial<AuthUser>,
): Promise<ApiEnvelope<ProfileData>> {
  return apiRequestEnvelope<ProfileData>(token, "/api/auth/update-profile", {
    method: "PUT",
    body: data,
    fallbackMessage: "We could not update your profile. Please try again.",
  });
}

export function logoutRequest(token: string): Promise<ApiEnvelope<unknown>> {
  return apiRequestEnvelope<unknown>(token, "/api/auth/logout", {
    method: "POST",
    fallbackMessage: "Logout request failed.",
  });
}
