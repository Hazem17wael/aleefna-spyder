import { useFocusEffect } from "expo-router";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  RefreshControl,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { usePets } from "@/context/PetsContext";

function safeHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "web") return;

  Haptics.impactAsync(style).catch(() => { });
}

function formatMemberYear(createdAt?: string | null) {
  if (!createdAt) return new Date().getFullYear();

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return new Date().getFullYear();
  }

  return date.getFullYear();
}

function getProfileScore(user: any) {
  let score = 35;

  if (user?.name) score += 20;
  if (user?.email) score += 20;
  if (user?.phone) score += 15;
  if (user?.email_verified_at) score += 10;

  return Math.min(score, 100);
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { user, logout, refreshUser } = useAuth();
  const { myPets, matches } = usePets();

  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 124 : insets.bottom + 148;

  const initials = (user?.name ?? "P")
    .split(" ")
    .filter(Boolean)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const memberYear = formatMemberYear(user?.created_at);
  const profileScore = useMemo(() => getProfileScore(user), [user]);

  const verified = Boolean(user?.email_verified_at);

  useEffect(() => {
    if (!initialLoading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [fadeAnim, initialLoading, slideAnim]);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        setInitialLoading(true);
        await refreshUser();
        setInitialLoading(false);
      };

      loadData();
    }, [refreshUser]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser]);

  async function handleLogout() {
    if (logoutLoading) return;

    Alert.alert("Log Out", "Are you sure you want to leave Aleefna?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          if (logoutLoading) return;

          safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
          setLogoutLoading(true);

          try {
            await logout();
            router.replace("/login");
          } finally {
            setLogoutLoading(false);
          }
        },
      },
    ]);
  }

  if (initialLoading) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        <SkeletonLoader colors={colors} topPad={topPad} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.card}
        />
      }
    >
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

        <Text style={[styles.decorSparkle, { color: colors.match + "18" }]}>
          ✨
        </Text>
      </View>

      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: topPad + 24 }]}
        >
          <View style={styles.heroDecorLayer} pointerEvents="none">
            <View style={styles.heroCircleOne} />
            <View style={styles.heroCircleTwo} />
            <Text style={styles.heroPaw}>🐾</Text>
            <Text style={styles.heroHeart}>♥</Text>
          </View>

          <View style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>

            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>🐾</Text>
            </View>
          </View>

          <Text style={styles.heroName} numberOfLines={1}>
            {user?.name ?? "Friend"}
          </Text>

          <Text style={styles.heroEmail} numberOfLines={1}>
            {user?.email ?? ""}
          </Text>

          {verified ? (
            <View style={styles.verifiedPill}>
              <Feather name="check-circle" size={13} color="#fff" />
              <Text style={styles.verifiedText}>Verified human</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                safeHaptic(Haptics.ImpactFeedbackStyle.Light);
                router.push("/verify-otp");
              }}
              style={styles.verifyPill}
              activeOpacity={0.84}
            >
              <Feather name="mail" size={13} color="#fff" />
              <Text style={styles.verifiedText}>Verify Email</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 42 }} />
        </LinearGradient>

        <View style={styles.statsWrap}>
          <View
            style={[
              styles.statsCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <StatPill value={myPets.length} label="Pets" color={colors.primary} emoji="🐶" />

            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

            <StatPill value={matches.length} label="Matches" color={colors.match} emoji="💘" />

            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

            <StatPill value={memberYear} label="Joined" color={colors.accent} emoji="✨" />
          </View>
        </View>

        <View style={styles.section}>
          <View
            style={[
              styles.profileScoreCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.scoreIcon,
                {
                  backgroundColor: colors.primary + "16",
                },
              ]}
            >
              <Text style={styles.scoreEmoji}>⭐</Text>
            </View>

            <View style={styles.scoreCopy}>
              <Text style={[styles.scoreTitle, { color: colors.foreground }]}>
                Profile power
              </Text>

              <Text
                style={[styles.scoreSubtitle, { color: colors.mutedForeground }]}
              >
                {profileScore >= 80
                  ? "Looking sharp. Pets are impressed."
                  : "Add more info to polish your profile."}
              </Text>

              <View
                style={[
                  styles.scoreTrack,
                  {
                    backgroundColor: colors.secondary,
                  },
                ]}
              >
                <View
                  style={[
                    styles.scoreFill,
                    {
                      width: `${profileScore}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>
            </View>

            <Text style={[styles.scoreValue, { color: colors.primary }]}>
              {profileScore}%
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Personal Info
              </Text>

              <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                Your account details
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                safeHaptic(Haptics.ImpactFeedbackStyle.Light);
                router.push("/profile/edit" as any);
              }}
              style={[
                styles.iconBtn,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                },
              ]}
              activeOpacity={0.82}
            >
              <Feather name="edit-2" size={15} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <InfoRow
              icon="user"
              iconColor="#6c63ff"
              label="Name"
              value={user?.name ?? "-"}
              colors={colors}
              last={false}
            />

            <InfoRow
              icon="mail"
              iconColor={colors.primary}
              label="Email"
              value={user?.email ?? "-"}
              colors={colors}
              last={false}
            />

            <InfoRow
              icon="phone"
              iconColor="#00b894"
              label="Phone (optional)"
              value={user?.phone ?? "Not set"}
              colors={colors}
              last
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Quick Links
              </Text>

              <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                Jump around Aleefna
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <MenuRow
              icon="star"
              iconColor={colors.primary}
              label="My Pets"
              sublabel={`${myPets.length} pet${myPets.length !== 1 ? "s" : ""
                } registered`}
              onPress={() => router.push("/(tabs)/my-pets")}
              colors={colors}
              last={false}
            />

            <MenuRow
              icon="zap"
              iconColor={colors.match}
              label="Matches"
              sublabel={`${matches.length} active match${matches.length !== 1 ? "es" : ""
                }`}
              onPress={() => router.push("/(tabs)/matches")}
              colors={colors}
              last={false}
            />

            <MenuRow
              icon="bell"
              iconColor={colors.accent}
              label="Notifications"
              sublabel="New pet alerts and updates"
              onPress={() => router.push("/(tabs)/notifications")}
              colors={colors}
              last={false}
            />

            <MenuRow
              icon="home"
              iconColor={colors.primary}
              label="My Adoption Listings"
              sublabel="Manage pets you listed for adoption"
              onPress={() => router.push("/my-adoption-listings")}
              colors={colors}
              last={false}
            />

            <MenuRow
              icon="file-text"
              iconColor={colors.dislike}
              label="My Applications"
              sublabel="Track adoption applications"
              onPress={() => router.push("/my-adoption-applications")}
              colors={colors}
              last
            />
          </View>
        </View>

        <View style={[styles.section, { marginBottom: 0 }]}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <MenuRow
              icon="trash-2"
              iconColor={colors.destructive}
              label="Delete Account"
              onPress={() => router.push("/account/delete" as any)}
              colors={colors}
              danger
              sublabel="Permanently remove your Aleefna account"
              last={false}
            />

            <MenuRow
              icon="log-out"
              iconColor={colors.destructive}
              label="Log Out"
              onPress={handleLogout}
              colors={colors}
              danger
              disabled={logoutLoading}
              sublabel={logoutLoading ? "Signing out..." : "Sign out of your account"}
              last
            />
          </View>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

function StatPill({
  value,
  label,
  color,
  emoji,
}: {
  value: number;
  label: string;
  color: string;
  emoji: string;
}) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  iconColor,
  label,
  value,
  colors,
  last,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  label: string;
  value: string;
  colors: any;
  last: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        !last && {
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={[styles.iconBubble, { backgroundColor: iconColor + "18" }]}>
        <Feather name={icon} size={15} color={iconColor} />
      </View>

      <View style={styles.infoCopy}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>

        <Text
          style={[styles.infoValue, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function MenuRow({
  icon,
  iconColor,
  label,
  sublabel,
  onPress,
  colors,
  danger = false,
  disabled = false,
  last,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  colors: any;
  danger?: boolean;
  disabled?: boolean;
  last: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const chevronX = useRef(new Animated.Value(0)).current;

  function animatePress(active: boolean) {
    if (disabled) return;

    Animated.parallel([
      Animated.spring(scale, {
        toValue: active ? 0.99 : 1,
        damping: 18,
        stiffness: 260,
        mass: 0.65,
        useNativeDriver: true,
      }),
      Animated.spring(chevronX, {
        toValue: active ? 2 : 0,
        damping: 18,
        stiffness: 260,
        mass: 0.65,
        useNativeDriver: true,
      }),
    ]).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
    <TouchableOpacity
      onPress={() => {
        if (disabled) return;
        safeHaptic(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={disabled}
      onPressIn={() => animatePress(true)}
      onPressOut={() => animatePress(false)}
      activeOpacity={0.78}
      style={[
        styles.menuRow,
        disabled ? { opacity: 0.55 } : null,
        !last && {
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={[styles.iconBubble, { backgroundColor: iconColor + "18" }]}>
        <Feather name={icon} size={16} color={iconColor} />
      </View>

      <View style={styles.menuText}>
        <Text
          style={[
            styles.menuLabel,
            { color: danger ? colors.destructive : colors.foreground },
          ]}
        >
          {label}
        </Text>

        {sublabel ? (
          <Text style={[styles.menuSublabel, { color: colors.mutedForeground }]}>
            {sublabel}
          </Text>
        ) : null}
      </View>

      <Animated.View style={{ transform: [{ translateX: chevronX }] }}>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </Animated.View>
    </TouchableOpacity>
    </Animated.View>
  );
}

function SkeletonLoader({ colors, topPad }: { colors: any; topPad: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.7],
  });

  return (
    <>
      <View
        style={[
          styles.hero,
          {
            paddingTop: topPad + 24,
            backgroundColor: colors.muted,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.avatarRing,
            {
              opacity,
              backgroundColor: colors.border,
            },
          ]}
        />

        <Animated.View
          style={{
            width: 130,
            height: 22,
            borderRadius: 8,
            backgroundColor: colors.border,
            opacity,
            marginTop: 60,
          }}
        />

        <Animated.View
          style={{
            width: 180,
            height: 14,
            borderRadius: 8,
            backgroundColor: colors.border,
            opacity,
            marginTop: 8,
          }}
        />

        <View style={{ height: 42 }} />
      </View>

      <View style={styles.statsWrap}>
        <Animated.View
          style={[
            styles.statsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity,
            },
          ]}
        />
      </View>

      {[1, 2].map((i) => (
        <View key={i} style={styles.section}>
          <Animated.View
            style={{
              width: 120,
              height: 18,
              borderRadius: 8,
              backgroundColor: colors.muted,
              opacity,
              marginBottom: 12,
            }}
          />

          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                height: 140,
                opacity,
              },
            ]}
          />
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  decorLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  decorBlobOne: {
    position: "absolute",
    top: 150,
    left: -90,
    width: 230,
    height: 230,
    borderRadius: 115,
  },
  decorBlobTwo: {
    position: "absolute",
    right: -100,
    bottom: 230,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  decorPawOne: {
    position: "absolute",
    top: 310,
    right: 26,
    fontSize: 34,
    transform: [{ rotate: "18deg" }],
  },
  decorSparkle: {
    position: "absolute",
    bottom: 350,
    left: 24,
    fontSize: 30,
    transform: [{ rotate: "-13deg" }],
  },

  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 0,
    gap: 6,
    position: "relative",
    overflow: "hidden",
  },
  heroDecorLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  heroCircleOne: {
    position: "absolute",
    right: -42,
    top: -35,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  heroCircleTwo: {
    position: "absolute",
    left: -34,
    bottom: -42,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroPaw: {
    position: "absolute",
    right: 32,
    bottom: 30,
    fontSize: 42,
    opacity: 0.24,
  },
  heroHeart: {
    position: "absolute",
    left: 40,
    top: 70,
    fontSize: 28,
    color: "#fff",
    opacity: 0.28,
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.88)",
    marginBottom: 5,
    transform: [{ rotate: "-4deg" }],
  },
  avatarInner: {
    width: 88,
    height: 88,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.23)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 34,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 1,
  },
  avatarBadge: {
    position: "absolute",
    right: -5,
    bottom: -6,
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.55)",
  },
  avatarBadgeText: {
    fontSize: 15,
  },
  heroName: {
    maxWidth: "82%",
    fontSize: 28,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.6,
    marginTop: 4,
  },
  heroEmail: {
    maxWidth: "84%",
    fontSize: 14,
    color: "rgba(255,255,255,0.82)",
    marginTop: 1,
    fontWeight: "600",
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.20)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 7,
  },
  verifyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.24)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
  },

  statsWrap: {
    paddingHorizontal: 20,
    marginTop: -32,
    marginBottom: 10,
    zIndex: 10,
  },
  statsCard: {
    flexDirection: "row",
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 18,
    minHeight: 92,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0,
    shadowRadius: 15,
    elevation: 6,
  },
  statPill: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9e9e9e",
  },
  statDivider: {
    width: 1,
    marginVertical: 5,
  },

  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  profileScoreCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0,
    shadowRadius: 10,
    elevation: 2,
  },
  scoreIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreEmoji: {
    fontSize: 21,
  },
  scoreCopy: {
    flex: 1,
    gap: 4,
  },
  scoreTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  scoreSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  scoreTrack: {
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 4,
  },
  scoreFill: {
    height: "100%",
    borderRadius: 999,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: "900",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: Platform.OS === "ios" ? 0.04 : 0,
    shadowRadius: 10,
    elevation: 2,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCopy: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  editForm: {
    padding: 16,
    gap: 16,
  },
  formErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
  },
  formErrorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },

  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  menuText: {
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "900",
  },
  menuSublabel: {
    fontSize: 12,
    fontWeight: "600",
  },
});
