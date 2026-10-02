import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";

import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { deleteAccount, getSafetyErrorMessage } from "@/services/safetyApi";

export default function DeleteAccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, logout } = useAuth();

  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const canDelete = confirmation.trim() === "DELETE" && !loading;

  async function submit() {
    if (!token || !canDelete) return;

    setLoading(true);

    try {
      await deleteAccount(token);
      await logout();
      Alert.alert("Account deleted successfully.");
      router.replace("/login");
    } catch (error) {
      Alert.alert("Could not delete account", getSafetyErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 18, paddingBottom: bottomPad + 32 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.destructive + "14" }]}>
        <Feather name="trash-2" size={28} color={colors.destructive} />
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>
        Delete Account
      </Text>

      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        This will sign you out, revoke your sessions, remove device tokens, and hide your pets and adoption listings. Messages and reports may be retained for safety.
      </Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.label, { color: colors.foreground }]}>
          Type DELETE to confirm
        </Text>

        <TextInput
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          editable={!loading}
          placeholder="DELETE"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              color: colors.foreground,
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
        />

        <Button
          title="Delete Account"
          variant="destructive"
          loading={loading}
          disabled={!canDelete}
          onPress={submit}
        />

        <Button
          title="Cancel"
          variant="ghost"
          disabled={loading}
          onPress={() => router.back()}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    gap: 18,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: "900",
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0,
  },
});
