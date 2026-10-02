import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { radius } from "@/constants/radius";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { useColors } from "@/hooks/useColors";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  leftIcon?: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  fullWidth = true,
  leftIcon,
  rightIcon,
}: Props) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const bgMap: Record<Variant, string> = {
    primary: colors.primary,
    secondary: colors.secondary,
    outline: "transparent",
    ghost: "transparent",
    destructive: colors.destructive,
  };

  const textColorMap: Record<Variant, string> = {
    primary: colors.primaryForeground,
    secondary: colors.secondaryForeground,
    outline: colors.primary,
    ghost: colors.foreground,
    destructive: colors.destructiveForeground,
  };

  const borderColorMap: Record<Variant, string | undefined> = {
    primary: undefined,
    secondary: undefined,
    outline: colors.primary,
    ghost: undefined,
    destructive: undefined,
  };

  function animateScale(toValue: number) {
    if (isDisabled) return;

    Animated.spring(scale, {
      toValue,
      damping: 18,
      stiffness: 260,
      mass: 0.65,
      useNativeDriver: true,
    }).start();
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => animateScale(0.98)}
      onPressOut={() => animateScale(1)}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.button,
        {
          backgroundColor: bgMap[variant],
          borderColor: borderColorMap[variant],
          borderWidth: variant === "outline" ? 1.5 : 0,
          opacity: isDisabled ? 0.6 : 1,
          alignSelf: fullWidth ? undefined : "flex-start",
          transform: [{ scale }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColorMap[variant]} size="small" />
      ) : (
        <>
          {leftIcon ? (
            <Feather name={leftIcon} size={17} color={textColorMap[variant]} />
          ) : null}
          <Text style={[styles.text, { color: textColorMap[variant] }]}>
            {title}
          </Text>
          {rightIcon ? (
            <Feather name={rightIcon} size={17} color={textColorMap[variant]} />
          ) : null}
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing["2xl"],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  text: {
    fontSize: typography.size.lg,
    fontWeight: "700",
    letterSpacing: 0,
  },
});
