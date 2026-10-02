import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Reanimated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { ONBOARDING_COMPLETE_KEY } from "@/utils/onboarding";

const slides = [
  {
    id: "1",
    title: "Add your pet",
    subtitle: "Create a clean profile with the basics, a photo, and optional trusted documents.",
    icon: "plus-circle" as const,
    emoji: "🐶",
    gradient: ["#ff6b6b", "#ff8e53"] as [string, string],
  },
  {
    id: "2",
    title: "Discover nearby pets",
    subtitle: "Use location-based discovery to browse dogs and cats close to you.",
    icon: "map-pin" as const,
    emoji: "🐱",
    gradient: ["#7c3aed", "#a855f7"] as [string, string],
  },
  {
    id: "3",
    title: "Adopt safely with verified documents",
    subtitle: "Review vaccination, medical, and ID documents before taking the next step.",
    icon: "shield" as const,
    emoji: "🦴",
    gradient: ["#0891b2", "#06b6d4"] as [string, string],
  },
];

// Floating Paw Component
function FloatingPaw({ delay = 0 }: { delay?: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-12, { duration: 3600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 3600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.38, { duration: 3600 }),
          withTiming(0.18, { duration: 3600 })
        ),
      -1,
      false
      )
    );
  }, [delay, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Reanimated.Text
      style={[
        styles.floatingPaw,
        animatedStyle,
      ]}
    >
      🐾
    </Reanimated.Text>
  );
}

function ProgressDot({
  active,
  activeColor,
  inactiveColor,
}: {
  active: boolean;
  activeColor: string;
  inactiveColor: string;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, progress]);

  const dotStyle = useAnimatedStyle(() => ({
    width: 8 + progress.value * 20,
    opacity: 0.58 + progress.value * 0.42,
  }));

  return (
    <Reanimated.View
      style={[
        styles.dot,
        { backgroundColor: active ? activeColor : inactiveColor },
        dotStyle,
      ]}
    />
  );
}

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const { width } = useWindowDimensions();

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const finishOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    router.replace("/login");
  };

  const handleNext = () => {
    btnScale.value = withSequence(
      withTiming(0.93, { duration: 80 }),
      withSpring(1, { damping: 12 })
    );
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      finishOnboarding();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <LinearGradient
            colors={item.gradient}
            style={[styles.slide, { width, paddingTop: topPad + 40, paddingBottom: bottomPad + 160 }]}
          >
            {/* Floating Paw Prints */}
            <View style={styles.pawsContainer}>
              <FloatingPaw delay={index * 220} />
              <FloatingPaw delay={900 + index * 220} />
            </View>

            {/* Decorative circles */}
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />
            <View style={styles.decorCircle3} />

            {/* Main Content */}
            <View style={styles.content}>
              {/* Icon Container with emoji */}
              <Reanimated.View entering={ZoomIn.springify().damping(14)} style={styles.iconWrapper}>
                <View style={styles.iconContainer}>
                  <LinearGradient
                    colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0.15)"]}
                    style={styles.iconGradient}
                  >
                    <Feather name={item.icon} size={64} color="#fff" />
                  </LinearGradient>
                </View>

                {/* Floating emoji */}
                <Reanimated.Text
                  entering={ZoomIn.delay(200).springify().damping(10)}
                  style={styles.floatingEmoji}
                >
                  {item.emoji}
                </Reanimated.Text>
              </Reanimated.View>

              {/* Title with fun styling */}
              <Reanimated.View entering={FadeInDown.delay(150).springify()}>
                <Text style={styles.title}>{item.title}</Text>
              </Reanimated.View>

              {/* Subtitle */}
              <Reanimated.View entering={FadeInDown.delay(250).springify()}>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              </Reanimated.View>

              {/* Fun fact badge */}
              <Reanimated.View
                entering={FadeInDown.delay(350).springify()}
                style={styles.funFactBadge}
              >
                <Feather name="info" size={14} color="#fff" />
                <Text style={styles.funFactText}>
                  {index === 0 && "Over 1,000 happy pet matches!"}
                  {index === 1 && "Nearby discovery uses your permission first."}
                  {index === 2 && "PDF documents stay optional."}
                </Text>
              </Reanimated.View>
            </View>
          </LinearGradient>
        )}
      />

      {/* Modern Footer */}
      <Reanimated.View
        entering={FadeInUp.springify().damping(18)}
        style={[
          styles.footer,
          {
            backgroundColor: colors.card,
            paddingBottom: bottomPad + 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
        ]}
      >
        {/* Progress Dots */}
        <View style={styles.dotsContainer}>
          <View style={styles.dots}>
            {slides.map((_, i) => (
              <ProgressDot
                key={i}
                active={i === currentIndex}
                activeColor={colors.primary}
                inactiveColor={colors.muted}
              />
            ))}
          </View>
          <Text style={[styles.stepText, { color: colors.mutedForeground }]}>
            {currentIndex + 1} of {slides.length}
          </Text>
        </View>

        {/* Next Button */}
        <Reanimated.View style={[{ width: "100%" }, btnStyle]}>
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: colors.primary }]}
            onPress={handleNext}
            activeOpacity={0.9}
          >
            <Text style={styles.nextText}>
              {currentIndex < slides.length - 1 ? "Next" : "Get Started"}
            </Text>
            {currentIndex < slides.length - 1 ? (
              <Feather name="arrow-right" size={20} color="#fff" />
            ) : (
              <Feather name="check" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </Reanimated.View>

        {/* Skip/Login Link */}
        <TouchableOpacity onPress={finishOnboarding} style={styles.skipButton}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
            Already a proud pet parent?{" "}
            <Text style={{ color: colors.primary, fontWeight: "800" }}>Login here</Text>
          </Text>
        </TouchableOpacity>
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Slide */
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    position: "relative",
    overflow: "hidden",
  },

  /* Decorative Elements */
  pawsContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "space-around",
    alignItems: "center",
  },
  floatingPaw: {
    position: "absolute",
    fontSize: 32,
  },
  decorCircle1: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  decorCircle2: {
    position: "absolute",
    bottom: 100,
    left: -70,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  decorCircle3: {
    position: "absolute",
    top: 120,
    left: 30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  /* Content */
  content: {
    alignItems: "center",
    gap: 20,
    zIndex: 1,
  },
  iconWrapper: {
    position: "relative",
    marginBottom: 8,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  iconGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  floatingEmoji: {
    position: "absolute",
    bottom: -10,
    right: -10,
    fontSize: 48,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    letterSpacing: -1,
    lineHeight: 42,
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
    paddingHorizontal: 8,
  },
  funFactBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  funFactText: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "700",
  },

  /* Footer */
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  dotsContainer: {
    alignItems: "center",
    gap: 8,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  stepText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 18,
    width: "100%",
    justifyContent: "center",
    shadowColor: "#ff6b6b",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  nextText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.3,
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});
