import React, { useState } from "react";
import { Text, View } from "react-native";
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
  firstValidationMessage,
  friendlyErrorMessage,
} from "@/utils/userMessages";

type FieldErrors = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getBackendFieldErrors(errors: any): FieldErrors {
  if (!errors || typeof errors !== "object") return {};

  return {
    name: Array.isArray(errors.name)
      ? friendlyErrorMessage(errors.name[0], VALIDATION_ERROR_MESSAGE)
      : undefined,
    email: Array.isArray(errors.email)
      ? friendlyErrorMessage(errors.email[0], VALIDATION_ERROR_MESSAGE)
      : undefined,
    phone: Array.isArray(errors.phone)
      ? friendlyErrorMessage(errors.phone[0], VALIDATION_ERROR_MESSAGE)
      : undefined,
    password: Array.isArray(errors.password)
      ? friendlyErrorMessage(errors.password[0], VALIDATION_ERROR_MESSAGE)
      : undefined,
  };
}

export default function RegisterScreen() {
  const colors = useColors();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [strength, setStrength] = useState(0);

  const busy = loading || socialLoading;
  const isPasswordStrong = strength >= 3;
  const strengthConfig = [
    { label: "Very weak", color: "#ef4444" },
    { label: "Weak", color: "#f59e0b" },
    { label: "Medium", color: "#f59e0b" },
    { label: "Strong", color: "#3b82f6" },
    { label: "Very strong", color: "#22c55e" },
  ];

  function checkPasswordStrength(pass: string) {
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  }

  async function handleRegister() {
    if (loading) return;

    const nextErrors: FieldErrors = {};

    if (!name.trim()) {
      nextErrors.name = "Name is required.";
    }

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    } else if (!isPasswordStrong) {
      nextErrors.password = "Use uppercase letters, numbers, and symbols.";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirm your password.";
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError(VALIDATION_ERROR_MESSAGE);
      return;
    }

    setError("");
    setFieldErrors({});
    setLoading(true);

    const result = await register(
      name.trim(),
      email.trim(),
      password,
      phone.trim() || undefined,
    );

    setLoading(false);

    if (result.success) {
      router.replace("/verify-otp");
    } else {
      const backendErrors = getBackendFieldErrors(result.errors);
      const validationMessage = firstValidationMessage(result.errors);

      setFieldErrors(backendErrors);
      setError(
        validationMessage ||
        friendlyErrorMessage(
          result.message,
          "Registration failed. Please try again.",
        ),
      );
    }
  }

  return (
    <AuthLayout loading={busy}>
      <AuthHeader
        title="Create your account"
        subtitle="Join Aleefna and start building your pet profile."
      />

      <AuthCard>
        <AuthInput
          accessibilityLabel="Full name"
          autoCapitalize="words"
          error={fieldErrors.name}
          icon="user"
          label="Full name"
          onChangeText={(value) => {
            setName(value);
            setFieldErrors((prev) => ({ ...prev, name: undefined }));
            setError("");
          }}
          placeholder="Enter your full name"
          textContentType="name"
          value={name}
        />

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

        <AuthInput
          accessibilityLabel="Phone number"
          error={fieldErrors.phone}
          icon="phone"
          keyboardType="phone-pad"
          label="Phone number (optional)"
          onChangeText={(value) => {
            setPhone(value);
            setFieldErrors((prev) => ({ ...prev, phone: undefined }));
            setError("");
          }}
          placeholder="+20 100 000 0000"
          textContentType="telephoneNumber"
          value={phone}
        />

        <View style={{ gap: 8 }}>
          <PasswordInput
            accessibilityLabel="Password"
            error={fieldErrors.password}
            label="Password"
            onChangeText={(value) => {
              setPassword(value);
              setStrength(checkPasswordStrength(value));
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
              setError("");
            }}
            placeholder="At least 8 characters"
            textContentType="newPassword"
            value={password}
          />
          {password.length > 0 ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={{
                      backgroundColor:
                        i < strength ? strengthConfig[strength].color : colors.border,
                      borderRadius: 999,
                      flex: 1,
                      height: 4,
                    }}
                  />
                ))}
              </View>
              <Text
                style={{
                  color: strengthConfig[strength].color,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {strengthConfig[strength].label}
              </Text>
            </View>
          ) : null}
        </View>

        <PasswordInput
          accessibilityLabel="Confirm password"
          error={fieldErrors.confirmPassword}
          label="Confirm password"
          onChangeText={(value) => {
            setConfirmPassword(value);
            setFieldErrors((prev) => ({
              ...prev,
              confirmPassword: undefined,
            }));
            setError("");
          }}
          placeholder="Re-enter your password"
          textContentType="newPassword"
          value={confirmPassword}
        />

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
          accessibilityLabel="Create account"
          disabled={busy}
          loading={loading}
          onPress={handleRegister}
          title="Create Account"
        />

        <DividerWithText text="or" />

        <SocialAuthButtons
          mode="register"
          disabled={loading}
          onError={setError}
          onLoadingChange={setSocialLoading}
          onSuccess={() => router.replace("/(tabs)")}
        />
      </AuthCard>

      <AuthFooterLink
        actionText="Sign in"
        onPress={() => router.back()}
        text="Already have an account?"
      />
      <TermsText prefix="By creating an account, you agree to our" />
    </AuthLayout>
  );
}
