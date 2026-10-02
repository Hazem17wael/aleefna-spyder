import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import type { Pet } from "@/context/PetsContext";
import { ImageFallback } from "@/components/ImageFallback";
import { PetVerifiedBadge } from "@/components/pets/PetVerifiedBadge";
import { formatPetType, getPetTypeEmoji } from "@/constants/petTypes";
import {
  resolvePetBreed,
  resolvePetImage,
  resolvePetName,
  resolvePetTypeRaw,
} from "@/utils/pet";

type MatchPetLike = Partial<Pet> & {
  pet_name?: string;
  pet_type?: string;
  images?: Array<{
    url?: string | null;
    image_path?: string | null;
  }>;
};

type Props = {
  visible: boolean;
  myPet: Pet | null;
  matchedPet: Pet | null;
  onClose: () => void;
};

function safeHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "web") return;

  Haptics.impactAsync(style).catch(() => { });
}

function PetBubble({
  pet,
  side,
  delay,
}: {
  pet: MatchPetLike | null;
  side: "left" | "right";
  delay: number;
}) {
  const image = resolvePetImage(pet);
  const name = resolvePetName(pet);
  const rawType = resolvePetTypeRaw(pet);
  const breed = resolvePetBreed(pet);

  const scale = useRef(new Animated.Value(0.75)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        delay,
        damping: 14,
        stiffness: 130,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        damping: 16,
        stiffness: 120,
        useNativeDriver: true,
      }),
      Animated.spring(rotate, {
        toValue: 1,
        delay,
        damping: 12,
        stiffness: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, rotate, scale, translateY]);

  const rotation = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: side === "left" ? ["-12deg", "-4deg"] : ["12deg", "4deg"],
  });

  return (
    <Animated.View
      style={[
        styles.petBubble,
        {
          transform: [{ scale }, { translateY }, { rotate: rotation }],
        },
      ]}
    >
      <View style={styles.petImageOuter}>
        <View style={styles.petImageInner}>
          <ImageFallback
            uri={image}
            containerStyle={styles.petImage}
            fallback={
              <LinearGradient
                colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0.12)"]}
                style={styles.petPlaceholder}
              >
                <Text style={styles.petPlaceholderEmoji}>
                  {getPetTypeEmoji(rawType)}
                </Text>
              </LinearGradient>
            }
            accessibilityLabel={`${name} photo`}
          />
        </View>

        <View style={styles.petMiniBadge}>
          <Text style={styles.petMiniBadgeText}>
            {getPetTypeEmoji(rawType)}
          </Text>
        </View>
      </View>

      <Text style={styles.petName} numberOfLines={1}>
        {name}
      </Text>

      <PetVerifiedBadge pet={pet} compact />

      <Text style={styles.petMeta} numberOfLines={1}>
        {breed || formatPetType(rawType)}
      </Text>
    </Animated.View>
  );
}

