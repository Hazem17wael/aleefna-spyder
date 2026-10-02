import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";
import { Feather, FontAwesome, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const appLogo = require("../../assets/images/icon.png");

type AuthLayoutProps = {
  children: React.ReactNode;
  loading?: boolean;
};

export function AuthLayout({ children, loading = false }: AuthLayoutProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 28 : insets.top;
  const bottomPad = Platform.OS === "web" ? 28 : insets.bottom;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.layout, { backgroundColor: colors.background }]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.backgroundGlow,
            styles.backgroundGlowTop,
            { backgroundColor: colors.primary + "18" },
          ]}
        />
        <View
          style={[
            styles.backgroundGlow,
            styles.backgroundGlowBottom,
            { backgroundColor: colors.accent + "12" },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topPad + 18, paddingBottom: bottomPad + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>{children}</View>
      </ScrollView>

      {loading ? (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function AuthHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const colors = useColors();

  return (
    <View style={styles.header}>
      <View
        style={[
          styles.brandMark,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Image
          accessibilityIgnoresInvertColors
          source={appLogo}
          style={styles.brandLogo}
        />
      </View>
      <Text style={[styles.brandName, { color: colors.foreground }]}>
        Aleefna
      </Text>
      <Text style={[styles.headerTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
        {subtitle}
      </Text>
    </View>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {children}
    </View>
  );
}

type AuthInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Feather.glyphMap;
  error?: string;
  accessibilityLabel?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  textContentType?: TextInputProps["textContentType"];
};

export function AuthInput({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  error,
  accessibilityLabel,
  keyboardType,
  autoCapitalize,
  textContentType,
}: AuthInputProps) {
  const colors = useColors();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: colors.input,
            borderColor: error ? colors.destructive : colors.border,
          },
        ]}
      >
        <Feather name={icon} size={19} color={colors.mutedForeground} />
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground }]}
          textContentType={textContentType}
          value={value}
        />
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function PasswordInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  accessibilityLabel,
  textContentType,
}: Omit<AuthInputProps, "icon" | "keyboardType" | "autoCapitalize">) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: colors.input,
            borderColor: error ? colors.destructive : colors.border,
          },
        ]}
      >
        <Feather name="lock" size={19} color={colors.mutedForeground} />
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label}
          autoCapitalize="none"
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={!visible}
          style={[styles.input, { color: colors.foreground }]}
          textContentType={textContentType}
          value={value}
        />
        <TouchableOpacity
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          accessibilityRole="button"
          activeOpacity={0.75}
          onPress={() => setVisible((current) => !current)}
          style={styles.eyeButton}
        >
          <Feather
            name={visible ? "eye-off" : "eye"}
            size={19}
            color={colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const colors = useColors();

  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      activeOpacity={0.86}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.primaryButton,
        {
          backgroundColor: colors.primary,
          opacity: disabled || loading ? 0.68 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryForeground} />
      ) : (
        <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function DividerWithText({ text = "or" }: { text?: string }) {
  const colors = useColors();

  return (
    <View style={styles.divider}>
      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
        {text}
      </Text>
      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

export function AuthFooterLink({
  text,
  actionText,
  onPress,
}: {
  text: string;
  actionText: string;
  onPress: () => void;
}) {
  const colors = useColors();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.75}
      onPress={onPress}
      style={styles.footerLink}
    >
      <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
        {text}{" "}
        <Text style={{ color: colors.primary, fontWeight: "900" }}>
          {actionText}
        </Text>
      </Text>
    </TouchableOpacity>
  );
}

export function TermsText({
  prefix = "By continuing, you agree to our",
}: {
  prefix?: string;
}) {
  const colors = useColors();

  return (
    <Text style={[styles.terms, { color: colors.mutedForeground }]}>
      {prefix}{" "}
      <Text style={{ color: colors.primary, fontWeight: "800" }}>
        Terms & Privacy
      </Text>
    </Text>
  );
}

export function SocialButton({
  provider,
  label,
  loading,
  disabled,
  onPress,
}: {
  provider: "apple" | "google";
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const isApple = provider === "apple";
  const colors = useColors();

  return (
    <TouchableOpacity
      accessibilityLabel={label}
      accessibilityRole="button"
      activeOpacity={0.86}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.socialButton,
        isApple
          ? styles.appleButton
          : {
              backgroundColor: colors.card,
              borderColor: colors.primary + "35",
            },
        { opacity: disabled && !loading ? 0.6 : 1 },
      ]}
    >
      <View style={styles.socialIconSlot}>
        {loading ? (
          <ActivityIndicator color={isApple ? "#fff" : colors.primary} />
        ) : isApple ? (
          <Ionicons name="logo-apple" size={23} color="#fff" />
        ) : (
          <FontAwesome name="google" size={21} color={colors.primary} />
        )}
      </View>
      <Text
        style={[
          styles.socialText,
          { color: isApple ? "#fff" : colors.foreground },
        ]}
      >
        {label}
      </Text>
      <View style={styles.socialIconSlot} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  layout: {
    flex: 1,
    overflow: "hidden",
  },
  backgroundGlow: {
    position: "absolute",
    borderRadius: 999,
  },
  backgroundGlowTop: {
    height: 230,
    right: -92,
    top: -78,
    width: 230,
  },
  backgroundGlowBottom: {
    bottom: 80,
    height: 190,
    left: -95,
    width: 190,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
  },
  content: {
    alignSelf: "center",
    gap: 18,
    maxWidth: 460,
    width: "100%",
  },
  header: {
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
  brandMark: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    height: 64,
    justifyContent: "center",
    marginBottom: 2,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0,
    shadowRadius: 18,
    width: 64,
  },
  brandLogo: {
    height: 64,
    resizeMode: "cover",
    width: 64,
  },
  brandName: {
    fontSize: 18,
    fontWeight: "900",
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginTop: 4,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    maxWidth: 320,
    textAlign: "center",
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === "ios" ? 0.07 : 0,
    shadowRadius: 20,
    elevation: 3,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "800",
  },
  inputShell: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 11,
    minHeight: 58,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 0,
  },
  eyeButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 36,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 20,
    height: 58,
    justifyContent: "center",
    marginTop: 2,
  },
  primaryText: {
    fontSize: 17,
    fontWeight: "900",
  },
  divider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "lowercase",
  },
  footerLink: {
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  footerText: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  terms: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    paddingHorizontal: 8,
    textAlign: "center",
  },
  socialButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    height: 56,
    justifyContent: "center",
    paddingHorizontal: 16,
    width: "100%",
  },
  appleButton: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  socialIconSlot: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
  },
  socialText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(20,20,40,0.22)",
    justifyContent: "center",
    zIndex: 40,
  },
  loadingCard: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    height: 82,
    justifyContent: "center",
    width: 82,
  },
});
