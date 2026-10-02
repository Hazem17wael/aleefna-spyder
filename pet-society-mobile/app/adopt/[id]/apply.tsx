import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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
  ErrorState,
  FormField,
  LoadingState,
  Notice,
  PetSummary,
  ScreenShell,
  ToggleRow,
} from "@/components/adoption/AdoptionComponents";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  applyToAdoptionListing,
  getAdoptionErrorMessage,
  getAdoptionListing,
  getAdoptionValidationErrors,
} from "@/services/adoptionApi";
import type { AdoptionListing, FieldErrors } from "@/types/adoption";
import {
  ADOPTION_PAYMENT_DISCLAIMER,
  formatAdoptionFee,
  hasAdoptionFee,
  petName,
} from "@/utils/adoption";

export default function AdoptionApplyScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { token } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [listing, setListing] = useState<AdoptionListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [message, setMessage] = useState("");
  const [experience, setExperience] = useState("");
  const [homeEnvironment, setHomeEnvironment] = useState("");
  const [hasOtherPets, setHasOtherPets] = useState(false);
  const [canAffordCare, setCanAffordCare] = useState(false);
  const [phone, setPhone] = useState("");

  const bottomPad = Platform.OS === "web" ? 30 : insets.bottom + 28;

  const loadListing = useCallback(async () => {
    if (!token || !id) return;

    setLoading(true);
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
    loadListing();
  }, [loadListing]);

  function validate() {
    const next: FieldErrors = {};

    if (message.trim().length < 10) {
      next.message = "Message must be at least 10 characters.";
    }

    if (phone.trim().length > 30) {
      next.phone = "Phone must be 30 characters or fewer.";
    }

    setFieldErrors(next);

    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!token || !id || submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    setError("");
    setFieldErrors({});

    try {
      await applyToAdoptionListing(token, id, {
        message: message.trim(),
        experience: experience.trim() || undefined,
        home_environment: homeEnvironment.trim() || undefined,
        has_other_pets: hasOtherPets,
        can_afford_care: canAffordCare,
        phone: phone.trim() || undefined,
      });

      Alert.alert("Application sent successfully.");
      router.replace("/my-adoption-applications");
    } catch (err) {
      setFieldErrors(getAdoptionValidationErrors(err));
      setError(getAdoptionErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <ScreenShell>
        <AdoptionHeader title="Apply to Adopt" subtitle="Preparing the form..." />
        <LoadingState label="Loading listing..." />
      </ScreenShell>
    );
  }

  if (error && !listing) {
    return (
      <ScreenShell>
        <AdoptionHeader title="Apply to Adopt" />
        <ErrorState message={error} onRetry={loadListing} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
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
            title="Apply to Adopt"
            subtitle={
              listing?.pet
                ? `Tell ${petName(listing.pet)}'s owner why this match works.`
                : "Tell the owner why this match works."
            }
          />

          <View style={styles.content}>
            {listing?.pet ? (
              <Card>
                <PetSummary pet={listing.pet} />
              </Card>
            ) : null}

            {listing ? (
              <Card style={styles.feeCard}>
                <Text style={[styles.feeTitle, { color: colors.foreground }]}>
                  {formatAdoptionFee(listing)}
                </Text>
                {hasAdoptionFee(listing) ? (
                  <Notice text={ADOPTION_PAYMENT_DISCLAIMER} />
                ) : null}
              </Card>
            ) : null}

            <Card style={styles.formCard}>
              <FormField
                label="Why do you want to adopt this pet?"
                value={message}
                onChangeText={(value) => {
                  setMessage(value);
                  setFieldErrors((prev) => ({ ...prev, message: "" }));
                }}
                multiline
                error={fieldErrors.message}
                placeholder="Share your motivation, daily routine, and what kind of home you can offer."
                editable={!submitting}
              />

              <FormField
                label="Tell us about your experience with pets"
                value={experience}
                onChangeText={(value) => {
                  setExperience(value);
                  setFieldErrors((prev) => ({ ...prev, experience: "" }));
                }}
                multiline
                error={fieldErrors.experience}
                placeholder="Previous pets, rescue experience, training, or first-time adopter context."
                editable={!submitting}
              />

              <FormField
                label="Describe your home environment"
                value={homeEnvironment}
                onChangeText={(value) => {
                  setHomeEnvironment(value);
                  setFieldErrors((prev) => ({
                    ...prev,
                    home_environment: "",
                  }));
                }}
                multiline
                error={fieldErrors.home_environment}
                placeholder="Apartment, house, family members, outdoor space, and daily schedule."
                editable={!submitting}
              />

              <ToggleRow
                label="I have other pets"
                value={hasOtherPets}
                onChange={setHasOtherPets}
                disabled={submitting}
              />

              <ToggleRow
                label="I can afford ongoing care"
                value={canAffordCare}
                onChange={setCanAffordCare}
                disabled={submitting}
              />

              <FormField
                label="Phone (optional)"
                value={phone}
                onChangeText={(value) => {
                  setPhone(value);
                  setFieldErrors((prev) => ({ ...prev, phone: "" }));
                }}
                error={fieldErrors.phone}
                placeholder="Optional"
                editable={!submitting}
                keyboardType="phone-pad"
              />

              {error ? (
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {error}
                </Text>
              ) : null}

              <Button
                title="Send Application"
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting}
              />
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  formCard: {
    gap: 16,
  },
  feeCard: {
    gap: 12,
  },
  feeTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
});
