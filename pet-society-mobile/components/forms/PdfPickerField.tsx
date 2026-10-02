import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { pickPdfFile, type PickedPdf } from "@/utils/pickPdfFile";

type PdfPickerFieldProps = {
  label: string;
  selectedFile: PickedPdf | null;
  existingUrl?: string | null;
  existingLabel?: string;
  buttonLabel?: string;
  onChange: (file: PickedPdf | null) => void;
  disabled?: boolean;
};

export function PdfPickerField({
  label,
  selectedFile,
  existingUrl,
  existingLabel = "Uploaded",
  buttonLabel,
  onChange,
  disabled,
}: PdfPickerFieldProps) {
  const colors = useColors();
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);

  const hasExisting = Boolean(existingUrl);
  const hasFile = Boolean(selectedFile || hasExisting);
  const fileAnim = useRef(new Animated.Value(hasFile ? 1 : 0)).current;
  const statusLabel =
    selectedFile?.name ?? (hasExisting ? existingLabel : "Optional PDF");

  useEffect(() => {
    Animated.spring(fileAnim, {
      toValue: hasFile ? 1 : 0,
      damping: 16,
      stiffness: 240,
      mass: 0.75,
      useNativeDriver: true,
    }).start();
  }, [fileAnim, hasFile]);

  async function handlePick() {
    if (disabled || picking) return;

    setPicking(true);
    setError("");

    try {
      const file = await pickPdfFile();

      if (file) {
        onChange(file);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not select that PDF. Please try again.",
      );
    } finally {
      setPicking(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {label.toUpperCase()}
      </Text>

      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.card,
            borderColor: error
              ? colors.destructive
              : hasFile
                ? colors.success + "42"
                : colors.border,
            opacity: disabled ? 0.68 : 1,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.iconBox,
            {
              backgroundColor: hasFile
                ? colors.success + "18"
                : colors.secondary,
              transform: [
                {
                  scale: fileAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.08],
                  }),
                },
              ],
            },
          ]}
        >
          <Feather
            name={hasFile ? "check-circle" : "file-text"}
            size={16}
            color={hasFile ? colors.success : colors.mutedForeground}
          />
        </Animated.View>

        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {statusLabel}
          </Text>
          <Text
            style={[styles.sub, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {selectedFile
              ? "Ready to upload"
              : hasExisting
                ? "Existing document will stay unless replaced"
                : "No document selected"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handlePick}
          disabled={disabled || picking}
          activeOpacity={0.85}
          style={[
            styles.pickButton,
            {
              backgroundColor: colors.primary + "14",
              borderColor: colors.primary + "30",
            },
          ]}
        >
          {picking ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="upload" size={15} color={colors.primary} />
          )}
          <Text style={[styles.pickText, { color: colors.primary }]} numberOfLines={1}>
            {buttonLabel ?? "Choose PDF"}
          </Text>
        </TouchableOpacity>
      </View>

      {selectedFile ? (
        <Animated.View
          style={{
            opacity: fileAnim,
            transform: [
              {
                translateY: fileAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-4, 0],
                }),
              },
            ],
          }}
        >
          <TouchableOpacity
            onPress={() => {
              setError("");
              onChange(null);
            }}
            disabled={disabled}
            activeOpacity={0.85}
            style={styles.removeButton}
          >
            <Feather name="x" size={13} color={colors.mutedForeground} />
            <Text style={[styles.removeText, { color: colors.mutedForeground }]}>
              Remove selected
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      {error ? (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  field: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "900",
  },
  sub: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  pickButton: {
    minHeight: 36,
    maxWidth: 138,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pickText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "900",
  },
  removeButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 2,
  },
  removeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  error: {
    fontSize: 12,
    fontWeight: "700",
  },
});
