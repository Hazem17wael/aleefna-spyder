import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AdoptionHeader,
  Card,
  ContactCard,
  ErrorState,
  InfoBadge,
  LoadingState,
  Notice,
  PetSummary,
  ScreenShell,
  StatusBadge,
} from "@/components/adoption/AdoptionComponents";
import { ApplicationTimeline } from "@/components/adoption/ApplicationTimeline";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  confirmAdopterHandover,
  createOrGetAdoptionConversation,
  getAdoptionErrorMessage,
  getMyAdoptionApplications,
  withdrawApplication,
} from "@/services/adoptionApi";
import type { AdoptionApplication } from "@/types/adoption";
import {
  ADOPTION_PAYMENT_DISCLAIMER,
  applicationConversationId,
  applicationListing,
  applicationListingId,
  applicationOwner,
  applicationPet,
  asBool,
  formatAdoptionFee,
  formatDate,
  hasAdoptionFee,
  petName,
} from "@/utils/adoption";

function DetailBlock({ label, value }: { label: string; value?: string | null }) {
  const colors = useColors();

  return (
    <View style={styles.detailBlock}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.detailValue, { color: colors.foreground }]}>
        {value || "Not provided"}
      </Text>
    </View>
  );
}

export default function MyAdoptionApplicationDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { token } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [application, setApplication] = useState<AdoptionApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const bottomPad = Platform.OS === "web" ? 30 : insets.bottom + 28;

  const load = useCallback(async () => {
    if (!token || !id) return;

    setError("");

    try {
      const result = await getMyAdoptionApplications(token);
      const found = result.items.find((item) => String(item.id) === String(id));

      setApplication(found ?? null);
      if (!found) setError("Application not found.");
    } catch (err) {
      setError(getAdoptionErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  function withdraw() {
    if (!token || !application) return;

    Alert.alert("Withdraw application?", `Withdraw your application for ${petName(applicationPet(application))}?`, [
      { text: "Keep Application", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: async () => {
          setBusy(true);

          try {
            await withdrawApplication(token, application.id);
            Alert.alert("Application withdrawn.");
            router.replace("/my-adoption-applications");
          } catch (err) {
            Alert.alert("Could not withdraw application", getAdoptionErrorMessage(err));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function confirmReceived() {
    if (!token || !application) return;

    const listingId = applicationListingId(application);

    if (!listingId) return;

    Alert.alert("Confirm received?", "Confirm that you received this pet from the owner.", [
      { text: "Not Yet", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setBusy(true);

          try {
            await confirmAdopterHandover(token, listingId);
            Alert.alert("Handover confirmed.");
            await load();
          } catch (err) {
            Alert.alert("Could not confirm handover", getAdoptionErrorMessage(err));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  async function openAdoptionChat() {
    if (!token || !application) return;

    const existingConversationId = applicationConversationId(application);

    if (existingConversationId) {
      router.push({
        pathname: "/adoption-chat/[conversationId]",
        params: { conversationId: String(existingConversationId) },
      });
      return;
    }

    const listingId = applicationListingId(application);

    if (!listingId) return;

    setBusy(true);

    try {
      const conversation = await createOrGetAdoptionConversation(token, {
        adoption_listing_id: listingId,
        adoption_application_id: application.id,
      });

      router.push({
        pathname: "/adoption-chat/[conversationId]",
        params: { conversationId: String(conversation.id) },
      });
    } catch (err) {
      Alert.alert("Could not open adoption chat", getAdoptionErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <ScreenShell>
        <AdoptionHeader title="Application Details" />
        <LoadingState label="Loading application..." />
      </ScreenShell>
    );
  }

  if (error || !application) {
    return (
      <ScreenShell>
        <AdoptionHeader title="Application Details" />
        <ErrorState message={error || "Application not found."} onRetry={load} />
      </ScreenShell>
    );
  }

  const listing = applicationListing(application);
  const listingId = applicationListingId(application);
  const pet = applicationPet(application);
  const owner = applicationOwner(application);
  const canWithdraw = ["pending", "shortlisted", "accepted"].includes(String(application.status));
  const canMessage = ["accepted", "completed"].includes(String(application.status));
  const canConfirm =
    application.can_confirm_adopter_handover || listing?.can_confirm_adopter_handover;
  const contact = application.owner_contact ?? listing?.owner_contact ?? null;
  const completed = Boolean(
    application.completed_at ||
      listing?.adopted_at ||
      (listing?.owner_handover_confirmed_at && listing?.adopter_handover_confirmed_at),
  );

  return (
    <ScreenShell>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <AdoptionHeader
          title="Application Details"
          subtitle={`Your application for ${petName(pet)}.`}
        />

        <View style={styles.content}>
          <Card style={styles.section}>
            <PetSummary pet={pet} />
            <View style={styles.statusRow}>
              <StatusBadge status={application.status} />
              {listing?.status ? <StatusBadge status={listing.status} label={`Listing ${listing.status}`} /> : null}
              {listing ? (
                <InfoBadge icon="tag" label={formatAdoptionFee(listing)} tint="#f59f00" />
              ) : null}
            </View>
            <ApplicationTimeline application={application} />
          </Card>

          {listing ? (
            <Card style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Adoption Fee
              </Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>
                {formatAdoptionFee(listing)}
              </Text>
              {hasAdoptionFee(listing) ? (
                <Notice text={ADOPTION_PAYMENT_DISCLAIMER} />
              ) : null}
            </Card>
          ) : null}

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Owner
            </Text>
            <DetailBlock label="Name" value={owner?.name ?? "Pet owner"} />
            <DetailBlock label="Submitted" value={formatDate(application.created_at)} />
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Your Answers
            </Text>
            <DetailBlock label="Message" value={application.message} />
            <DetailBlock label="Experience" value={application.experience} />
            <DetailBlock label="Home environment" value={application.home_environment} />
            <DetailBlock
              label="Has other pets"
              value={asBool(application.has_other_pets) ? "Yes" : "No"}
            />
            <DetailBlock
              label="Can afford care"
              value={asBool(application.can_afford_care) ? "Yes" : "No"}
            />
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Handover
            </Text>
            <DetailBlock
              label="Owner"
              value={listing?.owner_handover_confirmed_at ? "Confirmed" : "Not confirmed"}
            />
            <DetailBlock
              label="Adopter"
              value={listing?.adopter_handover_confirmed_at ? "Confirmed" : "Not confirmed"}
            />
            {completed ? <Notice text="Adoption completed" tint={colors.success} /> : null}
          </Card>

          <ContactCard
            contact={contact}
            locked={application.contact_locked ?? listing?.contact_locked}
            title="Owner Contact"
          />

          <View style={styles.actions}>
            <Button
              title="View Pet Details"
              variant="outline"
              onPress={() => {
                if (listingId) router.push(`/adopt/${listingId}`);
              }}
              disabled={!listingId}
            />
            {canWithdraw ? (
              <Button
                title="Withdraw"
                variant="destructive"
                onPress={withdraw}
                loading={busy}
                disabled={busy}
              />
            ) : null}
            {canMessage ? (
              <Button
                title="Message Owner"
                variant="outline"
                leftIcon="message-circle"
                onPress={openAdoptionChat}
                loading={busy}
                disabled={busy || !listingId}
              />
            ) : null}
            {canConfirm ? (
              <Button
                title="Confirm Received"
                onPress={confirmReceived}
                loading={busy}
                disabled={busy}
              />
            ) : null}
            {listingId ? (
              <Button
                title="Report Listing"
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: "/reports/create",
                    params: {
                      reportable_type: "adoption_listing",
                      reportable_id: String(listingId),
                      reported_user_id: owner?.id != null ? String(owner.id) : undefined,
                    },
                  })
                }
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  section: {
    gap: 12,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  detailBlock: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
  },
  actions: {
    gap: 10,
  },
});
