import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AdoptionHeader,
  Card,
  FormField,
  Notice,
  ScreenShell,
} from "@/components/adoption/AdoptionComponents";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getAdoptionValidationErrors } from "@/services/adoptionApi";
import {
  createReport,
  getReportErrorMessage,
  REPORT_REASON_LABELS,
} from "@/services/reportsApi";
import type { FieldErrors } from "@/types/adoption";
import { ADOPTION_REASONS } from "@/utils/adoption";

function ReportReasonChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(active ? 1.025 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.025 : 1,
      damping: 16,
      stiffness: 260,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={[
          styles.reasonChip,
          {
            backgroundColor: active ? colors.primary : colors.card,
            borderColor: active ? colors.primary : colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.reasonText,
            {
              color: active ? colors.primaryForeground : colors.foreground,
            },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CreateReportScreen() {
  const params = useLocalSearchParams<{
    reportable_type?: string;
    reportable_id?: string;
    reported_user_id?: string;
  }>();
  const { token } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [reason, setReason] = useState(ADOPTION_REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const bottomPad = Platform.OS === "web" ? 30 : insets.bottom + 28;
  const missingTarget = !params.reportable_type || !params.reportable_id;

  async function submit() {
    if (!token || submitting || missingTarget) return;

    const reportableType = params.reportable_type;
    const reportableId = params.reportable_id;

    if (!reportableType || !reportableId) return;

    const next: FieldErrors = {};

    if (!reason.trim()) {
      next.reason = "Reason is required.";
    }

    setFieldErrors(next);

    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setError("");

    try {
      await createReport(token, {
        reason,
        details: details.trim() || undefined,
        reportable_type: reportableType,
        reportable_id: reportableId,
        reported_user_id: params.reported_user_id || undefined,
      });

      Alert.alert("Report submitted. Our team will review it.");
      router.back();
    } catch (err) {
      setFieldErrors(getAdoptionValidationErrors(err));
      setError(getReportErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
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
            title="Create Report"
            subtitle="Report suspicious adoption activity for review."
          />

          <View style={styles.content}>
            {missingTarget ? (
              <Notice text="Report target is missing." tint={colors.destructive} />
            ) : null}

            <Card style={styles.formCard}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Reason
              </Text>

              <View style={styles.reasonGrid}>
                {ADOPTION_REASONS.map((item) => {
                  const active = reason === item;

                  return (
                    <ReportReasonChip
                      key={item}
                      active={active}
                      label={REPORT_REASON_LABELS[item as keyof typeof REPORT_REASON_LABELS] ?? item}
                      onPress={() => {
                        setReason(item);
                        setFieldErrors((prev) => ({ ...prev, reason: "" }));
                      }}
                    />
                  );
                })}
              </View>

              {fieldErrors.reason ? (
                <Text style={[styles.fieldError, { color: colors.destructive }]}>
                  {fieldErrors.reason}
                </Text>
              ) : null}

              <FormField
                label="Details"
                value={details}
                onChangeText={(value) => {
                  setDetails(value);
                  setFieldErrors((prev) => ({ ...prev, details: "" }));
                }}
                multiline
                error={fieldErrors.details}
                placeholder="Optional context that helps the team review this report."
                editable={!submitting}
              />

              {error ? (
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {error}
                </Text>
              ) : null}

              <Button
                title="Submit Report"
                onPress={submit}
                loading={submitting}
                disabled={submitting || missingTarget}
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
    gap: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: "900",
  },
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reasonChip: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  reasonText: {
    fontSize: 13,
    fontWeight: "800",
  },
  fieldError: {
    fontSize: 12,
    fontWeight: "800",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
});
