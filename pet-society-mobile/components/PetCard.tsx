// components/PetCard.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import type { Pet } from "@/context/PetsContext";
import { ImageFallback } from "@/components/ImageFallback";
import { PetDocumentBadges } from "@/components/pets/PetDocumentBadges";
import { PetVerifiedBadge } from "@/components/pets/PetVerifiedBadge";
import { getPetTypeEmoji } from "@/constants/petTypes";
import {
  resolvePetBreed,
  resolvePetImage,
  resolvePetName,
  resolvePetTypeRaw,
  resolvePetTypeWithEmoji,
} from "@/utils/pet";

/** Export a helper to compute card dimensions from screen width */
export function useCardDimensions() {
  const { width } = useWindowDimensions();
  const CARD_WIDTH = Math.min(Math.max(width - 48, 280), 420);
  const CARD_HEIGHT = Math.min(CARD_WIDTH * 1.35, 560);
  return { CARD_WIDTH, CARD_HEIGHT };
}

/** Fallback static values */
export const CARD_WIDTH = 320;

type Props = {
  pet: Pet;
  showPhotoDots?: boolean;
  /** When provided (usually with height), aligns card size with parent swipe container */
  width?: number;
  height?: number;
};

export function PetCard({
  pet,
  showPhotoDots = true,
  width: widthProp,
  height: heightProp,
}: Props) {
  const dims = useCardDimensions();
  const CARD_WIDTH = widthProp ?? dims.CARD_WIDTH;
  const CARD_HEIGHT = heightProp ?? dims.CARD_HEIGHT;

  const petName = resolvePetName(pet, "Unknown Pet");
  const petType = resolvePetTypeRaw(pet) ?? "";
  const petTypeDisplay = petType ? resolvePetTypeWithEmoji(pet) : "";
  const petBreed = resolvePetBreed(pet);
  const petAge = pet.age;
  const petBio = pet.bio || "";
  const petLocation = pet.location ||
    (pet.distance_km ? `${pet.distance_km} km away` : "");
  const firstImage = resolvePetImage(pet);

  const photoCount = pet.images?.length || 1;

  // Gender icon
  const getGenderIcon = (gender: string) => {
    const g = gender?.toLowerCase();
    if (g === "male") return "♂";
    if (g === "female") return "♀";
    return "";
  };

  return (
    <View style={[styles.card, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
      {/* IMAGE */}
      <ImageFallback
        uri={firstImage}
        containerStyle={StyleSheet.absoluteFill}
        fallback={
          <LinearGradient
            colors={["#667eea", "#764ba2"]}
            style={[StyleSheet.absoluteFill, styles.placeholder]}
          >
            <Text style={styles.placeholderEmoji}>
              {getPetTypeEmoji(petType)}
            </Text>
            <Text style={styles.placeholderText}>No photo yet</Text>
          </LinearGradient>
        }
        accessibilityLabel={`${petName} photo`}
      />

      {/* GRADIENT OVERLAY */}
      <LinearGradient
        colors={[
          "rgba(0,0,0,0)",
          "rgba(0,0,0,0.15)",
          "rgba(0,0,0,0.65)",
          "rgba(0,0,0,0.9)",
        ]}
        locations={[0, 0.4, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* TOP PHOTO INDICATORS */}
      {showPhotoDots && photoCount > 1 && (
        <View style={styles.bars}>
          {Array.from({ length: Math.min(photoCount, 5) }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                i === 0 ? styles.barActive : styles.barInactive,
              ]}
            />
          ))}
        </View>
      )}

      {/* PET INFO */}
      <View style={styles.info}>
        {/* Name + Age */}
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {petName}
            {petAge != null && ` ${petAge}`}
          </Text>
          <PetVerifiedBadge pet={pet} compact />
          {pet.gender && (
            <View style={styles.genderBadge}>
              <Text style={styles.genderText}>
                {getGenderIcon(pet.gender)}
              </Text>
            </View>
          )}
        </View>

        {/* Breed + Type */}
        {(petBreed || petType) && (
          <View style={styles.metaRow}>
            <Text style={styles.emoji}>{getPetTypeEmoji(petType)}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[petBreed, petTypeDisplay].filter(Boolean).join(" • ")}
            </Text>
          </View>
        )}

        {/* Location */}
        {petLocation && (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.meta} numberOfLines={1}>
              {petLocation}
            </Text>
          </View>
        )}

        {/* Bio */}
        {petBio ? (
          <View style={styles.bioContainer}>
            <Text style={styles.bio} numberOfLines={3}>
              {petBio}
            </Text>
          </View>
        ) : null}
      </View>

      {/* FLOATING BADGES */}
      <View style={styles.badges}>
        <PetDocumentBadges pet={pet} compact />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#1a1a2e",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
  },

  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  placeholderEmoji: {
    fontSize: 64,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0.5,
  },

  bars: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 5,
    zIndex: 10,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  barActive: {
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  barInactive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },

  info: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 6,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: {
    flex: 1,
    fontSize: 28,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  genderBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    backdropFilter: "blur(10px)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  genderText: {
    fontSize: 18,
    color: "#fff",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emoji: {
    fontSize: 14,
  },
  meta: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0.2,
  },

  bioContainer: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  bio: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
    letterSpacing: 0.1,
  },

  badges: {
    position: "absolute",
    top: 12,
    right: 12,
    gap: 6,
    zIndex: 10,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1a1a2e",
  },
});
