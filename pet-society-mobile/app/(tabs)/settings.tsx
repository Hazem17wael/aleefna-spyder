import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Switch,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { formatLiveDebugSnapshot } from "@/services/liveDebug";
import {
  getLocalPetRemindersEnabled,
  setLocalPetRemindersEnabled,
} from "@/services/localPetReminders";

type SettingsItem = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress?: () => void;
  kind?: "link" | "switch";
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
};

type SettingsSection = {
  title: string;
  items: SettingsItem[];
};

const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;

function publicHttpsUrl(value?: string) {
  if (!value?.trim()) return null;

  const trimmed = value.trim();

  return /^https:\/\//i.test(trimmed) ? trimmed : null;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [remindersSaving, setRemindersSaving] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    let mounted = true;

    getLocalPetRemindersEnabled()
      .then((enabled) => {
        if (mounted) setRemindersEnabled(enabled);
      })
      .catch(() => {
        if (mounted) setRemindersEnabled(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const sections: SettingsSection[] = [
    {
      title: "Account",
      items: [
        { icon: "user" as const, label: "Edit Profile", onPress: () => router.push("/(tabs)/profile") },
        { icon: "lock" as const, label: "Change Password", onPress: () => router.push("/forgot-password") },
        { icon: "mail" as const, label: "Verify Email", onPress: () => router.push("/verify-otp") },
        { icon: "trash-2" as const, label: "Delete Account", onPress: handleDeleteAccount },
      ],
    },
    {
      title: "Pets",
      items: [
        { icon: "star" as const, label: "My Pets", onPress: () => router.push("/(tabs)/my-pets") },
        { icon: "plus-circle" as const, label: "Add New Pet", onPress: () => router.push("/add-pet") },
      ],
    },
    {
      title: "App",
      items: [
        {
          icon: "bell" as const,
          label: "Pet care reminders",
          kind: "switch" as const,
          value: remindersEnabled,
          disabled: remindersSaving,
          onValueChange: handlePetCareRemindersChange,
        },
        { icon: "bell" as const, label: "Notifications", onPress: () => router.push("/(tabs)/notifications") },
        { icon: "heart" as const, label: "Matches", onPress: () => router.push("/(tabs)/matches") },
      ],
    },
    {
      title: "About",
      items: [
        { icon: "info" as const, label: "Aleefna v1.0", onPress: () => {} },
        { icon: "shield" as const, label: "Privacy Policy", onPress: () => openLegalUrl("Privacy Policy", PRIVACY_POLICY_URL) },
        { icon: "file-text" as const, label: "Terms of Service", onPress: () => openLegalUrl("Terms of Service", TERMS_URL) },
      ],
    },
    ...(__DEV__
      ? [
          {
            title: "Developer",
            items: [
              {
                icon: "activity" as const,
                label: "Live messaging health",
                onPress: () => {
                  Alert.alert("Live messaging health", formatLiveDebugSnapshot());
                },
              },
            ],
          },
        ]
      : []),
  ];

  async function handleLogout() {
    if (logoutLoading) return;

    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          if (logoutLoading) return;

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

  async function handlePetCareRemindersChange(enabled: boolean) {
    if (remindersSaving) return;

    const previousValue = remindersEnabled;

    setRemindersEnabled(enabled);
    setRemindersSaving(true);

    try {
      await setLocalPetRemindersEnabled(enabled);
    } catch {
      setRemindersEnabled(previousValue);
    } finally {
      setRemindersSaving(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete account?",
      "This hides your pets and adoption listings, revokes your sessions, and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => router.push("/account/delete" as any),
        },
      ],
    );
  }

  async function openLegalUrl(label: string, rawUrl?: string) {
    const url = publicHttpsUrl(rawUrl);

    if (!url) {
      Alert.alert(label, `${label} will be available soon.`);
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(label, `Could not open ${label}. Please try again later.`);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
    >
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.muted }]}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
      </View>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            {section.title.toUpperCase()}
          </Text>
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {section.items.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.onPress}
                style={[
                  styles.menuRow,
                  {
                    borderBottomWidth: i < section.items.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <View style={styles.menuLeft}>
                  <View
                    style={[
                      styles.iconWrap,
                      { backgroundColor: colors.primary + "15" },
                    ]}
                  >
                    <Feather name={item.icon} size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.menuLabel, { color: colors.foreground }]}>
                    {item.label}
                  </Text>
                </View>
                {item.kind === "switch" ? (
                  <Switch
                    disabled={item.disabled}
                    value={Boolean(item.value)}
                    onValueChange={item.onValueChange}
                    trackColor={{
                      false: colors.border,
                      true: colors.primary + "55",
                    }}
                    thumbColor={item.value ? colors.primary : colors.card}
                    ios_backgroundColor={colors.border}
                  />
                ) : (
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <View style={{ paddingHorizontal: 20 }}>
        <TouchableOpacity
          onPress={handleLogout}
          disabled={logoutLoading}
          style={[
            styles.logoutBtn,
            {
              backgroundColor: colors.destructive + "15",
              borderColor: colors.destructive + "40",
              opacity: logoutLoading ? 0.6 : 1,
            },
          ]}
          activeOpacity={0.8}
        >
          {logoutLoading ? (
            <ActivityIndicator size="small" color={colors.destructive} />
          ) : (
            <Feather name="log-out" size={18} color={colors.destructive} />
          )}
          <Text style={[styles.logoutText, { color: colors.destructive }]}>
            {logoutLoading ? "Please wait..." : "Logout"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
