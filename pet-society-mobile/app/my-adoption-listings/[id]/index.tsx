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
  FormField,
  InfoBadge,
  LoadingState,
  Notice,
  PetSummary,
  ScreenShell,
  StatusBadge,
  ToggleRow,
} from "@/components/adoption/AdoptionComponents";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  cancelAdoptionListing,
  confirmOwnerHandover,
  getAdoptionErrorMessage,
  getAdoptionListing,
  updateAdoptionListing,
} from "@/services/adoptionApi";
import type { AdoptionListing } from "@/types/adoption";
import {
  ADOPTION_DEFAULT_FEE_CURRENCY,
  ADOPTION_PAYMENT_DISCLAIMER,
  formatAdoptionFee,
  formatDate,
  petName,
} from "@/utils/adoption";

function DetailText({ label, value }: { label: string; value?: string | null }) {
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

export default function ManageAdoptionListingScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { token } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [listing, setListing] = useState<AdoptionListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeError, setFeeError] = useState("");
  const [isFeeEnabled, setIsFeeEnabled] = useState(false);
  const [feeAmount, setFeeAmount] = useState("");
  const [feeCurrency, setFeeCurrency] = useState(ADOPTION_DEFAULT_FEE_CURRENCY);

  const bottomPad = Platform.OS === "web" ? 30 : insets.bottom + 28;

  const load = useCallback(async () => {
    if (!token || !id) return;

    setError("");

    try {
      setListing(await getAdoptionListing(token, id));
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

  useEffect(() => {
    if (!listing) return;

    const amount = listing.adoption_fee_amount;
    const amountNumber = Number(amount);

    setIsFeeEnabled(
      Boolean(
        listing.is_adoption_fee_enabled &&
          amount != null &&
          amount !== "" &&
          Number.isFinite(amountNumber) &&
          amountNumber > 0,
      ),
    );
    setFeeAmount(amount == null || amount === "" ? "" : String(amount));
    setFeeCurrency(listing.adoption_fee_currency || ADOPTION_DEFAULT_FEE_CURRENCY);
    setFeeError("");
  }, [
    listing?.adoption_fee_amount,
    listing?.adoption_fee_currency,
    listing?.id,
    listing?.is_adoption_fee_enabled,
  ]);

  async function patchStatus(status: string) {
    if (!token || !listing || busy) return;

    const run = async () => {
      setBusy(true);

      try {
        setListing(
          status === "cancelled"
            ? await cancelAdoptionListing(token, listing.id)
            : await updateAdoptionListing(token, listing.id, { status }),
        );
        Alert.alert("Adoption listing updated.");
        await load();
      } catch (err) {
        Alert.alert("Could not update listing", getAdoptionErrorMessage(err));
      } finally {
        setBusy(false);
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

  function confirmHandover() {
    if (!token || !listing || busy) return;

    Alert.alert("Confirm handover?", "Confirm that you handed this pet to the adopter.", [
      { text: "Not Yet", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setBusy(true);

          try {
            setListing(await confirmOwnerHandover(token, listing.id));
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

  async function saveFee() {
    if (!token || !listing || feeSaving || busy) return;

    if (isFeeEnabled) {
      const amount = Number(feeAmount);

      if (!feeAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
        setFeeError("Enter a fee amount above 0.");
        return;
      }

      if (amount > 999999.99) {
        setFeeError("Fee amount must be 999,999.99 or less.");
        return;
      }

      if (feeCurrency.trim().length !== 3) {
        setFeeError("Currency must be a 3-letter code.");
        return;
      }
    }

    setFeeSaving(true);
    setFeeError("");

    try {
      const nextListing = await updateAdoptionListing(token, listing.id, {
        is_adoption_fee_enabled: isFeeEnabled,
        adoption_fee_amount: isFeeEnabled ? Number(feeAmount) : null,
        adoption_fee_currency:
          feeCurrency.trim().toUpperCase() || ADOPTION_DEFAULT_FEE_CURRENCY,
      });

      setListing(nextListing);
      Alert.alert("Adoption fee updated.");
      await load();
    } catch (err) {
      setFeeError(getAdoptionErrorMessage(err));
    } finally {
      setFeeSaving(false);
    }
  }

  if (loading) {
    return (
      <ScreenShell>
        <AdoptionHeader title="Manage Listing" />
        <LoadingState label="Loading listing..." />
      </ScreenShell>
    );
  }

  if (error || !listing) {
    return (
      <ScreenShell>
        <AdoptionHeader title="Manage Listing" />
        <ErrorState message={error || "Listing not found."} onRetry={load} />
      </ScreenShell>
    );
  }

  const canPause = listing.status === "open";
  const canReopen = listing.status === "paused";
  const canCancel = ["open", "paused", "draft"].includes(String(listing.status));

  return (
    <ScreenShell>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <AdoptionHeader
          title="Manage Listing"
          subtitle={`Status and handover details for ${petName(listing.pet)}.`}
        />

        <View style={styles.content}>
          <Card style={styles.topCard}>
            <PetSummary pet={listing.pet} />
            <View style={styles.inlineRow}>
              <StatusBadge status={listing.status} />
              <InfoBadge icon="tag" label={formatAdoptionFee(listing)} tint="#f59f00" />
              <Text style={[styles.countText, { color: colors.mutedForeground }]}>
                {Number(listing.applications_count ?? 0)} applications
              </Text>
            </View>
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Listing Details
            </Text>
            <DetailText label="Reason" value={listing.reason} />
            <DetailText label="Health notes" value={listing.health_notes} />
            <DetailText label="Requirements" value={listing.requirements} />
            <DetailText label="Created" value={formatDate(listing.created_at)} />
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Adoption Fee
            </Text>
            <Text style={[styles.feeSummary, { color: colors.mutedForeground }]}>
              {formatAdoptionFee(listing)}
            </Text>
            <ToggleRow
              label="Free adoption"
              value={!isFeeEnabled}
              onChange={() => setIsFeeEnabled(false)}
              disabled={feeSaving || busy}
            />
            <ToggleRow
              label="Add adoption fee"
              value={isFeeEnabled}
              onChange={() => setIsFeeEnabled(true)}
              disabled={feeSaving || busy}
            />

            {isFeeEnabled ? (
              <>
                <FormField
                  label="Fee amount"
                  value={feeAmount}
                  onChangeText={(value) => {
                    setFeeAmount(value);
                    setFeeError("");
                  }}
                  placeholder="500"
                  editable={!feeSaving && !busy}
                  keyboardType="decimal-pad"
                />
                <FormField
                  label="Currency"
                  value={feeCurrency}
                  onChangeText={(value) => {
                    setFeeCurrency(value.toUpperCase());
                    setFeeError("");
                  }}
                  placeholder={ADOPTION_DEFAULT_FEE_CURRENCY}
                  editable={!feeSaving && !busy}
                  autoCapitalize="characters"
                  maxLength={3}
                />
              </>
            ) : null}

            <Notice text={ADOPTION_PAYMENT_DISCLAIMER} />

            {feeError ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {feeError}
              </Text>
            ) : null}

            <Button
              title="Save Adoption Fee"
              variant="outline"
              onPress={saveFee}
              loading={feeSaving}
              disabled={feeSaving || busy}
            />
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Handover
            </Text>
            <DetailText
              label="Owner"
              value={listing.owner_handover_confirmed_at ? "Confirmed" : "Not confirmed"}
            />
            <DetailText
              label="Adopter"
              value={listing.adopter_handover_confirmed_at ? "Confirmed" : "Not confirmed"}
            />
            {listing.adopted_at ? (
              <Notice text="Adoption completed" tint={colors.success} />
            ) : null}
          </Card>

          <ContactCard
            contact={listing.applicant_contact}
            locked={listing.contact_locked}
            title="Applicant Contact"
          />

          <View style={styles.actions}>
            <Button
              title="View Applications"
              onPress={() => router.push(`/my-adoption-listings/${listing.id}/applications`)}
            />
            {canPause ? (
              <Button
                title="Pause Listing"
                variant="outline"
                onPress={() => patchStatus("paused")}
                loading={busy}
                disabled={busy}
              />
            ) : null}
            {canReopen ? (
              <Button
                title="Reopen Listing"
                variant="outline"
                onPress={() => patchStatus("open")}
                loading={busy}
                disabled={busy}
              />
            ) : null}
            {canCancel ? (
              <Button
                title="Remove from Adoption"
                variant="destructive"
                onPress={() => patchStatus("cancelled")}
                loading={busy}
                disabled={busy}
              />
            ) : null}
            {listing.can_confirm_owner_handover ? (
              <Button
                title="Confirm Handover"
                onPress={confirmHandover}
                loading={busy}
                disabled={busy}
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
  topCard: {
    gap: 13,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  countText: {
    fontSize: 13,
    fontWeight: "800",
  },
  section: {
    gap: 12,
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
  feeSummary: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  actions: {
    gap: 10,
  },
});
