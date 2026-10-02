import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { ImageFallback } from "@/components/ImageFallback";
import { useColors } from "@/hooks/useColors";
import {
  downloadMessageAttachment,
  type AttachmentConversationScope,
} from "@/services/chat/attachmentDownload";
import {
  attachmentDisplayName,
  type MessageAttachment,
} from "@/services/chat/messageAttachments";
import {
  createVoicePlayback,
  openLocalPdf,
  type VoicePlaybackHandle,
} from "@/services/chat/openAttachment";

type AttachmentLoadState = "idle" | "downloading" | "ready" | "error";

let activeVoicePlayback: VoicePlaybackHandle | null = null;

function attachmentIcon(type?: string | null) {
  if (type === "image") return "image";
  if (type === "pdf") return "file-text";
  if (type === "voice") return "mic";

  return "paperclip";
}

type ChatAttachmentChipProps = {
  attachment: MessageAttachment;
  isMine: boolean;
  token: string | null;
  scope?: AttachmentConversationScope;
  disabled?: boolean;
};

export function ChatAttachmentChip({
  attachment,
  isMine,
  token,
  scope,
  disabled = false,
}: ChatAttachmentChipProps) {
  const colors = useColors();
  const name = attachmentDisplayName(attachment);
  const canDownload = Boolean(token) && !disabled;
  const isImage = attachment.type === "image";
  const isPdf = attachment.type === "pdf";
  const isVoice = attachment.type === "voice";

  const [loadState, setLoadState] = useState<AttachmentLoadState>("idle");
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const voicePlaybackRef = useRef<VoicePlaybackHandle | null>(null);
  const isMountedRef = useRef(true);

  const foreground = isMine ? colors.primaryForeground : colors.foreground;
  const subtleForeground = isMine
    ? "rgba(255,255,255,0.82)"
    : colors.mutedForeground;
  const chipBackground = isMine ? "rgba(255,255,255,0.16)" : colors.secondary;
  const chipBorder = isMine ? "rgba(255,255,255,0.24)" : colors.border;

  const clearVoicePlayback = useCallback(async () => {
    const playback = voicePlaybackRef.current;
    voicePlaybackRef.current = null;

    if (!playback) return;

    try {
      await playback.stop();
    } catch {
      // Ignore unload errors during cleanup.
    }

    if (activeVoicePlayback === playback) {
      activeVoicePlayback = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      void clearVoicePlayback();
    };
  }, [clearVoicePlayback]);

  const downloadAttachment = useCallback(
    async (force = false) => {
      if (!token || disabled) return null;

      setLoadState("downloading");
      setErrorMessage("");

      try {
        const uri = await downloadMessageAttachment({
          token,
          attachment,
          scope,
          force,
        });

        if (!isMountedRef.current) return null;

        setLocalUri(uri);
        setLoadState("ready");
        return uri;
      } catch (error) {
        if (!isMountedRef.current) return null;

        setLoadState("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Could not open file",
        );
        return null;
      }
    },
    [attachment, disabled, scope, token],
  );

  useEffect(() => {
    if (!isImage || !canDownload) return;

    void downloadAttachment();
  }, [canDownload, downloadAttachment, isImage]);

  async function handlePress() {
    if (!canDownload || loadState === "downloading") return;

    if (isImage) {
      if (loadState === "error") {
        await downloadAttachment(true);
      }

      return;
    }

    const uri = localUri ?? (await downloadAttachment(loadState === "error"));

    if (!uri) return;

    try {
      if (isPdf) {
        await openLocalPdf({ uri, name });
        return;
      }

      if (isVoice) {
        if (isPlaying) {
          await voicePlaybackRef.current?.pause();
          setIsPlaying(false);
          return;
        }

        await clearVoicePlayback();

        if (activeVoicePlayback) {
          await activeVoicePlayback.stop().catch(() => {});
          activeVoicePlayback = null;
        }

        const playback = await createVoicePlayback(uri, (playing) => {
          if (isMountedRef.current) {
            setIsPlaying(playing);
          }
        });
        voicePlaybackRef.current = playback;
        activeVoicePlayback = playback;
        await playback.play();
        setIsPlaying(true);
      }
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Could not open file",
      );
    }
  }

  const statusText =
    loadState === "downloading"
      ? "Downloading..."
      : loadState === "error"
        ? errorMessage || "Could not open file"
        : isVoice && isPlaying
          ? "Playing..."
          : null;

  const content = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: chipBackground,
          borderColor: chipBorder,
        },
      ]}
    >
      {isImage && localUri ? (
        <ImageFallback
          uri={localUri}
          containerStyle={styles.imagePreview}
          imageStyle={styles.imagePreviewImage}
          fallback={
            <Feather
              name={attachmentIcon(attachment.type) as any}
              size={15}
              color={foreground}
            />
          }
          accessibilityLabel={name}
        />
      ) : (
        <Feather
          name={
            isVoice && isPlaying
              ? "pause-circle"
              : (attachmentIcon(attachment.type) as any)
          }
          size={15}
          color={foreground}
        />
      )}

      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.name, { color: foreground }]}>
          {name}
        </Text>

        {statusText ? (
          <Text numberOfLines={2} style={[styles.status, { color: subtleForeground }]}>
            {statusText}
          </Text>
        ) : null}
      </View>

      {loadState === "downloading" ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : loadState === "error" ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => void downloadAttachment(true)}
          style={styles.retryBtn}
        >
          <Text style={[styles.retryText, { color: foreground }]}>Retry</Text>
        </TouchableOpacity>
      ) : !isImage ? (
        <Feather
          name={isVoice && isPlaying ? "pause" : "play"}
          size={14}
          color={subtleForeground}
        />
      ) : null}
    </View>
  );

  if (isImage) {
    return content;
  }

  return (
    <TouchableOpacity
      activeOpacity={canDownload ? 0.82 : 1}
      disabled={!canDownload}
      onPress={() => void handlePress()}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    maxWidth: 220,
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 12,
    fontWeight: "800",
  },
  status: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 13,
  },
  imagePreview: {
    width: 34,
    height: 34,
    borderRadius: 8,
    overflow: "hidden",
  },
  imagePreviewImage: {
    width: "100%",
    height: "100%",
  },
  retryBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  retryText: {
    fontSize: 10,
    fontWeight: "800",
  },
});
