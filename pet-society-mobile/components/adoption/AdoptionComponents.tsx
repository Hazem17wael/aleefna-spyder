import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ImageFallback } from "@/components/ImageFallback";
import {
  EmptyState,
  ErrorState as SharedErrorState,
  LoadingState,
} from "@/components/ui/StateViews";
import { PetDocumentBadges } from "@/components/pets/PetDocumentBadges";
import { PetVerifiedBadge } from "@/components/pets/PetVerifiedBadge";
import { useColors } from "@/hooks/useColors";
import type { ContactInfo, Pet } from "@/types/adoption";
import {
  contactLines,
  petAgeLabel,
  petBreed,
  petGender,
  petImage,
  petName,
  petType,
  statusColor,
  statusLabel,
} from "@/utils/adoption";

export function ScreenShell({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const colors = useColors();

  return (
    <View style={[styles.shell, { backgroundColor: colors.background }, style]}>
      {children}
    </View>
  );
}

export function AdoptionHeader({
  title,
  subtitle,
  eyebrow = "ADOPTION",
  showBack = true,
  right,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 52 : insets.top;

  return (
    <View style={[styles.header, { paddingTop: topPad + 12 }]}>
      <View style={styles.headerRow}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.84}
            style={[
              styles.iconButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {eyebrow}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {right ?? (showBack ? <View style={styles.iconButtonSpacer} /> : null)}
      </View>
    </View>
  );
}

export function IconAction({
  icon,
  onPress,
  label,
  tint,
  disabled,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label?: string;
  tint?: string;
  disabled?: boolean;
}) {
  const colors = useColors();
  const color = tint ?? colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.84}
      style={[
        styles.iconButton,
        {
          backgroundColor: color + "14",
          borderColor: color + "30",
          opacity: disabled ? 0.55 : 1,
        },
      ]}
      accessibilityLabel={label}
    >
      <Feather name={icon} size={18} color={color} />
    </TouchableOpacity>
  );
}

export function StatusBadge({
  status,
  label,
  tint,
}: {
  status?: string | null;
  label?: string;
  tint?: string;
}) {
  const resolvedTint = tint ?? statusColor(status);
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    scale.setValue(0.92);
    Animated.spring(scale, {
      toValue: 1,
      damping: 15,
      stiffness: 260,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [label, scale, status, tint]);

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: resolvedTint + "14",
          borderColor: resolvedTint + "30",
          transform: [{ scale }],
        },
      ]}
    >
      <View style={[styles.badgeDot, { backgroundColor: resolvedTint }]} />
      <Text style={[styles.badgeText, { color: resolvedTint }]}>
        {label ?? statusLabel(status)}
      </Text>
    </Animated.View>
  );
}

