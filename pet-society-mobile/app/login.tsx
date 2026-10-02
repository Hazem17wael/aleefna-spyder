import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

import {
  AuthCard,
  AuthFooterLink,
  AuthHeader,
  AuthInput,
  AuthLayout,
  DividerWithText,
  PasswordInput,
  PrimaryButton,
  TermsText,
} from "@/components/auth/AuthComponents";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  VALIDATION_ERROR_MESSAGE,
  friendlyErrorMessage,
} from "@/utils/userMessages";

type FieldErrors = {
  email?: string;
  password?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function LoginScreen() {
  const colors = useColors();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  const busy = loading || socialLoading;

  async function handleLogin() {
    if (loading) return;

    const nextErrors: FieldErrors = {};

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError(VALIDATION_ERROR_MESSAGE);
      return;
    }

    setError("");
    setFieldErrors({});
    setLoading(true);

    const result = await login(email.trim(), password);

    setLoading(false);

    if (!result.success && !result.needsOtp) {
      setError(friendlyErrorMessage(result.message, "Login failed. Please try again."));
      return;
    }

    if (result.needsOtp) {
      router.replace({
        pathname: "/verify-otp",
        params: { email: email.trim() },
      });
      return;
    }

    if (result.success) {
      router.replace("/(tabs)");
    }
  }

  return (
    <AuthLayout loading={busy}>
      <AuthHeader
        title="Welcome back"
        subtitle="Sign in to continue caring for your pets."
      />

      <AuthCard>
        <AuthInput
          accessibilityLabel="Email address"
          autoCapitalize="none"
          error={fieldErrors.email}
          icon="mail"
          keyboardType="email-address"
          label="Email"
          onChangeText={(value) => {
            setEmail(value);
            setFieldErrors((prev) => ({ ...prev, email: undefined }));
            setError("");
          }}
          placeholder="you@example.com"
          textContentType="emailAddress"
          value={email}
        />

        <PasswordInput
          accessibilityLabel="Password"
          error={fieldErrors.password}
          label="Password"
          onChangeText={(value) => {
            setPassword(value);
            setFieldErrors((prev) => ({ ...prev, password: undefined }));
            setError("");
          }}
          placeholder="Enter your password"
          textContentType="password"
          value={password}
        />

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.75}
          onPress={() => router.push("/forgot-password")}
          style={{ alignSelf: "flex-end", minHeight: 36, justifyContent: "center" }}
        >
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "800" }}>
            Forgot password?
          </Text>
        </TouchableOpacity>

        {error ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: `${colors.destructive}12`,
              borderColor: `${colors.destructive}28`,
              borderRadius: 16,
              borderWidth: 1,
              flexDirection: "row",
              gap: 10,
              padding: 13,
            }}
          >
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text
              style={{
                color: colors.destructive,
                flex: 1,
                fontSize: 13,
                fontWeight: "700",
                lineHeight: 18,
              }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        <PrimaryButton
          accessibilityLabel="Sign in"
          disabled={busy}
          loading={loading}
          onPress={handleLogin}
          title="Sign In"
        />

        <DividerWithText text="or" />

        <SocialAuthButtons
          mode="login"
          disabled={loading}
          onError={setError}
          onLoadingChange={setSocialLoading}
          onSuccess={() => router.replace("/(tabs)")}
        />
      </AuthCard>

      <AuthFooterLink
        actionText="Create account"
        onPress={() => router.push("/register")}
        text="New to Aleefna?"
      />
      <TermsText />
    </AuthLayout>
  );
}
