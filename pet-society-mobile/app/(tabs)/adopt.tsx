import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import {
  EmptyState,
  ErrorState,
  InfoBadge,
  LoadingState,
  ScreenShell,
  StatusBadge,
} from "@/components/adoption/AdoptionComponents";
import { ImageFallback } from "@/components/ImageFallback";
import { PetDocumentBadges } from "@/components/pets/PetDocumentBadges";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getAdoptionErrorMessage, getAdoptionListings } from "@/services/adoptionApi";
import type { AdoptionListing } from "@/types/adoption";
import { getPetDocumentStatus } from "@/utils/petDocuments";
import {
  getCurrentCoordinatesFromUserAction,
  getCurrentCoordinatesIfAlreadyGranted,
} from "@/services/locationService";
import {
  ADOPTION_PET_TYPES,
  asBool,
  distanceLabel,
  formatAdoptionFee,
  petAgeLabel,
  petBreed,
  petGender,
  petImage,
  petName,
  petType,
} from "@/utils/adoption";

const adoptionHeroImage = require("../../assets/images/dog.png");
const RADIUS_OPTIONS = [5, 10, 25, 50];

type FeedFilters = {
  radius: number;
  type: string;
  breed: string;
  gender: string;
  is_vaccinated: boolean;
  good_with_kids: boolean;
  good_with_pets: boolean;
};

