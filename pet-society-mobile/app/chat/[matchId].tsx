import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import Reanimated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { setActiveConversationId } from "@/services/inAppMessageBus";
import { useColors } from "@/hooks/useColors";
import { usePets, type Match, type Pet } from "@/context/PetsContext";
import { useAuth } from "@/context/AuthContext";
import { ImageFallback } from "@/components/ImageFallback";
import { PetDocumentBadges } from "@/components/pets/PetDocumentBadges";
import { PetVerifiedBadge } from "@/components/pets/PetVerifiedBadge";
import {
  resolvePetBreed,
  resolvePetImage,
  resolvePetName,
  resolvePetType,
} from "@/utils/pet";
import { friendlyErrorMessage } from "@/utils/userMessages";
import { API_BASE_URL } from "@/config/realtime";
import {
  fetchConversationMessages,
  sendConversationMessage,
  markConversationRead,
  type ChatMessage,
} from "@/services/chat/chatApi";
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
import {
  confirmShareCurrentLocation,
  getCurrentChatLocation,
} from "@/services/chat/locationMessages";
import { connectConversationRealtime } from "@/services/chat/chatRealtime";
import { ChatAttachmentChip } from "@/components/chat/ChatAttachmentChip";
import { ChatLocationBubble } from "@/components/chat/ChatLocationBubble";
import {
  VoiceRecorderButton,
  VoiceRecordingBar,
  type VoiceRecorderButtonHandle,
} from "@/components/chat/VoiceRecorderButton";
import { ReportSheet } from "@/components/reports/ReportSheet";
import {
  blockUser,
  getSafetyErrorMessage,
  unmatch,
} from "@/services/safetyApi";

type MatchWithConversation = Match & {
  conversation_id?: string | number | null;
};

type MatchPetLike = Partial<Pet> & {
  pet_name?: string;
  pet_type?: string;
  images?: Array<{
    url?: string | null;
    image_path?: string | null;
  }>;
};

type UiMessage = {
  id: string | number;
  conversationId: string | number;
  senderId: string | number;
  text: string;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
  attachments?: MessageAttachment[];
  timestamp: string;
  pending?: boolean;
  failed?: boolean;
  retryBody?: string;
  retryAttachment?: PendingMessageAttachment | null;
  retryLocation?: ChatLocationMetadata | null;
};

const QUICK_REPLIES = [
  "Boop approved 🐾",
  "Your pet is illegally cute 😭",
  "Playdate soon? 🦴",
  "This match has tail energy 💘",
];

function safeHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "web") return;

  Haptics.impactAsync(style).catch(() => { });
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

function getPetId(pet?: MatchPetLike | null) {
  if (pet?.id == null || pet.id === "") return null;

  return String(pet.id);
}

function getMyPet(match?: Match | null): MatchPetLike | null {
  return (match?.my_pet ?? match?.pet_one ?? null) as MatchPetLike | null;
}

function getMatchedPet(match?: Match | null): MatchPetLike | null {
  return (match?.matched_pet ?? match?.pet_two ?? match?.pet_one ?? null) as
    | MatchPetLike
    | null;
}

function mapApiMessageToUi(message: ChatMessage): UiMessage {
  return {
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id,
    text: message.body ?? "",
    type: message.type,
    metadata: message.metadata ?? null,
    attachments: normalizeMessageAttachments(message),
    timestamp: message.created_at,
  };
}

