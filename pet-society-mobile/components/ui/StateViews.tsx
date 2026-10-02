import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { Button } from "@/components/Button";
import { useColors } from "@/hooks/useColors";

export function EmptyState({
  title,
  subtitle,
  actionTitle,
  onAction,
  icon = "heart",
  style,
}: {
  title: string;
  subtitle?: string;
  actionTitle?: string;
  onAction?: () => void;
  icon?: keyof typeof Feather.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entry, {
      toValue: 1,
      damping: 18,
      stiffness: 220,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [entry]);

  return (
    <Animated.View
      style={[
        styles.empty,
        style,
        {
          opacity: entry,
          transform: [
            {
              translateY: entry.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.emptyIcon,
          {
            backgroundColor: colors.primary + "14",
            borderColor: colors.primary + "25",
            transform: [
              {
                scale: entry.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.88, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Feather name={icon} size={28} color={colors.primary} />
      </Animated.View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          {subtitle}
        </Text>
      ) : null}
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} style={styles.emptyButton} />
      ) : null}
    </Animated.View>
  );
}

export function LoadingState({
  label = "Loading...",
  style,
}: {
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 780,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 780,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={[styles.centerState, style]}>
      <Animated.View
        style={{
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.72, 1],
          }),
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1.04],
              }),
            },
          ],
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </Animated.View>
      <Text style={[styles.centerLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

export function ErrorState({
  title = "Could not load data",
  message,
  onRetry,
  style,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [entry]);

  return (
    <Animated.View
      style={[
        styles.centerState,
        style,
        {
          opacity: entry,
          transform: [
            {
              translateY: entry.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Feather name="alert-circle" size={30} color={colors.destructive} />
      <Text style={[styles.errorTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      <Text style={[styles.centerLabel, { color: colors.mutedForeground }]}>
        {message}
      </Text>
      {onRetry ? (
        <Button title="Try Again" onPress={onRetry} style={{ marginTop: 8 }} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "600",
  },
  emptyButton: {
    marginTop: 8,
    minWidth: 180,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
  },
  centerLabel: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "600",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
});
