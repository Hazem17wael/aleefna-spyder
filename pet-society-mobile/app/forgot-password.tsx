import React, { useEffect, useRef, useMemo, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { OtpInput } from "@/components/OtpInput";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  VALIDATION_ERROR_MESSAGE,
  friendlyErrorMessage,
} from "@/utils/userMessages";

type Step = "email" | "otp" | "password";

type FieldErrors = {
  email?: string;
  otp?: string;
  password?: string;
  confirmPassword?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function maskEmail(value: string) {
  const [name, domain] = value.trim().split("@");

  if (!name || !domain) return value;

  return `${name.slice(0, 2)}${name.length > 2 ? "***" : "*"}@${domain}`;
}

function stepIndex(step: Step) {
  if (step === "email") return 0;
  if (step === "otp") return 1;
  return 2;
}

function useForgotPasswordFlow() {
  const { forgotPassword, verifyForgotOtp, resetPassword } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState(false);

  const copy = useMemo(() => {
    if (step === "email") {
      return {
        title: "Forgot Password?",
        subtitle: "Enter your email and we'll send you a verification code.",
        icon: "mail" as const,
      };
    }

    if (step === "otp") {
      return {
        title: "Verify Code",
        subtitle: `Enter the 6-digit code sent to ${maskEmail(email)}.`,
        icon: "shield" as const,
      };
    }

    return {
      title: "Reset Password",
      subtitle: "Create a new password for your account.",
      icon: "lock" as const,
    };
  }, [email, step]);

  function clearFeedback(field?: keyof FieldErrors) {
    setError("");
    setNotice("");
    if (field) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validateEmailStep() {
    const next: FieldErrors = {};

    if (!email.trim()) {
      next.email = "Email is required.";
    } else if (!isValidEmail(email)) {
      next.email = "Enter a valid email address.";
    }

    setFieldErrors((prev) => ({ ...prev, ...next }));

    if (Object.keys(next).length > 0) {
      setError(VALIDATION_ERROR_MESSAGE);
      return false;
    }

    return true;
  }

  function validateOtpStep() {
    const next: FieldErrors = {};

    if (!otp.trim()) {
      next.otp = "Verification code is required.";
    } else if (otp.trim().length !== 6) {
      next.otp = "Enter the 6-digit code.";
    }

    setFieldErrors((prev) => ({ ...prev, ...next }));

    if (Object.keys(next).length > 0) {
      setError(VALIDATION_ERROR_MESSAGE);
      return false;
    }

    return true;
  }

  function validatePasswordStep() {
    const next: FieldErrors = {};

    if (!password) {
      next.password = "Password is required.";
    } else if (password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }

    if (!confirmPassword) {
      next.confirmPassword = "Confirm your password.";
    } else if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }

    setFieldErrors((prev) => ({ ...prev, ...next }));

    if (Object.keys(next).length > 0) {
      setError(VALIDATION_ERROR_MESSAGE);
      return false;
    }

    return true;
  }

  async function sendCode({ resend = false } = {}) {
    if (loading) return;
    if (!validateEmailStep()) return;

    clearFeedback();
    setLoading(true);

    try {
      const result = await forgotPassword(email.trim());

      if (!result.success) {
        setError(
          friendlyErrorMessage(
            result.message,
            "We could not send a reset code. Please try again.",
          ),
        );
        return;
      }

      setOtp("");
      setStep("otp");
      setNotice(resend ? "A new code was sent." : "Verification code sent.");
    } catch (err: any) {
      setError(friendlyErrorMessage(err?.message));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (loading) return;
    if (!validateOtpStep()) return;

    clearFeedback();
    setLoading(true);

    try {
      const result = await verifyForgotOtp(email.trim(), otp.trim());

      if (!result.success) {
        setError(
          friendlyErrorMessage(
            result.message,
            "That code was not accepted. Please try again.",
          ),
        );
        return;
      }

      setResetToken(result.resetToken || "");
      setStep("password");
      setNotice("Code verified.");
    } catch (err: any) {
      setError(friendlyErrorMessage(err?.message));
    } finally {
      setLoading(false);
    }
  }

  async function submitNewPassword() {
    if (loading) return;
    if (!validatePasswordStep()) return;

    if (!resetToken) {
      setError("Please verify the code again before resetting your password.");
      return;
    }

    clearFeedback();
    setLoading(true);

    try {
      const result = await resetPassword(email.trim(), password, resetToken);

      if (!result.success) {
        setError(
          friendlyErrorMessage(
            result.message,
            "We could not reset your password. Please try again.",
          ),
        );
        return;
      }

      setSuccess(true);
      setTimeout(() => router.replace("/login"), 1200);
    } catch (err: any) {
      setError(friendlyErrorMessage(err?.message));
    } finally {
      setLoading(false);
    }
  }

  return {
    step,
    copy,
    email,
    setEmail: (value: string) => {
      setEmail(value);
      clearFeedback("email");
    },
    otp,
    setOtp: (value: string) => {
      setOtp(value.replace(/\D/g, "").slice(0, 6));
      clearFeedback("otp");
    },
    password,
    setPassword: (value: string) => {
      setPassword(value);
      clearFeedback("password");
    },
    confirmPassword,
    setConfirmPassword: (value: string) => {
      setConfirmPassword(value);
      clearFeedback("confirmPassword");
    },
    loading,
    error,
    notice,
    fieldErrors,
    success,
    sendCode,
    verifyCode,
    submitNewPassword,
  };
}

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    step,
    copy,
    email,
    setEmail,
    otp,
    setOtp,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    loading,
    error,
    notice,
    fieldErrors,
    success,
    sendCode,
    verifyCode,
    submitNewPassword,
  } = useForgotPasswordFlow();

  const topPad = Platform.OS === "web" ? 52 : insets.top;
  const bottomPad = Platform.OS === "web" ? 30 : insets.bottom + 28;
  const stepAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    stepAnim.setValue(0);
    Animated.timing(stepAnim, {
      toValue: 1,
      duration: 190,
      useNativeDriver: true,
    }).start();
  }, [step, stepAnim]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 14, paddingBottom: bottomPad },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.84}
          style={[
            styles.backButton,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + "16" }]}>
            <Feather name={copy.icon} size={28} color={colors.primary} />
          </View>

          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {copy.title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {copy.subtitle}
            </Text>
          </View>

          <View style={styles.steps}>
            {(["email", "otp", "password"] as Step[]).map((item) => {
              const active = stepIndex(item) <= stepIndex(step);

              return (
                <View
                  key={item}
                  style={[
                    styles.stepSegment,
                    { backgroundColor: active ? colors.primary : colors.border },
                  ]}
                />
              );
            })}
          </View>

          {success ? (
            <View style={[styles.messageBox, { backgroundColor: colors.success + "14" }]}>
              <Feather name="check-circle" size={17} color={colors.success} />
              <Text style={[styles.messageText, { color: colors.success }]}>
                Password reset successful. Redirecting to login...
              </Text>
            </View>
          ) : (
            <>
              <Animated.View
                style={[
                  styles.stepBody,
                  {
                    opacity: stepAnim,
                    transform: [
                      {
                        translateX: stepAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [12, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
              {step === "email" ? (
                <>
                  <Input
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    leftIcon="mail"
                    error={fieldErrors.email}
                    editable={!loading}
                  />
                  <Button
                    title="Send Code"
                    onPress={() => sendCode()}
                    loading={loading}
                    disabled={loading}
                  />
                </>
              ) : null}

              {step === "otp" ? (
                <>
                  <View style={styles.otpField}>
                    <Text style={[styles.otpLabel, { color: colors.foreground }]}>
                      Verification code
                    </Text>
                    <OtpInput
                      value={otp}
                      onChangeText={setOtp}
                      error={Boolean(fieldErrors.otp)}
                      editable={!loading}
                    />
                    {fieldErrors.otp ? (
                      <Text
                        style={[
                          styles.otpError,
                          { color: colors.destructive },
                        ]}
                      >
                        {fieldErrors.otp}
                      </Text>
                    ) : null}
                  </View>
                  <Button
                    title="Verify Code"
                    onPress={verifyCode}
                    loading={loading}
                    disabled={loading}
                  />
                  <TouchableOpacity
                    onPress={() => sendCode({ resend: true })}
                    disabled={loading}
                    activeOpacity={0.78}
                    style={styles.secondaryAction}
                  >
                    <Text style={[styles.secondaryActionText, { color: colors.primary }]}>
                      Resend code
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {step === "password" ? (
                <>
                  <Input
                    label="New password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="At least 8 characters"
                    isPassword
                    leftIcon="lock"
                    error={fieldErrors.password}
                    editable={!loading}
                  />
                  <Input
                    label="Confirm password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter password"
                    isPassword
                    leftIcon="lock"
                    error={fieldErrors.confirmPassword}
                    editable={!loading}
                  />
                  <Button
                    title="Reset Password"
                    onPress={submitNewPassword}
                    loading={loading}
                    disabled={loading}
                  />
                </>
              ) : null}
              </Animated.View>

              {notice ? (
                <View style={[styles.messageBox, { backgroundColor: colors.success + "14" }]}>
                  <Feather name="check-circle" size={17} color={colors.success} />
                  <Text style={[styles.messageText, { color: colors.success }]}>
                    {notice}
                  </Text>
                </View>
              ) : null}

              {error ? (
                <View
                  style={[
                    styles.messageBox,
                    { backgroundColor: colors.destructive + "14" },
                  ]}
                >
                  <Feather name="alert-circle" size={17} color={colors.destructive} />
                  <Text style={[styles.messageText, { color: colors.destructive }]}>
                    {error}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        <TouchableOpacity onPress={() => router.replace("/login")} activeOpacity={0.78}>
          <Text style={[styles.loginLink, { color: colors.primary }]}>
            Back to Login
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 18,
    gap: 16,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    gap: 7,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  steps: {
    flexDirection: "row",
    gap: 8,
  },
  stepSegment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
  },
  stepBody: {
    gap: 16,
  },
  secondaryAction: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  otpField: {
    gap: 8,
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  otpError: {
    fontSize: 12,
    fontWeight: "500",
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: "900",
  },
  messageBox: {
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  loginLink: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "900",
  },
});
