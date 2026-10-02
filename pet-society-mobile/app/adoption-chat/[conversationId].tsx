import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import Reanimated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_BASE_URL } from "@/config/realtime";
import { ImageFallback } from "@/components/ImageFallback";
import { useAuth } from "@/context/AuthContext";
import { usePets } from "@/context/PetsContext";
import { useColors } from "@/hooks/useColors";
import { connectAdoptionConversationRealtime } from "@/services/adoptionRealtime";
import {
  completeAdoptionConversation,
  getAdoptionConversation,
  getAdoptionConversationMessages,
  getAdoptionErrorMessage,
  markAdoptionConversationRead,
  sendAdoptionMessage,
} from "@/services/adoptionApi";
import {
  attachmentPreviewText,
  normalizeLocationMetadata,
  normalizeMessageAttachments,
  pickCameraImageAttachment,
  pickGalleryImageAttachment,
  pickPdfAttachment,
  type ChatLocationMetadata,
  type MessageAttachment,
  type PendingMessageAttachment,
} from "@/services/chat/messageAttachments";
import { ChatAttachmentChip } from "@/components/chat/ChatAttachmentChip";
import { ChatLocationBubble } from "@/components/chat/ChatLocationBubble";
import {
  confirmShareCurrentLocation,
  getCurrentChatLocation,
} from "@/services/chat/locationMessages";
import {
  VoiceRecorderButton,
  VoiceRecordingBar,
  type VoiceRecorderButtonHandle,
} from "@/components/chat/VoiceRecorderButton";
import { setActiveAdoptionConversationId } from "@/services/inAppMessageBus";
import type {
  AdoptionConversation,
  AdoptionMessage,
  Id,
} from "@/types/adoption";
import { petName } from "@/utils/adoption";

type UiMessage = {
  id: Id;
  conversationId: Id;
  senderId: Id;
  text: string;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
  attachments?: MessageAttachment[];
  timestamp?: string | null;
  pending?: boolean;
  failed?: boolean;
  retryBody?: string;
  retryAttachment?: PendingMessageAttachment | null;
  retryLocation?: ChatLocationMetadata | null;
};

