import { Ionicons, Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePets } from "@/context/PetsContext";
import { useColors } from "@/hooks/useColors";

type VisibleTabName = "index" | "swipe" | "adopt" | "matches";

type RouteLike = {
  key: string;
  name: string;
};

type FloatingTabBarProps = {
  state: {
    index: number;
    routes: RouteLike[];
  };
  navigation: {
    emit: (event: {
      type: "tabPress" | "tabLongPress";
      target?: string;
      canPreventDefault?: boolean;
    }) => unknown;
    navigate: (name: string) => void;
  };
  unreadCount: number;
};

const VISIBLE_TABS: VisibleTabName[] = ["index", "swipe", "adopt", "matches"];

const TAB_CONFIG: Record<
  VisibleTabName,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
  }
> = {
  index: {
    label: "Home",
    icon: "home-outline",
    activeIcon: "home",
  },
  swipe: {
    label: "Discover",
    icon: "compass-outline",
    activeIcon: "compass",
  },
  adopt: {
    label: "Adopt",
    icon: "heart-circle-outline",
    activeIcon: "heart-circle",
  },
  matches: {
    label: "Chats",
    icon: "chatbubbles-outline",
    activeIcon: "chatbubbles",
  },
};

const PAW_ACTIONS: {
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  route: string;
}[] = [
  {
    title: "Add Pet",
    subtitle: "Create a pet profile for matching.",
    icon: "plus-circle",
    route: "/add-pet",
  },
  {
    title: "My Pets",
    subtitle: "Manage profiles, photos, and adoption status.",
    icon: "grid",
    route: "/(tabs)/my-pets",
  },
  {
    title: "Create Adoption Listing",
    subtitle: "Choose a pet and start a listing.",
    icon: "heart",
    route: "/adoption/select-pet",
  },
  {
    title: "Pet Documents",
    subtitle: "Open My Pets to manage trust documents.",
    icon: "file-text",
    route: "/(tabs)/my-pets",
  },
];

function BadgeCount({ count }: { count: number }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const display = count > 99 ? "99+" : String(count);

  useEffect(() => {
    if (count > 0) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 80,
      }).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start();
    }
  }, [count, scaleAnim]);

  if (count <= 0) return null;

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Text style={styles.badgeText}>{display}</Text>
    </Animated.View>
  );
}

