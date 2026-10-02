import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { getPetDocumentStatus, type PetDocumentFields } from "@/utils/petDocuments";

type PetVerifiedBadgeProps = {
  pet?: PetDocumentFields | null;
  compact?: boolean;
  style?: ViewStyle;
};

export function PetVerifiedBadge({
  pet,
  compact = false,
  style,
}: PetVerifiedBadgeProps) {
  const colors = useColors();
  const status = getPetDocumentStatus(pet);
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entry, {
      toValue: 1,
      damping: 15,
      stiffness: 250,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [entry]);

  if (!status.hasVaccinationPdf) return null;

  return (
    <Animated.View
      style={[
        styles.badge,
        compact ? styles.compact : null,
        {
          backgroundColor: colors.success + "18",
          borderColor: colors.success + "35",
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
        style,
      ]}
    >
      <Feather name="shield" size={compact ? 12 : 13} color={colors.success} />
      <Text
        style={[
          styles.text,
          compact ? styles.compactText : null,
          { color: colors.success },
        ]}
        numberOfLines={1}
      >
        Vaccinated
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    alignSelf: "flex-start",
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
