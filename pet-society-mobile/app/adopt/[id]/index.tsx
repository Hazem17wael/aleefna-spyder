import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AdoptionHeader,
  AdoptionImage,
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
import { Button } from "@/components/Button";
import { PetDocumentBadges } from "@/components/pets/PetDocumentBadges";
import { ReportSheet } from "@/components/reports/ReportSheet";
import { useAuth } from "@/context/AuthContext";
import { usePets } from "@/context/PetsContext";
import { useColors } from "@/hooks/useColors";
import { getAdoptionErrorMessage, getAdoptionListing } from "@/services/adoptionApi";
import { blockUser, getSafetyErrorMessage } from "@/services/safetyApi";
import type { AdoptionListing } from "@/types/adoption";
import { getPetDocumentStatus } from "@/utils/petDocuments";
import {
  ADOPTION_PAYMENT_DISCLAIMER,
  asBool,
  canApplyToListing,
  canManageListing,
  distanceLabel,
  formatAdoptionFee,
  formatDate,
  hasAdoptionFee,
  listingOwner,
  petBreed,
  petGender,
  petName,
  petType,
} from "@/utils/adoption";

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  const colors = useColors();

  if (!value) return null;

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.detailValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

export default function AdoptionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { token, user } = useAuth();
  const { removeBrowsePetsForUserLocal, removeMatchesForUserLocal } = usePets();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [listing, setListing] = useState<AdoptionListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBlocking, setIsBlocking] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [error, setError] = useState("");

  const bottomPad = Platform.OS === "web" ? 30 : insets.bottom + 24;

  const loadListing = useCallback(async () => {
    if (!token || !id) return;

    setLoading(true);
    setError("");

    try {
      const data = await getAdoptionListing(token, id);
      setListing(data);
    } catch (err) {
      setError(getAdoptionErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    loadListing();
  }, [loadListing]);

  if (loading) {
    return (
      <ScreenShell>
        <AdoptionHeader title="Adoption Details" subtitle="Opening listing..." />
        <LoadingState label="Loading adoption listing..." />
      </ScreenShell>
    );
  }

  if (error || !listing) {
    return (
      <ScreenShell>
        <AdoptionHeader title="Adoption Details" />
        <ErrorState message={error || "Listing not found."} onRetry={loadListing} />
      </ScreenShell>
    );
  }

  const pet = listing.pet;
  const owner = listingOwner(listing);
  const canManage = canManageListing(listing, user?.id);
  const canApply = canApplyToListing(listing, user?.id);
  const hasApplied = Boolean(listing.has_applied || listing.current_user_application_id);
  const notOpen = listing.status !== "open";
  const distance = distanceLabel(listing.distance_km);
  const currentListing = listing;
  const documents = getPetDocumentStatus(pet);
  const hasDocuments =
    documents.hasVaccinationPdf || documents.hasMedicalRecord || documents.hasIdDocument;

  function reportListing() {
    setReportVisible(true);
  }

  function confirmBlockOwner() {
    if (!token || owner?.id == null || isBlocking) return;

    const ownerId = String(owner.id);

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

  function openMyApplication() {
    if (currentListing.current_user_application_id) {
      router.push(`/my-adoption-applications/${currentListing.current_user_application_id}`);
      return;
    }

    router.push("/my-adoption-applications");
  }

  return (
    <ScreenShell>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <AdoptionHeader
          title={petName(pet)}
          subtitle={`${petType(pet)} looking for a trusted home`}
        />

        <View style={styles.content}>
          <AdoptionImage pet={pet} height={300} />

          <Card style={styles.summaryCard}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.petTitleRow}>
                  <Text
                    style={[styles.title, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {petName(pet)}
                  </Text>
                </View>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {petType(pet)} - {petBreed(pet)} - {petGender(pet)}
                </Text>
              </View>
              <StatusBadge status={listing.status} />
            </View>

            <View style={styles.badges}>
              {distance ? <InfoBadge icon="map-pin" label={distance} /> : null}
              <InfoBadge icon="tag" label={formatAdoptionFee(listing)} tint="#f59f00" />
              {asBool(listing.is_vaccinated) && !documents.hasVaccinationPdf ? (
                <InfoBadge icon="shield" label="Vaccinated" tint="#00a86b" />
              ) : null}
              {asBool(listing.good_with_kids) ? (
                <InfoBadge icon="smile" label="Good with kids" tint="#6c63ff" />
              ) : null}
              {asBool(listing.good_with_pets) ? (
                <InfoBadge icon="heart" label="Good with pets" tint="#ff6b6b" />
              ) : null}
            </View>

            <PetSummary pet={pet} compact />
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Adoption Fee
            </Text>
            <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
              {formatAdoptionFee(listing)}
            </Text>
            {hasAdoptionFee(listing) ? (
              <Notice text={ADOPTION_PAYMENT_DISCLAIMER} />
            ) : null}
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Pet Information
            </Text>
            <DetailRow label="Type" value={petType(pet)} />
            <DetailRow label="Breed" value={petBreed(pet)} />
            <DetailRow label="Gender" value={petGender(pet)} />
            <DetailRow label="Distance" value={distance} />
            <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
              {pet?.bio || "No bio was shared yet."}
            </Text>
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Documents & Trust
            </Text>
            {hasDocuments ? (
              <PetDocumentBadges pet={pet} includeVaccination />
            ) : (
              <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
                No documents were shared yet.
              </Text>
            )}
            <View style={styles.trustLine}>
              <View style={[styles.trustIcon, { backgroundColor: colors.primary + "16" }]}>
                <Feather name="user-check" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.trustText, { color: colors.mutedForeground }]}>
                Listed by {owner?.name ?? "Pet owner"}
              </Text>
            </View>
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Adoption Notes
            </Text>
            <DetailRow label="Reason" value={listing.reason} />
            <DetailRow label="Health notes" value={listing.health_notes} />
            <DetailRow label="Requirements" value={listing.requirements} />
            <DetailRow label="Created" value={formatDate(listing.created_at)} />
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Owner
            </Text>
            <View style={styles.ownerRow}>
              <View
                style={[
                  styles.ownerAvatar,
                  { backgroundColor: colors.primary + "16" },
                ]}
              >
                <Feather name="user" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ownerName, { color: colors.foreground }]}>
                  {owner?.name ?? "Pet owner"}
                </Text>
                <Text style={[styles.ownerSub, { color: colors.mutedForeground }]}>
                  Community adoption listing
                </Text>
              </View>
            </View>
          </Card>

          <ContactCard
            contact={listing.owner_contact ?? listing.applicant_contact}
            locked={listing.contact_locked}
            title="Safe Contact"
          />

          {notOpen && !canManage ? (
            <Notice text="This adoption listing is no longer accepting applications." />
          ) : null}

          <View style={styles.actions}>
            {canManage ? (
              <>
                <Button
                  title="Manage Listing"
                  onPress={() => router.push(`/my-adoption-listings/${listing.id}`)}
                />
                <Button
                  title="View Applications"
                  variant="outline"
                  onPress={() =>
                    router.push(`/my-adoption-listings/${listing.id}/applications`)
                  }
                />
              </>
            ) : null}

            {!canManage && canApply ? (
              <Button
                title="Apply to Adopt"
                onPress={() => router.push(`/adopt/${listing.id}/apply`)}
              />
            ) : null}

            {!canManage && hasApplied ? (
              <>
                <Button
                  title="Application Submitted"
                  disabled
                  onPress={() => Alert.alert("Application submitted")}
                />
                <Button
                  title="View My Application"
                  variant="outline"
                  onPress={openMyApplication}
                />
              </>
            ) : null}

            <Button title="Report Listing" variant="ghost" onPress={reportListing} />

            {!canManage && owner?.id != null ? (
              <Button
                title={isBlocking ? "Blocking..." : "Block Owner"}
                variant="destructive"
                disabled={isBlocking}
                loading={isBlocking}
                onPress={confirmBlockOwner}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>

      <ReportSheet
        visible={reportVisible}
        title="Report Listing"
        target={{
          reportable_type: "adoption_listing",
          reportable_id: currentListing.id,
          reported_user_id: owner?.id ?? null,
        }}
        onClose={() => setReportVisible(false)}
        onSubmitted={() => Alert.alert("Report submitted. Our team will review it.")}
      />
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
  summaryCard: {
    gap: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    flexShrink: 1,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0,
  },
  petTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  meta: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  detailRow: {
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
  trustLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trustIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  trustText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ownerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerName: {
    fontSize: 16,
    fontWeight: "900",
  },
  ownerSub: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "600",
  },
  actions: {
    gap: 10,
  },
});
