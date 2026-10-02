import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
  Animated,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { usePets, type Pet } from "@/context/PetsContext";
import { ImageFallback } from "@/components/ImageFallback";
import { PetDocumentBadges } from "@/components/pets/PetDocumentBadges";
import { PetVerifiedBadge } from "@/components/pets/PetVerifiedBadge";
import {
  formatPetTypeWithEmoji,
  getPetTypeColor,
  getPetTypeEmoji,
} from "@/constants/petTypes";
import {
  resolvePetImage,
  resolvePetName,
  resolvePetTypeRaw,
} from "@/utils/pet";
import { getAdoptionErrorMessage, getMyAdoptionListings } from "@/services/adoptionApi";
import type { AdoptionListing, Pet as AdoptionPet } from "@/types/adoption";
import {
  isActiveAdoptionStatus,
  isPetCompleteForAdoption,
  listingPetId,
} from "@/utils/adoption";

function safeHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "web") return;

  Haptics.impactAsync(style).catch(() => { });
}

function petAgeLabel(age?: number | null) {
  if (age == null) return "Age unknown";

  return `${age} yr${age !== 1 ? "s" : ""}`;
}

function ProfileScoreBadge({ pet }: { pet: Pet }) {
  const colors = useColors();

  const score =
    35 +
    (pet.image ? 25 : 0) +
    (pet.name ? 10 : 0) +
    (pet.breed ? 10 : 0) +
    (pet.age != null ? 10 : 0) +
    (pet.gender ? 10 : 0);

  const finalScore = Math.min(score, 100);
  const isStrong = finalScore >= 80;

  return (
    <View
      style={[
        styles.profileScoreBadge,
        {
          backgroundColor: isStrong ? "#00b89418" : colors.secondary,
          borderColor: isStrong ? "#00b89435" : colors.border,
        },
      ]}
    >
      <Feather
        name={isStrong ? "star" : "zap"}
        size={12}
        color={isStrong ? "#00b894" : colors.mutedForeground}
      />

      <Text
        style={[
          styles.profileScoreText,
          { color: isStrong ? "#00b894" : colors.mutedForeground },
        ]}
      >
        {finalScore}% profile
      </Text>
    </View>
  );
}

function StatPill({
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
        styles.statPill,
        {
          backgroundColor: tint + "16",
          borderColor: tint + "30",
        },
      ]}
    >
      <Feather name={icon} size={13} color={tint} />
      <Text style={[styles.statPillText, { color: tint }]}>{label}</Text>
    </View>
  );
}

