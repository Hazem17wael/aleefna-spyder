import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { View, ActivityIndicator, Text } from "react-native";
import { useColors } from "@/hooks/useColors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { ONBOARDING_COMPLETE_KEY } from "@/utils/onboarding";

export default function RootIndex() {
  const { isAuthenticated, isLoading } = useAuth();
  const colors = useColors();
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
      .then((value) => setOnboardingComplete(value === "true"))
      .finally(() => setCheckedOnboarding(true));
  }, []);

  if (isLoading || !checkedOnboarding) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, gap: 10 }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
          Preparing your profile...
        </Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href={onboardingComplete ? "/login" : "/onboarding"} />;
  }

  return <Redirect href="/(tabs)" />;
}
