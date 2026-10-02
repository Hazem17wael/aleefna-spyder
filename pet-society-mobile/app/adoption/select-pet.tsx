import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AdoptionHeader,
  Card,
  EmptyState,
  InfoBadge,
  LoadingState,
  PetSummary,
  ScreenShell,
  StatusBadge,
} from "@/components/adoption/AdoptionComponents";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { usePets, type Pet as ContextPet } from "@/context/PetsContext";
import { useColors } from "@/hooks/useColors";
import { getAdoptionErrorMessage, getMyAdoptionListings } from "@/services/adoptionApi";
import type { AdoptionListing, Pet } from "@/types/adoption";
import {
  isActiveAdoptionStatus,
  isPetCompleteForAdoption,
  listingPetId,
} from "@/utils/adoption";

function asAdoptionPet(pet: ContextPet): Pet {
  return pet as unknown as Pet;
}

function SelectPetBackground() {
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

function PetChoiceCard({
  pet,
  listing,
  onChoose,
}: {
  pet: ContextPet;
  listing?: AdoptionListing;
  onChoose: () => void;
}) {
  const colors = useColors();
  const adoptionPet = asAdoptionPet(pet);
  const complete = isPetCompleteForAdoption(adoptionPet);
  const alreadyListed = Boolean(listing);

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onChoose}>
      <Card style={styles.petCard}>
        <View
          pointerEvents="none"
          style={[
            styles.petCardWash,
            {
              backgroundColor: alreadyListed
                ? `${colors.accent}12`
                : `${colors.primary}10`,
            },
          ]}
        />
        <PetSummary pet={adoptionPet} />

        <View style={styles.petMetaRow}>
          {complete ? (
            <InfoBadge icon="check-circle" label="Profile complete" tint="#00a86b" />
          ) : (
            <InfoBadge icon="alert-circle" label="Missing adoption details" tint="#f59f00" />
          )}
          {listing ? <StatusBadge status={listing.status} /> : null}
        </View>

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <View style={styles.footerCopy}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              {alreadyListed
                ? "This pet already has an adoption listing."
                : complete
                  ? "Profile is ready for a trusted listing."
                  : "Complete required details before publishing."}
            </Text>
          </View>
          <View
            style={[
              styles.footerAction,
              {
                backgroundColor: `${colors.primary}12`,
                borderColor: `${colors.primary}24`,
              },
            ]}
          >
            <Text style={[styles.footerActionText, { color: colors.primary }]}>
              {alreadyListed ? "Manage Adoption" : "List this pet"}
            </Text>
            <Feather name="arrow-right" size={14} color={colors.primary} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function SelectPetForAdoptionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { myPets, fetchMyPets } = usePets();

  const [listings, setListings] = useState<AdoptionListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const bottomPad = Platform.OS === "web" ? 30 : insets.bottom + 30;

  const load = useCallback(async () => {
    if (!token) return;

    setError("");
    setLoading(true);

    try {
      const [petsResult, listingResult] = await Promise.all([
        fetchMyPets(),
        getMyAdoptionListings(token),
      ]);

      if (!petsResult) {
        await fetchMyPets();
      }

      setListings(listingResult.items);
    } catch (err) {
      setError(getAdoptionErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchMyPets, token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const activeListingByPetId = listings.reduce<Record<string, AdoptionListing>>(
    (acc, listing) => {
      const petId = listingPetId(listing);

      if (petId != null && isActiveAdoptionStatus(listing.status)) {
        acc[String(petId)] = listing;
      }

      return acc;
    },
    {},
  );
  const activeListingCount = Object.keys(activeListingByPetId).length;
  const completePetCount = myPets.filter((pet) =>
    isPetCompleteForAdoption(asAdoptionPet(pet)),
  ).length;

  async function refresh() {
    setRefreshing(true);
    await load();
  }

  function showIncompleteModal(pet: ContextPet) {
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

  function handlePetPress(pet: ContextPet) {
    const activeListing = activeListingByPetId[String(pet.id)];

    if (activeListing) {
      router.push(`/my-adoption-listings/${activeListing.id}`);
      return;
    }

    if (!isPetCompleteForAdoption(asAdoptionPet(pet))) {
      showIncompleteModal(pet);
      return;
    }

    router.push(`/adoption/list-existing/${pet.id}`);
  }

  if (loading && myPets.length === 0) {
    return (
      <ScreenShell>
        <SelectPetBackground />
        <AdoptionHeader title="Choose a pet to list for adoption" />
        <LoadingState label="Loading your pets..." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <SelectPetBackground />
      <FlatList
        data={myPets}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <>
            <AdoptionHeader
              title="Choose a Pet"
              subtitle="Start an adoption listing with the right pet profile."
            />

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
                    Adoption setup
                  </Text>
                </View>
                <Text style={[styles.heroTitle, { color: colors.foreground }]}>
                  Pick the pet you want to list.
                </Text>
                <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
                  We’ll help you create a clear, caring adoption listing.
                </Text>
              </View>

              <View
                style={[
                  styles.heroStats,
                  {
                    backgroundColor: `${colors.card}D9`,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.heroStat}>
                  <Text style={[styles.heroStatValue, { color: colors.primary }]}>
                    {completePetCount}
                  </Text>
                  <Text style={[styles.heroStatLabel, { color: colors.mutedForeground }]}>
                    ready
                  </Text>
                </View>
                <View style={[styles.heroStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.heroStat}>
                  <Text style={[styles.heroStatValue, { color: colors.accent }]}>
                    {activeListingCount}
                  </Text>
                  <Text style={[styles.heroStatLabel, { color: colors.mutedForeground }]}>
                    listed
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {error ? (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: `${colors.destructive}10` },
                ]}
              >
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {error}
                </Text>
              </View>
            ) : null}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Existing pets
                </Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  Choose one to list, or manage an active adoption listing.
                </Text>
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <PetChoiceCard
            pet={item}
            listing={activeListingByPetId[String(item.id)]}
            onChoose={() => handlePetPress(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No pets yet"
            subtitle="Add a new pet first, then continue the adoption listing."
          />
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Card style={styles.newPetCard}>
              <View
                style={[
                  styles.newPetIcon,
                  { backgroundColor: `${colors.primary}16` },
                ]}
              >
                <Feather name="plus" size={22} color={colors.primary} />
              </View>
              <View style={styles.newPetCopy}>
                <Text style={[styles.cardEyebrow, { color: colors.primary }]}>
                  NEED ANOTHER PROFILE?
                </Text>
                <Text style={[styles.newPetTitle, { color: colors.foreground }]}>
                  Add a new pet first
                </Text>
                <Text style={[styles.newPetSub, { color: colors.mutedForeground }]}>
                  Create the profile, then open the adoption listing form.
                </Text>
              </View>
              <Button
                title="Create Pet"
                fullWidth={false}
                rightIcon="arrow-right"
                onPress={() => router.push("/adoption/create-pet-first")}
              />
            </Card>
          </View>
        }
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad },
          myPets.length === 0 ? styles.emptyList : null,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
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
    top: 130,
    width: 230,
  },
  decorBlobTwo: {
    borderRadius: 130,
    bottom: 160,
    height: 260,
    position: "absolute",
    right: -120,
    width: 260,
  },
  decorPawOne: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 28,
    top: 300,
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
  list: {
    gap: 14,
    paddingHorizontal: 18,
  },
  emptyList: {
    flexGrow: 1,
  },
  heroCard: {
    borderRadius: 28,
    flexDirection: "row",
    gap: 14,
    minHeight: 148,
    overflow: "hidden",
    padding: 16,
    shadowColor: "#ff8e53",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === "ios" ? 0.12 : 0,
    shadowRadius: 16,
    elevation: 3,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 28,
    marginTop: 12,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 6,
  },
  heroStats: {
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 24,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    width: 86,
  },
  heroStat: {
    alignItems: "center",
  },
  heroStatValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0,
  },
  heroStatLabel: {
    fontSize: 10,
    fontWeight: "900",
    marginTop: 1,
  },
  heroStatDivider: {
    alignSelf: "stretch",
    height: 1,
  },
  sectionHeader: {
    paddingTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
  petCard: {
    overflow: "hidden",
    gap: 13,
    position: "relative",
  },
  petCardWash: {
    borderBottomLeftRadius: 90,
    height: 86,
    position: "absolute",
    right: -24,
    top: -22,
    width: 132,
  },
  petMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  footerCopy: {
    flex: 1,
    minWidth: 0,
  },
  footerAction: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  footerActionText: {
    fontSize: 12,
    fontWeight: "900",
  },
  footer: {
    paddingTop: 4,
  },
  newPetCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 2,
  },
  newPetIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  newPetCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 4,
  },
  newPetTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  newPetSub: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  errorBox: {
    alignItems: "flex-start",
    borderRadius: 18,
    flexDirection: "row",
    gap: 9,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
});
