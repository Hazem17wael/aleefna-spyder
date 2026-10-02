import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import type { PendingMessageAttachment } from "@/services/chat/messageAttachments";

export const VOICE_RECORDING_DEPENDENCY = "expo-audio";
export const VOICE_RECORDING_INSTALL_COMMAND = "npx expo install expo-audio";
export const VOICE_RECORDING_PEER_INSTALL_COMMAND = "npx expo install expo-asset";

const MIN_RECORDING_MS = 1000;
const MAX_RECORDING_MS = 60000;

type ExpoAudioModule = {
  AudioModule?: {
    requestRecordingPermissionsAsync?: () => Promise<{
      granted?: boolean;
      status?: string;
    }>;
    setAudioModeAsync?: (mode: Record<string, unknown>) => Promise<void>;
  };
  RecordingPresets?: {
    HIGH_QUALITY?: unknown;
  };
  requestRecordingPermissionsAsync?: () => Promise<{
    granted?: boolean;
    status?: string;
  }>;
  setAudioModeAsync?: (mode: Record<string, unknown>) => Promise<void>;
  useAudioRecorder?: (options?: unknown) => {
    prepareToRecordAsync: () => Promise<void>;
    record: () => Promise<void> | void;
    stop: () => Promise<void>;
    uri?: string | null;
  };
};

export type VoiceRecorderButtonHandle = {
  cancel: () => void;
};

type VoiceRecorderButtonProps = {
  disabled?: boolean;
  onRecorded: (attachment: PendingMessageAttachment) => Promise<void> | void;
  onError: (message: string) => void;
  onRecordingChange?: (isRecording: boolean) => void;
  onRecordingProgress?: (elapsedMs: number) => void;
};

function loadExpoAudioModule(): ExpoAudioModule | null {
  try {
    return require("expo-audio") as ExpoAudioModule;
  } catch {
    return null;
  }
}

export function hasVoiceRecordingDependency() {
  return loadExpoAudioModule() != null;
}

export function missingVoiceRecordingMessage() {
  return `Voice recording needs ${VOICE_RECORDING_DEPENDENCY}. Install it with: ${VOICE_RECORDING_INSTALL_COMMAND}. If expo-audio is already installed, also run: ${VOICE_RECORDING_PEER_INSTALL_COMMAND}`;
}

export function formatVoiceRecordingDuration(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export const VoiceRecorderButton = forwardRef<
  VoiceRecorderButtonHandle,
  VoiceRecorderButtonProps
>(function VoiceRecorderButton(
  {
    disabled = false,
    onRecorded,
    onError,
    onRecordingChange,
    onRecordingProgress,
  },
  ref,
) {
  const colors = useColors();
  const expoAudio = loadExpoAudioModule();
  const recorder = expoAudio?.useAudioRecorder
    ? expoAudio.useAudioRecorder(expoAudio.RecordingPresets?.HIGH_QUALITY ?? {})
    : null;
  const [isRecording, setIsRecording] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishingRef = useRef(false);
  const cancelRequestedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setRecordingState = useCallback(
    (recording: boolean) => {
      setIsRecording(recording);
      onRecordingChange?.(recording);

      if (!recording) {
        onRecordingProgress?.(0);
      }
    },
    [onRecordingChange, onRecordingProgress],
  );

  const finishRecording = useCallback(
    async (cancelled: boolean) => {
      if (!recorder || finishingRef.current || !isRecording) return;

      finishingRef.current = true;
      clearTimer();

      const durationMs = startedAtRef.current
        ? Date.now() - startedAtRef.current
        : 0;
      startedAtRef.current = null;

      try {
        await recorder.stop();
      } catch {
        if (!cancelled) {
          onError("Voice note could not be saved. Please try again.");
        }
        setRecordingState(false);
        finishingRef.current = false;
        cancelRequestedRef.current = false;
        return;
      }

      setRecordingState(false);
      finishingRef.current = false;

      if (cancelled || cancelRequestedRef.current) {
        cancelRequestedRef.current = false;
        return;
      }

      if (durationMs < MIN_RECORDING_MS) {
        onError("Voice note was too short.");
        return;
      }

      const uri = recorder.uri;

      if (!uri) {
        onError("Voice note file is missing. Please try again.");
        return;
      }

      await onRecorded({
        type: "voice",
        uri,
        name: `voice-${Date.now()}.m4a`,
        mimeType: "audio/mp4",
        durationMs,
      });
    },
    [clearTimer, isRecording, onError, onRecorded, recorder, setRecordingState],
  );

  const startRecording = useCallback(async () => {
    if (disabled || isRecording || finishingRef.current) return;

    if (!expoAudio || !recorder) {
      onError(missingVoiceRecordingMessage());
      return;
    }

    try {
      const permission = expoAudio.AudioModule?.requestRecordingPermissionsAsync
        ? await expoAudio.AudioModule.requestRecordingPermissionsAsync()
        : expoAudio.requestRecordingPermissionsAsync
          ? await expoAudio.requestRecordingPermissionsAsync()
          : null;

      if (permission && !permission.granted && permission.status !== "granted") {
        onError("Microphone permission is required to record a voice note.");
        return;
      }

      if (expoAudio.AudioModule?.setAudioModeAsync) {
        await expoAudio.AudioModule.setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      } else if (expoAudio.setAudioModeAsync) {
        await expoAudio.setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      }

      await recorder.prepareToRecordAsync();
      await Promise.resolve(recorder.record());

      cancelRequestedRef.current = false;
      startedAtRef.current = Date.now();
      setRecordingState(true);
      onRecordingProgress?.(0);

      timerRef.current = setInterval(() => {
        const elapsedMs = startedAtRef.current
          ? Date.now() - startedAtRef.current
          : 0;
        onRecordingProgress?.(elapsedMs);

        if (elapsedMs >= MAX_RECORDING_MS) {
          void finishRecording(false);
        }
      }, 250);
    } catch {
      clearTimer();
      startedAtRef.current = null;
      setRecordingState(false);
      onError("Voice recording could not start. Please try again.");
    }
  }, [
    clearTimer,
    disabled,
    expoAudio,
    finishRecording,
    isRecording,
    onError,
    onRecordingProgress,
    recorder,
    setRecordingState,
  ]);

  const cancel = useCallback(() => {
    cancelRequestedRef.current = true;
    void finishRecording(true);
  }, [finishRecording]);

  useImperativeHandle(ref, () => ({ cancel }), [cancel]);

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      disabled={disabled}
      onPressIn={() => void startRecording()}
      onPressOut={() => void finishRecording(false)}
      style={[
        styles.button,
        {
          backgroundColor: isRecording ? colors.destructive : colors.secondary,
          borderColor: isRecording ? colors.destructive : colors.border,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <Feather
        name={isRecording ? "square" : "mic"}
        size={18}
        color={isRecording ? colors.primaryForeground : colors.foreground}
      />
    </TouchableOpacity>
  );
});

export function VoiceRecordingBar({
  elapsedMs,
  onCancel,
}: {
  elapsedMs: number;
  onCancel: () => void;
}) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.destructive + "14",
          borderColor: colors.destructive + "30",
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.destructive }]} />
      <Text style={[styles.barText, { color: colors.foreground }]}>
        {formatVoiceRecordingDuration(elapsedMs)} · Release to send
      </Text>
      <TouchableOpacity activeOpacity={0.78} onPress={onCancel}>
        <Text style={[styles.cancelText, { color: colors.destructive }]}>
          Cancel
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  bar: {
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  barText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  cancelText: {
    fontSize: 12,
    fontWeight: "900",
  },
});
