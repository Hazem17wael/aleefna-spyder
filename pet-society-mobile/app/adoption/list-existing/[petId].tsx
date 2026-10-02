import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AdoptionHeader,
  Card,
  FormField,
  LoadingState,
  Notice,
  PetSummary,
  ScreenShell,
  ToggleRow,
} from "@/components/adoption/AdoptionComponents";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { usePets, type Pet as ContextPet } from "@/context/PetsContext";
import { useColors } from "@/hooks/useColors";
import {
  createAdoptionListing,
  getAdoptionErrorMessage,
  getAdoptionValidationErrors,
} from "@/services/adoptionApi";
import type { FieldErrors, Pet } from "@/types/adoption";
import {
  ADOPTION_DEFAULT_FEE_CURRENCY,
  ADOPTION_PAYMENT_DISCLAIMER,
  isPetCompleteForAdoption,
  petName,
} from "@/utils/adoption";
import {
  LOCATION_PERMISSION_REQUIRED_MESSAGE,
  getCurrentCoordinatesFromUserAction,
} from "@/services/locationService";

function asAdoptionPet(pet: ContextPet): Pet {
  return pet as unknown as Pet;
}

function AdoptionCreateBackground() {
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

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const colors = useColors();

  return (
    <Card style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View
          style={[
            styles.sectionIcon,
            { backgroundColor: `${colors.primary}14` },
          ]}
        >
          <Feather name={icon} size={18} color={colors.primary} />
        </View>
        <View style={styles.sectionCopy}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {title}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
            {subtitle}
          </Text>
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Card>
  );
}

function ReadinessItem({
  label,
  ready,
}: {
  label: string;
  ready: boolean;
}) {
  const colors = useColors();
  const tint = ready ? colors.success : colors.warning;

  return (
    <View
      style={[
        styles.readinessItem,
        {
          backgroundColor: `${tint}10`,
          borderColor: `${tint}28`,
        },
      ]}
    >
      <Feather
        name={ready ? "check-circle" : "circle"}
        size={15}
        color={tint}
      />
      <Text style={[styles.readinessText, { color: colors.foreground }]}>
        {label}
      </Text>
    </View>
  );
}

