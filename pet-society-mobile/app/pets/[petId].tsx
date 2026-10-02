import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { ImageFallback } from "@/components/ImageFallback";
import { PetDocumentBadges } from "@/components/pets/PetDocumentBadges";
import { PetVerifiedBadge } from "@/components/pets/PetVerifiedBadge";
import { PetTrustDocuments } from "@/components/pets/PetTrustDocuments";
import { useAuth } from "@/context/AuthContext";
import {
  resolvePetBreed,
  resolvePetImage,
  resolvePetName,
  resolvePetType,
} from "@/utils/pet";
import { useColors } from "@/hooks/useColors";
import { usePets, type Match, type Pet } from "@/context/PetsContext";
import { fetchPetById } from "@/services/petsApi";
import { ReportSheet } from "@/components/reports/ReportSheet";
import { blockUser, getSafetyErrorMessage } from "@/services/safetyApi";

type PetWithOwner = Partial<Pet> & {
  id?: string | number;
  owner?: {
    id?: string | number;
    name?: string | null;
    email?: string | null;
  } | null;
  user?: {
    id?: string | number;
    name?: string | null;
    email?: string | null;
  } | null;
  owner_name?: string | null;
  user_name?: string | null;
  pet_name?: string;
  pet_type?: string;
  user_id?: string | number | null;
  images?: Array<{
    url?: string | null;
    image_path?: string | null;
  }>;
};

function getOwnerName(pet?: PetWithOwner | null) {
  return (
    pet?.owner?.name ??
    pet?.user?.name ??
    pet?.owner_name ??
    pet?.user_name ??
    null
  );
}

function getOwnerId(pet?: PetWithOwner | null) {
  const ownerId = pet?.user_id ?? pet?.owner?.id ?? pet?.user?.id;

  if (ownerId == null || ownerId === "") return null;

  return String(ownerId);
}

function distanceLabel(distance?: number | string | null) {
  if (distance == null || Number.isNaN(Number(distance))) return "";

  return `${Number(distance).toFixed(1)} km away`;
}

function ageLabel(age?: number | string | null) {
  if (age == null || age === "") return "";

  const value = Number(age);

  if (!Number.isFinite(value)) return "";

  return `${value} yr${value === 1 ? "" : "s"}`;
}

function findPetByIdFromContext({
  petId,
  myPets,
  browsePets,
  matches,
}: {
  petId: string;
  myPets: Pet[];
  browsePets: Pet[];
  matches: Match[];
}) {
  const directPet = [...myPets, ...browsePets].find(
    (pet) => String(pet.id) === petId,
  );

  if (directPet) return directPet as PetWithOwner;

  for (const match of matches) {
    const candidates = [
      match.my_pet,
      match.matched_pet,
      match.pet_one,
      match.pet_two,
    ];

    const found = candidates.find((pet) => String(pet?.id ?? "") === petId);

    if (found) return found as PetWithOwner;
  }

  return null;
}

function InfoChip({
  icon,
  label,
  tint,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  tint: string;
}) {
  return (
    <View
      style={[
        styles.infoChip,
        {
          backgroundColor: tint + "14",
          borderColor: tint + "28",
        },
      ]}
    >
      <Feather name={icon} size={13} color={tint} />
      <Text style={[styles.infoChipText, { color: tint }]} numberOfLines={1}>
        {label || "Not set"}
      </Text>
    </View>
  );
}

function PetNotFound({ message }: { message?: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View
      style={[
        styles.notFoundScreen,
        {
          backgroundColor: colors.background,
          paddingTop: topPad + 16,
        },
      ]}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        style={[
          styles.backBtn,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        activeOpacity={0.82}
      >
        <Feather name="arrow-left" size={21} color={colors.foreground} />
      </TouchableOpacity>

      <View
        style={[
          styles.emptyIcon,
          {
            backgroundColor: colors.primary + "14",
            borderColor: colors.primary + "24",
          },
        ]}
      >
        <Text style={styles.emptyEmoji}>🐾</Text>
      </View>

      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        Pet not found
      </Text>

      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        {message ?? "This pet may have been removed or is not loaded yet."}
      </Text>

      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        activeOpacity={0.86}
      >
        <Feather name="arrow-left" size={17} color={colors.primaryForeground} />
        <Text
          style={[styles.primaryBtnText, { color: colors.primaryForeground }]}
        >
          Go back
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function PetDetailsLoading() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [pulse]);

  return (
    <View
      style={[
        styles.notFoundScreen,
        {
          backgroundColor: colors.background,
          paddingTop: topPad + 16,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.loadingSkeleton,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.58, 1],
            }),
          },
        ]}
      >
        <View
          style={[
            styles.loadingHero,
            { backgroundColor: colors.secondary },
          ]}
        />
        <View
          style={[
            styles.loadingLineWide,
            { backgroundColor: colors.secondary },
          ]}
        />
        <View
          style={[
            styles.loadingLineShort,
            { backgroundColor: colors.secondary },
          ]}
        />
      </Animated.View>
      <ActivityIndicator color={colors.primary} size="small" />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        Loading profile
      </Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        Fetching the latest pet details.
      </Text>
    </View>
  );
}