function TabButton({
  route,
  isFocused,
  onPress,
  onLongPress,
  badgeCount,
}: {
  route: RouteLike;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  badgeCount?: number;
}) {
  const colors = useColors();
  const config = TAB_CONFIG[route.name as VisibleTabName];
  const scaleAnim = useRef(new Animated.Value(isFocused ? 1 : 0.96)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isFocused ? 1 : 0.96,
      useNativeDriver: true,
      friction: 7,
      tension: 120,
    }).start();
  }, [isFocused, scaleAnim]);

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => undefined);
    }
    onPress();
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      activeOpacity={0.82}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={styles.tabButton}
    >
      <Animated.View
        style={[
          styles.tabPill,
          {
            backgroundColor: isFocused ? `${colors.primary}14` : "transparent",
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.iconWrap}>
          <Ionicons
            name={isFocused ? config.activeIcon : config.icon}
            size={21}
            color={isFocused ? colors.primary : colors.mutedForeground}
          />
          {badgeCount ? <BadgeCount count={badgeCount} /> : null}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.tabLabel,
            {
              color: isFocused ? colors.primary : colors.mutedForeground,
              fontWeight: isFocused ? "800" : "700",
            },
          ]}
        >
          {config.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function PawActionSheet({
  visible,
  onClose,
  onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(28)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 180 : 130,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: visible ? 0 : 28,
        useNativeDriver: true,
        friction: 9,
        tension: 90,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.sheetRoot}>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={styles.sheetBackdropHitbox}
        >
          <Animated.View
            style={[
              styles.sheetBackdrop,
              {
                opacity,
              },
            ]}
          />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 14) + 12,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                Pet actions
              </Text>
              <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
                Add, manage, or prepare a pet profile.
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Close pet actions"
              activeOpacity={0.78}
              onPress={onClose}
              style={[
                styles.sheetClose,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={styles.actionList}>
            {PAW_ACTIONS.map((action) => (
              <TouchableOpacity
                activeOpacity={0.82}
                key={action.title}
                onPress={() => onNavigate(action.route)}
                style={[
                  styles.actionRow,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: `${colors.primary}16` },
                  ]}
                >
                  <Feather name={action.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>
                    {action.title}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.actionSubtitle, { color: colors.mutedForeground }]}
                  >
                    {action.subtitle}
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function FloatingTabBar({
  state,
  navigation,
  unreadCount,
}: FloatingTabBarProps) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);
  const isDark = colorScheme === "dark";
  const bottomOffset = Platform.OS === "web" ? 18 : Math.max(insets.bottom, 8) + 8;
  const visibleRoutes = VISIBLE_TABS.map((name) =>
    state.routes.find((route) => route.name === name)
  ).filter(Boolean) as RouteLike[];

  const navigateFromSheet = (route: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined
      );
    }
    setSheetVisible(false);
    requestAnimationFrame(() => {
      router.push(route as never);
    });
  };

  const openSheet = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
        () => undefined
      );
    }
    setSheetVisible(true);
  };

  const renderTab = (route: RouteLike) => {
    const currentRouteName = state.routes[state.index]?.name;
    const isFocused = currentRouteName === route.name;

    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (
        !isFocused &&
        !(event as { defaultPrevented?: boolean }).defaultPrevented
      ) {
        navigation.navigate(route.name);
      }
    };

    const onLongPress = () => {
      navigation.emit({
        type: "tabLongPress",
        target: route.key,
      });
    };

    return (
      <TabButton
        badgeCount={route.name === "matches" ? unreadCount : undefined}
        isFocused={isFocused}
        key={route.key}
        onLongPress={onLongPress}
        onPress={onPress}
        route={route}
      />
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.tabRoot, { bottom: bottomOffset }]}>
      <View
        style={[
          styles.floatingShell,
          {
            shadowColor: isDark ? "#000000" : "#5f2a2a",
          },
        ]}
      >
        <View
          style={[
            styles.floatingTint,
            {
              borderColor: colors.border,
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.03)"
                : "rgba(255, 255, 255, 0.42)",
            },
          ]}
        >
          {Platform.OS === "ios" || Platform.OS === "web" ? (
            <BlurView
              intensity={isDark ? 38 : 72}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDark
                    ? "rgba(26, 26, 46, 0.96)"
                    : "rgba(255, 255, 255, 0.96)",
                },
              ]}
            />
          )}
          <View style={styles.tabRow}>
            <View style={styles.tabPair}>
              {visibleRoutes.slice(0, 2).map(renderTab)}
            </View>
            <View style={styles.centerSpacer} />
            <View style={styles.tabPair}>
              {visibleRoutes.slice(2).map(renderTab)}
            </View>
          </View>
        </View>

        <TouchableOpacity
          accessibilityLabel="Open pet actions"
          activeOpacity={0.9}
          onPress={openSheet}
          style={[
            styles.pawButton,
            {
              borderColor: colors.card,
              shadowColor: colors.primary,
            },
          ]}
        >
          <LinearGradient
            colors={[colors.primary, colors.accent]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.pawGradient}
          >
            <Ionicons name="paw" size={27} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <PawActionSheet
        onClose={() => setSheetVisible(false)}
        onNavigate={navigateFromSheet}
        visible={sheetVisible}
      />
    </View>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const { chatUnreadCount } = usePets();

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (router.canGoBack()) {
          return false;
        }

        return true;
      }
    );

    return () => subscription.remove();
  }, [router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => (
        <FloatingTabBar {...props} unreadCount={chatUnreadCount} />
      )}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="swipe"
        options={{
          title: "Discover",
        }}
      />
      <Tabs.Screen
        name="adopt"
        options={{
          title: "Adopt",
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: "Chats",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="my-pets"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  actionCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  actionIcon: {
    alignItems: "center",
    borderRadius: 18,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  actionList: {
    gap: 10,
    marginTop: 18,
  },
  actionRow: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  badge: {
    alignItems: "center",
    backgroundColor: "#ef4444",
    borderColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
    minWidth: 18,
    paddingHorizontal: 5,
    position: "absolute",
    right: -10,
    top: -9,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
  },
  centerSpacer: {
    width: 56,
  },
  floatingShell: {
    borderRadius: 29,
    elevation: 16,
    height: 68,
    overflow: "visible",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  floatingTint: {
    borderRadius: 29,
    borderWidth: StyleSheet.hairlineWidth,
    height: 68,
    overflow: "hidden",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  pawButton: {
    alignItems: "center",
    borderRadius: 32,
    borderWidth: 3,
    elevation: 18,
    height: 62,
    justifyContent: "center",
    left: "50%",
    marginLeft: -31,
    overflow: "hidden",
    position: "absolute",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    top: -24,
    width: 62,
  },
  pawGradient: {
    alignItems: "center",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  sheetBackdropHitbox: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetClose: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  sheetHandle: {
    alignSelf: "center",
    borderRadius: 3,
    height: 5,
    marginBottom: 16,
    width: 42,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 3,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  tabButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
  },
  tabPair: {
    flex: 1,
    flexDirection: "row",
  },
  tabPill: {
    alignItems: "center",
    borderRadius: 20,
    height: 48,
    justifyContent: "center",
    maxWidth: 68,
    paddingHorizontal: 7,
    width: "100%",
  },
  tabRoot: {
    left: 16,
    pointerEvents: "box-none",
    position: "absolute",
    right: 16,
  },
  tabRow: {
    alignItems: "center",
    flexDirection: "row",
    height: 68,
    paddingHorizontal: 7,
  },
});
