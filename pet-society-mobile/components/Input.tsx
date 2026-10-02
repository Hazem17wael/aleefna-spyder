import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { radius } from "@/constants/radius";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { useColors } from "@/hooks/useColors";

type Props = Omit<TextInputProps, "style"> & {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  isPassword?: boolean;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export function Input({
  label,
  error,
  leftIcon,
  isPassword,
  inputStyle,
  style,
  onBlur,
  onFocus,
  ...props
}: Props) {
  const colors = useColors();
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const errorAnim = useRef(new Animated.Value(error ? 1 : 0)).current;
  const disabled = props.editable === false;
  const iconColor = error
    ? colors.destructive
    : isFocused
      ? colors.primary
      : colors.mutedForeground;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isFocused && !disabled ? 1.01 : 1,
      damping: 18,
      stiffness: 260,
      mass: 0.65,
      useNativeDriver: true,
    }).start();
  }, [disabled, isFocused, scale]);

  useEffect(() => {
    Animated.timing(errorAnim, {
      toValue: error ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [error, errorAnim]);

  return (
    <View style={[styles.wrapper, style]}>
      {label && (
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      )}
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: colors.input,
            borderColor: error
              ? colors.destructive
              : isFocused
                ? colors.primary
                : colors.border,
            opacity: disabled ? 0.68 : 1,
            transform: [{ scale }],
          },
        ]}
      >
        {leftIcon && (
          <Feather
            name={leftIcon}
            size={18}
            color={iconColor}
            style={styles.leftIcon}
          />
        )}
        <TextInput
          style={[styles.input, { color: colors.foreground }, inputStyle]}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={isPassword && !showPassword}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            style={styles.rightIcon}
            disabled={disabled}
          >
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={18}
              color={iconColor}
            />
          </TouchableOpacity>
        )}
      </Animated.View>
      {error && (
        <Animated.Text
          style={[
            styles.error,
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.size.md,
    fontWeight: "600",
    letterSpacing: 0,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  leftIcon: {
    marginRight: spacing.md,
  },
  rightIcon: {
    padding: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: typography.size.lg,
  },
  error: {
    fontSize: typography.size.sm,
    fontWeight: "500",
  },
});
