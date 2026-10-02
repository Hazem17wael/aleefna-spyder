import { Alert, Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

export const LOCATION_PERMISSION_EXPLAINED_KEY =
  "location_permission_explained";
export const LOCATION_PERMISSION_REQUESTED_ONCE_KEY =
  "location_permission_requested_once";

export const LOCATION_PERMISSION_REQUIRED_MESSAGE =
  "Location was not enabled. You can continue with broader results where available.";
export const LOCATION_PERMISSION_DISABLED_MESSAGE =
  "Location permission is disabled. You can continue without it or update this in Settings.";
export const LOCATION_UNAVAILABLE_MESSAGE =
  "Could not get your location. Please try again.";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type LocationPermissionResult = {
  granted: boolean;
  canAskAgain: boolean;
  status: Location.PermissionStatus;
  message?: string;
};

type LocationCoordinatesResult = LocationPermissionResult & {
  coords: Coordinates | null;
};

function showLocationExplanation() {
  if (Platform.OS === "web") return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      "Use your location?",
      "Aleefna uses your location to show nearby compatible pets. You can skip this and continue with broader results.",
      [
        { text: "Not Now", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ],
    );
  });
}

function showSettingsPrompt() {
  if (Platform.OS === "web") return;

  Alert.alert("Location permission disabled", LOCATION_PERMISSION_DISABLED_MESSAGE, [
    { text: "Not Now", style: "cancel" },
    { text: "Open Settings", onPress: () => void Linking.openSettings() },
  ]);
}

export async function getForegroundLocationPermission() {
  return Location.getForegroundPermissionsAsync();
}

export async function requestLocationPermissionFromUserAction(): Promise<LocationPermissionResult> {
  const current = await getForegroundLocationPermission();

  if (current.status === Location.PermissionStatus.GRANTED) {
    return {
      granted: true,
      canAskAgain: current.canAskAgain,
      status: current.status,
    };
  }

  if (!current.canAskAgain) {
    showSettingsPrompt();

    return {
      granted: false,
      canAskAgain: false,
      status: current.status,
      message: LOCATION_PERMISSION_DISABLED_MESSAGE,
    };
  }

  const values = await AsyncStorage.multiGet([
    LOCATION_PERMISSION_EXPLAINED_KEY,
    LOCATION_PERMISSION_REQUESTED_ONCE_KEY,
  ]);
  const explained = values[0]?.[1] === "true";

  if (!explained) {
    await AsyncStorage.setItem(LOCATION_PERMISSION_EXPLAINED_KEY, "true");

    const accepted = await showLocationExplanation();

    if (!accepted) {
      return {
        granted: false,
        canAskAgain: current.canAskAgain,
        status: current.status,
        message: LOCATION_PERMISSION_REQUIRED_MESSAGE,
      };
    }
  }

  await AsyncStorage.setItem(LOCATION_PERMISSION_REQUESTED_ONCE_KEY, "true");

  const next = await Location.requestForegroundPermissionsAsync();

  if (next.status === Location.PermissionStatus.GRANTED) {
    return {
      granted: true,
      canAskAgain: next.canAskAgain,
      status: next.status,
    };
  }

  if (!next.canAskAgain) {
    showSettingsPrompt();
  }

  return {
    granted: false,
    canAskAgain: next.canAskAgain,
    status: next.status,
    message: next.canAskAgain
      ? LOCATION_PERMISSION_REQUIRED_MESSAGE
      : LOCATION_PERMISSION_DISABLED_MESSAGE,
  };
}

export async function getCurrentCoordinatesIfAlreadyGranted(): Promise<LocationCoordinatesResult> {
  const permission = await getForegroundLocationPermission();

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return {
      coords: null,
      granted: false,
      canAskAgain: permission.canAskAgain,
      status: permission.status,
      message: permission.canAskAgain
        ? "Continue without location or use filters to browse pets."
        : LOCATION_PERMISSION_DISABLED_MESSAGE,
    };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      granted: true,
      canAskAgain: permission.canAskAgain,
      status: permission.status,
    };
  } catch {
    return {
      coords: null,
      granted: true,
      canAskAgain: permission.canAskAgain,
      status: permission.status,
      message: LOCATION_UNAVAILABLE_MESSAGE,
    };
  }
}

export async function getCurrentCoordinatesFromUserAction(): Promise<LocationCoordinatesResult> {
  const permission = await requestLocationPermissionFromUserAction();

  if (!permission.granted) {
    return {
      ...permission,
      coords: null,
    };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      ...permission,
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
    };
  } catch {
    return {
      ...permission,
      coords: null,
      message: LOCATION_UNAVAILABLE_MESSAGE,
    };
  }
}
