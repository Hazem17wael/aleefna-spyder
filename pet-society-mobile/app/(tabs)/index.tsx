import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  useWindowDimensions,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Reanimated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { usePets } from "@/context/PetsContext";
import {
  makeCareWidgetSnapshot,
  updateCareWidgetSnapshot,
} from "@/services/careWidget";

const heroPetImage = require("../../assets/images/dog.png");

type CareHabitKey = "food" | "water" | "play" | "care";

type CareStreakState = {
  date: string;
  completedHabits: CareHabitKey[];
  streakCount: number;
  lastCompletedDate: string | null;
  todayStreakSaved: boolean;
};

const careHabits: {
  key: CareHabitKey;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { key: "food", label: "Food", icon: "coffee" },
  { key: "water", label: "Water", icon: "droplet" },
  { key: "play", label: "Play", icon: "zap" },
  { key: "care", label: "Care", icon: "heart" },
];

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getPreviousDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);

  return getLocalDateKey(date);
}

function createDefaultCareState(date: string): CareStreakState {
  return {
    date,
    completedHabits: ["food", "water"],
    streakCount: 0,
    lastCompletedDate: null,
    todayStreakSaved: false,
  };
}

function sanitizeCareState(raw: unknown, today: string): CareStreakState {
  if (!raw || typeof raw !== "object") {
    return createDefaultCareState(today);
  }

  const record = raw as Partial<CareStreakState>;
  const validHabitKeys = new Set(careHabits.map((habit) => habit.key));
  const completedHabits = Array.isArray(record.completedHabits)
    ? record.completedHabits.filter(
        (habit): habit is CareHabitKey =>
          typeof habit === "string" && validHabitKeys.has(habit as CareHabitKey)
      )
    : [];

  const base: CareStreakState = {
    date: typeof record.date === "string" ? record.date : today,
    completedHabits,
    streakCount:
      typeof record.streakCount === "number" && record.streakCount > 0
        ? record.streakCount
        : 0,
    lastCompletedDate:
      typeof record.lastCompletedDate === "string"
        ? record.lastCompletedDate
        : null,
    todayStreakSaved: Boolean(record.todayStreakSaved),
  };

  if (base.date !== today) {
    return {
      ...base,
      date: today,
      completedHabits: [],
      todayStreakSaved: false,
    };
  }

  return base;
}

function updateSavedStreak(
  state: CareStreakState,
  completedHabits: CareHabitKey[],
  today: string
): { nextState: CareStreakState; rewardMessage: string | null } {
  if (completedHabits.length < 3 || state.todayStreakSaved) {
    return {
      nextState: {
        ...state,
        date: today,
        completedHabits,
      },
      rewardMessage: null,
    };
  }

  const yesterday = getPreviousDateKey(today);
  const streakCount =
    state.lastCompletedDate === today
      ? state.streakCount
      : state.lastCompletedDate === yesterday
        ? state.streakCount + 1
        : 1;

  return {
    nextState: {
      ...state,
      date: today,
      completedHabits,
      streakCount,
      lastCompletedDate: today,
      todayStreakSaved: true,
    },
    rewardMessage:
      completedHabits.length === careHabits.length
        ? "Perfect Care Day!"
        : "Care Streak saved!",
  };
}

function getCareMood(completedCount: number, petName: string | null) {
  const lovedName = petName ?? "Your pet";

  if (completedCount === 0) return "Start with one tiny act of pet love.";
  if (completedCount === 1) return "Nice start. The tail-wag department noticed.";
  if (completedCount === 2) {
    return "One more habit saves the streak. Very heroic, honestly.";
  }
  if (completedCount === 3) {
    return `Streak saved! ${lovedName} is ready for compliments.`;
  }

  return `Perfect Care Day! ${lovedName} is basically a tiny superstar.`;
}

