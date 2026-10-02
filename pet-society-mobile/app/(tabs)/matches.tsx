import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { usePets, type Match, type Pet } from "@/context/PetsContext";
import { ImageFallback } from "@/components/ImageFallback";
import { PetDocumentBadges } from "@/components/pets/PetDocumentBadges";
import { PetVerifiedBadge } from "@/components/pets/PetVerifiedBadge";
import { ReportSheet } from "@/components/reports/ReportSheet";
import { useAuth } from "@/context/AuthContext";
import {
  blockUser,
  getSafetyErrorMessage,
  unmatch,
} from "@/services/safetyApi";
import {
  markAdoptionConversationRead,
} from "@/services/adoptionApi";
import type { AdoptionConversation } from "@/types/adoption";
import {
  messagePreviewText,
  normalizeMessageAttachments,
  type MessageAttachment,
} from "@/services/chat/messageAttachments";
import { petName as adoptionPetName } from "@/utils/adoption";
import {
  resolvePetBreed,
  resolvePetImage,
  resolvePetName,
  resolvePetType,
} from "@/utils/pet";

type MatchWithConversation = Match & {
  conversation_id?: string | number | null;
  last_message?: {
    id: string | number;
    conversation_id?: string | number;
    sender_id?: string | number;
    type?: string;
    body?: string | null;
    metadata?: Record<string, unknown> | null;
    attachment?: MessageAttachment | null;
    attachments?: MessageAttachment[];
    created_at?: string | null;
    updated_at?: string | null;
  } | null;
  unread_count?: number;
};

type MatchPetLike = Partial<Pet> & {
  pet_name?: string;
  pet_type?: string;
  images?: Array<{
    url?: string | null;
    image_path?: string | null;
  }>;
};

function safeHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "web") return;

  Haptics.impactAsync(style).catch(() => { });
}

