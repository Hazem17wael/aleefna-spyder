import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import {
  formatLocationCoordinates,
  type ChatLocationMetadata,
} from "@/services/chat/messageAttachments";

function mapsUrl(location: ChatLocationMetadata) {
  const query = `${location.latitude},${location.longitude}`;
  const label = encodeURIComponent(location.label ?? "Location");

  if (Platform.OS === "ios") {
    return `http://maps.apple.com/?ll=${query}&q=${label}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function ChatLocationBubble({
  location,
  isMine,
}: {
  location: ChatLocationMetadata;
  isMine: boolean;
}) {
  const colors = useColors();
  const [isOpening, setIsOpening] = useState(false);

  const foreground = isMine ? colors.primaryForeground : colors.foreground;
  const subtleForeground = isMine
    ? "rgba(255,255,255,0.82)"
    : colors.mutedForeground;
  const cardBackground = isMine ? "rgba(255,255,255,0.16)" : colors.secondary;
  const cardBorder = isMine ? "rgba(255,255,255,0.24)" : colors.border;

  async function openMaps() {
    if (isOpening) return;

    const primaryUrl = mapsUrl(location);
    const fallbackUrl = location.map_url ?? primaryUrl;

    setIsOpening(true);

    try {
      const canOpenPrimary = await Linking.canOpenURL(primaryUrl);
      await Linking.openURL(canOpenPrimary ? primaryUrl : fallbackUrl);
    } catch {
      await Linking.openURL(fallbackUrl);
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBackground,
          borderColor: cardBorder,
        },
      ]}
    >
      <View style={styles.copyRow}>
        <View style={[styles.iconWrap, { borderColor: cardBorder }]}>
          <Feather name="map-pin" size={15} color={foreground} />
        </View>

        <View style={styles.copy}>
          <Text numberOfLines={1} style={[styles.title, { color: foreground }]}>
            {location.label || "Location"}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.coordinates, { color: subtleForeground }]}
          >
            {formatLocationCoordinates(location)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        disabled={isOpening}
        onPress={() => void openMaps()}
        style={[styles.openButton, { borderColor: cardBorder }]}
      >
        {isOpening ? (
          <ActivityIndicator size="small" color={foreground} />
        ) : (
          <>
            <Feather name="navigation" size={13} color={foreground} />
            <Text style={[styles.openText, { color: foreground }]}>
              Open in Maps
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: "900",
  },
  coordinates: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: "700",
  },
  openButton: {
    minHeight: 30,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  openText: {
    fontSize: 11,
    fontWeight: "900",
  },
});