export default function ListExistingPetForAdoptionScreen() {
  const { petId } = useLocalSearchParams<{ petId?: string }>();
  const { token } = useAuth();
  const { myPets, fetchMyPets } = usePets();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [loadingPet, setLoadingPet] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [reason, setReason] = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [requirements, setRequirements] = useState("");
  const [isVaccinated, setIsVaccinated] = useState(false);
  const [goodWithKids, setGoodWithKids] = useState(false);
  const [goodWithPets, setGoodWithPets] = useState(false);
  const [isFeeEnabled, setIsFeeEnabled] = useState(false);
  const [feeAmount, setFeeAmount] = useState("");
  const [feeCurrency, setFeeCurrency] = useState(ADOPTION_DEFAULT_FEE_CURRENCY);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const bottomPad = Platform.OS === "web" ? 30 : insets.bottom + 28;

  const pet = useMemo(() => {
    return myPets.find((item) => String(item.id) === String(petId));
  }, [myPets, petId]);

  const adoptionPet = pet ? asAdoptionPet(pet) : null;
  const complete = isPetCompleteForAdoption(adoptionPet);
  const reasonReady = reason.trim().length >= 10;
  const healthReady = healthNotes.trim().length >= 5;
  const locationReady = latitude != null && longitude != null;
  const feeReady =
    !isFeeEnabled ||
    (Number.isFinite(Number(feeAmount)) &&
      Number(feeAmount) > 0 &&
      feeCurrency.trim().length === 3);
  const readyCount = [complete, locationReady, reasonReady, healthReady].filter(Boolean).length;

  useEffect(() => {
    setLoadingPet(true);
    fetchMyPets().finally(() => setLoadingPet(false));
  }, [fetchMyPets]);

  useEffect(() => {
    if (!adoptionPet) return;

    const lat = adoptionPet.latitude == null ? null : Number(adoptionPet.latitude);
    const lng = adoptionPet.longitude == null ? null : Number(adoptionPet.longitude);

    setLatitude(Number.isFinite(lat) ? lat : null);
    setLongitude(Number.isFinite(lng) ? lng : null);
  }, [adoptionPet]);

  const detectLocation = useCallback(async () => {
    if (locationLoading || submitting) return;

    setLocationLoading(true);
    setLocationMessage("");

    try {
      const result = await getCurrentCoordinatesFromUserAction();

      if (!result.coords) {
        setLocationMessage(result.message ?? LOCATION_PERMISSION_REQUIRED_MESSAGE);
        return;
      }

      setLatitude(result.coords.latitude);
      setLongitude(result.coords.longitude);
    } catch {
      setLocationMessage("Could not get your location. Please try again.");
    } finally {
      setLocationLoading(false);
    }
  }, [locationLoading, submitting]);

  function validate() {
    const next: FieldErrors = {};

    if (reason.trim().length < 10) {
      next.reason = "Reason must be at least 10 characters.";
    }

    if (healthNotes.trim().length < 5) {
      next.health_notes = "Health notes must be at least 5 characters.";
    }

    if (isFeeEnabled) {
      const amount = Number(feeAmount);

      if (!feeAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
        next.adoption_fee_amount = "Enter a fee amount above 0.";
      } else if (amount > 999999.99) {
        next.adoption_fee_amount = "Fee amount must be 999,999.99 or less.";
      }

      if (feeCurrency.trim().length !== 3) {
        next.adoption_fee_currency = "Currency must be a 3-letter code.";
      }
    }

    setFieldErrors(next);

    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!token || !petId || submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    setError("");
    setFieldErrors({});

    try {
      await createAdoptionListing(token, petId, {
        reason: reason.trim(),
        health_notes: healthNotes.trim(),
        requirements: requirements.trim() || undefined,
        is_vaccinated: isVaccinated,
        good_with_kids: goodWithKids,
        good_with_pets: goodWithPets,
        is_adoption_fee_enabled: isFeeEnabled,
        adoption_fee_amount: isFeeEnabled ? Number(feeAmount) : null,
        adoption_fee_currency:
          feeCurrency.trim().toUpperCase() || ADOPTION_DEFAULT_FEE_CURRENCY,
        latitude,
        longitude,
      });

      Alert.alert("Your pet is now listed for adoption.");
      router.replace("/my-adoption-listings");
    } catch (err) {
      setFieldErrors(getAdoptionValidationErrors(err));
      setError(getAdoptionErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingPet) {
    return (
      <ScreenShell>
        <AdoptionCreateBackground />
        <AdoptionHeader title="List for Adoption" />
        <LoadingState label="Loading pet profile..." />
      </ScreenShell>
    );
  }

  if (!pet || !adoptionPet) {
    return (
      <ScreenShell>
        <AdoptionCreateBackground />
        <AdoptionHeader title="List for Adoption" />
        <View style={styles.content}>
          <Notice text="This pet profile could not be found." tint={colors.destructive} />
          <Button title="Choose another pet" onPress={() => router.replace("/adoption/select-pet")} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <AdoptionCreateBackground />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
        >
          <AdoptionHeader
            title="Create Adoption Listing"
            subtitle={`A warm, trusted listing for ${petName(adoptionPet)}.`}
          />

          <View style={styles.content}>
            <LinearGradient
              colors={[colors.secondary, colors.card]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroText}>
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
                  Tell the story clearly.
                </Text>
                <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
                  Honest details help the right adopter feel confident before they apply.
                </Text>
              </View>
              <View
                style={[
                  styles.heroProgress,
                  {
                    backgroundColor: `${colors.card}D9`,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.heroProgressValue, { color: colors.primary }]}>
                  {readyCount}/4
                </Text>
                <Text style={[styles.heroProgressLabel, { color: colors.mutedForeground }]}>
                  ready
                </Text>
              </View>
            </LinearGradient>

            <Card style={styles.petCard}>
              <Text style={[styles.cardEyebrow, { color: colors.primary }]}>
                SELECTED PET
              </Text>
              <PetSummary pet={adoptionPet} />
            </Card>

            <Card style={styles.readinessCard}>
              <View style={styles.readinessTopRow}>
                <View>
                  <Text style={[styles.readinessTitle, { color: colors.foreground }]}>
                    Listing readiness
                  </Text>
                  <Text
                    style={[
                      styles.readinessSubtitle,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Complete the essentials before publishing.
                  </Text>
                </View>
                <View
                  style={[
                    styles.readinessBadge,
                    { backgroundColor: `${colors.primary}12` },
                  ]}
                >
                  <Text style={[styles.readinessBadgeText, { color: colors.primary }]}>
                    {readyCount}/4
                  </Text>
                </View>
              </View>
              <View style={styles.readinessGrid}>
                <ReadinessItem label="Pet profile" ready={complete} />
                <ReadinessItem label="Location" ready={locationReady} />
                <ReadinessItem label="Story" ready={reasonReady} />
                <ReadinessItem label="Health notes" ready={healthReady} />
              </View>
            </Card>

            {!complete ? (
              <Notice
                text="This pet profile is missing required adoption details."
                tint={colors.warning}
              />
            ) : null}

            <SectionCard
              icon="map-pin"
              title="Nearby discovery"
              subtitle="Location helps adopters find this pet in the adoption feed."
            >
              {locationReady ? (
                <View
                  style={[
                    styles.locationReadyBox,
                    {
                      backgroundColor: `${colors.success}10`,
                      borderColor: `${colors.success}24`,
                    },
                  ]}
                >
                  <Feather name="check-circle" size={18} color={colors.success} />
                  <Text style={[styles.locationReadyText, { color: colors.foreground }]}>
                    Location is ready for nearby adoption feed.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.locationText, { color: colors.mutedForeground }]}>
                    Use your current location so nearby adopters can discover this listing.
                  </Text>
                  <Button
                    title="Use my current location"
                    leftIcon="navigation"
                    onPress={detectLocation}
                    loading={locationLoading}
                    disabled={locationLoading || submitting}
                  />
                </>
              )}
              {locationMessage ? (
                <Text
                  style={[
                    styles.locationError,
                    { color: colors.destructive },
                  ]}
                >
                  {locationMessage}
                </Text>
              ) : null}
            </SectionCard>

            <SectionCard
              icon="edit-3"
              title="Adoption story"
              subtitle="Write with care. The best listings are honest and easy to trust."
            >
              <FormField
                label="Reason"
                value={reason}
                onChangeText={(value) => {
                  setReason(value);
                  setFieldErrors((prev) => ({ ...prev, reason: "" }));
                }}
                multiline
                error={fieldErrors.reason}
                placeholder="Share why this pet needs a new home."
                editable={!submitting}
              />

              <FormField
                label="Requirements"
                value={requirements}
                onChangeText={(value) => {
                  setRequirements(value);
                  setFieldErrors((prev) => ({ ...prev, requirements: "" }));
                }}
                multiline
                error={fieldErrors.requirements}
                placeholder="Preferred home, adopter expectations, or special care needs."
                editable={!submitting}
              />
            </SectionCard>

            <SectionCard
              icon="shield"
              title="Care and personality"
              subtitle="Help adopters understand health, routine, and compatibility."
            >
              <FormField
                label="Health notes"
                value={healthNotes}
                onChangeText={(value) => {
                  setHealthNotes(value);
                  setFieldErrors((prev) => ({ ...prev, health_notes: "" }));
                }}
                multiline
                error={fieldErrors.health_notes}
                placeholder="Vaccines, conditions, medication, allergies, or vet notes."
                editable={!submitting}
              />

              <View style={styles.toggleStack}>
                <ToggleRow
                  label="Vaccinated"
                  value={isVaccinated}
                  onChange={setIsVaccinated}
                  disabled={submitting}
                />

                <ToggleRow
                  label="Good with kids"
                  value={goodWithKids}
                  onChange={setGoodWithKids}
                  disabled={submitting}
                />

                <ToggleRow
                  label="Good with pets"
                  value={goodWithPets}
                  onChange={setGoodWithPets}
                  disabled={submitting}
                />
              </View>
            </SectionCard>

            <SectionCard
              icon="tag"
              title="Adoption fee"
              subtitle="Keep it free or add a clear fee if needed."
            >
              <View style={styles.feeSection}>
                <ToggleRow
                  label="Free adoption"
                  value={!isFeeEnabled}
                  onChange={() => setIsFeeEnabled(false)}
                  disabled={submitting}
                />
                <ToggleRow
                  label="Add adoption fee"
                  value={isFeeEnabled}
                  onChange={() => setIsFeeEnabled(true)}
                  disabled={submitting}
                />

                {isFeeEnabled ? (
                  <>
                    <FormField
                      label="Fee amount"
                      value={feeAmount}
                      onChangeText={(value) => {
                        setFeeAmount(value);
                        setFieldErrors((prev) => ({
                          ...prev,
                          adoption_fee_amount: "",
                        }));
                      }}
                      error={fieldErrors.adoption_fee_amount}
                      placeholder="500"
                      editable={!submitting}
                      keyboardType="decimal-pad"
                    />
                    <FormField
                      label="Currency"
                      value={feeCurrency}
                      onChangeText={(value) => {
                        setFeeCurrency(value.toUpperCase());
                        setFieldErrors((prev) => ({
                          ...prev,
                          adoption_fee_currency: "",
                        }));
                      }}
                      error={fieldErrors.adoption_fee_currency}
                      placeholder={ADOPTION_DEFAULT_FEE_CURRENCY}
                      editable={!submitting}
                      autoCapitalize="characters"
                      maxLength={3}
                    />
                  </>
                ) : (
                  <Notice text="This listing will show as Free adoption." tint="#00a86b" />
                )}

                <Notice text={ADOPTION_PAYMENT_DISCLAIMER} />
              </View>
            </SectionCard>

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

            <Card style={styles.submitCard}>
              <View style={styles.submitCopy}>
                <Text style={[styles.submitTitle, { color: colors.foreground }]}>
                  Ready to publish?
                </Text>
                <Text style={[styles.submitText, { color: colors.mutedForeground }]}>
                  Review the details once, then share this pet with trusted adopters.
                </Text>
              </View>
              <Button
                title="List for Adoption"
                rightIcon="arrow-right"
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting || !complete || !locationReady || !feeReady}
              />
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scroll: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 14,
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
  heroText: {
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
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 29,
    marginTop: 12,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 6,
  },
  heroProgress: {
    alignItems: "center",
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 24,
    height: 78,
    justifyContent: "center",
    width: 78,
  },
  heroProgressValue: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
  },
  heroProgressLabel: {
    fontSize: 11,
    fontWeight: "900",
    marginTop: 1,
  },
  petCard: {
    gap: 11,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
  },
  readinessCard: {
    gap: 14,
  },
  readinessTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  readinessTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  readinessSubtitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
  readinessBadge: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 48,
    paddingHorizontal: 10,
  },
  readinessBadgeText: {
    fontSize: 13,
    fontWeight: "900",
  },
  readinessGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  readinessItem: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  readinessText: {
    fontSize: 12,
    fontWeight: "900",
  },
  sectionCard: {
    gap: 14,
    padding: 16,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  sectionIcon: {
    alignItems: "center",
    borderRadius: 17,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
  sectionBody: {
    gap: 14,
  },
  locationText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  locationReadyBox: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  locationReadyText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  locationError: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
  },
  toggleStack: {
    gap: 10,
  },
  feeSection: {
    gap: 12,
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
  submitCard: {
    gap: 14,
    marginTop: 2,
  },
  submitCopy: {
    gap: 4,
  },
  submitTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  submitText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
});
