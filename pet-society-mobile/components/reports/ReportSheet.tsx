import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  createReport,
  getReportErrorMessage,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  type ReportReason,
  type ReportTarget,
} from "@/services/reportsApi";

type Props = {
  visible: boolean;
  target: ReportTarget | null;
  title?: string;
  onClose: () => void;
  onSubmitted?: () => void;
};

function ReasonChip({
  active,
  disabled,
  label,
  onPress,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.035 : 1,
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
        disabled={disabled}
        style={[
          styles.reasonChip,
          {
            backgroundColor: active ? colors.primary : colors.secondary,
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

export function ReportSheet({
  visible,
  target,
  title = "Report",
  onClose,
  onSubmitted,
}: Props) {
  const colors = useColors();
  const { token } = useAuth();

  const [reason, setReason] = useState<ReportReason>("inappropriate_content");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      entry.setValue(0);
      return;
    }

    Animated.timing(entry, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [entry, visible]);

  async function submit() {
    if (!token || !target || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await createReport(token, {
        ...target,
        reason,
        details: details.trim() || undefined,
      });

      setDetails("");
      setReason("inappropriate_content");
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(getReportErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={submitting ? undefined : onClose}
    >
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: entry.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [
                {
                  translateY: entry.interpolate({
                    inputRange: [0, 1],
                    outputRange: [22, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {title}
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Reports are reviewed by the Aleefna team.
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
              style={[styles.closeBtn, { backgroundColor: colors.secondary }]}
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={styles.reasonGrid}>
            {REPORT_REASONS.map((item) => {
              const active = item === reason;

              return (
                <ReasonChip
                  key={item}
                  active={active}
                  disabled={submitting}
                  label={REPORT_REASON_LABELS[item]}
                  onPress={() => setReason(item)}
                />
              );
            })}
          </View>

          <TextInput
            value={details}
            onChangeText={setDetails}
            editable={!submitting}
            multiline
            maxLength={500}
            placeholder="Optional details"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.detailsInput,
              {
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />

          {error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={submit}
            disabled={submitting || !target}
            style={[
              styles.submitBtn,
              {
                backgroundColor: colors.primary,
                opacity: submitting || !target ? 0.6 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                Submit Report
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    padding: 18,
    paddingBottom: Platform.OS === "ios" ? 34 : 18,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "600",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reasonChip: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reasonText: {
    fontSize: 12,
    fontWeight: "800",
  },
  detailsInput: {
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    textAlignVertical: "top",
    fontSize: 14,
    fontWeight: "600",
  },
  error: {
    fontSize: 13,
    fontWeight: "700",
  },
  submitBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontSize: 15,
    fontWeight: "900",
  },
});