export function InfoBadge({
  icon,
  label,
  tint,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  tint?: string;
}) {
  const colors = useColors();
  const color = tint ?? colors.primary;

  return (
    <View
      style={[
        styles.infoBadge,
        { backgroundColor: color + "12", borderColor: color + "28" },
      ]}
    >
      <Feather name={icon} size={13} color={color} />
      <Text style={[styles.infoBadgeText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function AdoptionImage({
  pet,
  height = 210,
}: {
  pet?: Pet | null;
  height?: number;
}) {
  const colors = useColors();
  const image = petImage(pet);
  const type = petType(pet);

  return (
    <View style={[styles.petImageWrap, { height, backgroundColor: colors.muted }]}>
      <ImageFallback
        uri={image}
        containerStyle={StyleSheet.absoluteFill}
        fallback={
          <LinearGradient
            colors={[colors.primary + "16", colors.card]}
            style={styles.imageFallback}
          >
            <Feather name="home" size={32} color={colors.primary} />
            <Text style={[styles.imageFallbackText, { color: colors.primary }]}>
              {type}
            </Text>
          </LinearGradient>
        }
        accessibilityLabel={`${petName(pet)} photo`}
      />
    </View>
  );
}

export function PetSummary({
  pet,
  compact = false,
}: {
  pet?: Pet | null;
  compact?: boolean;
}) {
  const colors = useColors();

  return (
    <View style={styles.petSummary}>
      <View
        style={[
          styles.petThumb,
          { backgroundColor: colors.muted, width: compact ? 58 : 72, height: compact ? 58 : 72 },
        ]}
      >
        <ImageFallback
          uri={petImage(pet)}
          containerStyle={StyleSheet.absoluteFill}
          fallbackEmoji=""
          fallback={<Feather name="image" size={22} color={colors.primary} />}
          accessibilityLabel={`${petName(pet)} photo`}
        />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.petSummaryNameRow}>
          <Text
            style={[styles.petSummaryName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {petName(pet)}
          </Text>

          <PetVerifiedBadge pet={pet} compact />
        </View>
        <Text
          style={[styles.petSummarySub, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {petType(pet)} - {petBreed(pet)} - {petAgeLabel(pet?.age)} -{" "}
          {petGender(pet)}
        </Text>

        <PetDocumentBadges pet={pet} compact />
      </View>
    </View>
  );
}

export { EmptyState, LoadingState };

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <SharedErrorState
      title="We couldn't load adoption pets right now."
      message={message}
      onRetry={onRetry}
    />
  );
}

export function FormField({
  label,
  error,
  multiline,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
}) {
  const colors = useColors();
  const errorAnim = useRef(new Animated.Value(error ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(errorAnim, {
      toValue: error ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [error, errorAnim]);

  return (
    <View style={styles.formField}>
      <Text style={[styles.formLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.formInput,
          multiline ? styles.formTextArea : null,
          {
            backgroundColor: colors.input,
            borderColor: error ? colors.destructive : colors.border,
            color: colors.foreground,
          },
          props.style,
        ]}
      />
      {error ? (
        <Animated.Text
          style={[
            styles.fieldError,
            {
              color: colors.destructive,
              opacity: errorAnim,
              transform: [
                {
                  translateY: errorAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-4, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {error}
        </Animated.Text>
      ) : null}
    </View>
  );
}

export function ToggleRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      disabled={disabled}
      activeOpacity={0.84}
      style={[
        styles.toggleRow,
        {
          backgroundColor: colors.card,
          borderColor: value ? colors.primary + "55" : colors.border,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
        {label}
      </Text>
      <View
        style={[
          styles.toggleBox,
          {
            backgroundColor: value ? colors.primary : colors.input,
            borderColor: value ? colors.primary : colors.border,
          },
        ]}
      >
        {value ? (
          <Feather name="check" size={16} color={colors.primaryForeground} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function Notice({
  text,
  icon = "info",
  tint,
}: {
  text: string;
  icon?: keyof typeof Feather.glyphMap;
  tint?: string;
}) {
  const colors = useColors();
  const color = tint ?? colors.warning;

  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: color + "12", borderColor: color + "28" },
      ]}
    >
      <Feather name={icon} size={16} color={color} />
      <Text style={[styles.noticeText, { color }]}>{text}</Text>
    </View>
  );
}

export function ContactCard({
  contact,
  locked,
  title = "Contact",
}: {
  contact?: ContactInfo | null;
  locked?: boolean | null;
  title?: string;
}) {
  const colors = useColors();
  const lines = contactLines(contact);

  if (locked || lines.length === 0) {
    return (
      <Notice text="Contact details unlock after the owner accepts your application." />
    );
  }

  return (
    <Card style={styles.contactCard}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {lines.map((line) => (
        <View key={line.label} style={styles.contactRow}>
          <Text style={[styles.contactLabel, { color: colors.mutedForeground }]}>
            {line.label}
          </Text>
          <Text style={[styles.contactValue, { color: colors.foreground }]}>
            {line.value}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonSpacer: {
    width: 42,
    height: 42,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 3,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 3,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0,
    shadowRadius: 14,
    elevation: 2,
  },
  petImageWrap: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 18,
  },
  imageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  imageFallbackText: {
    fontSize: 14,
    fontWeight: "800",
  },
  petSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  petThumb: {
    borderRadius: 18,
    overflow: "hidden",
  },
  petSummaryName: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: "900",
  },
  petSummaryNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  petSummarySub: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 3,
  },
  formField: {
    gap: 7,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "800",
  },
  formInput: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  formTextArea: {
    minHeight: 120,
    paddingTop: 12,
    paddingBottom: 12,
  },
  fieldError: {
    fontSize: 12,
    fontWeight: "700",
  },
  toggleRow: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  toggleBox: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  contactCard: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  contactValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "700",
  },
});