function getHomeLoveNote({
  petName,
  petCount,
  matchCount,
}: {
  petName: string | null;
  petCount: number;
  matchCount: number;
}) {
  if (petName) {
    return `${petName} is accepting snacks, compliments, and dramatic attention.`;
  }

  if (petCount > 0) {
    return "Your tiny squad is ready for love, snacks, and mild chaos.";
  }

  if (matchCount > 0) {
    return "Your match radar is warming up. Pet drama may occur.";
  }

  return "Today's mission: make one pet feel ridiculously loved.";
}

function safeHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "web") return;

  Haptics.impactAsync(style).catch(() => { });
}

function getGreeting() {
  const h = new Date().getHours();

  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";

  return "Good evening";
}

function getGreetingEmoji() {
  const h = new Date().getHours();

  if (h < 12) return "☀️";
  if (h < 18) return "🌤️";

  return "🌙";
}

function QuickAction({
  icon,
  label,
  sub,
  badge,
  gradientStart,
  gradientEnd,
  onPress,
  delay,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sub: string;
  badge?: number;
  gradientStart: string;
  gradientEnd: string;
  onPress: () => void;
  delay: number;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Reanimated.View
      entering={FadeInDown.delay(delay).springify().damping(18)}
      style={styles.quickActionWrap}
    >
      <Reanimated.View style={anim}>
        <TouchableOpacity
          onPress={() => {
            safeHaptic(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }}
          onPressIn={() => {
            scale.value = withSpring(0.96, { damping: 14 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 14 });
          }}
          activeOpacity={1}
          style={[
            styles.quickActionCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <LinearGradient
            colors={[gradientStart, gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quickIconBox}
          >
            <Feather name={icon} size={22} color="#fff" />
          </LinearGradient>

          <View style={styles.quickCopy}>
            <View style={styles.quickTitleRow}>
              <Text
                style={[styles.quickActionLabel, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {label}
              </Text>

              {badge !== undefined && badge > 0 ? (
                <View
                  style={[
                    styles.inlineBadge,
                    {
                      backgroundColor: gradientStart + "18",
                      borderColor: gradientStart + "35",
                    },
                  ]}
                >
                  <Text style={[styles.inlineBadgeText, { color: gradientStart }]}>
                    {badge > 99 ? "99+" : badge}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              style={[
                styles.quickActionSub,
                { color: colors.mutedForeground },
              ]}
              numberOfLines={1}
            >
              {sub}
            </Text>
          </View>
        </TouchableOpacity>
      </Reanimated.View>
    </Reanimated.View>
  );
}

function StatCard({
  emoji,
  value,
  label,
  tint,
  delay,
}: {
  emoji: string;
  value: string | number;
  label: string;
  tint: string;
  delay: number;
}) {
  const colors = useColors();
  const numericValue = typeof value === "number" ? value : null;
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (numericValue === null) {
      setDisplayValue(value);
      return;
    }

    setDisplayValue(0);
    const duration = 620;
    let timer: ReturnType<typeof setInterval> | undefined;
    const startTimer = setTimeout(() => {
      const start = Date.now();
      timer = setInterval(() => {
        const elapsed = Date.now() - start;
        const progress = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(numericValue * eased));

        if (progress >= 1) {
          clearInterval(timer);
        }
      }, 32);
    }, Math.max(0, delay));

    return () => {
      clearTimeout(startTimer);
      if (timer) clearInterval(timer);
    };
  }, [delay, numericValue, value]);

  return (
    <Reanimated.View
      entering={FadeInDown.delay(delay).springify().damping(18)}
      style={[
        styles.statCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.statIconBox,
          {
            backgroundColor: tint + "16",
          },
        ]}
      >
        <Text style={styles.statEmoji}>{emoji}</Text>
      </View>

      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {displayValue}
      </Text>

      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </Reanimated.View>
  );
}

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ focus?: string }>();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const {
    myPets,
    matches,
    unreadCount,
    fetchMyPets,
    fetchMatches,
    fetchNotifications,
  } = usePets();
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const careStreakY = useRef(0);

  const topPad = Platform.OS === "web" ? 52 : insets.top;
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 20;

  const isSmall = width < 375;
  const isTablet = width >= 768;
  const horizontalPadding = isTablet ? 28 : 20;

  const greeting = useMemo(getGreeting, []);
  const greetingEmoji = useMemo(getGreetingEmoji, []);

  const firstName = user?.name?.split(" ")[0] ?? "Friend";

  const initials = (user?.name ?? "P")
    .split(" ")
    .filter(Boolean)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // TODO: add pet selector for Care Streak after MVP
  const activePet = myPets[0] ?? null;
  const activePetName = activePet?.name ?? activePet?.pet_name ?? null;
  const careToday = getLocalDateKey();
  const careStorageKey = useMemo(() => {
    if (user?.id && activePet?.id != null) {
      return `aleefna:care-streak:user:${user.id}:pet:${activePet.id}`;
    }

    if (user?.id) {
      return `aleefna:care-streak:user:${user.id}:general`;
    }

    return "aleefna:care-streak:guest";
  }, [activePet?.id, user?.id]);
  const [careState, setCareState] = useState<CareStreakState>(() =>
    createDefaultCareState(careToday)
  );
  const [careLoaded, setCareLoaded] = useState(false);
  const [careReward, setCareReward] = useState<string | null>(null);
  const rewardScale = useSharedValue(0);

  const rewardStyle = useAnimatedStyle(() => ({
    opacity: rewardScale.value,
    transform: [{ scale: rewardScale.value }],
  }));

  const completedCount = careState.completedHabits.length;
  const progressPercent = Math.round((completedCount / careHabits.length) * 100);
  const streakText =
    careState.streakCount > 0
      ? `Day ${careState.streakCount} streak`
      : "Start your streak today";
  const carePetLine = activePetName ? `Today with ${activePetName}` : "Today's care";
  const careMood = getCareMood(completedCount, activePetName);
  const homeLoveNote = getHomeLoveNote({
    petName: activePetName,
    petCount: myPets.length,
    matchCount: matches.length,
  });
  const completedHabitSet = useMemo(
    () => new Set(careState.completedHabits),
    [careState.completedHabits]
  );

  useEffect(() => {
    let mounted = true;

    setCareLoaded(false);
    setCareReward(null);
    rewardScale.value = 0;

    AsyncStorage.getItem(careStorageKey)
      .then((stored) => {
        if (!mounted) return;

        if (!stored) {
          setCareState(createDefaultCareState(careToday));
          return;
        }

        try {
          setCareState(sanitizeCareState(JSON.parse(stored), careToday));
        } catch {
          setCareState(createDefaultCareState(careToday));
        }
      })
      .finally(() => {
        if (mounted) setCareLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, [careStorageKey, careToday, rewardScale]);

  useEffect(() => {
    if (!careLoaded) return;

    AsyncStorage.setItem(careStorageKey, JSON.stringify(careState)).catch(
      () => undefined
    );
  }, [careLoaded, careState, careStorageKey]);

  useEffect(() => {
    if (!careLoaded) return;

    updateCareWidgetSnapshot(
      makeCareWidgetSnapshot({
        petName: activePetName,
        careState,
      })
    );
  }, [activePetName, careLoaded, careState]);

  const toggleCareHabit = useCallback(
    (habitKey: CareHabitKey) => {
      safeHaptic(Haptics.ImpactFeedbackStyle.Light);

      setCareState((current) => {
        const nextSet = new Set(current.completedHabits);

        if (nextSet.has(habitKey)) {
          nextSet.delete(habitKey);
        } else {
          nextSet.add(habitKey);
        }

        const completedHabits = careHabits
          .map((habit) => habit.key)
          .filter((key) => nextSet.has(key));
        const { nextState, rewardMessage } = updateSavedStreak(
          current,
          completedHabits,
          careToday
        );
        const perfectReward =
          completedHabits.length === careHabits.length &&
          current.completedHabits.length !== careHabits.length
            ? "Perfect Care Day!"
            : null;
        const nextReward = rewardMessage ?? perfectReward;

        if (nextReward) {
          setCareReward(nextReward);
          rewardScale.value = 0.72;
          rewardScale.value = withSpring(1, { damping: 9, stiffness: 140 });
          safeHaptic(
            nextReward === "Perfect Care Day!"
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light
          );
        }

        return nextState;
      });
    },
    [careToday, rewardScale]
  );

  const avatarScale = useSharedValue(1);

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const heroScale = useSharedValue(1);

  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroScale.value }],
  }));

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;

    setRefreshing(true);

    try {
      await Promise.all([
        fetchMyPets(),
        fetchMatches(),
        fetchNotifications(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchMatches, fetchMyPets, fetchNotifications, refreshing]);

  useEffect(() => {
    if (params.focus !== "care_streak") return;

    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(careStreakY.current - 16, 0),
        animated: true,
      });
    }, 450);

    return () => clearTimeout(timer);
  }, [params.focus]);

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

        <Text style={[styles.decorPawTwo, { color: colors.match + "16" }]}>
          🐾
        </Text>
      </View>

      <Reanimated.View
        entering={FadeInDown.springify().damping(20)}
        style={[
          styles.topBar,
          {
            paddingTop: topPad + 8,
            paddingHorizontal: horizontalPadding,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.greetingLine, { color: colors.mutedForeground }]}>
            {greetingEmoji} {greeting}
          </Text>

          <Text
            style={[styles.nameLine, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {firstName} 👋
          </Text>
        </View>

        <Reanimated.View style={avatarStyle}>
          <TouchableOpacity
            onPress={() => {
              safeHaptic(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/profile");
            }}
            onPressIn={() => {
              avatarScale.value = withSpring(0.88, { damping: 12 });
            }}
            onPressOut={() => {
              avatarScale.value = withSpring(1, { damping: 12 });
            }}
            style={[styles.avatarBtn, { backgroundColor: colors.primary }]}
            activeOpacity={1}
          >
            <Text style={styles.avatarInitials}>{initials}</Text>
          </TouchableOpacity>
        </Reanimated.View>
      </Reanimated.View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom: bottomPad + 90,
            paddingHorizontal: horizontalPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <Reanimated.View
          entering={FadeInDown.delay(60).springify().damping(18)}
          style={heroStyle}
        >
          <View pointerEvents="none" style={styles.heroBackLayer} />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Start swiping"
            onPress={() => {
              safeHaptic(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/swipe");
            }}
            onPressIn={() => {
              heroScale.value = withSpring(0.985, { damping: 14 });
            }}
            onPressOut={() => {
              heroScale.value = withSpring(1, { damping: 14 });
            }}
            activeOpacity={0.92}
          >
            <LinearGradient
              colors={[colors.primary, colors.accent, "#ffb36b"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.heroBanner, { minHeight: isSmall ? 152 : 172 }]}
            >
              <Text style={[styles.heroPatternPaw, styles.heroPatternPawOne]}>
                🐾
              </Text>
              <Text style={[styles.heroPatternPaw, styles.heroPatternPawTwo]}>
                🐾
              </Text>
              <Text style={[styles.heroPatternPaw, styles.heroPatternPawThree]}>
                🐾
              </Text>

              <View style={styles.heroInner}>
                <View
                  style={[
                    styles.heroContent,
                    { maxWidth: isSmall ? "66%" : "61%" },
                  ]}
                >
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>ALEEFNA</Text>
                  </View>

                  <Text
                    style={[
                      styles.heroTitle,
                      {
                        fontSize: isSmall ? 19 : 25,
                        lineHeight: isSmall ? 23 : 30,
                      },
                    ]}
                  >
                    Find Your Pet&apos;s{"\n"}Perfect Playmate
                  </Text>

                  <Text style={styles.heroSub}>
                    Swipe, match, and let the pet drama begin.
                  </Text>

                  <View style={styles.heroCta}>
                    <Text style={styles.heroCtaText}>Start Swiping</Text>
                    <Feather
                      name="arrow-right"
                      size={15}
                      color={colors.primary}
                    />
                  </View>
                </View>

                <View
                  style={[
                    styles.heroImageHalo,
                    {
                      width: isSmall ? 104 : 132,
                      height: isSmall ? 122 : 150,
                      right: isSmall ? -18 : -14,
                    },
                  ]}
                >
                  <Image
                    accessibilityIgnoresInvertColors
                    accessible={false}
                    source={heroPetImage}
                    resizeMode="cover"
                    style={styles.heroPetImage}
                  />
                </View>

                <View
                  style={[
                    styles.heroHeartBubble,
                    {
                      right: isSmall ? 72 : 94,
                      top: isSmall ? 26 : 28,
                    },
                  ]}
                >
                  <Text style={styles.heroHeartBubbleText}>♥</Text>
                </View>
              </View>

              <View style={[styles.heroPawCircle, styles.heroPawCircle1]} />
              <View style={[styles.heroPawCircle, styles.heroPawCircle2]} />
            </LinearGradient>
          </TouchableOpacity>
        </Reanimated.View>

        <Reanimated.View entering={FadeInDown.delay(210).springify().damping(18)}>
          <View
            style={[
              styles.homeOverviewCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.homeOverviewHeader}>
              <View style={styles.homeOverviewCopy}>
                <Text
                  style={[styles.homeOverviewTitle, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  Today on Aleefna
                </Text>
                <Text
                  style={[
                    styles.homeOverviewSub,
                    { color: colors.mutedForeground },
                  ]}
                  numberOfLines={2}
                >
                  Pet love, tiny routines, and just enough drama for today.
                </Text>
              </View>

              <View
                style={[
                  styles.homeOverviewPill,
                  { backgroundColor: `${colors.primary}12` },
                ]}
              >
                <Feather name="activity" size={13} color={colors.primary} />
                <Text style={[styles.homeOverviewPillText, { color: colors.primary }]}>
                  Live
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.homeLoveNote,
                { backgroundColor: `${colors.accent}10` },
              ]}
            >
              <View
                style={[
                  styles.homeLoveIcon,
                  { backgroundColor: `${colors.primary}16` },
                ]}
              >
                <Text style={styles.homeLoveEmoji}>♥</Text>
              </View>

              <Text
                style={[styles.homeLoveText, { color: colors.foreground }]}
                numberOfLines={2}
              >
                {homeLoveNote}
              </Text>
            </View>

            <View style={styles.statsGrid}>
              <StatCard
                emoji="🐶"
                value={myPets.length}
                label="pets"
                tint={colors.primary}
                delay={100}
              />

              <StatCard
                emoji="💘"
                value={matches.length}
                label="matches"
                tint={colors.match}
                delay={140}
              />
            </View>

            <View style={styles.homeVibeRow}>
              <View
                style={[
                  styles.homeVibeChip,
                  { backgroundColor: `${colors.primary}10` },
                ]}
              >
                <Text style={styles.homeVibeEmoji}>🔥</Text>
                <View style={styles.homeVibeCopy}>
                  <Text
                    style={[styles.homeVibeLabel, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    Love mode
                  </Text>
                  <Text
                    style={[styles.homeVibeValue, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {activePetName ? "Activated" : "Ready"}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.homeVibeChip,
                  { backgroundColor: `${colors.accent}12` },
                ]}
              >
                <Text style={styles.homeVibeEmoji}>✨</Text>
                <View style={styles.homeVibeCopy}>
                  <Text
                    style={[styles.homeVibeLabel, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    Cuddle forecast
                  </Text>
                  <Text
                    style={[styles.homeVibeValue, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    Very high
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Reanimated.View>

        <Reanimated.View
          entering={FadeInDown.delay(250).springify().damping(18)}
          style={[
            styles.actionPanel,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Quick Actions
              </Text>

              <Text
                style={[styles.sectionSub, { color: colors.mutedForeground }]}
              >
                Jump straight into the fun
              </Text>
            </View>
          </View>

          <View style={styles.quickGrid}>
            <QuickAction
              icon="heart"
              label="Swipe"
              sub="meet cute chaos"
              gradientStart="#ff6b6b"
              gradientEnd="#ff8e53"
              onPress={() => router.push("/(tabs)/swipe")}
              delay={270}
            />

            <QuickAction
              icon="star"
              label="My Pets"
              sub="tiny VIP profiles"
              badge={myPets.length}
              gradientStart="#6c63ff"
              gradientEnd="#a29bfe"
              onPress={() => router.push("/(tabs)/my-pets")}
              delay={310}
            />

            <QuickAction
              icon="zap"
              label="Matches"
              sub="open the drama"
              badge={matches.length}
              gradientStart="#fd79a8"
              gradientEnd="#e84393"
              onPress={() => router.push("/(tabs)/matches")}
              delay={350}
            />

            <QuickAction
              icon="bell"
              label="Alerts"
              sub="important barks"
              badge={unreadCount}
              gradientStart="#ff8e53"
              gradientEnd="#ffc36d"
              onPress={() => router.push("/(tabs)/notifications")}
              delay={390}
            />
          </View>
        </Reanimated.View>

        <Reanimated.View
          onLayout={(event) => {
            careStreakY.current = event.nativeEvent.layout.y;
          }}
          entering={FadeInDown.delay(380).springify().damping(18)}
          style={[
            styles.careStreakCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.careTopRow}>
            <View style={styles.careTitleGroup}>
              <Text style={[styles.careTitle, { color: colors.foreground }]}>
                Care Streak
              </Text>
              <Text
                style={[styles.careSubtitle, { color: colors.mutedForeground }]}
              >
                Tiny rituals. Big tail-wag energy.
              </Text>
              <Text style={[styles.carePetLine, { color: colors.primary }]}>
                {carePetLine}
              </Text>
            </View>

            <View
              style={[
                styles.careProgressBadge,
                {
                  backgroundColor: `${colors.primary}12`,
                  borderColor: `${colors.primary}45`,
                },
              ]}
            >
              <Text style={[styles.careProgressPercent, { color: colors.primary }]}>
                {progressPercent}%
              </Text>
              <Text style={[styles.careProgressLabel, { color: colors.primary }]}>
                {completedCount}/{careHabits.length}
              </Text>
            </View>
          </View>

          <View style={styles.careMetaRow}>
            <View
              style={[
                styles.careStreakPill,
                { backgroundColor: `${colors.accent}18` },
              ]}
            >
              <Feather name="sun" size={14} color={colors.accent} />
              <Text style={[styles.careStreakText, { color: colors.accent }]}>
                {streakText}
              </Text>
            </View>
            <Text style={[styles.careCompletedText, { color: colors.foreground }]}>
              {completedCount}/{careHabits.length} completed
            </Text>
          </View>

          <View
            style={[
              styles.careProgressTrack,
              { backgroundColor: `${colors.accent}18` },
            ]}
          >
            <View
              style={[
                styles.careProgressFill,
                { backgroundColor: colors.accent, width: `${progressPercent}%` },
              ]}
            />
          </View>

          <View style={styles.careHabitGrid}>
            {careHabits.map((habit) => {
              const completed = completedHabitSet.has(habit.key);

              return (
                <TouchableOpacity
                  activeOpacity={0.82}
                  key={habit.key}
                  onPress={() => toggleCareHabit(habit.key)}
                  style={[
                    styles.careHabitButton,
                    {
                      backgroundColor: completed
                        ? `${colors.primary}12`
                        : colors.card,
                      borderColor: completed
                        ? `${colors.primary}45`
                        : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.careHabitIcon,
                      {
                        backgroundColor: completed
                          ? colors.primary
                          : `${colors.accent}18`,
                      },
                    ]}
                  >
                    <Feather
                      name={completed ? "check" : habit.icon}
                      size={16}
                      color={completed ? colors.primaryForeground : colors.accent}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.careHabitLabel,
                      {
                        color: completed
                          ? colors.foreground
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    {habit.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            style={[
              styles.careMoodBox,
              { backgroundColor: `${colors.accent}10` },
            ]}
          >
            <Text style={styles.careMoodEmoji}>
              {completedCount === careHabits.length ? "💛" : "🐾"}
            </Text>
            <Text style={[styles.careMoodText, { color: colors.foreground }]}>
              {careMood}
            </Text>
          </View>

          {careReward ? (
            <Reanimated.View
              style={[
                styles.careReward,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
                rewardStyle,
              ]}
            >
              <Text style={[styles.careRewardIcon, { color: colors.primary }]}>
                ♥
              </Text>
              <Text style={[styles.careRewardText, { color: colors.accent }]}>
                {careReward}
              </Text>
            </Reanimated.View>
          ) : null}
        </Reanimated.View>
      </ScrollView>
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
    top: 300,
    right: 28,
    fontSize: 34,
    transform: [{ rotate: "18deg" }],
  },
  decorPawTwo: {
    position: "absolute",
    bottom: 350,
    left: 24,
    fontSize: 31,
    transform: [{ rotate: "-14deg" }],
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    zIndex: 2,
  },
  greetingLine: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  nameLine: {
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0,
  },
  avatarBtn: {
    width: 46,
    height: 46,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ff6b6b",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: Platform.OS === "ios" ? 0.25 : 0,
    shadowRadius: 9,
    elevation: 4,
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
  },

  scroll: {
    paddingTop: 4,
  },

  heroBackLayer: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 10,
    bottom: 10,
    borderRadius: 28,
    backgroundColor: "#ff8e53",
    opacity: 0.18,
    transform: [{ rotate: "-1.2deg" }],
  },
  heroBanner: {
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 18,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#ff6b6b",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === "ios" ? 0.22 : 0,
    shadowRadius: 18,
    elevation: 5,
  },
  heroInner: {
    flex: 1,
    minHeight: 118,
    justifyContent: "center",
    position: "relative",
  },
  heroContent: {
    gap: 7,
    zIndex: 4,
  },
  heroBadge: {
    backgroundColor: "rgba(255,255,255,0.22)",
    alignSelf: "flex-start",
    borderColor: "rgba(255,255,255,0.34)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0,
  },
  heroTitle: {
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0,
  },
  heroSub: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    maxWidth: 170,
  },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 4,
    shadowColor: "#8b2f1c",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === "ios" ? 0.16 : 0,
    shadowRadius: 10,
    elevation: 2,
  },
  heroCtaText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#ff6b6b",
  },
  heroImageHalo: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "flex-end",
    bottom: -12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.20)",
    borderColor: "rgba(255,255,255,0.30)",
    borderWidth: 1,
    overflow: "visible",
    shadowColor: "#7a2d19",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === "ios" ? 0.18 : 0,
    shadowRadius: 14,
    elevation: 4,
    zIndex: 2,
  },
  heroPetImage: {
    width: "112%",
    height: "112%",
  },
  heroHeartBubble: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    shadowColor: "#9f2d27",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === "ios" ? 0.2 : 0,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 5,
  },
  heroHeartBubbleText: {
    color: "#ff6b6b",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  heroPawCircle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroPawCircle1: {
    width: 128,
    height: 128,
    right: -36,
    top: -38,
  },
  heroPawCircle2: {
    width: 78,
    height: 78,
    right: 78,
    bottom: -28,
  },
  heroPatternPaw: {
    position: "absolute",
    fontSize: 30,
    color: "#fff",
    opacity: 0.12,
    zIndex: 1,
  },
  heroPatternPawOne: {
    left: 24,
    bottom: 18,
    transform: [{ rotate: "-18deg" }],
  },
  heroPatternPawTwo: {
    right: 96,
    top: 12,
    transform: [{ rotate: "18deg" }],
  },
  heroPatternPawThree: {
    right: 30,
    bottom: 18,
    transform: [{ rotate: "-10deg" }],
  },

  homeOverviewCard: {
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === "ios" ? 0.055 : 0,
    shadowRadius: 14,
    elevation: 3,
  },
  homeOverviewHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  homeOverviewCopy: {
    flex: 1,
    minWidth: 0,
  },
  homeOverviewTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
  },
  homeOverviewSub: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
  },
  homeOverviewPill: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  homeOverviewPillText: {
    fontSize: 11,
    fontWeight: "900",
  },
  homeLoveNote: {
    alignItems: "center",
    borderRadius: 20,
    flexDirection: "row",
    gap: 11,
    marginTop: 14,
    padding: 12,
  },
  homeLoveIcon: {
    alignItems: "center",
    borderRadius: 15,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  homeLoveEmoji: {
    color: "#ff6b6b",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
  },
  homeLoveText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  homeVibeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  homeVibeChip: {
    alignItems: "center",
    borderRadius: 18,
    flex: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 54,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  homeVibeEmoji: {
    fontSize: 18,
  },
  homeVibeCopy: {
    flex: 1,
    minWidth: 0,
  },
  homeVibeLabel: {
    fontSize: 10,
    fontWeight: "800",
  },
  homeVibeValue: {
    fontSize: 12,
    fontWeight: "900",
    marginTop: 1,
  },

  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    padding: 13,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === "ios" ? 0.035 : 0,
    shadowRadius: 8,
    elevation: 1,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  statEmoji: {
    fontSize: 18,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 1,
  },

  sectionHeaderRow: {
    marginBottom: 13,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0,
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },

  actionPanel: {
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 22,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === "ios" ? 0.055 : 0,
    shadowRadius: 14,
    elevation: 3,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickActionWrap: {
    width: "48%",
  },
  quickActionCard: {
    minHeight: 92,
    borderRadius: 24,
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0,
    shadowRadius: 10,
    elevation: 2,
  },
  quickIconBox: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  quickCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  inlineBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  inlineBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },
  quickActionLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "900",
  },
  quickActionSub: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },

  careStreakCard: {
    borderRadius: 26,
    borderWidth: 1,
    marginBottom: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0,
    shadowRadius: 14,
    elevation: 3,
  },
  careTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
  },
  careTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  careTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0,
  },
  careSubtitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  carePetLine: {
    fontSize: 13,
    fontWeight: "900",
    marginTop: 9,
  },
  careProgressBadge: {
    alignItems: "center",
    backgroundColor: "#e6f7f1",
    borderColor: "#36c7a0",
    borderRadius: 999,
    borderWidth: 2,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  careProgressPercent: {
    color: "#0f766e",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0,
  },
  careProgressLabel: {
    color: "#0f766e",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 1,
  },
  careMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 16,
  },
  careStreakPill: {
    alignItems: "center",
    backgroundColor: "#fff3df",
    borderRadius: 999,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  careStreakText: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "900",
  },
  careCompletedText: {
    fontSize: 13,
    fontWeight: "900",
  },
  careProgressTrack: {
    backgroundColor: "#f3eadf",
    borderRadius: 999,
    height: 9,
    marginTop: 12,
    overflow: "hidden",
  },
  careProgressFill: {
    backgroundColor: "#36c7a0",
    borderRadius: 999,
    height: "100%",
  },
  careHabitGrid: {
    flexDirection: "row",
    gap: 9,
    marginTop: 16,
  },
  careHabitButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 88,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  careHabitIcon: {
    alignItems: "center",
    borderRadius: 14,
    height: 32,
    justifyContent: "center",
    marginBottom: 8,
    width: 32,
  },
  careHabitLabel: {
    fontSize: 12,
    fontWeight: "900",
  },
  careMoodBox: {
    alignItems: "center",
    backgroundColor: "#fff8ed",
    borderRadius: 18,
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    padding: 12,
  },
  careMoodEmoji: {
    fontSize: 18,
  },
  careMoodText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  careReward: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#fff",
    borderColor: "#ffd6a8",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: "#ff8e53",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === "ios" ? 0.16 : 0,
    shadowRadius: 10,
    elevation: 2,
  },
  careRewardIcon: {
    color: "#ff6b6b",
    fontSize: 16,
    fontWeight: "900",
  },
  careRewardText: {
    color: "#b45309",
    fontSize: 13,
    fontWeight: "900",
  },
});