function dedupeMessages(messages: UiMessage[]): UiMessage[] {
  const map = new Map<string, UiMessage>();

  for (const message of messages) {
    map.set(String(message.id), message);
  }

  return Array.from(map.values()).sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
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
      {!isMine && (
        <View
          style={[
            styles.bubbleMiniAvatar,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={styles.bubbleMiniEmoji}>🐾</Text>
        </View>
      )}

      <Reanimated.View
        style={[
          styles.bubble,
          isMine
            ? {
              backgroundColor: message.failed ? "#ef4444" : colors.primary,
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
              kind: "match",
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
              {
                color: isMine ? "#fff" : colors.foreground,
              },
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

          {isMine && !message.pending && !message.failed && (
            <Reanimated.View entering={ZoomIn.springify().damping(16)}>
              <Feather
                name="check"
                size={11}
                color="rgba(255,255,255,0.75)"
              />
            </Reanimated.View>
          )}
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

function PetAvatar({
  uri,
  emoji,
  side,
}: {
  uri: string | null;
  emoji: string;
  side: "left" | "right";
}) {
  const colors = useColors();

  return (
    <Reanimated.View
      entering={ZoomIn.delay(side === "left" ? 80 : 160).springify()}
      style={[
        styles.petAvatar,
        side === "right" && styles.petAvatarRight,
        {
          backgroundColor: colors.muted,
          borderColor: colors.card,
        },
      ]}
    >
      <ImageFallback
        uri={uri}
        containerStyle={styles.petAvatarImg}
        fallback={<Text style={styles.petAvatarEmoji}>{emoji}</Text>}
        accessibilityLabel="Pet photo"
      />
    </Reanimated.View>
  );
}

function QuickReplyChip({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Reanimated.View style={chipStyle}>
      <TouchableOpacity
        onPress={() => {
          scale.value = withSequence(
            withTiming(0.96, { duration: 80 }),
            withSpring(1, { damping: 14 }),
          );
          onPress();
        }}
        style={[
          styles.quickReplyChip,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        activeOpacity={0.9}
      >
        <Text
          style={[
            styles.quickReplyText,
            {
              color: colors.foreground,
            },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    matchId?: string;
    conversationId?: string;
  }>();

  const {
    matches,
    fetchMatches,
    updateMatchLastMessage,
    markConversationReadLocal,
    removeMatchLocal,
    removeMatchesForUserLocal,
  } = usePets();
  const { user, token } = useAuth();

  const normalizedMatchId = String(params.matchId ?? "");
  const paramConversationId = params.conversationId
    ? String(params.conversationId)
    : "";

  const match = matches.find((item) => {
    const itemConversationId = item.conversation_id
      ? String(item.conversation_id)
      : "";

    return (
      String(item.id) === normalizedMatchId ||
      Boolean(paramConversationId && itemConversationId === paramConversationId) ||
      Boolean(itemConversationId && itemConversationId === normalizedMatchId)
    );
  }) as MatchWithConversation | undefined;

  const resolvedConversationId = useMemo(() => {
    return (
      paramConversationId ||
      (match?.conversation_id ? String(match.conversation_id) : "")
    );
  }, [paramConversationId, match?.conversation_id]);

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [text, setText] = useState("");
  const [selectedAttachment, setSelectedAttachment] =
    useState<PendingMessageAttachment | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSafetyActionLoading, setIsSafetyActionLoading] = useState(false);
  const [isAttachmentActionPending, setIsAttachmentActionPending] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [composerFocused, setComposerFocused] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingMs, setVoiceRecordingMs] = useState(0);

  const flatListRef = useRef<FlatList<UiMessage>>(null);
  const realtimeDisconnectRef = useRef<null | (() => void)>(null);
  const voiceRecorderRef = useRef<VoiceRecorderButtonHandle | null>(null);

  const sendScale = useSharedValue(1);
  const inputScale = useSharedValue(1);

  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const inputAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const myPet = getMyPet(match);
  const matchedPet = getMatchedPet(match);

  const petOneName = resolvePetName(myPet);
  const petTwoName = resolvePetName(matchedPet);

  const petOneType = resolvePetType(myPet);
  const petTwoType = resolvePetType(matchedPet);
  const matchedBreed = resolvePetBreed(matchedPet);

  const img1 = resolvePetImage(myPet);
  const img2 = resolvePetImage(matchedPet);
  const matchedUserId = matchedPet?.user_id != null
    ? String(matchedPet.user_id)
    : null;

  const headerSubtitle = `${petOneType} + ${petTwoType}${matchedBreed ? ` · ${matchedBreed}` : ""
    }`;

  const scrollToEndSoon = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, []);

  const loadMessages = useCallback(
    async ({ append = false }: { append?: boolean } = {}) => {
      if (!token || !resolvedConversationId) return;

      if (append) {
        if (!nextCursor || isLoadingOlder) return;
        setIsLoadingOlder(true);
      } else {
        setIsInitialLoading(true);
        setLoadError("");
      }

      try {
        const payload = await fetchConversationMessages({
          token,
          conversationId: resolvedConversationId,
          cursor: append ? nextCursor : null,
          limit: 30,
        });

        const mapped = payload.data.map(mapApiMessageToUi).reverse();

        setMessages((prev) => {
          if (append) {
            return dedupeMessages([...mapped, ...prev]);
          }

          return dedupeMessages(mapped);
        });

        setHasMore(payload.has_more);
        setNextCursor(payload.next_cursor);
        setLoadError("");

        await markConversationRead({
          token,
          conversationId: resolvedConversationId,
        });

        markConversationReadLocal(resolvedConversationId);

        if (!append) {
          scrollToEndSoon();
        }
      } catch (error) {
        if (!append) {
          setLoadError(
            friendlyErrorMessage(
              error instanceof Error ? error.message : undefined,
              "We could not load this chat. Please try again.",
            ),
          );
        }
      } finally {
        setIsInitialLoading(false);
        setIsLoadingOlder(false);
      }
    },
    [
      isLoadingOlder,
      nextCursor,
      markConversationReadLocal,
      resolvedConversationId,
      scrollToEndSoon,
      token,
    ],
  );

  useEffect(() => {
    if (!token || !resolvedConversationId) return;

    let isMounted = true;

    if (realtimeDisconnectRef.current) {
      realtimeDisconnectRef.current();
      realtimeDisconnectRef.current = null;
    }

    const disconnect = connectConversationRealtime({
      token,
      conversationId: resolvedConversationId,
      baseUrl: API_BASE_URL,
      onMessageSent: (apiMessage) => {
        if (!isMounted) return;

        const uiMessage = mapApiMessageToUi(apiMessage);

        updateMatchLastMessage(apiMessage);
        markConversationReadLocal(resolvedConversationId);

        setMessages((prev) => {
          const exists = prev.some(
            (item) => String(item.id) === String(uiMessage.id),
          );

          if (exists) return prev;

          return dedupeMessages([...prev, uiMessage]);
        });

        markConversationRead({
          token,
          conversationId: resolvedConversationId,
        }).catch(() => {});

        scrollToEndSoon();
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
  }, [
    markConversationReadLocal,
    resolvedConversationId,
    scrollToEndSoon,
    token,
    updateMatchLastMessage,
  ]);

  useEffect(() => {
    if (!match && normalizedMatchId) {
      fetchMatches();
    }
  }, [match, normalizedMatchId, fetchMatches]);

  useFocusEffect(
    useCallback(() => {
      if (!resolvedConversationId) {
        setActiveConversationId(null);
        return undefined;
      }

      setActiveConversationId(resolvedConversationId);
      markConversationReadLocal(resolvedConversationId);

      return () => {
        setActiveConversationId(null);
      };
    }, [markConversationReadLocal, resolvedConversationId]),
  );

  useEffect(() => {
    if (!token || !resolvedConversationId) return;

    loadMessages();
  }, [resolvedConversationId, token]);

  const sendMessagePayload = useCallback(async ({
    body,
    attachment,
    location,
    clearComposer = true,
  }: {
    body: string;
    attachment?: PendingMessageAttachment | null;
    location?: ChatLocationMetadata | null;
    clearComposer?: boolean;
  }) => {
    const trimmed = body.trim();
    const outgoingAttachment = attachment ?? null;
    const outgoingLocation = location ?? null;

    if ((!trimmed && !outgoingAttachment && !outgoingLocation) || !token || !resolvedConversationId || isSending) return;
    setSendError("");

    sendScale.value = withSpring(0.82, { damping: 10 }, () => {
      sendScale.value = withSpring(1, { damping: 12 });
    });

    inputScale.value = withSpring(0.98, { damping: 10 }, () => {
      inputScale.value = withSpring(1, { damping: 14 });
    });

    safeHaptic(Haptics.ImpactFeedbackStyle.Light);

    const tempId = `temp-${Date.now()}`;

    const optimisticMessage: UiMessage = {
      id: tempId,
      conversationId: resolvedConversationId,
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
      const apiMessage = await sendConversationMessage({
        token,
        conversationId: resolvedConversationId,
        body: trimmed,
        attachment: outgoingAttachment,
        location: outgoingLocation,
      });

      const realMessage = mapApiMessageToUi(apiMessage);

      updateMatchLastMessage(apiMessage);
      markConversationReadLocal(resolvedConversationId);

      setMessages((prev) =>
        dedupeMessages(
          prev.map((item) =>
            String(item.id) === String(tempId) ? realMessage : item,
          ),
        ),
      );

      scrollToEndSoon();
    } catch (error) {
      setSendError(
        friendlyErrorMessage(
          error instanceof Error ? error.message : undefined,
          "Message could not be sent. Please try again.",
        ),
      );

      setMessages((prev) =>
        prev.map((item) =>
          String(item.id) === String(tempId)
            ? {
              ...item,
              pending: false,
              failed: true,
            }
            : item,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }, [
    inputScale,
    isSending,
    resolvedConversationId,
    scrollToEndSoon,
    sendScale,
    selectedAttachment,
    text,
    token,
    updateMatchLastMessage,
    user?.id,
    markConversationReadLocal,
  ]);

  const handleSend = useCallback(() => {
    void sendMessagePayload({
      body: text,
      attachment: selectedAttachment,
    });
  }, [selectedAttachment, sendMessagePayload, text]);

  const handleRecordedVoice = useCallback(
    async (attachment: PendingMessageAttachment) => {
      await sendMessagePayload({
        body: "",
        attachment,
        clearComposer: false,
      });
    },
    [sendMessagePayload],
  );

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

      safeHaptic(Haptics.ImpactFeedbackStyle.Light);
      setSelectedAttachment(attachment);
      setSendError("");
    } catch (error) {
      Alert.alert(
        "Could not attach file",
        friendlyErrorMessage(
          error instanceof Error ? error.message : undefined,
          "Please choose a different file and try again.",
        ),
      );
    } finally {
      setIsAttachmentActionPending(false);
    }
  }

  async function shareCurrentLocation() {
    if (isSending || isRecordingVoice || isAttachmentActionPending) return;

    const confirmed = await confirmShareCurrentLocation();

    if (!confirmed) return;

    setIsAttachmentActionPending(true);
    setSendError("");

    try {
      const location = await getCurrentChatLocation();
      safeHaptic(Haptics.ImpactFeedbackStyle.Light);
      await sendMessagePayload({
        body: "",
        location,
        clearComposer: false,
      });
    } catch (error) {
      Alert.alert(
        "Could not share location",
        friendlyErrorMessage(
          error instanceof Error ? error.message : undefined,
          "Please try again.",
        ),
      );
    } finally {
      setIsAttachmentActionPending(false);
    }
  }

  function showAttachmentMenu() {
    if (isSending || isRecordingVoice || isAttachmentActionPending) return;

    Alert.alert("Attach", "Choose what to send.", [
      { text: "Camera", onPress: () => void chooseAttachment("camera") },
      { text: "Gallery", onPress: () => void chooseAttachment("gallery") },
      { text: "Document", onPress: () => void chooseAttachment("pdf") },
      { text: "Location", onPress: () => void shareCurrentLocation() },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function applyQuickReply(reply: string) {
    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
    setText(reply);
    inputScale.value = withSequence(
      withTiming(0.98, { duration: 80 }),
      withSpring(1.02, { damping: 14 }),
      withSpring(1, { damping: 16 }),
    );
  }

  function openMatchedPetDetails() {
    const petId = getPetId(matchedPet);

    if (!petId) return;

    router.push({
      pathname: "/pets/[petId]" as any,
      params: {
        petId,
        source: "match",
        matchId: normalizedMatchId,
        conversationId: resolvedConversationId,
      },
    });
  }

  function showSafetyMenu() {
    const actions = [
      {
        text: "Report Conversation",
        onPress: () => setReportVisible(true),
      },
      matchedUserId
        ? {
          text: "Block User",
          style: "destructive" as const,
          onPress: confirmBlockUser,
        }
        : null,
      {
        text: "Unmatch",
        style: "destructive" as const,
        onPress: confirmUnmatch,
      },
      { text: "Cancel", style: "cancel" as const },
    ].filter(Boolean) as Array<{
      text: string;
      style?: "default" | "cancel" | "destructive";
      onPress?: () => void;
    }>;

    Alert.alert("Safety Options", "Choose an action for this match.", actions);
  }

  function confirmUnmatch() {
    if (!token || !normalizedMatchId || isSafetyActionLoading) return;

    Alert.alert(
      "Are you sure you want to unmatch?",
      "You will no longer be able to chat with this match.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unmatch",
          style: "destructive",
          onPress: async () => {
            setIsSafetyActionLoading(true);

            try {
              await unmatch(token, normalizedMatchId);
              removeMatchLocal(normalizedMatchId);
              Alert.alert("Unmatched successfully.");
              router.replace("/(tabs)/matches");
            } catch (error) {
              Alert.alert("Could not unmatch", getSafetyErrorMessage(error));
            } finally {
              setIsSafetyActionLoading(false);
            }
          },
        },
      ],
    );
  }

  function confirmBlockUser() {
    if (!token || !matchedUserId || isSafetyActionLoading) return;

    Alert.alert(
      "Block this user?",
      "They will no longer be able to contact you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setIsSafetyActionLoading(true);

            try {
              await blockUser(token, matchedUserId);
              removeMatchesForUserLocal(matchedUserId);
              Alert.alert("User blocked.");
              router.replace("/(tabs)/matches");
            } catch (error) {
              Alert.alert("Could not block user", getSafetyErrorMessage(error));
            } finally {
              setIsSafetyActionLoading(false);
            }
          },
        },
      ],
    );
  }

  if (!resolvedConversationId) {
    return (
      <View
        style={[
          styles.centerState,
          {
            backgroundColor: colors.background,
            paddingTop: topPad,
          },
        ]}
      >
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          Chat is not ready
        </Text>

        <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>
          This match does not have a conversation yet.
        </Text>

        <TouchableOpacity
          onPress={() => {
            fetchMatches();
          }}
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.retryBtnText}>Refresh matches</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.retryBtn,
            {
              backgroundColor: colors.secondary,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.retryBtnText, { color: colors.foreground }]}>
            Go back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.decorLayer} pointerEvents="none">
        <View
          style={[
            styles.blobOne,
            {
              backgroundColor: colors.primary + "12",
            },
          ]}
        />

        <View
          style={[
            styles.blobTwo,
            {
              backgroundColor: colors.match + "12",
            },
          ]}
        />

        <Text style={[styles.bgPawOne, { color: colors.primary + "16" }]}>
          🐾
        </Text>

        <Text style={[styles.bgPawTwo, { color: colors.match + "14" }]}>
          🐾
        </Text>
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
          onPress={() => {
            safeHaptic(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={[
            styles.backBtn,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
            },
          ]}
          activeOpacity={0.78}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={openMatchedPetDetails}
          disabled={!getPetId(matchedPet)}
          activeOpacity={0.82}
          style={styles.headerCenter}
          accessibilityRole="button"
          accessibilityLabel="View pet profile"
        >
          <View style={styles.avatarStage}>
            <PetAvatar uri={img1} emoji="🐶" side="left" />
            <PetAvatar uri={img2} emoji="🐱" side="right" />

            <Reanimated.View
              entering={ZoomIn.delay(240).springify()}
              style={[
                styles.heartBadge,
                {
                  backgroundColor: colors.match,
                  borderColor: colors.card,
                },
              ]}
            >
              <Text style={styles.heartBadgeText}>♥</Text>
            </Reanimated.View>
          </View>

          <View style={styles.headerTextWrap}>
            <View style={styles.headerTitleRow}>
              <Text
                style={[
                  styles.headerTitle,
                  {
                    color: colors.foreground,
                  },
                ]}
                numberOfLines={1}
              >
                {petOneName} & {petTwoName}
              </Text>

              <PetVerifiedBadge pet={matchedPet} compact />

              <View
                style={[
                  styles.liveDot,
                  {
                    backgroundColor: colors.match,
                  },
                ]}
              />
            </View>

            <Text
              style={[
                styles.headerSub,
                {
                  color: colors.mutedForeground,
                },
              ]}
              numberOfLines={1}
            >
              {headerSubtitle}
            </Text>

            <PetDocumentBadges pet={matchedPet} compact />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={showSafetyMenu}
          disabled={isSafetyActionLoading}
          style={[
            styles.moreBtn,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
              opacity: isSafetyActionLoading ? 0.55 : 1,
            },
          ]}
          activeOpacity={0.78}
        >
          <Feather name="more-horizontal" size={21} color={colors.foreground} />
        </TouchableOpacity>
      </Reanimated.View>

      <ReportSheet
        visible={reportVisible}
        title="Report Conversation"
        target={
          resolvedConversationId
            ? {
              reportable_type: "conversation",
              reportable_id: resolvedConversationId,
              reported_user_id: matchedUserId,
            }
            : null
        }
        onClose={() => setReportVisible(false)}
        onSubmitted={() => Alert.alert("Report submitted. Our team will review it.")}
      />

      <Reanimated.View
        entering={FadeInDown.delay(80).springify().damping(18)}
        style={[
          styles.matchBanner,
          {
            backgroundColor: colors.match + "12",
            borderColor: colors.match + "30",
          },
        ]}
      >
        <Text style={styles.matchBannerEmoji}>💘</Text>

        <View style={styles.matchBannerTextWrap}>
          <Text style={[styles.matchBannerTitle, { color: colors.foreground }]}>
            Pawfect chaos unlocked!
          </Text>

          <Text
            style={[
              styles.matchBannerSub,
              {
                color: colors.mutedForeground,
              },
            ]}
            numberOfLines={1}
          >
            Send a boop before someone steals the spotlight.
          </Text>
        </View>
      </Reanimated.View>

      {hasMore && (
        <TouchableOpacity
          onPress={() => loadMessages({ append: true })}
          disabled={isLoadingOlder}
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
              Load older chaos
            </Text>
          )}
        </TouchableOpacity>
      )}

      {isInitialLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingTitle, { color: colors.foreground }]}>
            Loading messages...
          </Text>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Opening your chat
          </Text>
        </View>
      ) : loadError ? (
        <View style={styles.loadingWrap}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Could not load messages
          </Text>

          <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>
            {loadError}
          </Text>

          <TouchableOpacity
            onPress={() => loadMessages()}
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
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Reanimated.View
              entering={FadeInDown.delay(120).springify()}
              style={styles.emptyChat}
            >
              <View
                style={[
                  styles.emptyBubble,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 52 }}>🐾</Text>
              </View>

              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No messages yet
              </Text>

              <Text
                style={[
                  styles.emptyChatText,
                  {
                    color: colors.mutedForeground,
                  },
                ]}
              >
                Send a boop to start the conversation.
              </Text>
            </Reanimated.View>
          }
          renderItem={({ item, index }) => (
            <MessageBubble
              message={item}
              isMine={String(item.senderId) === String(user?.id)}
              index={index}
              token={token}
              onRetry={retryFailedMessage}
              onRemove={removeFailedMessage}
            />
          )}
        />
      )}

      {messages.length === 0 && !isInitialLoading && !loadError && (
        <Reanimated.View
          entering={FadeInUp.delay(80).springify().damping(18)}
          style={styles.quickRepliesWrap}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickReplies}
          >
            {QUICK_REPLIES.map((reply) => (
              <QuickReplyChip
                key={reply}
                onPress={() => applyQuickReply(reply)}
                label={reply}
              />
            ))}
          </ScrollView>
        </Reanimated.View>
      )}

      {!!sendError && (
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
      )}

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
              {
                borderColor: colors.border,
                backgroundColor: colors.secondary,
              },
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
              onPress={() => setSelectedAttachment(null)}
              disabled={isSending}
              style={styles.selectedAttachmentRemove}
            >
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.composerRow}>
          <TouchableOpacity
            style={[
              styles.composerIconBtn,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
            ]}
            activeOpacity={0.78}
            onPress={showAttachmentMenu}
            disabled={isSending || isRecordingVoice || isAttachmentActionPending}
          >
            <Feather name="paperclip" size={18} color={colors.foreground} />
          </TouchableOpacity>

          <VoiceRecorderButton
            ref={voiceRecorderRef}
            disabled={isSending || isAttachmentActionPending || Boolean(text.trim()) || Boolean(selectedAttachment)}
            onRecorded={handleRecordedVoice}
            onError={(message) => setSendError(message)}
            onRecordingChange={setIsRecordingVoice}
            onRecordingProgress={setVoiceRecordingMs}
          />

          <Reanimated.View style={[styles.inputWrap, inputAnimStyle]}>
            <TextInput
              value={text}
              onChangeText={(value) => {
                setText(value);
                setSendError("");
              }}
              placeholder={
                isRecordingVoice
                  ? "Recording voice note..."
                  : selectedAttachment
                  ? "Add a caption..."
                  : "Send a boop, joke, or tiny confession…"
              }
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                  borderColor: composerFocused ? colors.primary : colors.border,
                },
              ]}
              multiline
              maxLength={500}
              onFocus={() => {
                setComposerFocused(true);
                inputScale.value = withSpring(1.015, { damping: 16 });
              }}
              onBlur={() => {
                setComposerFocused(false);
                inputScale.value = withSpring(1, { damping: 16 });
              }}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!isSending && !isRecordingVoice}
            />
          </Reanimated.View>

          <Reanimated.View style={sendAnimStyle}>
            <TouchableOpacity
              onPress={handleSend}
              disabled={(!text.trim() && !selectedAttachment) || isSending || isRecordingVoice || isAttachmentActionPending}
              style={[
                styles.sendBtn,
                {
                  backgroundColor:
                    text.trim() || selectedAttachment ? colors.primary : colors.muted,
                  borderColor:
                    text.trim() || selectedAttachment ? colors.primary : colors.border,
                  opacity: isSending || isRecordingVoice ? 0.7 : 1,
                },
              ]}
              activeOpacity={0.85}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather
                  name="send"
                  size={20}
                  color={text.trim() || selectedAttachment ? "#fff" : colors.mutedForeground}
                />
              )}
            </TouchableOpacity>
          </Reanimated.View>
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
    width: 190,
    height: 190,
    borderRadius: 95,
    top: 80,
    left: -105,
    opacity: 0.9,
  },

  blobTwo: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    bottom: 105,
    right: -135,
    opacity: 0.9,
  },

  bgPawOne: {
    position: "absolute",
    top: 215,
    right: 26,
    fontSize: 42,
    transform: [{ rotate: "14deg" }],
  },

  bgPawTwo: {
    position: "absolute",
    bottom: 185,
    left: 28,
    fontSize: 38,
    transform: [{ rotate: "-12deg" }],
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  moreBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  avatarStage: {
    width: 70,
    height: 48,
    position: "relative",
  },

  petAvatar: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    left: 0,
    top: 2,
  },

  petAvatarRight: {
    left: 27,
  },

  petAvatarImg: {
    width: "100%",
    height: "100%",
  },

  petAvatarEmoji: {
    fontSize: 22,
  },

  heartBadge: {
    position: "absolute",
    left: 29,
    top: 28,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  heartBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    marginTop: -1,
  },

  headerTextWrap: {
    flex: 1,
  },

  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    maxWidth: "88%",
    letterSpacing: -0.25,
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  headerSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },

  matchBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  matchBannerEmoji: {
    fontSize: 25,
  },

  matchBannerTextWrap: {
    flex: 1,
  },

  matchBannerTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.15,
  },

  matchBannerSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },

  messageList: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 10,
  },

  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    maxWidth: "86%",
    gap: 8,
  },

  bubbleRowLeft: {
    alignSelf: "flex-start",
  },

  bubbleRowRight: {
    alignSelf: "flex-end",
  },

  bubbleMiniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },

  bubbleMiniEmoji: {
    fontSize: 14,
  },

  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 19,
    maxWidth: "100%",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },

  bubbleText: {
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: "600",
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
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },

  bubbleTime: {
    fontSize: 10.5,
    fontWeight: "800",
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

  quickRepliesWrap: {
    paddingVertical: 8,
  },

  quickReplies: {
    paddingHorizontal: 16,
    gap: 8,
  },

  quickReplyChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.04 : 0,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  quickReplyText: {
    fontSize: 12,
    fontWeight: "800",
  },

  inputBar: {
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 14,
    gap: 10,
  },

  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },

  composerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
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
  },

  input: {
    minHeight: 42,
    maxHeight: 112,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 11 : 8,
    fontSize: 14.5,
    fontWeight: "600",
  },

  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.1 : 0,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  emptyChat: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 86,
    paddingHorizontal: 28,
  },

  emptyBubble: {
    width: 96,
    height: 96,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    transform: [{ rotate: "-4deg" }],
  },

  emptyTitle: {
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.3,
  },

  emptyChatText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontWeight: "600",
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },

  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 15,
  },

  retryBtnText: {
    color: "#fff",
    fontWeight: "900",
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 28,
  },

  loadingTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4,
  },

  loadingText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  loadMoreBtn: {
    alignSelf: "center",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: "center",
  },

  loadMoreText: {
    fontSize: 12,
    fontWeight: "800",
  },

  sendErrorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  sendErrorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
});
