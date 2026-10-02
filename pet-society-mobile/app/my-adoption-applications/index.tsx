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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Card,
  ContactCard,
  EmptyState,
  InfoBadge,
  LoadingState,
  Notice,
  PetSummary,
  ScreenShell,
  StatusBadge,
  AdoptionHeader,
} from "@/components/adoption/AdoptionComponents";
import { ApplicationTimeline } from "@/components/adoption/ApplicationTimeline";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  confirmAdopterHandover,
  getAdoptionErrorMessage,
  getMyAdoptionApplications,
  withdrawApplication,
} from "@/services/adoptionApi";
import type { AdoptionApplication } from "@/types/adoption";
import {
  applicationListing,
  applicationListingId,
  applicationOwner,
  applicationPet,
  formatAdoptionFee,
  formatDate,
  petName,
} from "@/utils/adoption";

function MyApplicationCard({
  application,
  busy,
  onWithdraw,
  onConfirm,
}: {
  application: AdoptionApplication;
  busy?: boolean;
  onWithdraw: () => void;
  onConfirm: () => void;
}) {
  const colors = useColors();
  const listing = applicationListing(application);
  const listingId = applicationListingId(application);
  const pet = applicationPet(application);
  const owner = applicationOwner(application);
  const canWithdraw = ["pending", "shortlisted", "accepted"].includes(String(application.status));
  const contact = application.owner_contact ?? listing?.owner_contact ?? null;
  const completed = Boolean(
    application.completed_at ||
      listing?.adopted_at ||
      (listing?.owner_handover_confirmed_at && listing?.adopter_handover_confirmed_at),
  );

  return (
    <Card style={styles.applicationCard}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => router.push(`/my-adoption-applications/${application.id}`)}
      >
        <PetSummary pet={pet} />
      </TouchableOpacity>

      <View style={styles.statusRow}>
        <StatusBadge status={application.status} />
        {listing?.status ? <StatusBadge status={listing.status} label={`Listing ${listing.status}`} /> : null}
        {listing ? (
          <InfoBadge icon="tag" label={formatAdoptionFee(listing)} tint="#f59f00" />
        ) : null}
      </View>

      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
        Owner: {owner?.name ?? "Pet owner"}
      </Text>
      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
        Submitted {formatDate(application.created_at) || "recently"}
      </Text>

      <ApplicationTimeline application={application} />

      {application.status === "accepted" ? (
        <ContactCard
          contact={contact}
          locked={application.contact_locked ?? listing?.contact_locked}
          title="Owner Contact"
        />
      ) : (
        <Notice text="Contact details unlock after the owner accepts your application." />
      )}

      {completed ? <Notice text="Adoption completed" tint={colors.success} /> : null}

      <View style={styles.actions}>
        <Button
          title="View Pet"
          variant="outline"
          onPress={() => {
            if (listingId) router.push(`/adopt/${listingId}`);
          }}
          disabled={!listingId}
        />
        <Button
          title="View Application"
          variant="secondary"
          onPress={() => router.push(`/my-adoption-applications/${application.id}`)}
        />
        {canWithdraw ? (
          <Button
            title="Withdraw"
            variant="destructive"
            onPress={onWithdraw}
            loading={busy}
            disabled={busy}
          />
        ) : null}
        {application.can_confirm_adopter_handover || listing?.can_confirm_adopter_handover ? (
          <Button
            title="Confirm Received"
            onPress={onConfirm}
            loading={busy}
            disabled={busy}
          />
        ) : null}
        {application.status === "accepted" && contact ? (
          <Button
            title="View Contact"
            variant="ghost"
            onPress={() => router.push(`/my-adoption-applications/${application.id}`)}
          />
        ) : null}
      </View>
    </Card>
  );
}

export default function MyAdoptionApplicationsScreen() {
  const { token } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<AdoptionApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const bottomPad = Platform.OS === "web" ? 30 : insets.bottom + 30;

  const load = useCallback(async () => {
    if (!token) return;

    setError("");

    try {
      const result = await getMyAdoptionApplications(token);
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

  function withdraw(application: AdoptionApplication) {
    if (!token) return;

    Alert.alert("Withdraw application?", `Withdraw your application for ${petName(applicationPet(application))}?`, [
      { text: "Keep Application", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: async () => {
          setBusyId(String(application.id));

          try {
            await withdrawApplication(token, application.id);
            Alert.alert("Application withdrawn.");
            await load();
          } catch (err) {
            Alert.alert("Could not withdraw application", getAdoptionErrorMessage(err));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  function confirmReceived(application: AdoptionApplication) {
    if (!token) return;

    const listingId = applicationListingId(application);

    if (!listingId) return;

    Alert.alert("Confirm received?", "Confirm that you received this pet from the owner.", [
      { text: "Not Yet", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setBusyId(String(application.id));

          try {
            await confirmAdopterHandover(token, listingId);
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
        <AdoptionHeader title="My Applications" />
        <LoadingState label="Loading your applications..." />
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
              title="My Applications"
              subtitle="Track adoption applications you submitted."
            />
            {error ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <MyApplicationCard
            application={item}
            busy={busyId === String(item.id)}
            onWithdraw={() => withdraw(item)}
            onConfirm={() => confirmReceived(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No adoption applications yet"
            subtitle="Applications you submit will appear here."
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
  applicationCard: {
    gap: 13,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "700",
  },
  actions: {
    gap: 9,
  },
  errorText: {
    paddingHorizontal: 18,
    fontSize: 13,
    fontWeight: "800",
  },
});