export function MatchModal({ visible, myPet, matchedPet, onClose }: Props) {
  const { width } = useWindowDimensions();
  const scale = useRef(new Animated.Value(0.86)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(18)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const confetti = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);

  useEffect(() => {
    if (!visible) return;

    scale.setValue(0.86);
    opacity.setValue(0);
    titleY.setValue(18);
    heartScale.setValue(1);
    confetti.setValue(0);
    closingRef.current = false;

    safeHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 16,
        stiffness: 135,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.spring(titleY, {
        toValue: 0,
        damping: 16,
        stiffness: 120,
        useNativeDriver: true,
      }),
      Animated.timing(confetti, {
        toValue: 1,
        duration: 680,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(heartScale, {
          toValue: 1.12,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();
    const softenTimer = setTimeout(() => {
      pulse.stop();
      Animated.spring(heartScale, {
        toValue: 1,
        damping: 18,
        stiffness: 160,
        useNativeDriver: true,
      }).start();
    }, 1500);

    return () => {
      clearTimeout(softenTimer);
      pulse.stop();
    };
  }, [confetti, heartScale, opacity, scale, titleY, visible]);

  function handleClose() {
    if (closingRef.current) return;

    closingRef.current = true;
    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.94,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(titleY, {
        toValue: 10,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      closingRef.current = false;
    });
  }

  const myPetName = resolvePetName(myPet as MatchPetLike | null);
  const matchedPetName = resolvePetName(matchedPet as MatchPetLike | null);
  const cardWidth = Math.max(240, Math.min(width - 32, 390));
  const stageScale = Math.min(1, cardWidth / 330);

  const confettiY = confetti.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 12],
  });

  const confettiOpacity = confetti.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <LinearGradient
        colors={["rgba(255,107,107,0.96)", "rgba(255,142,83,0.96)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.overlay}
      >
        <View style={styles.decorLayer} pointerEvents="none">
          <Animated.Text
            style={[
              styles.decorPawOne,
              {
                opacity: confettiOpacity,
                transform: [{ translateY: confettiY }, { rotate: "-16deg" }],
              },
            ]}
          >
            🐾
          </Animated.Text>

          <Animated.Text
            style={[
              styles.decorPawTwo,
              {
                opacity: confettiOpacity,
                transform: [{ translateY: confettiY }, { rotate: "18deg" }],
              },
            ]}
          >
            🐾
          </Animated.Text>

          <Animated.Text
            style={[
              styles.decorSparkleOne,
              {
                opacity: confettiOpacity,
                transform: [{ translateY: confettiY }],
              },
            ]}
          >
            ✨
          </Animated.Text>

          <Animated.Text
            style={[
              styles.decorSparkleTwo,
              {
                opacity: confettiOpacity,
                transform: [{ translateY: confettiY }],
              },
            ]}
          >
            ✨
          </Animated.Text>
        </View>

        <Animated.View
          style={[
            styles.content,
            {
              width: cardWidth,
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <Animated.View style={{ transform: [{ translateY: titleY }] }}>
            <View style={styles.topBadge}>
              <Text style={styles.topBadgeText}>NEW MATCH</Text>
            </View>

            <Text style={styles.title}>It&apos;s a Match!</Text>

            <Text style={styles.subtitle}>
              {myPetName} and {matchedPetName} just started a tiny love story.
            </Text>
          </Animated.View>

          <View
            style={[
              styles.petStage,
              {
                transform: [{ scale: stageScale }],
                marginVertical: stageScale < 1 ? -12 : 4,
              },
            ]}
          >
            <PetBubble
              pet={myPet as MatchPetLike | null}
              side="left"
              delay={80}
            />

            <Animated.View
              style={[
                styles.heartCenter,
                {
                  transform: [{ scale: heartScale }],
                },
              ]}
            >
              <LinearGradient
                colors={["#fff", "rgba(255,255,255,0.86)"]}
                style={styles.heartCircle}
              >
                <Text style={styles.heartText}>♥</Text>
              </LinearGradient>
            </Animated.View>

            <PetBubble
              pet={matchedPet as MatchPetLike | null}
              side="right"
              delay={160}
            />
          </View>

          <View style={styles.matchCard}>
            <View style={styles.matchCardIcon}>
              <Text style={styles.matchCardEmoji}>💘</Text>
            </View>

            <View style={styles.matchCardCopy}>
              <Text style={styles.matchCardTitle}>Pawfect chemistry</Text>

              <Text style={styles.matchCardText} numberOfLines={2}>
                Mutual like detected. Time to celebrate the pet algorithm.
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleClose}
              activeOpacity={0.9}
            >
              <Feather name="shuffle" size={18} color="#ff6b6b" />
              <Text style={styles.primaryButtonText}>Keep Swiping</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  decorLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  decorPawOne: {
    position: "absolute",
    top: 110,
    left: 28,
    fontSize: 42,
    color: "rgba(255,255,255,0.26)",
  },
  decorPawTwo: {
    position: "absolute",
    bottom: 120,
    right: 28,
    fontSize: 44,
    color: "rgba(255,255,255,0.24)",
  },
  decorSparkleOne: {
    position: "absolute",
    top: 170,
    right: 44,
    fontSize: 28,
    color: "rgba(255,255,255,0.34)",
  },
  decorSparkleTwo: {
    position: "absolute",
    bottom: 210,
    left: 48,
    fontSize: 26,
    color: "rgba(255,255,255,0.30)",
  },

  content: {
    alignItems: "center",
    gap: 20,
  },

  topBadge: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 10,
  },
  topBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  title: {
    fontSize: 39,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -1.2,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.90)",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 6,
    fontWeight: "600",
  },

  petStage: {
    width: "100%",
    minHeight: 168,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },

  petBubble: {
    width: 122,
    alignItems: "center",
    gap: 9,
  },
  petImageOuter: {
    width: 116,
    height: 116,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.26)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.78)",
    position: "relative",
  },
  petImageInner: {
    width: 102,
    height: 102,
    borderRadius: 33,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.20)",
  },
  petImage: {
    width: "100%",
    height: "100%",
  },
  petPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  petPlaceholderEmoji: {
    fontSize: 46,
  },
  petMiniBadge: {
    position: "absolute",
    right: -6,
    bottom: -5,
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.55)",
  },
  petMiniBadgeText: {
    fontSize: 15,
  },
  petName: {
    maxWidth: 116,
    fontSize: 16,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
  },
  petMeta: {
    maxWidth: 116,
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.78)",
    textAlign: "center",
    marginTop: -6,
  },

  heartCenter: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  heartCircle: {
    width: 56,
    height: 56,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.55)",
  },
  heartText: {
    color: "#ff6b6b",
    fontSize: 28,
    fontWeight: "900",
    marginTop: -2,
  },

  matchCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 24,
    padding: 14,
  },
  matchCardIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  matchCardEmoji: {
    fontSize: 23,
  },
  matchCardCopy: {
    flex: 1,
  },
  matchCardTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
  matchCardText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
    fontWeight: "600",
  },

  actions: {
    width: "100%",
    gap: 10,
  },
  primaryButton: {
    width: "100%",
    height: 56,
    borderRadius: 19,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.14 : 0,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  primaryButtonText: {
    color: "#ff6b6b",
    fontWeight: "900",
    fontSize: 16,
  },
});
