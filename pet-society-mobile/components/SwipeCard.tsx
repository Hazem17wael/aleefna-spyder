// components/SwipeCard.tsx
import React, { useEffect } from "react";
import {
  Platform,
  useWindowDimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { PetCard, CARD_WIDTH } from "./PetCard";
import type { Pet } from "@/context/PetsContext";

/** Must be a plain function for runOnJS from gesture worklets */
function playImpact(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "web") return;

  void Haptics.impactAsync(style).catch(() => {});
}

const VELOCITY_THRESHOLD = 700;
const ACTIVE_X_OFFSET = 10;
const FAIL_Y_OFFSET = 70;
const SCALE = [1, 0.96, 0.92];
const OFFSET_Y = [0, 14, 28];
const OPACITY = [1, 0.85, 0.7];

type Props = {
  pet: Pet;
  stackPosition: number;
  topProgress: SharedValue<number>;
  onLike: (petId: string) => void;
  onDislike: (petId: string) => void;
  cardWidth?: number;
  cardHeight?: number;
  disabled?: boolean;
  onViewDetails?: () => void;
};

export function SwipeCard({
  pet,
  stackPosition,
  topProgress,
  onLike,
  onDislike,
  cardWidth,
  cardHeight,
  disabled = false,
  onViewDetails,
}: Props) {
  const palette = useColors();
  const { width: SCREEN_W } = useWindowDimensions();
  const SWIPE_THRESHOLD = SCREEN_W * 0.3;

  const isTop = stackPosition === 0;

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);

  const w = cardWidth ?? CARD_WIDTH;
  const h = cardHeight ?? CARD_WIDTH * 1.35;
  const petId = String(pet.id);
  const isAnimatingAway = useSharedValue(false);

  useEffect(() => {
    tx.value = 0;
    ty.value = 0;
    scale.value = withSpring(1);
    isAnimatingAway.value = false;
  }, [pet.id]);

  const resetCard = () => {
    "worklet";
    scale.value = withSpring(1, { damping: 20, stiffness: 200 });
    tx.value = withSpring(0, { damping: 25, stiffness: 180 });
    ty.value = withSpring(0, { damping: 25, stiffness: 180 });
    topProgress.value = withSpring(0);
  };

  const flyRight = () => {
    "worklet";
    if (isAnimatingAway.value) return;

    isAnimatingAway.value = true;
    scale.value = withTiming(0.95, { duration: 200 });
    tx.value = withTiming(
      SCREEN_W * 1.8,
      { duration: 350 },
      () => {
        runOnJS(onLike)(petId);
        topProgress.value = 0;
      }
    );
    ty.value = withTiming(-50, { duration: 350 });
  };

  const flyLeft = () => {
    "worklet";
    if (isAnimatingAway.value) return;

    isAnimatingAway.value = true;
    scale.value = withTiming(0.95, { duration: 200 });
    tx.value = withTiming(
      -SCREEN_W * 1.8,
      { duration: 350 },
      () => {
        runOnJS(onDislike)(petId);
        topProgress.value = 0;
      }
    );
    ty.value = withTiming(-50, { duration: 350 });
  };

  const gesture = Gesture.Pan()
    .enabled(isTop && !disabled)
    .maxPointers(1)
    .minDistance(4)
    // Keep vertical scrolling available, but do not cancel normal diagonal thumb swipes.
    .activeOffsetX([-ACTIVE_X_OFFSET, ACTIVE_X_OFFSET])
    .failOffsetY([-FAIL_Y_OFFSET, FAIL_Y_OFFSET])
    .onStart(() => {
      if (isAnimatingAway.value) return;

      scale.value = withSpring(0.98, { damping: 20, stiffness: 300 });
    })
    .onUpdate((e) => {
      if (isAnimatingAway.value) return;

      tx.value = e.translationX;
      ty.value = e.translationY * 0.2;
      topProgress.value = e.translationX / SCREEN_W;
    })
    .onEnd((e) => {
      if (isAnimatingAway.value) return;

      const right =
        e.translationX > SWIPE_THRESHOLD ||
        e.velocityX > VELOCITY_THRESHOLD;
      const left =
        e.translationX < -SWIPE_THRESHOLD ||
        e.velocityX < -VELOCITY_THRESHOLD;

      if (right) {
        runOnJS(playImpact)(Haptics.ImpactFeedbackStyle.Medium);
        flyRight();
      } else if (left) {
        runOnJS(playImpact)(Haptics.ImpactFeedbackStyle.Light);
        flyLeft();
      } else {
        resetCard();
      }
    })
    .onFinalize(() => {
      if (!isAnimatingAway.value) {
        resetCard();
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    if (!isTop) {
      const prog = Math.min(Math.abs(topProgress.value), 1);
      const next = Math.max(stackPosition - 1, 0);

      return {
        transform: [
          {
            scale: interpolate(
              prog,
              [0, 1],
              [SCALE[stackPosition], SCALE[next]],
              Extrapolation.CLAMP
            ),
          },
          {
            translateY: interpolate(
              prog,
              [0, 1],
              [OFFSET_Y[stackPosition], OFFSET_Y[next]],
              Extrapolation.CLAMP
            ),
          },
        ],
        opacity: interpolate(
          prog,
          [0, 1],
          [OPACITY[stackPosition], OPACITY[next]],
          Extrapolation.CLAMP
        ),
      };
    }

    const rotate = interpolate(
      tx.value,
      [-SCREEN_W / 2, 0, SCREEN_W / 2],
      [-8, 0, 8],
      Extrapolation.CLAMP
    );

    const brightness = interpolate(
      Math.abs(tx.value),
      [0, SWIPE_THRESHOLD],
      [1, 0.92],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { rotate: `${rotate}deg` },
        { scale: scale.value },
      ],
      opacity: brightness,
    };
  });

  const likeBadgeStyle = useAnimatedStyle(() => {
    if (!isTop)
      return { opacity: 0 };
    const p = interpolate(
      tx.value,
      [SWIPE_THRESHOLD * 0.2, SWIPE_THRESHOLD * 1.1],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: p,
      transform: [{ scale: 0.94 + p * 0.06 }],
    };
  });

  const nopeBadgeStyle = useAnimatedStyle(() => {
    if (!isTop)
      return { opacity: 0 };
    const p = interpolate(
      tx.value,
      [-SWIPE_THRESHOLD * 1.1, -SWIPE_THRESHOLD * 0.2],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity: p,
      transform: [{ scale: 0.94 + p * 0.06 }],
    };
  });

  const containerStyle = {
    position: "absolute" as const,
    width: w,
    height: h,
    zIndex: isTop ? 50 : Math.max(1, 10 - stackPosition),
  };

  return (
    <GestureDetector gesture={gesture}>
      {/* Android collapses layered views aggressively; disables wrong touch targets with gestures */}
      <Animated.View collapsable={false} style={[containerStyle, cardStyle]}>
        <PetCard pet={pet} width={w} height={h} />

        {/* Swipe cue stamps — visible only while dragging top card */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.feedbackLayer]}
        >
          <Animated.View
            style={[
              styles.labelPill,
              styles.pillRight,
              { backgroundColor: `${palette.primary}E8` },
              likeBadgeStyle,
            ]}
          >
            <Text style={[styles.labelLike, { color: palette.primaryForeground }]}>Like</Text>
          </Animated.View>
          <Animated.View
            style={[
              styles.labelPill,
              styles.pillLeft,
              { backgroundColor: `${palette.dislike}E8` },
              nopeBadgeStyle,
            ]}
          >
            <Text style={[styles.labelPass, { color: palette.primaryForeground }]}>Pass</Text>
          </Animated.View>
        </Animated.View>

        {isTop && onViewDetails ? (
          <TouchableOpacity
            onPress={onViewDetails}
            disabled={disabled}
            activeOpacity={0.86}
            style={[
              styles.profileBtn,
              {
                backgroundColor: `${palette.card}F2`,
                borderColor: `${palette.primary}38`,
                opacity: disabled ? 0.6 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View pet profile"
          >
            <Feather name="user" size={13} color={palette.primary} />
            <Text style={[styles.profileBtnText, { color: palette.primary }]}>
              View profile
            </Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  feedbackLayer: {
    overflow: "hidden",
    borderRadius: 24,
  },
  labelPill: {
    position: "absolute",
    top: "32%",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillRight: {
    right: 24,
  },
  pillLeft: {
    left: 24,
  },
  labelLike: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  labelPass: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  profileBtn: {
    position: "absolute",
    top: 50,
    right: 14,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  profileBtnText: {
    fontSize: 12,
    fontWeight: "900",
  },
});