function timeAgo(iso?: string | null) {
  if (!iso) return "";

  const timestamp = new Date(iso).getTime();

  if (Number.isNaN(timestamp)) return "";

  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days}d ago`;

  return `${Math.floor(days / 7)}w ago`;
}

function getPetId(pet?: MatchPetLike | null) {
  if (pet?.id == null || pet.id === "") return null;

  return String(pet.id);
}

function getMyPet(match: Match): MatchPetLike | null {
  return (match.my_pet ?? match.pet_one ?? null) as MatchPetLike | null;
}

function getMatchedPet(match: Match): MatchPetLike | null {
  return (match.matched_pet ?? match.pet_two ?? match.pet_one ?? null) as
    | MatchPetLike
    | null;
}

function getPair(match: Match) {
  const myPet = getMyPet(match);
  const matchedPet = getMatchedPet(match);

  return {
    myPetName: resolvePetName(myPet),
    matchedPetName: resolvePetName(matchedPet),
    myPetImage: resolvePetImage(myPet),
    matchedPetImage: resolvePetImage(matchedPet),
    matchedPetType: resolvePetType(matchedPet),
    matchedPetBreed: resolvePetBreed(matchedPet),
  };
}

function getLastMessage(match: MatchWithConversation) {
  const lastMessage = match.last_message;

  if (!lastMessage) return null;

  return {
    text: messagePreviewText({
      body: lastMessage.body,
      type: lastMessage.type,
      attachments: normalizeMessageAttachments(lastMessage),
    }),
    timestamp: lastMessage.created_at ?? null,
  };
}

function openChat(
  match: MatchWithConversation,
  onReadConversation?: (conversationId: string | number) => void,
) {
  const conversationId = match.conversation_id;

  if (!conversationId) {
    return;
  }

  onReadConversation?.(conversationId);

  router.push({
    pathname: "/chat/[matchId]",
    params: {
      matchId: String(match.id),
      conversationId: String(conversationId),
    },
  });
}

function openPetDetails(match: MatchWithConversation, pet?: MatchPetLike | null) {
  const petId = getPetId(pet);

  if (!petId) return;

  router.push({
    pathname: "/pets/[petId]" as any,
    params: {
      petId,
      source: "match",
      matchId: String(match.id),
      conversationId: match.conversation_id
        ? String(match.conversation_id)
        : "",
    },
  });
}

function AvatarPair({
  firstImage,
  secondImage,
}: {
  firstImage: string | null;
  secondImage: string | null;
}) {
  const colors = useColors();
  const matchColor = colors.match ?? "#ec4899";

  return (
    <View style={styles.avatarPair}>
      <View
        style={[
          styles.avatar,
          styles.avatarBack,
          {
            backgroundColor: colors.muted,
            borderColor: colors.card,
          },
        ]}
      >
        <ImageFallback
          uri={secondImage}
          containerStyle={styles.avatarImage}
          fallback={<Text style={styles.avatarEmoji}>🐾</Text>}
          accessibilityLabel="Matched pet photo"
        />
      </View>

      <View
        style={[
          styles.avatar,
          styles.avatarFront,
          {
            backgroundColor: colors.muted,
            borderColor: colors.card,
          },
        ]}
      >
        <ImageFallback
          uri={firstImage}
          containerStyle={styles.avatarImage}
          fallback={<Text style={styles.avatarEmoji}>🐾</Text>}
          accessibilityLabel="Your pet photo"
        />
      </View>

      <View
        style={[
          styles.heartMini,
          {
            backgroundColor: matchColor,
            borderColor: colors.card,
          },
        ]}
      >
        <Text style={styles.heartMiniText}>♥</Text>
      </View>
    </View>
  );
}

function ChatRow({
  match,
  index,
  onReadConversation,
  onSafetyPress,
}: {
  match: MatchWithConversation;
  index: number;
  onReadConversation: (conversationId: string | number) => void;
  onSafetyPress: (match: MatchWithConversation) => void;
}) {
  const colors = useColors();
  const matchColor = colors.match ?? "#ec4899";
  const matchedPet = getMatchedPet(match);
  const entry = React.useRef(new Animated.Value(0)).current;
  const badgeScale = React.useRef(new Animated.Value(1)).current;

  const {
    myPetName,
    matchedPetName,
    myPetImage,
    matchedPetImage,
    matchedPetType,
    matchedPetBreed,
  } = getPair(match);

  const lastMsg = getLastMessage(match);
  const unreadCount = Number(match.unread_count ?? 0);
  const hasUnread = unreadCount > 0;

  useEffect(() => {
    Animated.spring(entry, {
      toValue: 1,
      delay: Math.min(index * 45, 240),
      damping: 18,
      stiffness: 220,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [entry, index]);

  useEffect(() => {
    if (!hasUnread) return;

    badgeScale.setValue(0.78);
    Animated.spring(badgeScale, {
      toValue: 1,
      damping: 12,
      stiffness: 320,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [badgeScale, hasUnread, unreadCount]);

  const preview = lastMsg?.text
    ? lastMsg.text
    : `Matched with ${matchedPetType}${matchedPetBreed ? ` · ${matchedPetBreed}` : ""
    }`;

  const timestamp = timeAgo(lastMsg?.timestamp ?? match.matched_at);

  return (
    <Animated.View
      style={{
        opacity: entry,
        transform: [
          {
            translateY: entry.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => {
        safeHaptic(Haptics.ImpactFeedbackStyle.Light);
        openChat(match, onReadConversation);
      }}
      style={[
        styles.chatRow,
        {
          backgroundColor: colors.card,
          borderColor: hasUnread ? matchColor + "80" : colors.border,
        },
      ]}
    >
      <TouchableOpacity
        onPress={(event) => {
          event.stopPropagation();
          safeHaptic(Haptics.ImpactFeedbackStyle.Light);
          openPetDetails(match, matchedPet);
        }}
        activeOpacity={0.84}
        accessibilityRole="button"
        accessibilityLabel="View pet profile"
      >
        <AvatarPair firstImage={myPetImage} secondImage={matchedPetImage} />
      </TouchableOpacity>

      <View style={styles.chatMain}>
        <View style={styles.chatTopLine}>
          <TouchableOpacity
            onPress={(event) => {
              event.stopPropagation();
              safeHaptic(Haptics.ImpactFeedbackStyle.Light);
              openPetDetails(match, matchedPet);
            }}
            activeOpacity={0.8}
            style={styles.chatTitlePress}
            accessibilityRole="button"
            accessibilityLabel="View pet profile"
          >
            <Text
              style={[
                styles.chatTitle,
                {
                  color: colors.foreground,
                },
              ]}
              numberOfLines={1}
            >
              {myPetName} & {matchedPetName}
            </Text>
            <PetVerifiedBadge pet={matchedPet} compact />
          </TouchableOpacity>

          {timestamp ? (
            <Text style={[styles.chatTime, { color: colors.mutedForeground }]}>
              {timestamp}
            </Text>
          ) : null}
        </View>

        <View style={styles.chatMiddleLine}>
          <Text
            style={[
              styles.chatPreview,
              {
                color: hasUnread ? colors.foreground : colors.mutedForeground,
                fontWeight: hasUnread ? "800" : "600",
              },
            ]}
            numberOfLines={1}
          >
            {preview || "Say hi. The paws are waiting."}
          </Text>

          {hasUnread ? (
            <Animated.View
              style={[
                styles.unreadBadge,
                {
                  backgroundColor: matchColor,
                  transform: [{ scale: badgeScale }],
                },
              ]}
            >
              <Text style={styles.unreadText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.chatBottomLine}>
          <PetDocumentBadges pet={matchedPet} compact />

          <View
            style={[
              styles.statusChip,
              {
                backgroundColor: hasUnread
                  ? matchColor + "16"
                  : colors.secondary,
              },
            ]}
          >
            <Text
              style={[
                styles.statusChipText,
                {
                  color: hasUnread ? matchColor : colors.mutedForeground,
                },
              ]}
            >
              {hasUnread ? "New message" : "Tap to chat"}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        onPress={(event) => {
          event.stopPropagation();
          safeHaptic(Haptics.ImpactFeedbackStyle.Light);
          onSafetyPress(match);
        }}
        style={[styles.rowActionBtn, { backgroundColor: colors.secondary }]}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="Open safety actions"
      >
        <Feather name="more-horizontal" size={17} color={colors.foreground} />
      </TouchableOpacity>
    </TouchableOpacity>
    </Animated.View>
  );
}

function getAdoptionLastMessage(conversation: AdoptionConversation) {
  const lastMessage = conversation.last_message;

  if (!lastMessage) return null;

  return {
    text: messagePreviewText({
      body: lastMessage.body,
      type: lastMessage.type,
      attachments: normalizeMessageAttachments(lastMessage),
    }),
    timestamp: lastMessage.created_at ?? null,
  };
}

function AdoptionAvatar({ uri }: { uri: string | null }) {
  const colors = useColors();
  const adoptionColor = colors.primary;

  return (
    <View
      style={[
        styles.adoptionAvatar,
        {
          backgroundColor: colors.muted,
          borderColor: adoptionColor + "66",
        },
      ]}
    >
      <ImageFallback
        uri={uri}
        containerStyle={styles.adoptionAvatarImage}
        fallback={<Text style={styles.avatarEmoji}>🐾</Text>}
        accessibilityLabel="Adoption pet photo"
      />
    </View>
  );
}

function AdoptionChatRow({
  conversation,
  index,
  onReadConversation,
}: {
  conversation: AdoptionConversation;
  index: number;
  onReadConversation: (conversationId: string | number) => void;
}) {
  const colors = useColors();
  const adoptionColor = colors.primary;
  const entry = React.useRef(new Animated.Value(0)).current;
  const badgeScale = React.useRef(new Animated.Value(1)).current;
  const lastMessage = getAdoptionLastMessage(conversation);
  const unreadCount = Number(conversation.unread_count ?? 0);
  const hasUnread = unreadCount > 0;
  const pet = conversation.pet;
  const title = adoptionPetName(pet) || "Adoption chat";
  const otherName =
    conversation.applicant?.name ?? conversation.owner?.name ?? "Adoption chat";
  const timestamp = timeAgo(
    lastMessage?.timestamp ??
      conversation.last_message_at ??
      conversation.created_at,
  );
  const imageUri =
    typeof pet?.image_url === "string"
      ? pet.image_url
      : typeof pet?.image === "string"
        ? pet.image
        : null;

  useEffect(() => {
    Animated.spring(entry, {
      toValue: 1,
      delay: Math.min(index * 45, 240),
      damping: 18,
      stiffness: 220,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [entry, index]);

  useEffect(() => {
    if (!hasUnread) return;

    badgeScale.setValue(0.78);
    Animated.spring(badgeScale, {
      toValue: 1,
      damping: 12,
      stiffness: 320,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [badgeScale, hasUnread, unreadCount]);

  return (
    <Animated.View
      style={{
        opacity: entry,
        transform: [
          {
            translateY: entry.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => {
          safeHaptic(Haptics.ImpactFeedbackStyle.Light);
          onReadConversation(conversation.id);
          router.push({
            pathname: "/adoption-chat/[conversationId]",
            params: { conversationId: String(conversation.id) },
          });
        }}
        style={[
          styles.chatRow,
          {
            backgroundColor: colors.card,
            borderColor: hasUnread ? adoptionColor + "80" : colors.border,
          },
        ]}
      >
        <AdoptionAvatar uri={imageUri} />

        <View style={styles.chatMain}>
          <View style={styles.chatTopLine}>
            <Text
              style={[styles.chatTitle, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {title}
            </Text>

            {timestamp ? (
              <Text style={[styles.chatTime, { color: colors.mutedForeground }]}>
                {timestamp}
              </Text>
            ) : null}
          </View>

          <View style={styles.chatMiddleLine}>
            <Text
              style={[
                styles.chatPreview,
                {
                  color: hasUnread ? colors.foreground : colors.mutedForeground,
                  fontWeight: hasUnread ? "800" : "600",
                },
              ]}
              numberOfLines={1}
            >
              {lastMessage?.text || otherName}
            </Text>

            {hasUnread ? (
              <Animated.View
                style={[
                  styles.unreadBadge,
                  {
                    backgroundColor: adoptionColor,
                    transform: [{ scale: badgeScale }],
                  },
                ]}
              >
                <Text style={styles.unreadText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </Animated.View>
            ) : null}
          </View>

          <View style={styles.chatBottomLine}>
            <View
              style={[
                styles.statusChip,
                {
                  backgroundColor: hasUnread
                    ? adoptionColor + "16"
                    : colors.secondary,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  {
                    color: hasUnread ? adoptionColor : colors.mutedForeground,
                  },
                ]}
              >
                {hasUnread ? "New message" : "Adoption chat"}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function EmptyState() {
  const colors = useColors();

  return (
    <View style={styles.empty}>
      <View
        style={[
          styles.emptyIconWrap,
          {
            backgroundColor: colors.primary + "14",
            borderColor: colors.primary + "22",
          },
        ]}
      >
        <Text style={styles.emptyIcon}>🐾</Text>
      </View>

      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        No chats yet
      </Text>

      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        Matches and approved adoption conversations will show up here.
      </Text>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          safeHaptic(Haptics.ImpactFeedbackStyle.Light);
          router.push("/(tabs)/swipe");
        }}
        style={[styles.emptyButton, { backgroundColor: colors.primary }]}
      >
        <Feather name="shuffle" size={16} color="#fff" />
        <Text style={styles.emptyButtonText}>Start swiping</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MatchesScreen() {
  const colors = useColors();
  const matchColor = colors.match ?? "#ec4899";
  const { token } = useAuth();

  const insets = useSafeAreaInsets();

  const {
    matches,
    fetchMatches,
    isLoading,
    markConversationReadLocal,
    markAdoptionConversationReadLocal,
    removeMatchLocal,
    removeMatchesForUserLocal,
    adoptionConversations,
    fetchAdoptionConversations,
    refreshAppCounts,
  } = usePets();

  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [reportTarget, setReportTarget] = useState<{
    reportable_type: string;
    reportable_id: string | number;
    reported_user_id?: string | number | null;
  } | null>(null);
  const [safetyLoadingId, setSafetyLoadingId] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const typedMatches = matches as MatchWithConversation[];

  const sortedMatches = useMemo(() => {
    return [...typedMatches].sort((a, b) => {
      const aLast = a.last_message?.created_at ?? a.matched_at ?? "";
      const bLast = b.last_message?.created_at ?? b.matched_at ?? "";

      const aTime = new Date(aLast).getTime();
      const bTime = new Date(bLast).getTime();

      return (
        (Number.isNaN(bTime) ? 0 : bTime) -
        (Number.isNaN(aTime) ? 0 : aTime)
      );
    });
  }, [typedMatches]);

  const sortedAdoptionConversations = useMemo(() => {
    return [...adoptionConversations].sort((a, b) => {
      const aLast =
        a.last_message?.created_at ?? a.last_message_at ?? a.created_at ?? "";
      const bLast =
        b.last_message?.created_at ?? b.last_message_at ?? b.created_at ?? "";

      const aTime = new Date(aLast).getTime();
      const bTime = new Date(bLast).getTime();

      return (
        (Number.isNaN(bTime) ? 0 : bTime) -
        (Number.isNaN(aTime) ? 0 : aTime)
      );
    });
  }, [adoptionConversations]);

  const chatItems = useMemo(() => {
    return [
      ...sortedMatches.map((match) => ({
        kind: "match" as const,
        id: `match-${match.id}`,
        timestamp: match.last_message?.created_at ?? match.matched_at ?? "",
        match,
      })),
      ...sortedAdoptionConversations.map((conversation) => ({
        kind: "adoption" as const,
        id: `adoption-${conversation.id}`,
        timestamp:
          conversation.last_message?.created_at ??
          conversation.last_message_at ??
          conversation.created_at ??
          "",
        conversation,
      })),
    ].sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();

      return (
        (Number.isNaN(bTime) ? 0 : bTime) -
        (Number.isNaN(aTime) ? 0 : aTime)
      );
    });
  }, [sortedAdoptionConversations, sortedMatches]);

  const unreadTotal = chatItems.reduce((sum, item) => {
    return sum + Number(
      item.kind === "match"
        ? item.match.unread_count ?? 0
        : item.conversation.unread_count ?? 0,
    );
  }, 0);

  const fetchAdoptionChats = useCallback(async () => {
    await fetchAdoptionConversations();
  }, [fetchAdoptionConversations]);

  const loadMatches = useCallback(async () => {
    try {
      await Promise.all([fetchMatches(), fetchAdoptionChats(), refreshAppCounts()]);
    } finally {
      setInitialLoading(false);
    }
  }, [fetchAdoptionChats, fetchMatches, refreshAppCounts]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await Promise.all([fetchMatches(), fetchAdoptionChats(), refreshAppCounts()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchAdoptionChats, fetchMatches, refreshAppCounts]);

  const handleOpenChat = useCallback(
    (conversationId: string | number) => {
      markConversationReadLocal(conversationId);
    },
    [markConversationReadLocal],
  );

  const handleOpenAdoptionChat = useCallback(
    (conversationId: string | number) => {
      markAdoptionConversationReadLocal(conversationId);

      if (token) {
        markAdoptionConversationRead(token, conversationId).catch(() => {});
      }
    },
    [markAdoptionConversationReadLocal, token],
  );

  const handleSafetyPress = useCallback(
    (match: MatchWithConversation) => {
      const matchedPet = getMatchedPet(match);
      const matchedUserId = matchedPet?.user_id ?? null;

      const actions = [
        {
          text: "Report Match",
          onPress: () =>
            setReportTarget({
              reportable_type: "conversation",
              reportable_id: match.conversation_id ?? match.id,
              reported_user_id: matchedUserId,
            }),
        },
        matchedUserId != null
          ? {
            text: "Block User",
            style: "destructive" as const,
            onPress: () => {
              if (!token || safetyLoadingId) return;

              Alert.alert(
                "Block this user?",
                "They will no longer be able to contact you.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Block",
                    style: "destructive",
                    onPress: async () => {
                      setSafetyLoadingId(String(match.id));

                      try {
                        await blockUser(token, matchedUserId);
                        removeMatchesForUserLocal(matchedUserId);
                        Alert.alert("User blocked.");
                      } catch (error) {
                        Alert.alert("Could not block user", getSafetyErrorMessage(error));
                      } finally {
                        setSafetyLoadingId(null);
                      }
                    },
                  },
                ],
              );
            },
          }
          : null,
        {
          text: "Unmatch",
          style: "destructive" as const,
          onPress: () => {
            if (!token || safetyLoadingId) return;

            Alert.alert(
              "Are you sure you want to unmatch?",
              "You will no longer be able to chat with this match.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Unmatch",
                  style: "destructive",
                  onPress: async () => {
                    setSafetyLoadingId(String(match.id));

                    try {
                      await unmatch(token, match.id);
                      removeMatchLocal(match.id);
                      Alert.alert("Unmatched successfully.");
                    } catch (error) {
                      Alert.alert("Could not unmatch", getSafetyErrorMessage(error));
                    } finally {
                      setSafetyLoadingId(null);
                    }
                  },
                },
              ],
            );
          },
        },
        { text: "Cancel", style: "cancel" as const },
      ].filter(Boolean) as Array<{
        text: string;
        style?: "default" | "cancel" | "destructive";
        onPress?: () => void;
      }>;

      Alert.alert("Safety Options", "Choose an action for this match.", actions);
    },
    [
      removeMatchLocal,
      removeMatchesForUserLocal,
      safetyLoadingId,
      token,
    ],
  );

  const showInitialLoader = initialLoading && chatItems.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.decorLayer} pointerEvents="none">
        <View
          style={[
            styles.decorBlobOne,
            {
              backgroundColor: colors.primary + "10",
            },
          ]}
        />
        <View
          style={[
            styles.decorBlobTwo,
            {
              backgroundColor: matchColor + "12",
            },
          ]}
        />
        <Text style={[styles.decorPawOne, { color: colors.primary + "12" }]}>
          🐾
        </Text>
      </View>

      <View style={[styles.header, { paddingTop: topPad + 14 }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextBlock}>
            <Text style={[styles.eyebrow, { color: matchColor }]}>
              ALEEFNA
            </Text>

            <Text style={[styles.title, { color: colors.foreground }]}>
              Chats
            </Text>

            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Live messages. No refresh needed.
            </Text>
          </View>

          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            activeOpacity={0.82}
            style={[
              styles.refreshButton,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: refreshing ? 0.6 : 1,
              },
            ]}
          >
            <Feather name="refresh-cw" size={17} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCardRow}>
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={styles.summaryEmoji}>💘</Text>
            <View>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                {chatItems.length}
              </Text>
              <Text
                style={[
                  styles.summaryLabel,
                  { color: colors.mutedForeground },
                ]}
              >
                chats
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.card,
                borderColor:
                  unreadTotal > 0 ? matchColor + "70" : colors.border,
              },
            ]}
          >
            <Text style={styles.summaryEmoji}>💬</Text>
            <View>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                {unreadTotal}
              </Text>
              <Text
                style={[
                  styles.summaryLabel,
                  {
                    color:
                      unreadTotal > 0 ? matchColor : colors.mutedForeground,
                  },
                ]}
              >
                unread
              </Text>
            </View>
          </View>
        </View>
      </View>

      {showInitialLoader ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text style={[styles.loaderTitle, { color: colors.foreground }]}>
            Loading chats...
          </Text>

          <Text style={[styles.loaderText, { color: colors.mutedForeground }]}>
            Counting paws. Negotiating treats.
          </Text>
        </View>
      ) : (
        <FlatList
          data={chatItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomPad + 110 },
            chatItems.length === 0 ? styles.emptyList : null,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            chatItems.length > 0 ? (
              <View style={styles.listHeader}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Recent conversations
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={!isLoading ? <EmptyState /> : null}
          renderItem={({ item, index }) =>
            item.kind === "match" ? (
              <ChatRow
                match={item.match}
                index={index}
                onReadConversation={handleOpenChat}
                onSafetyPress={handleSafetyPress}
              />
            ) : (
              <AdoptionChatRow
                conversation={item.conversation}
                index={index}
                onReadConversation={handleOpenAdoptionChat}
              />
            )
          }
        />
      )}

      <ReportSheet
        visible={reportTarget != null}
        title="Report Match"
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmitted={() => Alert.alert("Report submitted. Our team will review it.")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  decorLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },

  decorBlobOne: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: 95,
    left: -130,
  },

  decorBlobTwo: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -155,
    bottom: 150,
  },

  decorPawOne: {
    position: "absolute",
    top: 235,
    right: 26,
    fontSize: 42,
    transform: [{ rotate: "16deg" }],
  },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  headerTextBlock: {
    flex: 1,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 4,
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },

  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryCardRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },

  summaryCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.04 : 0,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },

  summaryEmoji: {
    fontSize: 25,
  },

  summaryValue: {
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.4,
  },

  summaryLabel: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: "800",
  },

  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },

  loaderTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "900",
  },

  loaderText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  list: {
    paddingHorizontal: 16,
    gap: 10,
  },

  emptyList: {
    flexGrow: 1,
  },

  listHeader: {
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 4,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },

  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },

  avatarPair: {
    width: 66,
    height: 56,
    position: "relative",
    flexShrink: 0,
  },

  avatar: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarFront: {
    left: 0,
    top: 0,
    zIndex: 2,
  },

  avatarBack: {
    right: 0,
    bottom: 0,
    zIndex: 1,
  },

  avatarImage: {
    width: "100%",
    height: "100%",
  },

  avatarEmoji: {
    fontSize: 21,
  },

  adoptionAvatar: {
    width: 56,
    height: 56,
    borderRadius: 22,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  adoptionAvatarImage: {
    width: "100%",
    height: "100%",
  },

  heartMini: {
    position: "absolute",
    left: 24,
    bottom: 1,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },

  heartMiniText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    marginTop: -1,
  },

  chatMain: {
    flex: 1,
    minWidth: 0,
  },

  chatTopLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  chatTitlePress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  chatTitle: {
    flexShrink: 1,
    fontSize: 15.5,
    fontWeight: "900",
    letterSpacing: -0.25,
  },

  chatTime: {
    fontSize: 11,
    fontWeight: "800",
  },

  chatMiddleLine: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  chatPreview: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
  },

  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  unreadText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  rowActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  chatBottomLine: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },

  statusChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },

  statusChipText: {
    fontSize: 11,
    fontWeight: "800",
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
    gap: 13,
  },

  emptyIconWrap: {
    width: 104,
    height: 104,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    transform: [{ rotate: "-4deg" }],
  },

  emptyIcon: {
    fontSize: 48,
  },

  emptyTitle: {
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.4,
    textAlign: "center",
  },

  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
  },

  emptyButton: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 17,
  },

  emptyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
});
