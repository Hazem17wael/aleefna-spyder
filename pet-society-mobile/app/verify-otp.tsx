import React, { useState, useEffect } from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/Button";
import { OtpInput } from "@/components/OtpInput";
import { friendlyErrorMessage } from "@/utils/userMessages";
import { deleteTempEmail } from "@/services/authStorage";

export default function VerifyOtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { verifyOtp, resendOtp, user } = useAuth();

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const errorAnim = React.useRef(new Animated.Value(0)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Animated.timing(errorAnim, {
      toValue: error ? 1 : 0,
      duration: 170,
      useNativeDriver: true,
    }).start();
  }, [error, errorAnim]);

  function handleOtpChange(value: string) {
    setOtp(value);
    setError("");
  }

  async function handleVerify() {
    if (loading) return;

    const code = otp;

    if (code.length < 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    setError("");
    setLoading(true);

    const result = await verifyOtp(code);

    setLoading(false);

    if (!result.success) {
      setError(
        friendlyErrorMessage(
          result.message,
          "That code was not accepted. Please try again.",
        ),
      );
      setOtp("");
      return;
    }

    await deleteTempEmail();
    router.replace("/(tabs)");
  }

  async function handleResend() {
    if (resendLoading) return;

    setResendLoading(true);
    const result = await resendOtp();
    setResendLoading(false);
    if (result.success) {
      setCountdown(60);
      setOtp("");
      setError("");
    } else {
      setError(
        friendlyErrorMessage(
          result.message,
          "We could not resend the code. Please try again.",
        ),
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.container,
          { paddingTop: topPad + 16, paddingBottom: bottomPad + 24 },
        ]}
      >
        <View style={styles.content}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.muted }]}
          >
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>

          <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="mail" size={36} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>
            Verify Email
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            We sent a 6-digit code to{"\n"}
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>
              {user?.email ?? "your email"}
            </Text>
          </Text>

          <OtpInput
            value={otp}
            onChangeText={handleOtpChange}
            error={Boolean(error)}
            editable={!loading}
            style={styles.otpRow}
          />

          {!!error && (
            <Animated.View
              style={[
                styles.errorBox,
                {
                  backgroundColor: colors.destructive + "15",
                  opacity: errorAnim,
                  transform: [
                    {
                      translateY: errorAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-6, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Feather name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            </Animated.View>
          )}

          <Button
            title="Verify"
            onPress={handleVerify}
            loading={loading}
            disabled={loading}
          />

          <View style={styles.resendRow}>
            {countdown > 0 ? (
              <Text style={[styles.resendText, { color: colors.mutedForeground }]}>
                Resend code in{" "}
                <Text style={{ color: colors.primary, fontWeight: "700" }}>
                  {countdown}s
                </Text>
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResend}
                disabled={resendLoading || loading}
                activeOpacity={0.7}
                style={{ opacity: resendLoading || loading ? 0.6 : 1 }}
              >
                {resendLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.resendLink, { color: colors.primary }]}>
                    Resend OTP
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  content: {
    gap: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  otpRow: {
    marginVertical: 8,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  resendRow: {
    alignItems: "center",
  },
  resendText: {
    fontSize: 14,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: "700",
  },
});
