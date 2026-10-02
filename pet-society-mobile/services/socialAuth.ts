import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

export type GoogleSocialCredentials = {
  provider: "google";
  id_token: string;
};

export type AppleSocialCredentials = {
  provider: "apple";
  identity_token: string;
  authorization_code?: string;
  full_name?: string;
};

export type SocialCredentials = GoogleSocialCredentials | AppleSocialCredentials;

let googleConfigured = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function tokenDebug(token?: string | null) {
  return {
    hasToken: Boolean(token),
    tokenLength: typeof token === "string" ? token.length : 0,
  };
}

function safeErrorInfo(error: unknown) {
  if (!isRecord(error)) {
    return { message: typeof error === "string" ? error : undefined };
  }

  return {
    name: typeof error.name === "string" ? error.name : undefined,
    message: typeof error.message === "string" ? error.message : undefined,
    code: typeof error.code === "string" ? error.code : undefined,
    statusCode:
      typeof error.statusCode === "string" ||
      typeof error.statusCode === "number"
        ? error.statusCode
        : undefined,
    isDeveloperError:
      error.code === "DEVELOPER_ERROR" || error.statusCode === "DEVELOPER_ERROR",
    isSignInCancelled:
      error.code === statusCodes.SIGN_IN_CANCELLED ||
      error.statusCode === statusCodes.SIGN_IN_CANCELLED,
    isPlayServicesNotAvailable:
      error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE ||
      error.statusCode === statusCodes.PLAY_SERVICES_NOT_AVAILABLE,
  };
}

function debugLog(label: string, details?: Record<string, unknown>) {
  if (!__DEV__) return;

  if (details) {
    console.log(label, details);
  } else {
    console.log(label);
  }
}

function configureGoogleSignIn() {
  if (googleConfigured) return;

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  GoogleSignin.configure({
    webClientId,
    iosClientId,
    offlineAccess: false,
    scopes: ["profile", "email"],
  });

  googleConfigured = true;
}

function formatAppleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
) {
  if (!fullName) return undefined;

  const name = [
    fullName.givenName,
    fullName.middleName,
    fullName.familyName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || undefined;
}

export async function isAppleSignInAvailable() {
  if (Platform.OS !== "ios") return false;

  return AppleAuthentication.isAvailableAsync();
}

export async function getGoogleSocialCredentials(): Promise<GoogleSocialCredentials | null> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new Error("Google sign in is available on iOS and Android builds.");
  }

  if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
    throw new Error("Google sign in is not configured for this build.");
  }

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  debugLog("[GoogleSignIn] config", {
    hasWebClientId: Boolean(webClientId),
    webClientIdSuffix: webClientId ? webClientId.slice(-12) : undefined,
    hasIosClientId: Boolean(iosClientId),
    platform: Platform.OS,
  });

  configureGoogleSignIn();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    debugLog("[GoogleSignIn] play services ok");

    const response = await GoogleSignin.signIn();
    const idToken =
      isRecord(response) &&
      isRecord(response.data) &&
      typeof response.data.idToken === "string"
        ? response.data.idToken
        : undefined;
    const idTokenDebug = tokenDebug(idToken);

    debugLog("[GoogleSignIn] raw response", {
      responseType: isRecord(response) ? response.type : undefined,
      isSuccess: isSuccessResponse(response),
      hasData: isRecord(response) && Boolean(response.data),
      hasIdToken: idTokenDebug.hasToken,
      idTokenLength: idTokenDebug.tokenLength,
    });

    if (isCancelledResponse(response)) {
      return null;
    }

    if (!isSuccessResponse(response) || !response.data.idToken) {
      throw new Error("Google sign in could not be completed. Please try again.");
    }

    return {
      provider: "google",
      id_token: response.data.idToken,
    };
  } catch (error) {
    debugLog("[GoogleSignIn] catch", safeErrorInfo(error));

    if (
      isErrorWithCode(error) &&
      error.code === statusCodes.SIGN_IN_CANCELLED
    ) {
      return null;
    }

    if (
      isErrorWithCode(error) &&
      error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
    ) {
      throw new Error("Google Play Services is unavailable or needs an update.");
    }

    throw new Error("Google sign in could not be completed. Please try again.");
  }
}

export async function getAppleSocialCredentials(): Promise<AppleSocialCredentials | null> {
  if (Platform.OS !== "ios") {
    throw new Error("Apple sign in is available on iOS builds.");
  }

  const available = await AppleAuthentication.isAvailableAsync();

  debugLog("[AppleSignIn] start", {
    platform: Platform.OS,
    available,
  });

  if (!available) {
    throw new Error("Apple sign in is not available on this device.");
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const identityTokenDebug = tokenDebug(credential.identityToken);

    debugLog("[AppleSignIn] raw response", {
      hasIdentityToken: identityTokenDebug.hasToken,
      identityTokenLength: identityTokenDebug.tokenLength,
      hasAuthorizationCode: Boolean(credential.authorizationCode),
      hasFullName: Boolean(formatAppleFullName(credential.fullName)),
    });

    if (!credential.identityToken) {
      throw new Error("Apple sign in could not be completed. Please try again.");
    }

    return {
      provider: "apple",
      identity_token: credential.identityToken,
      authorization_code: credential.authorizationCode ?? undefined,
      full_name: formatAppleFullName(credential.fullName),
    };
  } catch (error) {
    debugLog("[AppleSignIn] catch", safeErrorInfo(error));

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ERR_REQUEST_CANCELED"
    ) {
      return null;
    }

    throw new Error("Apple sign in could not be completed. Please try again.");
  }
}
