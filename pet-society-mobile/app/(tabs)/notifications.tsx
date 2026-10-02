import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Reanimated, {
  FadeInDown,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { usePets, type Notification } from "@/context/PetsContext";
import { resolveNotificationRoute } from "@/src/features/notifications/utils/notificationRoutes";

function safeHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "web") return;

  Haptics.impactAsync(style).catch(() => { });
}

function formatNotificationTime(iso?: string | null) {
  if (!iso) return "";

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "";

  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function notificationMeta(notification: Notification) {
  const type = notification.type ?? "";

  if (type.includes("match")) {
    return {
      emoji: "💘",
      icon: "heart" as const,
      label: "New Match",
      tint: "#ff6b6b",
    };
  }

  if (type.includes("adoption")) {
    return {
      emoji: "🏠",
      icon: "home" as const,
      label: "Adoption",
      tint: "#ff6b6b",
    };
  }

  if (type.includes("swipe") || type.includes("like")) {
    return {
      emoji: "🐾",
      icon: "zap" as const,
      label: "Pet Activity",
      tint: "#6c63ff",
    };
  }

  if (type.includes("system")) {
    return {
      emoji: "✨",
      icon: "bell" as const,
      label: "System",
      tint: "#00b894",
    };
  }

  return {
    emoji: "🔔",
    icon: "bell" as const,
    label: "Notification",
    tint: "#fd79a8",
  };
}

function NotificationItem({
  notification,
  onRead,
  index,
  disabled,
}: {
  notification: Notification;
  onRead: () => void;
  index: number;
  disabled?: boolean;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);

  const meta = notificationMeta(notification);
  const isUnread = !notification.is_read && !notification.read_at;
  const body =
    notification.message ??
    (notification as any).body ??
    (notification.data as any)?.body ??
    "";

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    if (disabled) return;

    scale.value = withSequence(
      withTiming(0.965, { duration: 80 }),
      withSpring(1, { damping: 12 }),
    );

    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
    onRead();
  }

  return (
    <Reanimated.View
      entering={SlideInRight.delay(index * 65).springify().damping(18)}
    >
      <Reanimated.View style={animStyle}>
        <TouchableOpacity
          onPress={handlePress}
          disabled={disabled}
          activeOpacity={0.86}
          style={[
            styles.notifCard,
            {
              backgroundColor: colors.card,
              borderColor: isUnread ? meta.tint + "55" : colors.border,
              opacity: disabled ? 0.65 : 1,
            },
          ]}
        >
          {isUnread ? (
            <LinearGradient
              colors={[meta.tint + "18", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.unreadGlow}
            />
          ) : null}

          <View
            style={[
              styles.notifIcon,
              {
                backgroundColor: isUnread ? meta.tint + "18" : colors.secondary,
                borderColor: isUnread ? meta.tint + "35" : colors.border,
              },
            ]}
          >
            <Text style={styles.notifEmoji}>{meta.emoji}</Text>
          </View>

          <View style={styles.notifContent}>
            <View style={styles.notifTopRow}>
              <View
                style={[
                  styles.typePill,
                  {
                    backgroundColor: meta.tint + "15",
                  },
                ]}
              >
                <Feather name={meta.icon} size={11} color={meta.tint} />
                <Text style={[styles.typePillText, { color: meta.tint }]}>
                  {meta.label}
                </Text>
              </View>

              <Text
                style={[styles.notifTime, { color: colors.mutedForeground }]}
              >
                {formatNotificationTime(notification.created_at)}
              </Text>
            </View>

            <Text
              style={[
                styles.notifTitle,
                {
                  color: colors.foreground,
                  fontWeight: isUnread ? "900" : "800",
                },
              ]}
              numberOfLines={2}
            >
              {notification.title}
            </Text>

            <Text
              style={[styles.notifMessage, { color: colors.mutedForeground }]}
              numberOfLines={3}
            >
              {body}
            </Text>

            {notification.data?.matched_pet_name ? (
              <View
                style={[
                  styles.matchMiniCard,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={styles.matchMiniEmoji}>🐾</Text>

                <Text
                  style={[
                    styles.matchMiniText,
                    { color: colors.mutedForeground },
                  ]}
                  numberOfLines={1}
                >
                  {notification.data.my_pet_name ?? "Your pet"} matched with{" "}
                  {notification.data.matched_pet_name}
                </Text>
              </View>
            ) : null}
          </View>

          {isUnread ? (
            <View style={[styles.unreadDot, { backgroundColor: meta.tint }]} />
          ) : (
            <View
              style={[
                styles.readCheck,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="check" size={12} color={colors.mutedForeground} />
            </View>
          )}
        </TouchableOpacity>
      </Reanimated.View>
    </Reanimated.View>
  );
}

function HeaderStats({
  unreadCount,
  total,
}: {
  unreadCount: number;
  total: number;
}) {
  const colors = useColors();

  return (
    <View style={styles.statsRow}>
      <View
        style={[
          styles.statPill,
          {
            backgroundColor: colors.primary + "14",
            borderColor: colors.primary + "28",
          },
        ]}
      >
        <Text style={styles.statEmoji}>🔔</Text>
        <Text style={[styles.statText, { color: colors.primary }]}>
          {total} total
        </Text>
      </View>

      <View
        style={[
          styles.statPill,
          {
            backgroundColor: unreadCount > 0 ? "#ff6b6b18" : "#00b89418",
            borderColor: unreadCount > 0 ? "#ff6b6b35" : "#00b89435",
          },
        ]}
      >
        <Text style={styles.statEmoji}>{unreadCount > 0 ? "🔥" : "✅"}</Text>
        <Text
          style={[
            styles.statText,
            { color: unreadCount > 0 ? "#ff6b6b" : "#00b894" },
          ]}
        >
          {unreadCount} unread
        </Text>
      </View>
    </View>
  );
}

function EmptyState() {
  const colors = useColors();

  return (
    <View style={styles.empty}>
      <View
        style={[
          styles.emptyCircle,
          {
            backgroundColor: colors.primary + "14",
            borderColor: colors.primary + "25",
          },
        ]}
      >
        <Text style={styles.emptyEmoji}>🔕</Text>
        <Text style={styles.emptyMiniPaw}>🐾</Text>
      </View>

      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        No alerts yet
      </Text>

      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        New matches and updates will appear here.
      </Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const {
    notifications,
    fetchNotifications,
    markNotificationRead,
    markAllRead,
    unreadCount,
    isLoading,
  } = usePets();

  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingIds, setMarkingIds] = useState<Set<string>>(() => new Set());

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const aTime = new Date(a.created_at ?? 0).getTime();
      const bTime = new Date(b.created_at ?? 0).getTime();

      return bTime - aTime;
    });
  }, [notifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await fetchNotifications();
    } finally {
      setRefreshing(false);
    }
  }, [fetchNotifications]);

  async function handleMarkAllRead() {
    if (markingAll) return;

    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
    setMarkingAll(true);

    try {
      await markAllRead();
    } finally {
      setMarkingAll(false);
    }
  }

  const showLoading = isLoading && notifications.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.decorLayer} pointerEvents="none">
        <View
          style={[
            styles.decorBlobOne,
            { backgroundColor: colors.primary + "12" },
          ]}
        />

        <View
          style={[
            styles.decorBlobTwo,
            { backgroundColor: colors.match + "12" },
          ]}
        />

        <Text style={[styles.decorPawOne, { color: colors.primary + "18" }]}>
          🐾
        </Text>

        <Text style={[styles.decorBell, { color: colors.match + "18" }]}>
          🔔
        </Text>
      </View>

      <Reanimated.View
        entering={FadeInDown.springify().damping(20)}
        style={[styles.header, { paddingTop: topPad + 10 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              PET ALERTS
            </Text>

            <Text style={[styles.title, { color: colors.foreground }]}>
              Notifications
            </Text>

            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {unreadCount > 0
                ? `${unreadCount} fresh update${unreadCount !== 1 ? "s" : ""}`
                : "No unread updates. Very peaceful."}
            </Text>
          </View>

          {unreadCount > 0 ? (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              disabled={markingAll}
              style={[
                styles.markAllBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: markingAll ? 0.6 : 1,
                },
              ]}
              activeOpacity={0.84}
            >
              {markingAll ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="check-circle" size={16} color={colors.primary} />
              )}

              <Text style={[styles.markAllText, { color: colors.primary }]}>
                {markingAll ? "Please wait..." : "Read all"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.headerIconBox,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="bell" size={20} color={colors.primary} />
            </View>
          )}
        </View>

        <HeaderStats unreadCount={unreadCount} total={notifications.length} />
      </Reanimated.View>

      {showLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text style={[styles.loadingTitle, { color: colors.foreground }]}>
            Loading pet alerts...
          </Text>

          <Text style={[styles.loadingSub, { color: colors.mutedForeground }]}>
            Checking if someone matched your little legend
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedNotifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomPad + 110 },
            sortedNotifications.length === 0 ? styles.emptyList : null,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item, index }) => (
            <NotificationItem
              notification={item}
              index={index}
              disabled={markingIds.has(String(item.id))}
              onRead={async () => {
                if (!item.is_read && !item.read_at) {
                  const id = String(item.id);

                  setMarkingIds((prev) => new Set(prev).add(id));

                  try {
                    await markNotificationRead(id);
                  } finally {
                    setMarkingIds((prev) => {
                      const next = new Set(prev);
                      next.delete(id);
                      return next;
                    });
                  }
                }

                router.push(resolveNotificationRoute(item) as any);
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  decorLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  decorBlobOne: {
    position: "absolute",
    top: 140,
    left: -90,
    width: 230,
    height: 230,
    borderRadius: 115,
  },
  decorBlobTwo: {
    position: "absolute",
    bottom: 190,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  decorPawOne: {
    position: "absolute",
    top: 290,
    right: 26,
    fontSize: 34,
    transform: [{ rotate: "18deg" }],
  },
  decorBell: {
    position: "absolute",
    bottom: 310,
    left: 24,
    fontSize: 30,
    transform: [{ rotate: "-13deg" }],
  },

  header: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    gap: 14,
    zIndex: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontSize: 33,
    fontWeight: "900",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: "900",
  },
  headerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  statEmoji: {
    fontSize: 13,
  },
  statText: {
    fontSize: 12,
    fontWeight: "900",
  },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
  },
  loadingSub: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },

  list: {
    paddingHorizontal: 20,
    gap: 12,
    paddingTop: 4,
  },
  emptyList: {
    flexGrow: 1,
  },

  notifCard: {
    flexDirection: "row",
    gap: 13,
    padding: 15,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "flex-start",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0,
    shadowRadius: 10,
    elevation: 2,
  },
  unreadGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  notifIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  notifEmoji: {
    fontSize: 22,
  },
  notifContent: {
    flex: 1,
    gap: 5,
  },
  notifTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: "900",
  },
  notifTitle: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  notifMessage: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  notifTime: {
    fontSize: 11,
    fontWeight: "800",
  },
  matchMiniCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 3,
  },
  matchMiniEmoji: {
    fontSize: 14,
  },
  matchMiniText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginTop: 5,
  },
  readCheck: {
    width: 22,
    height: 22,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginTop: 1,
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
    gap: 14,
    paddingTop: 70,
  },
  emptyCircle: {
    width: 116,
    height: 116,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 6,
    transform: [{ rotate: "-4deg" }],
  },
  emptyEmoji: {
    fontSize: 52,
  },
  emptyMiniPaw: {
    position: "absolute",
    right: 18,
    bottom: 15,
    fontSize: 22,
    transform: [{ rotate: "18deg" }],
  },
  emptyTitle: {
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
