import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { getPetDocumentStatus, type PetDocumentFields } from "@/utils/petDocuments";

type PetDocumentBadgesProps = {
  pet?: PetDocumentFields | null;
  compact?: boolean;
  includeVaccination?: boolean;
};

type BadgeItem = {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  tint: string;
};

function AnimatedDocumentBadge({
  badge,
  compact,
  index,
}: {
  badge: BadgeItem;
  compact: boolean;
  index: number;
}) {
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entry, {
      toValue: 1,
      delay: index * 55,
      damping: 15,
      stiffness: 250,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [entry, index]);

  return (
    <Animated.View
      style={[
        styles.badge,
        compact ? styles.compact : null,
        {
          backgroundColor: badge.tint + "14",
          borderColor: badge.tint + "30",
          opacity: entry,
          transform: [
            {
              scale: entry.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Feather
        name={badge.icon}
        size={compact ? 11 : 13}
        color={badge.tint}
      />
      <Text
        style={[
          styles.text,
          compact ? styles.compactText : null,
          { color: badge.tint },
        ]}
        numberOfLines={1}
      >
        {badge.label}
      </Text>
    </Animated.View>
  );
}

export function PetDocumentBadges({
  pet,
  compact = false,
  includeVaccination = false,
}: PetDocumentBadgesProps) {
  const colors = useColors();
  const status = getPetDocumentStatus(pet);

  const badges: BadgeItem[] = [
    ...(includeVaccination && status.hasVaccinationPdf
      ? [
        {
          key: "vaccination",
          icon: "shield" as const,
          label: "Vaccinated",
          tint: colors.success,
        },
      ]
      : []),
    ...(status.hasMedicalRecord
      ? [
        {
          key: "medical",
          icon: "file-text" as const,
          label: "Medical record",
          tint: colors.dislike,
        },
      ]
      : []),
    ...(status.hasIdDocument
      ? [
        {
          key: "id",
          icon: "check-circle" as const,
          label: "ID verified",
          tint: colors.accent,
        },
      ]
      : []),
  ];

  if (badges.length === 0) return null;

  return (
    <View style={styles.row}>
      {badges.map((badge, index) => (
        <AnimatedDocumentBadge
          key={badge.key}
          badge={badge}
          compact={compact}
          index={index}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: "100%",
  },
  compact: {
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "900",
  },
  compactText: {
    fontSize: 10,
  },
});