function PetCard({
  item,
  onEdit,
  onDelete,
  onListForAdoption,
  onManageAdoption,
  adoptionListing,
  deleting,
  delay,
}: {
  item: Pet;
  onEdit: () => void;
  onDelete: () => void;
  onListForAdoption: () => void;
  onManageAdoption: () => void;
  adoptionListing?: AdoptionListing | null;
  deleting: boolean;
  delay: number;
}) {
  const colors = useColors();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(34)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const resolvedType = resolvePetTypeRaw(item);
  const firstImage = resolvePetImage(item);
  const typeColor = getPetTypeColor(resolvedType);
  const typeEmoji = getPetTypeEmoji(resolvedType);
  const typeLabel = formatPetTypeWithEmoji(resolvedType);
  const adoptionPet = item as unknown as AdoptionPet;
  const completeForAdoption = isPetCompleteForAdoption(adoptionPet);
  const hasActiveAdoption = Boolean(adoptionListing);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 420,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay,
        damping: 18,
        stiffness: 120,
        useNativeDriver: true,
      }),
      Animated.spring(rotateAnim, {
        toValue: 1,
        delay,
        damping: 14,
        stiffness: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, fadeAnim, rotateAnim, slideAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-2deg", "0deg"],
  });

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { rotate }],
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={() =>
            Animated.spring(scaleAnim, {
              toValue: 0.975,
              damping: 15,
              useNativeDriver: true,
            }).start()
          }
          onPressOut={() =>
            Animated.spring(scaleAnim, {
              toValue: 1,
              damping: 15,
              useNativeDriver: true,
            }).start()
          }
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.cardTopGlow} pointerEvents="none">
            <View
              style={[
                styles.cardGlowBlob,
                {
                  backgroundColor: typeColor + "20",
                },
              ]}
            />

            <Text style={[styles.cardPawDecor, { color: typeColor + "25" }]}>
              🐾
            </Text>
          </View>

          <View style={[styles.photoWrap, { backgroundColor: colors.muted }]}>
            <ImageFallback
              uri={firstImage}
              containerStyle={StyleSheet.absoluteFill}
              fallback={
                <LinearGradient
                  colors={[typeColor + "22", colors.card] as const}
                  style={styles.photoPlaceholder}
                >
                  <Text style={styles.photoPlaceholderEmoji}>{typeEmoji}</Text>

                  <Text
                    style={[
                      styles.photoPlaceholderText,
                      { color: typeColor },
                    ]}
                  >
                    Add a superstar photo
                  </Text>
                </LinearGradient>
              }
              accessibilityLabel={`${resolvePetName(item)} photo`}
            />

            {firstImage ? (
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.70)"]}
                style={styles.photoGradient}
              />
            ) : null}

            <View style={styles.photoFloatingTop}>
              <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
                <Text style={styles.typeBadgeText}>
                  {typeLabel}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={[styles.statusDot, { backgroundColor: "#00b894" }]} />

                <Text style={[styles.statusText, { color: colors.foreground }]}>
                  Active
                </Text>
              </View>
            </View>

            <View style={styles.photoNameOverlay}>
              <Text style={styles.photoName} numberOfLines={1}>
                {resolvePetName(item)}
              </Text>

              <Text style={styles.photoSubtitle} numberOfLines={1}>
                {item.breed || "Mystery breed"} · {petAgeLabel(item.age)}
              </Text>
            </View>
          </View>

          <View style={styles.info}>
            <View style={styles.nameRow}>
              <View style={styles.nameCopy}>
                <View style={styles.petNameLine}>
                  <Text
                    style={[
                      styles.petName,
                      styles.petNameInLine,
                      { color: colors.foreground },
                    ]}
                    numberOfLines={1}
                  >
                    {resolvePetName(item)}
                  </Text>

                  <PetVerifiedBadge pet={item} compact />
                </View>

                <Text
                  style={[styles.breed, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {item.breed || "No breed specified yet"}
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => {
                    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
                    onEdit();
                  }}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: colors.secondary,
                      borderColor: colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Feather name="edit-2" size={15} color={colors.foreground} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (deleting) return;
                    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
                    onDelete();
                  }}
                  disabled={deleting}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: colors.destructive + "15",
                      borderColor: colors.destructive + "30",
                      opacity: deleting ? 0.5 : 1,
                    },
                  ]}
                  activeOpacity={0.8}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Feather
                    name="trash-2"
                    size={15}
                    color={colors.destructive}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.chips}>
              {item.age != null ? (
                <View style={[styles.chip, { backgroundColor: typeColor + "15" }]}>
                  <Feather name="calendar" size={11} color={typeColor} />

                  <Text style={[styles.chipText, { color: typeColor }]}>
                    {petAgeLabel(item.age)}
                  </Text>
                </View>
              ) : null}

              {item.gender ? (
                <View style={[styles.chip, { backgroundColor: colors.secondary }]}>
                  <Feather
                    name={
                      item.gender.toLowerCase() === "male"
                        ? "arrow-up"
                        : item.gender.toLowerCase() === "female"
                          ? "arrow-down"
                          : "minus"
                    }
                    size={11}
                    color={colors.mutedForeground}
                  />

                  <Text style={[styles.chipText, { color: colors.mutedForeground }]}>
                    {item.gender}
                  </Text>
                </View>
              ) : null}

              <ProfileScoreBadge pet={item} />
              <PetDocumentBadges pet={item} compact />
            </View>

            {!completeForAdoption ? (
              <View
                style={[
                  styles.adoptionWarning,
                  {
                    backgroundColor: colors.warning + "12",
                    borderColor: colors.warning + "28",
                  },
                ]}
              >
                <Feather name="alert-circle" size={14} color={colors.warning} />
                <Text style={[styles.adoptionWarningText, { color: colors.warning }]}>
                  Complete profile before adoption.
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.adoptionPanel,
                {
                  backgroundColor: hasActiveAdoption
                    ? "#00b89412"
                    : colors.secondary,
                  borderColor: hasActiveAdoption
                    ? "#00b89432"
                    : colors.border,
                },
              ]}
            >
              <View style={styles.adoptionPanelCopy}>
                <Text
                  style={[
                    styles.adoptionPanelTitle,
                    { color: colors.foreground },
                  ]}
                >
                  {hasActiveAdoption ? "Adoption listing active" : "Community adoption"}
                </Text>
                <Text
                  style={[
                    styles.adoptionPanelSub,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {hasActiveAdoption
                    ? `Status: ${adoptionListing?.status ?? "active"}`
                    : "List this pet for a trusted home"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  safeHaptic(Haptics.ImpactFeedbackStyle.Light);
                  hasActiveAdoption ? onManageAdoption() : onListForAdoption();
                }}
                activeOpacity={0.84}
                style={[
                  styles.adoptionActionBtn,
                  { backgroundColor: hasActiveAdoption ? "#00b894" : colors.primary },
                ]}
              >
                <Text style={styles.adoptionActionText}>
                  {hasActiveAdoption ? "Manage Adoption" : "Put for Adoption"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
              <View style={styles.footerLeft}>
                <Text style={styles.footerEmoji}>✨</Text>

                <Text
                  style={[styles.footerText, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  Ready to appear in discovery
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  safeHaptic(Haptics.ImpactFeedbackStyle.Light);
                  onEdit();
                }}
                activeOpacity={0.82}
                style={[
                  styles.footerAction,
                  {
                    backgroundColor: typeColor + "15",
                  },
                ]}
              >
                <Text style={[styles.footerActionText, { color: typeColor }]}>
                  Polish
                </Text>

                <Feather name="arrow-right" size={13} color={typeColor} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

function SkeletonCard({ colors }: { colors: any }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 820,
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 820,
          useNativeDriver: false,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.72],
  });

  return (
    <Animated.View
      style={[
        styles.skeletonCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity,
        },
      ]}
    >
      <View style={[styles.skeletonPhoto, { backgroundColor: colors.muted }]} />

      <View style={styles.skeletonBody}>
        <View
          style={[
            styles.skeletonLine,
            { width: "60%", height: 22, backgroundColor: colors.muted },
          ]}
        />

        <View
          style={[
            styles.skeletonLine,
            { width: "42%", height: 14, backgroundColor: colors.muted },
          ]}
        />

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View
            style={[
              styles.skeletonLine,
              {
                width: 62,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.muted,
              },
            ]}
          />

          <View
            style={[
              styles.skeletonLine,
              {
                width: 76,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.muted,
              },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

function EmptyState({ colors }: { colors: any }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyCircle, { backgroundColor: colors.primary + "15" }]}>
        <Text style={styles.emptyEmoji}>🐾</Text>
        <Text style={styles.emptyMiniEmoji}>✨</Text>
      </View>

      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        No pets yet
      </Text>

      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        Add your first pet to start matching.
      </Text>

      <TouchableOpacity
        style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
        onPress={() => {
          safeHaptic(Haptics.ImpactFeedbackStyle.Light);
          router.push("/add-pet");
        }}
        activeOpacity={0.88}
      >
        <Feather name="plus" size={18} color="#fff" />

        <Text style={styles.emptyBtnText}>Add pet</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MyPetsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { myPets, fetchMyPets, deletePet, isLoading } = usePets();
  const [refreshing, setRefreshing] = useState(false);
  const [deletingPetId, setDeletingPetId] = useState<string | null>(null);
  const [adoptionListings, setAdoptionListings] = useState<AdoptionListing[]>([]);
  const [adoptionError, setAdoptionError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const stats = useMemo(() => {
    const withPhotos = myPets.filter((pet) => Boolean(resolvePetImage(pet))).length;
    const completeProfiles = myPets.filter((pet) => {
      return (
        Boolean(resolvePetImage(pet)) &&
        Boolean(resolvePetName(pet)) &&
        Boolean(pet.breed)
      );
    }).length;

    return {
      total: myPets.length,
      withPhotos,
      completeProfiles,
    };
  }, [myPets]);

  const activeListingByPetId = useMemo(() => {
    return adoptionListings.reduce<Record<string, AdoptionListing>>((acc, listing) => {
      const petId = listingPetId(listing);

      if (petId != null && isActiveAdoptionStatus(listing.status)) {
        acc[String(petId)] = listing;
      }

      return acc;
    }, {});
  }, [adoptionListings]);

  const fetchAdoptionListings = useCallback(async () => {
    if (!token) return;

    try {
      const result = await getMyAdoptionListings(token);
      setAdoptionListings(result.items);
      setAdoptionError("");
    } catch (err) {
      setAdoptionError(getAdoptionErrorMessage(err));
    }
  }, [token]);

  useEffect(() => {
    fetchMyPets();
    fetchAdoptionListings();
  }, [fetchAdoptionListings, fetchMyPets]);

  useFocusEffect(
    useCallback(() => {
      fetchMyPets();
      fetchAdoptionListings();
    }, [fetchAdoptionListings, fetchMyPets]),
  );

  async function handleRefresh() {
    if (refreshing) return;

    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);

    try {
      await Promise.all([fetchMyPets(), fetchAdoptionListings()]);
    } finally {
      setRefreshing(false);
    }
  }

  function showIncompleteAdoptionModal(pet: Pet) {
    Alert.alert(
      "This pet profile is missing required adoption details.",
      "Add an image, type, age, gender, and location before listing for adoption.",
      [
        {
          text: "Complete Profile",
          onPress: () =>
            router.push({
                pathname: "/add-pet",
              params: {
                id: String(pet.id),
                adoptionMode: "true",
                returnTo: "adoption",
              },
            }),
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  }

  function handleListForAdoption(pet: Pet) {
    const activeListing = activeListingByPetId[String(pet.id)];

    if (activeListing) {
      router.push(`/my-adoption-listings/${activeListing.id}`);
      return;
    }

    if (!isPetCompleteForAdoption(pet as unknown as AdoptionPet)) {
      showIncompleteAdoptionModal(pet);
      return;
    }

    router.push(`/adoption/list-existing/${pet.id}`);
  }

  async function handleDelete(pet: Pet) {
    const petId = pet.id != null && pet.id !== "" ? String(pet.id) : "";

    if (!petId) return;

    Alert.alert("Remove Pet", `Remove ${pet.name} from your profile?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          if (deletingPetId) return;

          safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
          setDeletingPetId(petId);

          try {
            const removed = await deletePet(petId);

            if (!removed) {
              Alert.alert(
                "Could not remove pet",
                "Something went wrong. Please try again in a moment.",
              );
            }
          } finally {
            setDeletingPetId(null);
          }
        },
      },
    ]);
  }

  const showSkeleton = isLoading && myPets.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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

        <Text style={[styles.decorPawOne, { color: colors.primary + "18" }]}>
          🐾
        </Text>

        <Text style={[styles.decorPawTwo, { color: colors.match + "16" }]}>
          🐾
        </Text>
      </View>

      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              PET PROFILES
            </Text>

            <Text style={[styles.title, { color: colors.foreground }]}>
              My Pets
            </Text>

            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {myPets.length === 0
                ? "No pets registered yet"
                : `${myPets.length} pet${myPets.length !== 1 ? "s" : ""
                } ready to be famous`}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => {
                safeHaptic(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/profile");
              }}
              style={[
                styles.profileShortcutBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              activeOpacity={0.88}
              accessibilityLabel="Open profile"
            >
              <Feather name="user" size={20} color={colors.foreground} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                safeHaptic(Haptics.ImpactFeedbackStyle.Light);
                router.push("/add-pet");
              }}
              style={[
                styles.addBtn,
                {
                  backgroundColor: colors.primary,
                },
              ]}
              activeOpacity={0.88}
              accessibilityLabel="Add pet"
            >
              <Feather name="plus" size={23} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatPill
            icon="heart"
            label={`${stats.total} pet${stats.total !== 1 ? "s" : ""}`}
            tint={colors.primary}
          />

          <StatPill
            icon="image"
            label={`${stats.withPhotos} photo${stats.withPhotos !== 1 ? "s" : ""}`}
            tint="#6c63ff"
          />

          <StatPill
            icon="star"
            label={`${stats.completeProfiles} polished`}
            tint="#00b894"
          />
        </View>

        <TouchableOpacity
          onPress={() => {
            safeHaptic(Haptics.ImpactFeedbackStyle.Light);
            router.push("/adoption/select-pet");
          }}
          activeOpacity={0.86}
          style={[
            styles.adoptionHeaderBtn,
            {
              backgroundColor: colors.primary,
            },
          ]}
        >
          <Feather name="home" size={17} color={colors.primaryForeground} />
          <Text
            style={[
              styles.adoptionHeaderBtnText,
              { color: colors.primaryForeground },
            ]}
          >
            List a Pet for Adoption
          </Text>
        </TouchableOpacity>

        {adoptionError ? (
          <Text style={[styles.adoptionErrorText, { color: colors.destructive }]}>
            {adoptionError}
          </Text>
        ) : null}
      </View>

      {showSkeleton ? (
        <View style={[styles.skeletonList, { paddingBottom: bottomPad + 110 }]}>
          <Text style={[styles.loadingLabel, { color: colors.mutedForeground }]}>
            Loading pets...
          </Text>
          <SkeletonCard colors={colors} />
          <SkeletonCard colors={colors} />
        </View>
      ) : (
        <FlatList
          data={myPets}
          keyExtractor={(item, index) =>
            item?.id != null ? String(item.id) : `pet-${index}`
          }
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomPad + 110 },
            myPets.length === 0 && { flex: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={<EmptyState colors={colors} />}
          renderItem={({ item, index }) => (
            <PetCard
              item={item}
              delay={index * 80}
              adoptionListing={activeListingByPetId[String(item.id)]}
              onListForAdoption={() => handleListForAdoption(item)}
              onManageAdoption={() => {
                const listing = activeListingByPetId[String(item.id)];

                if (listing) {
                  router.push(`/my-adoption-listings/${listing.id}`);
                }
              }}
              onEdit={() => {
                if (item.id == null || item.id === "") return;

                router.push({
                  pathname: "/add-pet",
                  params: { id: String(item.id) },
                });
              }}
              onDelete={() => handleDelete(item)}
              deleting={deletingPetId === String(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  decorLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  decorBlobOne: {
    position: "absolute",
    top: 140,
    left: -90,
    width: 230,
    height: 230,
    borderRadius: 115,
  },
  decorBlobTwo: {
    position: "absolute",
    bottom: 180,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  decorPawOne: {
    position: "absolute",
    top: 255,
    right: 26,
    fontSize: 36,
    transform: [{ rotate: "18deg" }],
  },
  decorPawTwo: {
    position: "absolute",
    bottom: 280,
    left: 24,
    fontSize: 32,
    transform: [{ rotate: "-15deg" }],
  },

  header: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    zIndex: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  addBtn: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ff6b6b",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  profileShortcutBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0,
    shadowRadius: 9,
    elevation: 2,
  },

  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  statPillText: {
    fontSize: 12,
    fontWeight: "900",
  },
  adoptionHeaderBtn: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  adoptionHeaderBtnText: {
    fontSize: 14,
    fontWeight: "900",
  },
  adoptionErrorText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "800",
  },

  list: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 16,
  },

  cardWrap: { width: "100%" },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTopGlow: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 2,
  },
  cardGlowBlob: {
    position: "absolute",
    right: -45,
    bottom: 60,
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  cardPawDecor: {
    position: "absolute",
    right: 20,
    bottom: 92,
    fontSize: 28,
    transform: [{ rotate: "17deg" }],
  },

  photoWrap: {
    width: "100%",
    height: 205,
    position: "relative",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 105,
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  photoPlaceholderEmoji: {
    fontSize: 56,
  },
  photoPlaceholderText: {
    fontSize: 13,
    fontWeight: "800",
  },
  photoFloatingTop: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    gap: 4,
  },
  typeBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "900",
  },
  photoNameOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
  },
  photoName: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  photoSubtitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },

  info: {
    padding: 16,
    gap: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  nameCopy: {
    flex: 1,
  },
  petName: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  petNameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  petNameInLine: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  breed: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 3,
  },
  chips: {
    flexDirection: "row",
    gap: 7,
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  profileScoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  profileScoreText: {
    fontSize: 12,
    fontWeight: "800",
  },
  adoptionWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  adoptionWarningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  adoptionPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  adoptionPanelCopy: {
    flex: 1,
    gap: 3,
  },
  adoptionPanelTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  adoptionPanelSub: {
    fontSize: 12,
    fontWeight: "700",
  },
  adoptionActionBtn: {
    minHeight: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 11,
  },
  adoptionActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  footerEmoji: {
    fontSize: 14,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "700",
  },
  footerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  footerActionText: {
    fontSize: 12,
    fontWeight: "900",
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 14,
    paddingTop: 60,
  },
  emptyCircle: {
    width: 116,
    height: 116,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    transform: [{ rotate: "-4deg" }],
  },
  emptyEmoji: {
    fontSize: 54,
  },
  emptyMiniEmoji: {
    position: "absolute",
    right: 20,
    bottom: 16,
    fontSize: 22,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 17,
    marginTop: 6,
    shadowColor: "#ff6b6b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyBtnText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#fff",
  },

  skeletonList: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  loadingLabel: {
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 4,
  },
  skeletonCard: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
  },
  skeletonPhoto: {
    width: "100%",
    height: 205,
  },
  skeletonBody: {
    padding: 16,
    gap: 10,
  },
  skeletonLine: {
    borderRadius: 8,
  },
});