function FilterChip({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(active ? 1.015 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.015 : 1,
      damping: 16,
      stiffness: 260,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  function animatePress(toValue: number) {
    if (disabled) return;

    Animated.spring(scale, {
      toValue,
      damping: 18,
      stiffness: 280,
      mass: 0.65,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={disabled ? undefined : onPress}
        onPressIn={() => animatePress(0.96)}
        onPressOut={() => animatePress(active ? 1.015 : 1)}
        disabled={disabled}
        activeOpacity={0.9}
        style={[
          styles.filterChip,
          {
            backgroundColor: active ? colors.primary : colors.card,
            borderColor: active ? colors.primary : colors.border,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.filterChipText,
            { color: active ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function AdoptionBackground() {
  const colors = useColors();

  return (
    <View pointerEvents="none" style={styles.decorLayer}>
      <View
        style={[
          styles.decorBlobOne,
          { backgroundColor: `${colors.primary}12` },
        ]}
      />
      <View
        style={[
          styles.decorBlobTwo,
          { backgroundColor: `${colors.accent}10` },
        ]}
      />
      <View
        style={[
          styles.decorPawOne,
          {
            backgroundColor: `${colors.primary}10`,
            borderColor: `${colors.primary}18`,
          },
        ]}
      >
        <Feather name="heart" size={19} color={`${colors.primary}38`} />
      </View>
      <View
        style={[
          styles.decorPawTwo,
          {
            backgroundColor: `${colors.accent}10`,
            borderColor: `${colors.accent}18`,
          },
        ]}
      >
        <Feather name="home" size={18} color={`${colors.accent}38`} />
      </View>
    </View>
  );
}

function AdoptionListingCard({ listing }: { listing: AdoptionListing }) {
  const colors = useColors();
  const pet = listing.pet;
  const distance = distanceLabel(listing.distance_km);
  const documents = getPetDocumentStatus(pet);
  const description =
    [listing.reason, listing.health_notes, listing.requirements].find(
      (item) => typeof item === "string" && item.trim().length > 0,
    ) ?? "A sweet pet looking for a patient, loving home.";

  return (
    <TouchableOpacity
      onPress={() => router.push(`/adopt/${listing.id}`)}
      activeOpacity={0.9}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.cardWarmWash,
          { backgroundColor: `${colors.primary}08` },
        ]}
      />

      <View style={[styles.cardImageWrap, { backgroundColor: colors.muted }]}>
        <ImageFallback
          uri={petImage(pet)}
          containerStyle={StyleSheet.absoluteFill}
          fallback={
            <LinearGradient
              colors={[`${colors.primary}16`, `${colors.accent}10`]}
              style={styles.cardImageFallback}
            >
              <Feather name="home" size={24} color={colors.primary} />
            </LinearGradient>
          }
          accessibilityLabel={`${petName(pet)} photo`}
        />

        <View style={styles.ageBadge}>
          <Text style={styles.ageBadgeText}>{petAgeLabel(pet?.age)}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardNameBlock}>
            <Text
              style={[styles.petName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {petName(pet)}
            </Text>
            <Text
              style={[styles.petMeta, { color: colors.mutedForeground }]}
              numberOfLines={2}
            >
              {petType(pet)} - {petBreed(pet)} - {petGender(pet)}
            </Text>
          </View>
          <StatusBadge status={listing.status} />
        </View>

        {distance ? (
          <View
            style={[
              styles.distanceRow,
              {
                backgroundColor: `${colors.primary}10`,
                borderColor: `${colors.primary}24`,
              },
            ]}
          >
            <Feather name="map-pin" size={13} color={colors.primary} />
            <Text style={[styles.distanceText, { color: colors.primary }]}>
              {distance}
            </Text>
          </View>
        ) : null}

        <View style={styles.badgeRow}>
          <InfoBadge icon="tag" label={formatAdoptionFee(listing)} tint="#f59f00" />
          <PetDocumentBadges pet={pet} compact includeVaccination />
          {asBool(listing.is_vaccinated) && !documents.hasVaccinationPdf ? (
            <InfoBadge icon="shield" label="Vaccinated" tint="#4caf50" />
          ) : null}
          {asBool(listing.good_with_kids) ? (
            <InfoBadge icon="smile" label="Good with kids" tint="#e040fb" />
          ) : null}
          {asBool(listing.good_with_pets) ? (
            <InfoBadge icon="users" label="Pet friendly" tint="#ff6b6b" />
          ) : null}
        </View>

        <Text
          style={[styles.description, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {description}
        </Text>

        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.viewButton}
        >
          <Text style={styles.viewButtonText}>View Details</Text>
          <Feather name="arrow-right" size={14} color="#fff" />
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

export default function AdoptFeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const locationCheckedRef = useRef(false);

  const [filters, setFilters] = useState<FeedFilters>({
    radius: 10,
    type: "All",
    breed: "All",
    gender: "All",
    is_vaccinated: false,
    good_with_kids: false,
    good_with_pets: false,
  });
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [items, setItems] = useState<AdoptionListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const topPad = Platform.OS === "web" ? 52 : insets.top;
  const bottomPad = Platform.OS === "web" ? 96 : insets.bottom + 96;
  const requestCoords = useCallback(async () => {
    if (locationCheckedRef.current) return coords;

    locationCheckedRef.current = true;

    try {
      const result = await getCurrentCoordinatesIfAlreadyGranted();

      if (!result.coords) {
        setLocationDenied(true);
        return null;
      }

      const nextCoords = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };

      setCoords(nextCoords);
      setLocationDenied(false);

      return nextCoords;
    } catch {
      setLocationDenied(true);
      return null;
    }
  }, [coords]);

  const loadListings = useCallback(
    async ({ reset, nextPage }: { reset: boolean; nextPage?: number }) => {
      if (!token) return;

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      setError("");

      try {
        const resolvedCoords = coords ?? (await requestCoords());
        const currentPage = nextPage ?? 1;
        const params: Record<string, unknown> = {
          limit: 20,
          page: currentPage,
          radius: filters.radius,
          type: filters.type === "All" ? undefined : filters.type,
          breed: filters.breed === "All" ? undefined : filters.breed,
          gender: filters.gender === "All" ? undefined : filters.gender,
          is_vaccinated: filters.is_vaccinated,
          good_with_kids: filters.good_with_kids,
          good_with_pets: filters.good_with_pets,
        };

        if (resolvedCoords) {
          params.latitude = resolvedCoords.latitude;
          params.longitude = resolvedCoords.longitude;
        }

        const result = await getAdoptionListings(token, params);

        setItems((prev) => (reset ? result.items : [...prev, ...result.items]));
        setHasMore(result.hasMore);
        setPage(currentPage);
      } catch (err) {
        setError(getAdoptionErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [coords, filters, requestCoords, token],
  );

  useEffect(() => {
    loadListings({ reset: true, nextPage: 1 });
  }, [filters, loadListings]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    locationCheckedRef.current = false;
    await loadListings({ reset: true, nextPage: 1 });
  }, [loadListings]);

  const handleEnableLocation = useCallback(async () => {
    const result = await getCurrentCoordinatesFromUserAction();

    if (!result.coords) {
      setLocationDenied(true);
      return;
    }

    locationCheckedRef.current = true;
    setCoords(result.coords);
    setLocationDenied(false);
  }, []);

  const handleBrowsePets = useCallback(() => {
    setFilters({
      radius: 10,
      type: "All",
      breed: "All",
      gender: "All",
      is_vaccinated: false,
      good_with_kids: false,
      good_with_pets: false,
    });
  }, []);

  const handleExpandDistance = useCallback(() => {
    setFilters((prev) => ({ ...prev, radius: 50 }));
  }, []);

  const handleEndReached = useCallback(() => {
    if (loading || refreshing || loadingMore || !hasMore) return;

    loadListings({ reset: false, nextPage: page + 1 });
  }, [hasMore, loadListings, loading, loadingMore, page, refreshing]);

  const header = useMemo(
    () => (
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerTop}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            Adoption
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/adoption/select-pet")}
            activeOpacity={0.84}
            style={styles.listPetButton}
          >
            <LinearGradient
              colors={[colors.primary, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.listPetGradient}
            >
              <Feather name="plus" size={17} color="#fff" />
              <Text style={styles.listPetButtonText}>List Pet</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Find pets looking for a loving home
        </Text>

        <LinearGradient
          colors={[colors.secondary, colors.card]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroCopy}>
            <View
              style={[
                styles.heroBadge,
                {
                  backgroundColor: `${colors.card}D9`,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="home" size={13} color={colors.primary} />
              <Text style={[styles.heroBadgeText, { color: colors.primary }]}>
                Second chances
              </Text>
            </View>

            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              Give a pet a second chance
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
              Browse nearby pets or list a pet for adoption.
            </Text>

            <View style={styles.heroActions}>
              <TouchableOpacity
                onPress={handleBrowsePets}
                activeOpacity={0.84}
                style={[styles.heroPrimaryButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.heroPrimaryText}>Browse Pets</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/adoption/select-pet")}
                activeOpacity={0.84}
                style={[
                  styles.heroSecondaryButton,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.heroSecondaryText, { color: colors.primary }]}>
                  List a Pet
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroArt} pointerEvents="none">
            <View
              style={[
                styles.heroPawDotOne,
                { backgroundColor: `${colors.primary}16` },
              ]}
            />
            <View
              style={[
                styles.heroPawDotTwo,
                { backgroundColor: `${colors.accent}18` },
              ]}
            />
            <View
              style={[
                styles.heroPaw,
                {
                  backgroundColor: `${colors.primary}12`,
                  borderColor: `${colors.primary}20`,
                },
              ]}
            >
              <Feather name="heart" size={16} color={`${colors.primary}60`} />
            </View>
            <Image
              source={adoptionHeroImage}
              resizeMode="cover"
              style={styles.heroImage}
              accessibilityIgnoresInvertColors
            />
          </View>
        </LinearGradient>

        {locationDenied && !coords ? (
          <View
            style={[
              styles.locationCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.locationIcon,
                { backgroundColor: `${colors.primary}14` },
              ]}
            >
              <Feather name="map-pin" size={20} color={colors.primary} />
            </View>
            <View style={styles.locationCopy}>
              <Text style={[styles.locationTitle, { color: colors.foreground }]}>
                Find pets near you
              </Text>
              <Text
                style={[
                  styles.locationSubtitle,
                  { color: colors.mutedForeground },
                ]}
              >
                Aleefna uses your location to show nearby adoption pets. You can continue without it and browse broader results.
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleEnableLocation}
              activeOpacity={0.86}
              style={[styles.locationButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.locationButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View
          style={[
            styles.filterPanel,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.compactFilterRow}
          >
            {ADOPTION_PET_TYPES.map((type) => (
              <FilterChip
                key={type}
                label={type}
                active={filters.type === type}
                onPress={() =>
                  setFilters((prev) => ({ ...prev, type, breed: "All" }))
                }
              />
            ))}

            <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />

            {RADIUS_OPTIONS.map((radius) => (
              <FilterChip
                key={radius}
                label={`${radius}km`}
                active={filters.radius === radius}
                onPress={() => setFilters((prev) => ({ ...prev, radius }))}
              />
            ))}

            <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />

            <FilterChip
              label="Vaccinated"
              active={filters.is_vaccinated}
              onPress={() =>
                setFilters((prev) => ({
                  ...prev,
                  is_vaccinated: !prev.is_vaccinated,
                }))
              }
            />
            <FilterChip
              label="Good with kids"
              active={filters.good_with_kids}
              onPress={() =>
                setFilters((prev) => ({
                  ...prev,
                  good_with_kids: !prev.good_with_kids,
                }))
              }
            />
            <FilterChip
              label="Pet friendly"
              active={filters.good_with_pets}
              onPress={() =>
                setFilters((prev) => ({
                  ...prev,
                  good_with_pets: !prev.good_with_pets,
                }))
              }
            />
          </ScrollView>
        </View>
      </View>
    ),
    [colors, coords, filters, handleBrowsePets, handleEnableLocation, locationDenied, topPad],
  );

  if (loading && items.length === 0) {
    return (
      <ScreenShell>
        <AdoptionBackground />
        <ScrollView
          contentContainerStyle={[styles.stateScroll, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          bounces
          alwaysBounceVertical
        >
          {header}
          <LoadingState
            label="Loading adoptable pets..."
            style={styles.inlineState}
          />
        </ScrollView>
      </ScreenShell>
    );
  }

  if (error && items.length === 0) {
    return (
      <ScreenShell>
        <AdoptionBackground />
        <ScrollView
          contentContainerStyle={[styles.stateScroll, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          bounces
          alwaysBounceVertical
        >
          {header}
          <View style={styles.inlineState}>
            <ErrorState
              message={error || "Please check your connection and try again."}
              onRetry={() => loadListings({ reset: true, nextPage: 1 })}
            />
          </View>
        </ScrollView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <AdoptionBackground />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad },
          items.length === 0 ? styles.emptyList : null,
        ]}
        renderItem={({ item }) => <AdoptionListingCard listing={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title={
              locationDenied
                ? "Location helps refine nearby adoption pets."
                : "No adoption pets found nearby."
            }
            subtitle={
              locationDenied
                ? "You can continue without it or try broader filters."
                : "Try expanding your distance or changing filters."
            }
            actionTitle={locationDenied ? "Continue" : "Expand Distance"}
            onAction={locationDenied ? handleEnableLocation : handleExpandDistance}
            icon={locationDenied ? "map-pin" : "search"}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  decorLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  decorBlobOne: {
    borderRadius: 115,
    height: 230,
    left: -100,
    position: "absolute",
    top: 140,
    width: 230,
  },
  decorBlobTwo: {
    borderRadius: 130,
    bottom: 190,
    height: 260,
    position: "absolute",
    right: -115,
    width: 260,
  },
  decorPawOne: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 26,
    top: 330,
    transform: [{ rotate: "16deg" }],
    width: 36,
  },
  decorPawTwo: {
    alignItems: "center",
    borderRadius: 17,
    borderWidth: 1,
    bottom: 360,
    height: 34,
    justifyContent: "center",
    left: 24,
    position: "absolute",
    transform: [{ rotate: "-12deg" }],
    width: 34,
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 10,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
  },
  title: {
    flex: 1,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 4,
  },
  listPetButton: {
    minHeight: 44,
    borderRadius: 15,
    overflow: "hidden",
    shadowColor: "#ff6b6b",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === "ios" ? 0.22 : 0,
    shadowRadius: 11,
    elevation: 4,
  },
  listPetGradient: {
    minHeight: 44,
    borderRadius: 15,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  listPetButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },
  heroCard: {
    borderRadius: 24,
    minHeight: 126,
    overflow: "hidden",
    paddingHorizontal: 15,
    paddingVertical: 13,
    position: "relative",
    shadowColor: "#ff8e53",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: Platform.OS === "ios" ? 0.1 : 0,
    shadowRadius: 14,
    elevation: 3,
  },
  heroCopy: {
    maxWidth: "68%",
    zIndex: 2,
  },
  heroBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 23,
    marginTop: 8,
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 4,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 9,
  },
  heroPrimaryButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroPrimaryText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  heroSecondaryButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroSecondaryText: {
    fontSize: 11,
    fontWeight: "900",
  },
  heroArt: {
    bottom: -14,
    height: 116,
    justifyContent: "flex-end",
    position: "absolute",
    right: -10,
    width: 116,
  },
  heroImage: {
    borderRadius: 30,
    height: 106,
    width: 96,
  },
  heroPaw: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 84,
    top: 14,
    transform: [{ rotate: "-16deg" }],
    width: 28,
  },
  heroPawDotOne: {
    borderRadius: 999,
    height: 68,
    position: "absolute",
    right: -20,
    top: 4,
    width: 68,
  },
  heroPawDotTwo: {
    borderRadius: 999,
    bottom: 12,
    height: 42,
    position: "absolute",
    right: 62,
    width: 42,
  },
  locationCard: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0,
    shadowRadius: 10,
    elevation: 2,
  },
  locationIcon: {
    alignItems: "center",
    borderRadius: 17,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  locationCopy: {
    flex: 1,
    minWidth: 0,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  locationSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    fontWeight: "700",
  },
  locationButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  locationButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  filterPanel: {
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 10,
  },
  filterChip: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "800",
  },
  compactFilterRow: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  filterDivider: {
    borderRadius: 999,
    height: 24,
    marginHorizontal: 2,
    width: 1,
  },
  stateScroll: {
    flexGrow: 1,
  },
  inlineState: {
    minHeight: 260,
  },
  list: {
    gap: 14,
    paddingHorizontal: 18,
  },
  emptyList: {
    flexGrow: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 26,
    flexDirection: "row",
    gap: 13,
    overflow: "hidden",
    padding: 11,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0,
    shadowRadius: 14,
    elevation: 2,
  },
  cardWarmWash: {
    borderBottomLeftRadius: 90,
    height: 86,
    position: "absolute",
    right: -24,
    top: -22,
    width: 132,
  },
  cardImageWrap: {
    borderRadius: 22,
    height: 152,
    overflow: "hidden",
    position: "relative",
    width: 116,
  },
  cardImageFallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  ageBadge: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    bottom: 8,
    left: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    position: "absolute",
  },
  ageBadgeText: {
    color: "#1a1a2e",
    fontSize: 10,
    fontWeight: "900",
  },
  cardBody: {
    flex: 1,
    gap: 8,
    minWidth: 0,
    paddingVertical: 3,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  cardNameBlock: {
    flex: 1,
    minWidth: 0,
  },
  petName: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0,
  },
  petMeta: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 3,
  },
  distanceRow: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: "900",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  description: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  viewButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    marginTop: "auto",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },
  footerLoader: {
    paddingVertical: 18,
    alignItems: "center",
  },
});
