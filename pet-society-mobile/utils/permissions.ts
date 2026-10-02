import { Alert, Platform } from "react-native";

function explainPermission(title: string, message: string) {
  if (Platform.OS === "web") return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: "Not now", style: "cancel", onPress: () => resolve(false) },
      { text: "Continue", onPress: () => resolve(true) },
    ]);
  });
}

export function explainNotificationPermission() {
  return explainPermission(
    "Stay updated?",
    "Enable notifications for matches, messages, and adoption updates.",
  );
}

export function explainCameraPermission() {
  return explainPermission(
    "Use your camera?",
    "Camera access lets you take a clear pet photo for the profile you choose to create.",
  );
}

export function explainPhotoLibraryPermission() {
  return explainPermission(
    "Choose a pet photo?",
    "Photo library access lets you select a pet photo. We only upload the image you choose.",
  );
}

export function explainDocumentPickerPermission() {
  return explainPermission(
    "Choose a PDF document?",
    "Optional PDF documents help owners and adopters build trust. We only upload the PDF you choose.",
  );
}
