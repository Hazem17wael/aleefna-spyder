import React, { useEffect, useState } from "react";
import {
  Platform,
  StyleSheet,
  View,
} from "react-native";

import { SocialButton } from "@/components/auth/AuthComponents";
import { useAuth } from "@/context/AuthContext";
import {
  getAppleSocialCredentials,
  getGoogleSocialCredentials,
  isAppleSignInAvailable,
  type SocialCredentials,
} from "@/services/socialAuth";
import { friendlyErrorMessage } from "@/utils/userMessages";

type SocialAuthButtonsProps = {
  mode: "login" | "register";
  disabled?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  onError: (message: string) => void;
  onSuccess: () => void;
};

type LoadingProvider = SocialCredentials["provider"] | null;

function tokenDebug(token?: string | null) {
  return {
    hasToken: Boolean(token),
    tokenLength: typeof token === "string" ? token.length : 0,
  };
}

function safeErrorInfo(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: typeof error === "string" ? error : undefined };
  }

  const record = error as Record<string, unknown>;

  return {
    name: typeof record.name === "string" ? record.name : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
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

export function SocialAuthButtons({
  disabled = false,
  onLoadingChange,
  onError,
  onSuccess,
}: SocialAuthButtonsProps) {
  const { socialLogin } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<LoadingProvider>(null);

  useEffect(() => {
    let mounted = true;

    isAppleSignInAvailable()
      .then((available) => {
        if (mounted) setAppleAvailable(available);
      })
      .catch(() => {
        if (mounted) setAppleAvailable(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const busy = disabled || loadingProvider !== null;
  const showGoogle = Platform.OS === "ios" || Platform.OS === "android";
  const showApple = Platform.OS === "ios" && appleAvailable;

  useEffect(() => {
    onLoadingChange?.(loadingProvider !== null);
  }, [loadingProvider, onLoadingChange]);

  async function completeSocialLogin(credentials: SocialCredentials) {
    setLoadingProvider(credentials.provider);
    onError("");

    const googleToken =
      credentials.provider === "google" ? credentials.id_token : undefined;
    const appleToken =
      credentials.provider === "apple" ? credentials.identity_token : undefined;
    const googleDebug = tokenDebug(googleToken);
    const appleDebug = tokenDebug(appleToken);

    debugLog("[SocialLogin] sending", {
      provider: credentials.provider,
      hasGoogleToken: googleDebug.hasToken,
      googleTokenLength: googleDebug.tokenLength,
      hasAppleToken: appleDebug.hasToken,
      appleTokenLength: appleDebug.tokenLength,
    });

    const result = await socialLogin(credentials);
    const hasReturnedUser = Boolean(result.user);

    debugLog("[SocialLogin] result", {
      success: result.success,
      message: result.message,
      hasData: hasReturnedUser,
      hasSession: result.success && hasReturnedUser,
      hasToken: result.success && hasReturnedUser,
    });

    if (!result.success) {
      onError(
        friendlyErrorMessage(
          result.message,
          "Social sign in failed. Please try again.",
        ),
      );
      return;
    }

    onSuccess();
  }

  async function handleGooglePress() {
    if (busy) return;

    debugLog("[Google] pressed");
    setLoadingProvider("google");

    try {
      const credentials = await getGoogleSocialCredentials();

      if (credentials) {
        const idTokenDebug = tokenDebug(credentials.id_token);

        debugLog("[Google] credentials", {
          provider: credentials.provider,
          hasIdToken: idTokenDebug.hasToken,
          idTokenLength: idTokenDebug.tokenLength,
        });

        await completeSocialLogin(credentials);
      }
    } catch (error) {
      debugLog("[Google] error", safeErrorInfo(error));
      onError(
        error instanceof Error
          ? error.message
          : "Google sign in could not be completed. Please try again.",
      );
    } finally {
      setLoadingProvider(null);
    }
  }

  async function handleApplePress() {
    if (busy) return;

    debugLog("[Apple] pressed");
    setLoadingProvider("apple");

    try {
      const credentials = await getAppleSocialCredentials();

      if (credentials) {
        const identityTokenDebug = tokenDebug(credentials.identity_token);

        debugLog("[Apple] credentials", {
          provider: credentials.provider,
          hasIdentityToken: identityTokenDebug.hasToken,
          identityTokenLength: identityTokenDebug.tokenLength,
          hasAuthorizationCode: Boolean(credentials.authorization_code),
        });

        await completeSocialLogin(credentials);
      }
    } catch (error) {
      debugLog("[Apple] error", safeErrorInfo(error));
      onError(
        error instanceof Error
          ? error.message
          : "Apple sign in could not be completed. Please try again.",
      );
    } finally {
      setLoadingProvider(null);
    }
  }

  if (!showGoogle && !showApple) return null;

  return (
    <View style={styles.container}>
      {showApple && (
        <SocialButton
          provider="apple"
          label="Continue with Apple"
          loading={loadingProvider === "apple"}
          disabled={busy}
          onPress={handleApplePress}
        />
      )}

      {showGoogle && (
        <SocialButton
          provider="google"
          label="Continue with Google"
          loading={loadingProvider === "google"}
          disabled={busy}
          onPress={handleGooglePress}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
});
