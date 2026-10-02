import { Alert, Platform } from "react-native";

import {
  normalizeLocationMetadata,
  type ChatLocationMetadata,
} from "@/services/chat/messageAttachments";

export const CHAT_LOCATION_DEPENDENCY = "expo-location";
export const CHAT_LOCATION_INSTALL_COMMAND = "npx expo install expo-location";

type ExpoLocationModule = {
  Accuracy?: {
    Balanced?: unknown;
  };
  getCurrentPositionAsync?: (options?: Record<string, unknown>) => Promise<{
    coords?: {
      latitude?: number;
      longitude?: number;
    };
  }>;
  requestForegroundPermissionsAsync?: () => Promise<{
    granted?: boolean;
    status?: string;
    canAskAgain?: boolean;
  }>;
};

function loadExpoLocationModule(): ExpoLocationModule | null {
  try {
    return require("expo-location") as ExpoLocationModule;
  } catch {
    return null;
  }
}

export function hasChatLocationDependency() {
  return loadExpoLocationModule() != null;
}

export function missingChatLocationMessage() {
  return `Location sharing needs ${CHAT_LOCATION_DEPENDENCY}. Install it with: ${CHAT_LOCATION_INSTALL_COMMAND}`;
}

export function confirmShareCurrentLocation() {
  if (Platform.OS === "web") {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert("Send your current location?", undefined, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Send", onPress: () => resolve(true) },
    ]);
  });
}

export async function getCurrentChatLocation(): Promise<ChatLocationMetadata> {
  const location = loadExpoLocationModule();

  if (!location?.requestForegroundPermissionsAsync || !location.getCurrentPositionAsync) {
    throw new Error(missingChatLocationMessage());
  }

  const permission = await location.requestForegroundPermissionsAsync();

  if (!permission.granted && permission.status !== "granted") {
    throw new Error("Location permission is required to share your current location.");
  }

  let position;

  try {
    position = await location.getCurrentPositionAsync({
      accuracy: location.Accuracy?.Balanced,
    });
  } catch {
    throw new Error("Could not get your current location. Please try again.");
  }

  const metadata = normalizeLocationMetadata({
    latitude: position.coords?.latitude,
    longitude: position.coords?.longitude,
  });

  if (!metadata) {
    throw new Error("Current location is unavailable. Please try again.");
  }

  return metadata;
}