function safeHaptic() {
  if (Platform.OS === "web") return;

  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function formatTime(iso?: string | null) {
  if (!iso) return "";

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapMessage(message: AdoptionMessage): UiMessage {
  return {
    id: message.id,
    conversationId: message.adoption_conversation_id,
    senderId: message.sender_id,
    text: message.body ?? "",
    type: message.type,
    metadata: message.metadata ?? null,
    attachments: normalizeMessageAttachments(message),
    timestamp: message.created_at,
  };
}

function dedupeMessages(messages: UiMessage[]) {
  const map = new Map<string, UiMessage>();

  for (const message of messages) {
    map.set(String(message.id), message);
  }

  return Array.from(map.values()).sort((a, b) => {
    return (
      new Date(a.timestamp ?? 0).getTime() -
      new Date(b.timestamp ?? 0).getTime()
    );
  });
}

function attachmentIcon(type?: string | null) {
  if (type === "image") return "image";
  if (type === "pdf") return "file-text";
  if (type === "voice") return "mic";

  return "paperclip";
}

function MessageBubble({
  message,
  isMine,
  index,
  token,
  onRetry,
  onRemove,
}: {
  message: UiMessage;
  isMine: boolean;
  index: number;
  token: string | null;
  onRetry?: (message: UiMessage) => void;
  onRemove?: (message: UiMessage) => void;
}) {
  const colors = useColors();
  const statusPulse = useSharedValue(1);
  const attachments = message.attachments ?? [];
  const location =
    message.type === "location"
      ? normalizeLocationMetadata(message.metadata)
      : null;
  const hasText = Boolean(message.text.trim());
  const hasRichContent = attachments.length > 0 || Boolean(location);

  useEffect(() => {
    if (message.pending || message.failed) {
      statusPulse.value = withRepeat(
        withSequence(
          withTiming(message.failed ? 0.93 : 0.82, { duration: 650 }),
          withTiming(1, { duration: 650 }),
        ),
        -1,
        false,
      );
      return;
    }

    statusPulse.value = withTiming(1, { duration: 160 });
  }, [message.failed, message.pending, statusPulse]);

  const statusStyle = useAnimatedStyle(() => ({
    opacity: statusPulse.value,
  }));

  return (
    <Reanimated.View
      entering={FadeInDown.delay(index * 18).springify().damping(18)}
      style={[
        styles.bubbleRow,
        isMine ? styles.bubbleRowRight : styles.bubbleRowLeft,
      ]}
    >
      <Reanimated.View
        style={[
          styles.bubble,
          isMine
            ? {
                backgroundColor: message.failed ? colors.destructive : colors.primary,
                borderTopRightRadius: 8,
              }
            : {
                backgroundColor: colors.card,
                borderTopLeftRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
              },
          message.pending || message.failed ? statusStyle : null,
        ]}
      >
        {location ? (
          <ChatLocationBubble location={location} isMine={isMine} />
        ) : null}

        {attachments.map((attachment, attachmentIndex) => (
          <ChatAttachmentChip
            key={`${message.id}-${attachment.id ?? attachmentIndex}`}
            attachment={attachment}
            disabled={
              message.pending ||
              message.failed ||
              (!attachment.download_url && attachment.id == null)
            }
            isMine={isMine}
            scope={{
              kind: "adoption",
              conversationId: message.conversationId,
            }}
            token={token}
          />
        ))}
        {hasText ? (
          <Text
            style={[
              styles.bubbleText,
              hasRichContent ? styles.bubbleTextWithAttachment : null,
              { color: isMine ? colors.primaryForeground : colors.foreground },
            ]}
          >
            {message.text}
          </Text>
        ) : null}
        <View style={styles.bubbleFooter}>
          <Text
            style={[
              styles.bubbleTime,
              {
                color: isMine
                  ? "rgba(255,255,255,0.75)"
                  : colors.mutedForeground,
              },
            ]}
          >
            {message.pending
              ? "Sending..."
              : message.failed
                ? "Failed"
                : formatTime(message.timestamp)}
          </Text>
          {isMine && !message.pending && !message.failed ? (
            <Feather name="check" size={11} color="rgba(255,255,255,0.75)" />
          ) : null}
        </View>

        {message.failed ? (
          <View style={styles.failedActions}>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => onRetry?.(message)}
              style={styles.failedActionBtn}
            >
              <Text style={styles.failedActionText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => onRemove?.(message)}
              style={styles.failedActionBtn}
            >
              <Text style={styles.failedActionText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </Reanimated.View>
    </Reanimated.View>
  );
}

export default function AdoptionChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const { token, user } = useAuth();
  const {
    fetchAdoptionConversations,
    fetchMyPets,
    refreshAppCounts,
  } = usePets();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<UiMessage>>(null);
  const voiceRecorderRef = useRef<VoiceRecorderButtonHandle | null>(null);

  const [conversation, setConversation] = useState<AdoptionConversation | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [text, setText] = useState("");
  const [selectedAttachment, setSelectedAttachment] =
    useState<PendingMessageAttachment | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isAttachmentActionPending, setIsAttachmentActionPending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingMs, setVoiceRecordingMs] = useState(0);
  const realtimeDisconnectRef = useRef<null | (() => void)>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const normalizedConversationId = String(conversationId ?? "");
  const isReadOnly = Boolean(conversation?.is_read_only);
  const isOwner = String(user?.id) === String(conversation?.owner_id);
  const isApplicant = String(user?.id) === String(conversation?.applicant_id);
  const applicationStatus = String(conversation?.application?.status ?? "");
  const listingStatus = String(conversation?.listing?.status ?? "");
  const isCompleted =
    conversation?.status === "completed" ||
    applicationStatus === "completed" ||
    listingStatus === "adopted";
  const isRemoved =
    conversation?.status === "closed" ||
    applicationStatus === "cancelled" ||
    listingStatus === "cancelled";
  const canCompleteAdoption =
    Boolean(conversation?.can_complete_adoption) ||
    (isOwner &&
      !isReadOnly &&
      applicationStatus === "accepted" &&
      listingStatus === "open");

  const otherParticipantName = useMemo(() => {
    if (!conversation) return "Adoption chat";

    if (String(user?.id) === String(conversation.owner_id)) {
      return conversation.applicant?.name ?? "Applicant";
    }

    return conversation.owner?.name ?? "Pet owner";
  }, [conversation, user?.id]);

  const title = petName(conversation?.pet) || "Adoption chat";
  const applicantName = conversation?.applicant?.name ?? "the applicant";
  const roleLabel = isOwner
    ? "Owner"
    : isApplicant
      ? "Applicant"
      : "Adoption";
  const statusLabel = isCompleted
    ? "Completed"
    : isRemoved
      ? "Removed"
      : applicationStatus === "accepted"
        ? "Accepted"
        : "Active";
  const statusCopy = isCompleted
    ? isOwner
      ? `${title} has been transferred to ${applicantName}.`
      : `${title} has been added to your pets.`
    : isRemoved
      ? "This adoption listing is closed."
      : isOwner
        ? "Coordinate the handover here when the pet is ready."
        : "Coordinate details with the owner here.";

  const scrollToEndSoon = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, []);

  const load = useCallback(async () => {
    if (!token || !normalizedConversationId) return;

    setIsInitialLoading(true);
    setLoadError("");

    try {
      const [conversationPayload, messagesPayload] = await Promise.all([
        getAdoptionConversation(token, normalizedConversationId),
        getAdoptionConversationMessages(token, normalizedConversationId, {
          limit: 30,
        }),
      ]);

      setConversation(conversationPayload);
      setMessages(dedupeMessages(messagesPayload.data.map(mapMessage).reverse()));
      setHasMore(messagesPayload.has_more);
      setNextCursor(messagesPayload.next_cursor);
      await markAdoptionConversationRead(token, normalizedConversationId);
      scrollToEndSoon();
    } catch (error) {
      setLoadError(
        getAdoptionErrorMessage(
          error,
          "We could not load this adoption chat. Please try again.",
        ),
      );
    } finally {
      setIsInitialLoading(false);
    }
  }, [normalizedConversationId, scrollToEndSoon, token]);

  const refreshAdoptionSurfaces = useCallback(async () => {
    await Promise.all([
      fetchMyPets().catch(() => []),
      fetchAdoptionConversations().catch(() => undefined),
      refreshAppCounts().catch(() => undefined),
    ]);
  }, [fetchAdoptionConversations, fetchMyPets, refreshAppCounts]);

  const refreshConversationSummary = useCallback(async () => {
    if (!token || !normalizedConversationId) return;

    try {
      setConversation(await getAdoptionConversation(token, normalizedConversationId));
      await refreshAdoptionSurfaces();
    } catch {
      // The next focus/app refresh will reconcile state.
    }
  }, [normalizedConversationId, refreshAdoptionSurfaces, token]);

  useFocusEffect(
    useCallback(() => {
      if (normalizedConversationId) {
        setActiveAdoptionConversationId(normalizedConversationId);
      }

      void load();

      return () => {
        setActiveAdoptionConversationId(null);
      };
    }, [load, normalizedConversationId]),
  );

  useEffect(() => {
    if (!token || !normalizedConversationId) return;

    let isMounted = true;

    if (realtimeDisconnectRef.current) {
      realtimeDisconnectRef.current();
      realtimeDisconnectRef.current = null;
    }

    const disconnect = connectAdoptionConversationRealtime({
      token,
      conversationId: normalizedConversationId,
      baseUrl: API_BASE_URL,
      onMessageSent: (apiMessage) => {
        if (!isMounted) return;

        const uiMessage = mapMessage(apiMessage);

        setMessages((prev) => {
          const exists = prev.some(
            (item) => String(item.id) === String(uiMessage.id),
          );

          if (exists) return prev;

          return dedupeMessages([...prev, uiMessage]);
        });

        markAdoptionConversationRead(token, normalizedConversationId).catch(() => {});
        scrollToEndSoon();
      },
      onAdoptionCompleted: () => {
        void refreshConversationSummary();
      },
    });

    realtimeDisconnectRef.current = disconnect;

    return () => {
      isMounted = false;

      if (realtimeDisconnectRef.current) {
        realtimeDisconnectRef.current();
        realtimeDisconnectRef.current = null;
      }
    };
  }, [normalizedConversationId, refreshConversationSummary, scrollToEndSoon, token]);

  async function loadOlder() {
    if (!token || !normalizedConversationId || !nextCursor || isLoadingOlder) {
      return;
    }

    setIsLoadingOlder(true);

    try {
      const payload = await getAdoptionConversationMessages(
        token,
        normalizedConversationId,
        {
          cursor: nextCursor,
          limit: 30,
        },
      );

      setMessages((prev) =>
        dedupeMessages([...payload.data.map(mapMessage).reverse(), ...prev]),
      );
      setHasMore(payload.has_more);
      setNextCursor(payload.next_cursor);
    } catch (error) {
      setLoadError(getAdoptionErrorMessage(error));
    } finally {
      setIsLoadingOlder(false);
    }
  }

  async function sendMessagePayload({
    body,
    attachment,
    location,
    clearComposer = true,
  }: {
    body: string;
    attachment?: PendingMessageAttachment | null;
    location?: ChatLocationMetadata | null;
    clearComposer?: boolean;
  }) {
    const trimmed = body.trim();
    const outgoingAttachment = attachment ?? null;
    const outgoingLocation = location ?? null;

    if (
      (!trimmed && !outgoingAttachment && !outgoingLocation) ||
      !token ||
      !normalizedConversationId ||
      isSending ||
      isReadOnly
    ) {
      return;
    }

    safeHaptic();
    setSendError("");

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: UiMessage = {
      id: tempId,
      conversationId: normalizedConversationId,
      senderId: user?.id ?? "me",
      text: trimmed,
      type: outgoingLocation ? "location" : outgoingAttachment?.type ?? "text",
      metadata: outgoingLocation,
      attachments: outgoingAttachment
        ? [
            {
              type: outgoingAttachment.type,
              original_name: outgoingAttachment.name,
              mime_type: outgoingAttachment.mimeType,
              size_bytes: outgoingAttachment.size ?? null,
              duration_ms: outgoingAttachment.durationMs ?? null,
            },
          ]
        : [],
      timestamp: new Date().toISOString(),
      pending: true,
      retryBody: trimmed,
      retryAttachment: outgoingAttachment,
      retryLocation: outgoingLocation,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    if (clearComposer) {
      setText("");
      setSelectedAttachment(null);
    }
    setIsSending(true);
    scrollToEndSoon();

    try {
      const apiMessage = await sendAdoptionMessage(
        token,
        normalizedConversationId,
        trimmed,
        outgoingAttachment,
        outgoingLocation,
      );
      const realMessage = mapMessage(apiMessage);

      setMessages((prev) =>
        dedupeMessages(
          prev.map((item) =>
            String(item.id) === String(tempId) ? realMessage : item,
          ),
        ),
      );
      await markAdoptionConversationRead(token, normalizedConversationId);
      scrollToEndSoon();
    } catch (error) {
      setSendError(
        getAdoptionErrorMessage(
          error,
          "Message could not be sent. Please try again.",
        ),
      );
      setMessages((prev) =>
        prev.map((item) =>
          String(item.id) === String(tempId)
            ? { ...item, pending: false, failed: true }
            : item,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleSend() {
    void sendMessagePayload({
      body: text,
      attachment: selectedAttachment,
    });
  }

  async function handleRecordedVoice(attachment: PendingMessageAttachment) {
    await sendMessagePayload({
      body: "",
      attachment,
      clearComposer: false,
    });
  }

  const retryFailedMessage = useCallback(
    (message: UiMessage) => {
      setMessages((prev) =>
        prev.filter((item) => String(item.id) !== String(message.id)),
      );
      void sendMessagePayload({
        body: message.retryBody ?? message.text,
        attachment: message.retryAttachment ?? null,
        location: message.retryLocation ?? null,
        clearComposer: false,
      });
    },
    [sendMessagePayload],
  );

  const removeFailedMessage = useCallback((message: UiMessage) => {
    setMessages((prev) =>
      prev.filter((item) => String(item.id) !== String(message.id)),
    );
  }, []);

  async function chooseAttachment(kind: "camera" | "gallery" | "pdf") {
    if (isAttachmentActionPending) return;

    setIsAttachmentActionPending(true);

    try {
      const attachment =
        kind === "camera"
          ? await pickCameraImageAttachment()
          : kind === "gallery"
            ? await pickGalleryImageAttachment()
            : await pickPdfAttachment();

      if (!attachment) return;

      safeHaptic();
      setSelectedAttachment(attachment);
      setSendError("");
    } catch (error) {
      Alert.alert(
        "Could not attach file",
        getAdoptionErrorMessage(
          error,
          error instanceof Error
            ? error.message
          : "Please choose a different file and try again.",
        ),
      );
    } finally {
      setIsAttachmentActionPending(false);
    }
  }

  async function shareCurrentLocation() {
    if (isSending || isReadOnly || isRecordingVoice || isAttachmentActionPending) {
      return;
    }

    const confirmed = await confirmShareCurrentLocation();

    if (!confirmed) return;

    setIsAttachmentActionPending(true);
    setSendError("");

    try {
      const location = await getCurrentChatLocation();
      safeHaptic();
      await sendMessagePayload({
        body: "",
        location,
        clearComposer: false,
      });
    } catch (error) {
      Alert.alert(
        "Could not share location",
        getAdoptionErrorMessage(
          error,
          error instanceof Error ? error.message : "Please try again.",
        ),
      );
    } finally {
      setIsAttachmentActionPending(false);
    }
  }

  function showAttachmentMenu() {
    if (isSending || isReadOnly || isRecordingVoice || isAttachmentActionPending) return;

    Alert.alert("Attach", "Choose what to send.", [
      { text: "Camera", onPress: () => void chooseAttachment("camera") },
      { text: "Gallery", onPress: () => void chooseAttachment("gallery") },
      { text: "Document", onPress: () => void chooseAttachment("pdf") },
      { text: "Location", onPress: () => void shareCurrentLocation() },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function handleCompleteAdoption() {
    if (!token || !normalizedConversationId || !conversation || isCompleting) {
      return;
    }

    Alert.alert(
      "Complete adoption?",
      `This transfers ${title} to ${applicantName}.`,
      [
        { text: "Not Yet", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            setIsCompleting(true);
            setSendError("");

            try {
              const nextConversation = await completeAdoptionConversation(
                token,
                normalizedConversationId,
              );

              setConversation(nextConversation);
              await refreshAdoptionSurfaces();
              Alert.alert("Adoption completed.");
            } catch (error) {
              Alert.alert(
                "Could not complete adoption",
                getAdoptionErrorMessage(error),
              );
            } finally {
              setIsCompleting(false);
            }
          },
        },
      ],
    );
  }

  if (!normalizedConversationId) {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          Chat is not ready
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.retryBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={styles.decorLayer} pointerEvents="none">
        <View style={[styles.blobOne, { backgroundColor: colors.primary + "12" }]} />
        <View style={[styles.blobTwo, { backgroundColor: colors.match + "12" }]} />
      </View>

      <Reanimated.View
        entering={FadeInDown.springify().damping(20)}
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.78}
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text
            numberOfLines={1}
            style={[styles.headerTitle, { color: colors.foreground }]}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.headerSub, { color: colors.mutedForeground }]}
          >
            {otherParticipantName}
          </Text>
        </View>

        <View
          style={[
            styles.moreBtn,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <Feather name="home" size={19} color={colors.foreground} />
        </View>
      </Reanimated.View>

      {conversation ? (
        <View
          style={[
            styles.roleBar,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.roleCopy}>
            <View style={styles.roleTitleRow}>
              <Text style={[styles.roleLabel, { color: colors.foreground }]}>
                {roleLabel}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isCompleted
                      ? colors.success + "18"
                      : isRemoved
                        ? colors.destructive + "15"
                        : colors.primary + "14",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color: isCompleted
                        ? colors.success
                        : isRemoved
                          ? colors.destructive
                          : colors.primary,
                    },
                  ]}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>
            <Text
              numberOfLines={2}
              style={[styles.roleDescription, { color: colors.mutedForeground }]}
            >
              {statusCopy}
            </Text>
          </View>

          {canCompleteAdoption ? (
            <TouchableOpacity
              activeOpacity={0.82}
              disabled={isCompleting}
              onPress={handleCompleteAdoption}
              style={[
                styles.completeBtn,
                {
                  backgroundColor: colors.success,
                  opacity: isCompleting ? 0.72 : 1,
                },
              ]}
            >
              {isCompleting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Feather name="check-circle" size={15} color="#ffffff" />
                  <Text style={styles.completeBtnText}>Complete</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {hasMore ? (
        <TouchableOpacity
          disabled={isLoadingOlder}
          onPress={loadOlder}
          style={[
            styles.loadMoreBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: isLoadingOlder ? 0.7 : 1,
            },
          ]}
        >
          {isLoadingOlder ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text style={[styles.loadMoreText, { color: colors.foreground }]}>
              Load older messages
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      {isInitialLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingTitle, { color: colors.foreground }]}>
            Loading messages...
          </Text>
        </View>
      ) : loadError ? (
        <View style={styles.loadingWrap}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Could not load messages
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {loadError}
          </Text>
          <TouchableOpacity
            onPress={load}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messageList}
          renderItem={({ item, index }) => (
            <MessageBubble
              index={index}
              isMine={String(item.senderId) === String(user?.id)}
              message={item}
              token={token}
              onRetry={retryFailedMessage}
              onRemove={removeFailedMessage}
            />
          )}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Reanimated.View
              entering={FadeInDown.delay(120).springify()}
              style={styles.emptyChat}
            >
              <View
                style={[
                  styles.emptyBubble,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Feather name="message-circle" size={42} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No messages yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Send a message to coordinate the adoption.
              </Text>
            </Reanimated.View>
          }
        />
      )}

      {sendError ? (
        <View
          style={[
            styles.sendErrorBox,
            {
              backgroundColor: colors.destructive + "15",
              borderColor: colors.destructive + "25",
            },
          ]}
        >
          <Feather name="alert-circle" size={14} color={colors.destructive} />
          <Text style={[styles.sendErrorText, { color: colors.destructive }]}>
            {sendError}
          </Text>
        </View>
      ) : null}

      {isReadOnly ? (
        <View
          style={[
            styles.readOnlyBar,
            { backgroundColor: colors.secondary, borderTopColor: colors.border },
          ]}
        >
          <Text style={[styles.readOnlyText, { color: colors.mutedForeground }]}>
            This adoption chat is read-only.
          </Text>
        </View>
      ) : null}

      <Reanimated.View
        entering={FadeInUp.springify().damping(20)}
        style={[
          styles.inputBar,
          {
            paddingBottom: bottomPad + 8,
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ]}
      >
        {isRecordingVoice ? (
          <VoiceRecordingBar
            elapsedMs={voiceRecordingMs}
            onCancel={() => voiceRecorderRef.current?.cancel()}
          />
        ) : null}

        {selectedAttachment ? (
          <View
            style={[
              styles.selectedAttachmentBar,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            {selectedAttachment.type === "image" ? (
              <ImageFallback
                uri={selectedAttachment.uri}
                containerStyle={styles.selectedAttachmentThumb}
                fallback={
                  <Feather name="image" size={15} color={colors.foreground} />
                }
                accessibilityLabel="Selected image"
              />
            ) : (
              <Feather
                name={attachmentIcon(selectedAttachment.type) as any}
                size={15}
                color={colors.foreground}
              />
            )}
            <Text
              numberOfLines={1}
              style={[styles.selectedAttachmentText, { color: colors.foreground }]}
            >
              {attachmentPreviewText(selectedAttachment.type)} · {selectedAttachment.name}
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isSending}
              onPress={() => setSelectedAttachment(null)}
              style={styles.selectedAttachmentRemove}
            >
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.composerRow}>
          <TouchableOpacity
            activeOpacity={0.78}
            disabled={isSending || isReadOnly || isRecordingVoice || isAttachmentActionPending}
            onPress={showAttachmentMenu}
            style={[
              styles.composerIconBtn,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                opacity: isReadOnly || isAttachmentActionPending ? 0.55 : 1,
              },
            ]}
          >
            <Feather name="paperclip" size={18} color={colors.foreground} />
          </TouchableOpacity>

          <VoiceRecorderButton
            ref={voiceRecorderRef}
            disabled={
              isSending ||
              isReadOnly ||
              isAttachmentActionPending ||
              Boolean(text.trim()) ||
              Boolean(selectedAttachment)
            }
            onRecorded={handleRecordedVoice}
            onError={(message) => setSendError(message)}
            onRecordingChange={setIsRecordingVoice}
            onRecordingProgress={setVoiceRecordingMs}
          />

          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                opacity: isReadOnly ? 0.65 : 1,
              },
            ]}
          >
            <TextInput
              editable={!isSending && !isReadOnly && !isRecordingVoice && !isAttachmentActionPending}
              multiline
              onChangeText={(value) => {
                setText(value);
                setSendError("");
              }}
              placeholder={
                isReadOnly
                  ? "Read-only chat"
                  : isRecordingVoice
                    ? "Recording voice note..."
                  : selectedAttachment
                    ? "Add a caption..."
                    : "Write a message..."
              }
              placeholderTextColor={colors.mutedForeground}
              style={[styles.textInput, { color: colors.foreground }]}
              value={text}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.82}
            disabled={
              (!text.trim() && !selectedAttachment) ||
              isSending ||
              isReadOnly ||
              isRecordingVoice ||
              isAttachmentActionPending
            }
            onPress={handleSend}
            style={[
              styles.sendBtn,
              {
                backgroundColor: colors.primary,
                opacity:
                  (!text.trim() && !selectedAttachment) ||
                  isSending ||
                  isReadOnly ||
                  isRecordingVoice ||
                  isAttachmentActionPending
                    ? 0.5
                    : 1,
              },
            ]}
          >
            {isSending ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Feather name="send" size={18} color={colors.primaryForeground} />
            )}
          </TouchableOpacity>
        </View>
      </Reanimated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  decorLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  blobOne: {
    position: "absolute",
    top: 120,
    left: -90,
    width: 230,
    height: 230,
    borderRadius: 115,
  },
  blobTwo: {
    position: "absolute",
    bottom: 190,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 5,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  headerSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  moreBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  roleBar: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    zIndex: 4,
  },
  roleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  roleTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: "900",
  },
  roleDescription: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  statusPill: {
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "900",
  },
  completeBtn: {
    minWidth: 104,
    height: 38,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  completeBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 28,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  loadMoreBtn: {
    alignSelf: "center",
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    zIndex: 3,
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: "800",
  },
  messageList: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  bubbleRowLeft: {
    justifyContent: "flex-start",
  },
  bubbleRowRight: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  bubbleText: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  bubbleTextWithAttachment: {
    marginTop: 8,
  },
  attachmentChip: {
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
  attachmentName: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  bubbleFooter: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  bubbleTime: {
    fontSize: 10,
    fontWeight: "700",
  },
  failedActions: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  failedActionBtn: {
    minHeight: 26,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.42)",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  failedActionText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
  },
  emptyBubble: {
    width: 88,
    height: 88,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
  },
  retryBtn: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  retryBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  sendErrorBox: {
    marginHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sendErrorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  readOnlyBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  readOnlyText: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
  },
  inputBar: {
    gap: 10,
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  composerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedAttachmentBar: {
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectedAttachmentText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  selectedAttachmentRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedAttachmentThumb: {
    width: 28,
    height: 28,
    borderRadius: 9,
    overflow: "hidden",
  },
  inputWrap: {
    flex: 1,
    minHeight: 42,
    maxHeight: 112,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 9 : 4,
  },
  textInput: {
    minHeight: 30,
    maxHeight: 96,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    padding: 0,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