export default function PetDetailsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { petId, source, matchId, conversationId } = useLocalSearchParams<{
    petId?: string;
    source?: string;
    matchId?: string;
    conversationId?: string;
  }>();
  const {
    myPets,
    browsePets,
    matches,
    removeBrowsePetsForUserLocal,
    removeMatchesForUserLocal,
  } = usePets();
  const { token, user, isLoading: isAuthLoading } = useAuth();
  const [remotePet, setRemotePet] = useState<PetWithOwner | null>(null);
  const [isFetchingRemotePet, setIsFetchingRemotePet] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [remotePetError, setRemotePetError] = useState<string | null>(null);

  const normalizedPetId = String(petId ?? "");

  const localPet = useMemo(
    () =>
      normalizedPetId
        ? findPetByIdFromContext({
          petId: normalizedPetId,
          myPets,
          browsePets,
          matches,
        })
        : null,
    [browsePets, matches, myPets, normalizedPetId],
  );

  useEffect(() => {
    let isMounted = true;

    if (!normalizedPetId || localPet || !token) {
      setIsFetchingRemotePet(false);
      setRemotePetError(null);

      if (localPet || !normalizedPetId) {
        setRemotePet(null);
      }

      return () => {
        isMounted = false;
      };
    }

    setIsFetchingRemotePet(true);
    setRemotePetError(null);
    setRemotePet(null);

    fetchPetById(token, normalizedPetId)
      .then((petFromApi) => {
        if (!isMounted) return;

        setRemotePet(petFromApi as PetWithOwner);
      })
      .catch((error) => {
        if (!isMounted) return;

        setRemotePet(null);
        setRemotePetError(
          error instanceof Error
            ? error.message
            : "Pet profile is not available right now.",
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsFetchingRemotePet(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [localPet, normalizedPetId, token]);

  const pet = localPet ?? remotePet;
  const ownerId = getOwnerId(pet);
  const ownerName = getOwnerName(pet);
  const name = resolvePetName(pet);
  const type = resolvePetType(pet);
  const breed = resolvePetBreed(pet);
  const image = resolvePetImage(pet);
  const age = ageLabel(pet?.age);
  const distance = distanceLabel(pet?.distance_km);
  const hasOpenChatAction = source === "match" && matchId && conversationId;
  const canActOnOwner = ownerId != null && String(ownerId) !== String(user?.id);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!pet && (isFetchingRemotePet || (isAuthLoading && Boolean(normalizedPetId)))) {
    return <PetDetailsLoading />;
  }

  if (!pet) {
    return (
      <PetNotFound
        message={
          remotePetError ??
          (!token ? "Sign in again to view this pet profile." : undefined)
        }
      />
    );
  }

  function confirmBlockOwner() {
    if (!token || !ownerId || isBlocking) return;

    Alert.alert(
      "Block this user?",
      "They will no longer be able to contact you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setIsBlocking(true);

            try {
              await blockUser(token, ownerId);
              removeBrowsePetsForUserLocal(ownerId);
              removeMatchesForUserLocal(ownerId);
              Alert.alert("User blocked.");
              router.back();
            } catch (error) {
              Alert.alert("Could not block user", getSafetyErrorMessage(error));
            } finally {
              setIsBlocking(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.decorLayer} pointerEvents="none">
        <View
          style={[
            styles.decorBlobOne,
            { backgroundColor: colors.primary + "12" },
          ]}
        />
        <View
          style={[
            styles.decorBlobTwo,
            { backgroundColor: colors.match + "12" },
          ]}
        />
      </View>

      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={21} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Pet profile
          </Text>
        </View>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 28 },
        ]}
      >
        <View
          style={[
            styles.hero,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <ImageFallback
            uri={image}
            containerStyle={StyleSheet.absoluteFill}
            fallback={
              <LinearGradient
                colors={[colors.secondary, colors.card]}
                style={styles.heroPlaceholder}
              >
                <Text style={styles.placeholderEmoji}>🐾</Text>
                <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
                  No photo yet
                </Text>
              </LinearGradient>
            }
            accessibilityLabel={`${name} photo`}
          />

          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.72)"]}
            style={styles.heroGradient}
          />

          <View style={styles.heroText}>
            <Text style={styles.heroEyebrow}>{type}</Text>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName} numberOfLines={1}>
                {name}
              </Text>

              <PetVerifiedBadge pet={pet} compact />
            </View>
            <Text style={styles.heroMeta} numberOfLines={1}>
              {[breed, age, distance].filter(Boolean).join(" • ")}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Details
          </Text>

          <View style={styles.chips}>
            <InfoChip icon="heart" label={type} tint={colors.primary} />
            {breed ? <InfoChip icon="star" label={breed} tint="#6c63ff" /> : null}
            {age ? <InfoChip icon="calendar" label={age} tint={colors.accent} /> : null}
            {pet.gender ? (
              <InfoChip icon="user" label={pet.gender} tint="#00b894" />
            ) : null}
            {distance ? (
              <InfoChip icon="map-pin" label={distance} tint={colors.dislike} />
            ) : null}
            <PetDocumentBadges pet={pet} compact includeVaccination />
          </View>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Documents
          </Text>

          <PetTrustDocuments
            pet={pet}
            onOpenError={(label) =>
              Alert.alert("Could not open document", `${label} is not available right now.`)
            }
          />
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            About
          </Text>
          <Text style={[styles.bioText, { color: colors.mutedForeground }]}>
            {pet.bio?.trim() ||
              "No bio yet. Still mysterious. Very suspicious."}
          </Text>
        </View>

        {ownerName ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Owner
            </Text>
            <View style={styles.ownerRow}>
              <View
                style={[
                  styles.ownerAvatar,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Feather name="user" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.ownerName, { color: colors.foreground }]}>
                {ownerName}
              </Text>
            </View>
          </View>
        ) : null}

        {canActOnOwner ? (
          <View style={styles.safetyActions}>
            <TouchableOpacity
              onPress={() => setReportVisible(true)}
              style={[
                styles.safetyBtn,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                },
              ]}
              activeOpacity={0.84}
            >
              <Feather name="flag" size={16} color={colors.foreground} />
              <Text style={[styles.safetyBtnText, { color: colors.foreground }]}>
                Report Pet
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={confirmBlockOwner}
              disabled={isBlocking}
              style={[
                styles.safetyBtn,
                {
                  backgroundColor: colors.destructive + "14",
                  borderColor: colors.destructive + "30",
                  opacity: isBlocking ? 0.6 : 1,
                },
              ]}
              activeOpacity={0.84}
            >
              <Feather name="slash" size={16} color={colors.destructive} />
              <Text style={[styles.safetyBtnText, { color: colors.destructive }]}>
                {isBlocking ? "Blocking..." : "Block User"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {hasOpenChatAction ? (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/chat/[matchId]",
                params: {
                  matchId: String(matchId),
                  conversationId: String(conversationId),
                },
              })
            }
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.86}
          >
            <Feather name="message-circle" size={18} color={colors.primaryForeground} />
            <Text
              style={[
                styles.primaryBtnText,
                { color: colors.primaryForeground },
              ]}
            >
              Open chat
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <ReportSheet
        visible={reportVisible}
        title="Report Pet"
        target={
          pet?.id != null
            ? {
              reportable_type: "pet",
              reportable_id: pet.id,
              reported_user_id: ownerId,
            }
            : null
        }
        onClose={() => setReportVisible(false)}
        onSubmitted={() => Alert.alert("Report submitted. Our team will review it.")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  decorLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  decorBlobOne: {
    position: "absolute",
    top: 120,
    left: -95,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  decorBlobTwo: {
    position: "absolute",
    right: -120,
    bottom: 150,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 2,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    maxWidth: "100%",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  headerSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 18,
    gap: 18,
  },
  hero: {
    height: 390,
    borderRadius: 30,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  placeholderEmoji: {
    fontSize: 72,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: "800",
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroText: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 20,
  },
  heroEyebrow: {
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 8,
  },
  heroName: {
    flexShrink: 1,
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroMeta: {
    marginTop: 4,
    color: "rgba(255,255,255,0.86)",
    fontSize: 14,
    fontWeight: "700",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  infoChipText: {
    maxWidth: 220,
    fontSize: 12,
    fontWeight: "900",
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.04 : 0,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  documentRows: {
    gap: 0,
  },
  documentRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  documentCopy: {
    flex: 1,
    minWidth: 0,
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: "900",
  },
  documentStatus: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  documentAction: {
    maxWidth: 178,
    minHeight: 34,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  documentActionText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "900",
  },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ownerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  safetyActions: {
    flexDirection: "row",
    gap: 10,
  },
  safetyBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  safetyBtnText: {
    fontSize: 13,
    fontWeight: "900",
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "900",
  },
  notFoundScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  loadingSkeleton: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 28,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  loadingHero: {
    height: 190,
    borderRadius: 22,
  },
  loadingLineWide: {
    width: "68%",
    height: 18,
    borderRadius: 999,
  },
  loadingLineShort: {
    width: "42%",
    height: 12,
    borderRadius: 999,
  },
  emptyIcon: {
    width: 106,
    height: 106,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-4deg" }],
  },
  emptyEmoji: {
    fontSize: 52,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
  },
});
