import React, { useRef } from "react";
import {
  Animated,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import {
  getPetDocumentStatus,
  type PetDocumentFields,
} from "@/utils/petDocuments";

type TrustDocument = {
  key: string;
  label: string;
  status: string;
  url: string | null;
  uploaded: boolean;
};

export function petTrustDocuments(pet?: PetDocumentFields | null): TrustDocument[] {
  const status = getPetDocumentStatus(pet);

  return [
    {
      key: "vaccination",
      label: "Vaccination",
      status: status.hasVaccinationPdf ? "Verified" : "Not uploaded",
      url: status.vaccinationPdfUrl,
      uploaded: status.hasVaccinationPdf,
    },
    {
      key: "medical",
      label: "Medical Record",
      status: status.hasMedicalRecord ? "Uploaded" : "Not uploaded",
      url: status.medicalRecordPdfUrl,
      uploaded: status.hasMedicalRecord,
    },
    {
      key: "id",
      label: "ID Document",
      status: status.hasIdDocument ? "Uploaded" : "Not uploaded",
      url: status.idDocumentPdfUrl,
      uploaded: status.hasIdDocument,
    },
  ];
}

function DocumentOpenButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  function animate(toValue: number) {
    Animated.spring(scale, {
      toValue,
      damping: 18,
      stiffness: 260,
      mass: 0.65,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => animate(0.985)}
        onPressOut={() => animate(1)}
        activeOpacity={0.9}
        style={[
          styles.action,
          {
            backgroundColor: colors.primary + "14",
            borderColor: colors.primary + "30",
          },
        ]}
      >
        <Feather name="external-link" size={13} color={colors.primary} />
        <Text style={[styles.actionText, { color: colors.primary }]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function PetTrustDocuments({
  pet,
  onOpenError,
}: {
  pet?: PetDocumentFields | null;
  onOpenError?: (label: string) => void;
}) {
  const colors = useColors();
  const documents = petTrustDocuments(pet);

  async function openDocument(url: string, label: string) {
    try {
      await Linking.openURL(url);
    } catch {
      onOpenError?.(label);
    }
  }

  return (
    <View style={styles.rows}>
      {documents.map((document, index) => (
        <View
          key={document.key}
          style={[
            styles.row,
            index < documents.length - 1 ? { borderBottomColor: colors.border } : null,
          ]}
        >
          <View
            style={[
              styles.icon,
              {
                backgroundColor: document.uploaded
                  ? colors.success + "14"
                  : colors.muted,
              },
            ]}
          >
            <Feather
              name={document.uploaded ? "check-circle" : "circle"}
              size={16}
              color={document.uploaded ? colors.success : colors.mutedForeground}
            />
          </View>

          <View style={styles.copy}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {document.label}
            </Text>
            <Text
              style={[
                styles.status,
                {
                  color: document.uploaded
                    ? colors.success
                    : colors.mutedForeground,
                },
              ]}
            >
              {document.status}
            </Text>
          </View>

          {document.url ? (
            <DocumentOpenButton
              label="Open"
              onPress={() => openDocument(document.url!, document.label)}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: 0,
  },
  row: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: "900",
  },
  status: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800",
  },
  action: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "900",
  },
});
