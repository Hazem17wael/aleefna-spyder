import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const ONBOARDING_STORAGE_KEY = "aleefna:first-run-onboarding:v1";

const ONBOARDING_STEPS: Array<{
  title: string;
  body: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  {
    title: "Welcome to Aleefna",
    body: "Create pet profiles, manage your pets, and keep everything close.",
    icon: "heart",
  },
  {
    title: "Discover nearby pets",
    body: "Explore compatible pets around you with a calm, friendly feed.",
    icon: "map-pin",
  },
  {
    title: "Swipe, match, and chat",
    body: "Like pets, create matches, and chat safely with their owners.",
    icon: "message-circle",
  },
  {
    title: "Care Streak",
    body: "Keep daily habits like food, water, play, and care on track.",
    icon: "sun",
  },
  {
    title: "Adoption-friendly community",
    body: "Explore adoption profiles and connect with care.",
    icon: "home",
  },
];

export function FirstRunOnboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const step = ONBOARDING_STEPS[stepIndex];
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;

  const progressText = useMemo(
    () => `${stepIndex + 1}/${ONBOARDING_STEPS.length}`,
    [stepIndex],
  );

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)
      .then((value) => {
        if (!mounted) return;

        setIsVisible(value !== "done");
      })
      .catch(() => {
        if (mounted) {
          setIsVisible(true);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function completeOnboarding() {
    setIsVisible(false);
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "done").catch(() => {});
  }

  function goNext() {
    if (isLastStep) {
      void completeOnboarding();
      return;
    }

    setStepIndex((current) =>
      Math.min(current + 1, ONBOARDING_STEPS.length - 1),
    );
  }

  if (!isReady) return null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        void completeOnboarding();
      }}
      transparent={false}
      visible={isVisible}
    >
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 18,
            paddingBottom: Math.max(insets.bottom, 18),
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.progress, { color: colors.mutedForeground }]}>
            {progressText}
          </Text>
          {!isLastStep ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void completeOnboarding();
              }}
              style={styles.skipButton}
            >
              <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
                Skip
              </Text>
            </Pressable>
          ) : (
            <View style={styles.skipButton} />
          )}
        </View>

        <View style={styles.content}>
          <View
            style={[
              styles.iconShell,
              {
                backgroundColor: `${colors.primary}14`,
                borderColor: `${colors.primary}35`,
              },
            ]}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: `${colors.accent}18` },
              ]}
            >
              <Feather name={step.icon} size={42} color={colors.primary} />
            </View>
          </View>

          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {step.title}
            </Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              {step.body}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {ONBOARDING_STEPS.map((item, index) => (
              <View
                key={item.title}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      index === stepIndex ? colors.primary : colors.border,
                    width: index === stepIndex ? 22 : 8,
                  },
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={goNext}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                { color: colors.primaryForeground },
              ]}
            >
              {isLastStep ? "Get Started" : "Next"}
            </Text>
            <Feather
              name={isLastStep ? "check" : "arrow-right"}
              size={18}
              color={colors.primaryForeground}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 22,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progress: {
    fontSize: 13,
    fontWeight: "800",
  },
  skipButton: {
    alignItems: "flex-end",
    minHeight: 42,
    minWidth: 72,
    justifyContent: "center",
  },
  skipText: {
    fontSize: 15,
    fontWeight: "800",
  },
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    gap: 34,
  },
  iconShell: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: "center",
    maxWidth: 240,
    width: "68%",
  },
  iconCircle: {
    alignItems: "center",
    borderRadius: 44,
    height: 88,
    justifyContent: "center",
    width: 88,
  },
  copy: {
    alignItems: "center",
    gap: 12,
    maxWidth: 340,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center",
  },
  body: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
    textAlign: "center",
  },
  footer: {
    gap: 22,
  },
  dots: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  dot: {
    borderRadius: 999,
    height: 8,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 18,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
  },
});
