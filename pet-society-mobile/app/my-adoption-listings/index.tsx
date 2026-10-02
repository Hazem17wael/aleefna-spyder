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
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
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
import { useColors } from "@/hooks/useColors";
import {
  cancelAdoptionListing,
  confirmOwnerHandover,
  getAdoptionErrorMessage,
  getMyAdoptionListings,
  updateAdoptionListing,
} from "@/services/adoptionApi";
import type { AdoptionListing } from "@/types/adoption";
import { formatAdoptionFee, formatDate, petName } from "@/utils/adoption";

function ListingCard({
  listing,
  busy,
  onStatus,
  onConfirm,
}: {
  listing: AdoptionListing;
  busy?: boolean;
  onStatus: (status: string) => void;
  onConfirm: () => void;
}) {
  const colors = useColors();
  const canPause = listing.status === "open";
  const canReopen = listing.status === "paused";
  const canCancel = ["open", "paused", "draft"].includes(String(listing.status));

  return (
    <Card style={styles.listingCard}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => router.push(`/my-adoption-listings/${listing.id}`)}
      >
        <PetSummary pet={listing.pet} />
      </TouchableOpacity>

      <View style={styles.metaRow}>
        <StatusBadge status={listing.status} />
        <InfoBadge icon="tag" label={formatAdoptionFee(listing)} tint="#f59f00" />
        <View style={styles.countPill}>
          <Feather name="file-text" size={13} color={colors.primary} />
          <Text style={[styles.countText, { color: colors.primary }]}>
            {Number(listing.applications_count ?? 0)} applications
          </Text>
        </View>
      </View>

      <Text style={[styles.subText, { color: colors.mutedForeground }]}>
        Listed {formatDate(listing.created_at) || "recently"}
      </Text>

      {listing.accepted_application_id ? (
        <Text style={[styles.acceptedText, { color: colors.success }]}>
          Accepted applicant selected
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          title="View Listing"
          variant="outline"
          onPress={() => router.push(`/my-adoption-listings/${listing.id}`)}
        />
        <Button
          title="View Applications"
          variant="secondary"
          onPress={() => router.push(`/my-adoption-listings/${listing.id}/applications`)}
        />
        {canPause ? (
          <Button
            title="Pause Listing"
            variant="outline"
            onPress={() => onStatus("paused")}
            loading={busy}
            disabled={busy}
          />
        ) : null}
        {canReopen ? (
          <Button
            title="Reopen Listing"
            variant="outline"
            onPress={() => onStatus("open")}
            loading={busy}
            disabled={busy}
          />
        ) : null}
        {canCancel ? (
          <Button
            title="Remove from Adoption"
            variant="destructive"
            onPress={() => onStatus("cancelled")}
            loading={busy}
            disabled={busy}
          />
        ) : null}
        {listing.can_confirm_owner_handover ? (
          <Button
            title="Confirm Handover"
            onPress={onConfirm}
            loading={busy}
            disabled={busy}
          />
        ) : null}
      </View>
    </Card>
  );
}

export default function MyAdoptionListingsScreen() {
  const { token } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<AdoptionListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const bottomPad = Platform.OS === "web" ? 30 : insets.bottom + 30;

  const load = useCallback(async () => {
    if (!token) return;

    setError("");

    try {
      const result = await getMyAdoptionListings(token);
      setItems(result.items);
    } catch (err) {
      setError(getAdoptionErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
  }

  async function patchStatus(listing: AdoptionListing, status: string) {
    const run = async () => {
      if (!token) return;

      setBusyId(String(listing.id));

      try {
        if (status === "cancelled") {
          await cancelAdoptionListing(token, listing.id);
        } else {
          await updateAdoptionListing(token, listing.id, { status });
        }
        Alert.alert("Adoption listing updated.");
        await load();
      } catch (err) {
        Alert.alert("Could not update listing", getAdoptionErrorMessage(err));
      } finally {
        setBusyId(null);
      }
    };

    if (status === "cancelled") {
      Alert.alert(
        "Remove from adoption?",
        `${petName(listing.pet)} will stay in your pets, but the public listing, pending applications, and adoption chats will be closed.`,
        [
          { text: "Keep Listing", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: run },
        ],
      );
      return;
    }

    await run();
  }

  async function confirmHandover(listing: AdoptionListing) {
    if (!token) return;

    Alert.alert("Confirm handover?", "Confirm that you handed this pet to the adopter.", [
      { text: "Not Yet", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setBusyId(String(listing.id));

          try {
            await confirmOwnerHandover(token, listing.id);
            Alert.alert("Handover confirmed.");
            await load();
          } catch (err) {
            Alert.alert("Could not confirm handover", getAdoptionErrorMessage(err));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  if (loading && items.length === 0) {
    return (
      <ScreenShell>
        <AdoptionHeader title="My Adoption Listings" />
        <LoadingState label="Loading your listings..." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <>
            <AdoptionHeader
              title="My Adoption Listings"
              subtitle="Manage listings, applications, and handovers."
              right={
                <TouchableOpacity
                  onPress={() => router.push("/adoption/select-pet")}
                  activeOpacity={0.84}
                  style={[styles.addButton, { backgroundColor: colors.primary }]}
                >
                  <Feather name="plus" size={18} color={colors.primaryForeground} />
                </TouchableOpacity>
              }
            />
            {error ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            busy={busyId === String(item.id)}
            onStatus={(status) => patchStatus(item, status)}
            onConfirm={() => confirmHandover(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Your adoption listings will appear here."
            actionTitle="List a Pet for Adoption"
            onAction={() => router.push("/adoption/select-pet")}
          />
        }
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad },
          items.length === 0 ? styles.emptyList : null,
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
  list: {
    gap: 14,
    paddingHorizontal: 18,
  },
  emptyList: {
    flexGrow: 1,
  },
  listingCard: {
    gap: 12,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#ff6b6b14",
  },
  countText: {
    fontSize: 12,
    fontWeight: "900",
  },
  subText: {
    fontSize: 13,
    fontWeight: "700",
  },
  acceptedText: {
    fontSize: 13,
    fontWeight: "900",
  },
  actions: {
    gap: 9,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    paddingHorizontal: 18,
    fontSize: 13,
    fontWeight: "800",
  },
});
