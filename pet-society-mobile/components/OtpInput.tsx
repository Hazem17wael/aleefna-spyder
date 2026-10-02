import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

import { radius } from "@/constants/radius";
import { useColors } from "@/hooks/useColors";

const DEFAULT_OTP_LENGTH = 6;

const otpAutoFillProps = Platform.select<TextInputProps>({
  ios: {
    textContentType: "oneTimeCode",
    autoComplete: "one-time-code",
  },
  android: {
    // Full Android SMS auto-reading requires SMS delivery, SMS Retriever API,
    // and an app hash in the SMS body. This app currently uses email OTP, so
    // do not add READ_SMS permission or native SMS modules here.
    autoComplete: "sms-otp" as TextInputProps["autoComplete"],
    importantForAutofill: "yes",
  },
  default: {
    autoComplete: "one-time-code",
  },
});

type OtpInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
  onComplete?: (value: string) => void;
  error?: boolean;
  editable?: boolean;
  autoFocus?: boolean;
  style?: ViewStyle;
};

function safeSuccessHaptic() {
  if (Platform.OS === "web") return;

  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
}

function OtpBox({
  active,
  digit,
  error,
  size,
}: {
  active: boolean;
  digit: string;
  error: boolean;
  size: number;
}) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const digitAnim = useRef(new Animated.Value(digit ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.045 : digit ? 1.015 : 1,
      damping: 16,
      stiffness: 280,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [active, digit, scale]);

  useEffect(() => {
    if (!digit) {
      digitAnim.setValue(0);
      return;
    }

    digitAnim.setValue(0);
    Animated.spring(digitAnim, {
      toValue: 1,
      damping: 14,
      stiffness: 260,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [digit, digitAnim]);

  return (
    <Animated.View
      style={[
        styles.box,
        {
          width: size,
          height: size + 8,
          borderColor: error
            ? colors.destructive
            : digit || active
              ? colors.primary
              : colors.border,
          backgroundColor: colors.input,
          transform: [{ scale }],
        },
      ]}
    >
      <Animated.Text
        style={[
          styles.digit,
          {
            color: colors.foreground,
            opacity: digit ? digitAnim : 1,
            transform: [
              {
                scale: digit
                  ? digitAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.78, 1],
                    })
                  : 1,
              },
            ],
          },
        ]}
      >
        {digit}
      </Animated.Text>
    </Animated.View>
  );
}

export function OtpInput({
  value,
  onChangeText,
  length = DEFAULT_OTP_LENGTH,
  onComplete,
  error = false,
  editable = true,
  autoFocus = true,
  style,
}: OtpInputProps) {
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);
  const completeRef = useRef("");
  const [focused, setFocused] = React.useState(false);
  const cleanValue = value.replace(/\D/g, "").slice(0, length);
  const gap = width < 360 ? 6 : 10;
  const boxSize = Math.min(
    48,
    Math.max(38, Math.floor((width - 56 - gap * (length - 1)) / length)),
  );

  useEffect(() => {
    if (!autoFocus || !editable) return;

    const timer = setTimeout(() => inputRef.current?.focus(), 250);

    return () => clearTimeout(timer);
  }, [autoFocus, editable]);

  function handleChange(nextValue: string) {
    const cleanCode = nextValue.replace(/\D/g, "").slice(0, length);

    onChangeText(cleanCode);

    if (cleanCode.length === length && completeRef.current !== cleanCode) {
      completeRef.current = cleanCode;
      safeSuccessHaptic();
      onComplete?.(cleanCode);
    }

    if (cleanCode.length < length) {
      completeRef.current = "";
    }
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => inputRef.current?.focus()}
      style={[styles.wrapper, style]}
      disabled={!editable}
    >
      <TextInput
        ref={inputRef}
        value={cleanValue}
        onChangeText={handleChange}
        editable={editable}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={length}
        caretHidden
        selectTextOnFocus={false}
        style={styles.hiddenInput}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...otpAutoFillProps}
      />

      <View style={[styles.row, { gap }]}>
        {Array.from({ length }).map((_, index) => {
          const digit = cleanValue[index] ?? "";
          const active = focused && cleanValue.length === index && !digit;

          return (
            <OtpBox
              key={index}
              active={active}
              digit={digit}
              error={error}
              size={boxSize}
            />
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

export const OTP_AUTOFILL_PROPS = otpAutoFillProps;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0.01,
    left: 0,
    top: 0,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
  },
  box: {
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
});
