import { Linking, Platform } from "react-native";

export const PDF_OPENER_DEPENDENCY = "expo-sharing";
export const VOICE_PLAYER_DEPENDENCY = "expo-audio";
export const VOICE_PLAYER_PEER_INSTALL_COMMAND = "npx expo install expo-asset";

type SharingModule = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (
    url: string,
    options?: { mimeType?: string; dialogTitle?: string; UTI?: string },
  ) => Promise<void>;
};

type AudioPlayer = {
  play: () => Promise<void> | void;
  pause: () => Promise<void> | void;
  remove?: () => Promise<void> | void;
  seekTo?: (seconds: number) => Promise<void> | void;
};

type AudioModule = {
  AudioModule?: {
    setAudioModeAsync?: (mode: Record<string, unknown>) => Promise<void>;
  };
  setAudioModeAsync?: (mode: Record<string, unknown>) => Promise<void>;
  createAudioPlayer?: (source: { uri: string }) => AudioPlayer;
};

function loadSharingModule(): SharingModule | null {
  try {
    return require("expo-sharing") as SharingModule;
  } catch {
    return null;
  }
}

function loadAudioModule(): AudioModule | null {
  try {
    return require("expo-audio") as AudioModule;
  } catch {
    return null;
  }
}

export function hasPdfOpenerDependency() {
  return loadSharingModule() != null;
}

export function hasVoicePlayerDependency() {
  return loadAudioModule() != null;
}

export async function openLocalPdf(params: {
  uri: string;
  name?: string | null;
}) {
  const sharing = loadSharingModule();

  if (sharing) {
    const available = await sharing.isAvailableAsync();

    if (available) {
      await sharing.shareAsync(params.uri, {
        mimeType: "application/pdf",
        dialogTitle: params.name ?? "Open PDF",
        UTI: "com.adobe.pdf",
      });
      return;
    }
  }

  if (Platform.OS === "web") {
    const supported = await Linking.canOpenURL(params.uri);

    if (supported) {
      await Linking.openURL(params.uri);
      return;
    }
  }

  throw new Error(
    `Could not open file. Install ${PDF_OPENER_DEPENDENCY} to open PDFs on this device.`,
  );
}

export type VoicePlaybackHandle = {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
};

export async function createVoicePlayback(
  uri: string,
  onStatusChange?: (playing: boolean) => void,
): Promise<VoicePlaybackHandle> {
  const audio = loadAudioModule();

  if (!audio) {
    throw new Error(
      `Could not open file. Install ${VOICE_PLAYER_DEPENDENCY} to play voice messages. If expo-audio is already installed, also run: ${VOICE_PLAYER_PEER_INSTALL_COMMAND}`,
    );
  }

  if (!audio.createAudioPlayer) {
    throw new Error(
      `Could not open file. Install ${VOICE_PLAYER_DEPENDENCY} to play voice messages. If expo-audio is already installed, also run: ${VOICE_PLAYER_PEER_INSTALL_COMMAND}`,
    );
  }

  if (audio.AudioModule?.setAudioModeAsync) {
    await audio.AudioModule.setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
  } else if (audio.setAudioModeAsync) {
    await audio.setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
  }

  const player = audio.createAudioPlayer({ uri });

  return {
    play: async () => {
      await Promise.resolve(player.play());
      onStatusChange?.(true);
    },
    pause: async () => {
      await Promise.resolve(player.pause());
      onStatusChange?.(false);
    },
    stop: async () => {
      await Promise.resolve(player.pause());
      if (player.seekTo) {
        await Promise.resolve(player.seekTo(0));
      }
      if (player.remove) {
        await Promise.resolve(player.remove());
      }
      onStatusChange?.(false);
    },
  };
}
