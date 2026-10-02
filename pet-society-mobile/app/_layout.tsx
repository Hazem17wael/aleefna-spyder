import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FirstRunOnboarding } from "@/components/FirstRunOnboarding";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { PetsProvider } from "@/context/PetsContext";
import { GlobalMatchProvider } from "@/context/GlobalMatchContext";
import { InAppMessageBanner } from "@/components/InAppMessageBanner";
import {
  getLocalPetReminderRoute,
  refreshLocalPetReminders,
} from "@/services/localPetReminders";
import { initializePushNotifications } from "@/services/pushNotifications";
import { getAuthRouteAvailability } from "@/src/features/auth/routing/authGuard";
import { normalizeAppDeepLink } from "@/utils/adoptionDeepLinks";
import { resolveNotificationRoute } from "@/src/features/notifications/utils/notificationRoutes";
import {
  consumePendingDeepLink,
  storePendingDeepLink,
  type PendingDeepLinkDestination,
} from "@/services/pendingDeepLink";
import {
  captureBoundaryError,
  initializeMonitoring,
  wrapRootComponent,
} from "@/services/monitoring";
import { markLiveDebugPushReceived } from "@/services/liveDebug";

initializeMonitoring();
SplashScreen.preventAutoHideAsync();
initializePushNotifications();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const replayedPendingLinkRef = useRef(false);
  const handledNotificationResponseIdsRef = useRef<Set<string>>(new Set());
  const { canUseAuthRoutes, canUseProtectedRoutes } = getAuthRouteAvailability({
    isAuthenticated,
    isLoading,
  });

  const openProtectedDestination = useCallback(
    async (destination: PendingDeepLinkDestination | null) => {
      if (!destination) return;

      if (isLoading || !isAuthenticated) {
        await storePendingDeepLink(destination);

        if (!isLoading) {
          router.replace("/");
        }

        return;
      }

      router.push(destination as never);
    },
    [isAuthenticated, isLoading, router],
  );

  useEffect(() => {
    function openResponse(response: Notifications.NotificationResponse | null) {
      const responseId = response?.notification.request.identifier;

      if (responseId) {
        if (handledNotificationResponseIdsRef.current.has(responseId)) {
          return;
        }

        handledNotificationResponseIdsRef.current.add(responseId);
      }

      const data = response?.notification.request.content.data;
      const localReminderRoute = getLocalPetReminderRoute(data);

      if (localReminderRoute) {
        void openProtectedDestination(localReminderRoute);
        return;
      }

      const route = resolveNotificationRoute(data);
      void openProtectedDestination(route);
      markLiveDebugPushReceived(
        typeof route === "string" ? route : route?.pathname ?? null,
      );
    }

    const sub = Notifications.addNotificationResponseReceivedListener(openResponse);

    Notifications.getLastNotificationResponseAsync()
      .then(openResponse)
      .catch(() => {});

    return () => sub.remove();
  }, [openProtectedDestination]);

  useEffect(() => {
    function storeLoggedOutUrl(url: string | null) {
      const deepLink = normalizeAppDeepLink(url);

      if (!deepLink || isAuthenticated) return;

      void storePendingDeepLink(deepLink).then(() => {
        if (!isLoading) {
          router.replace("/");
        }
      });
    }

    Linking.getInitialURL()
      .then(storeLoggedOutUrl)
      .catch(() => {});

    const sub = Linking.addEventListener("url", ({ url }) => {
      storeLoggedOutUrl(url);
    });

    return () => sub.remove();
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || replayedPendingLinkRef.current) return;

    replayedPendingLinkRef.current = true;

    consumePendingDeepLink()
      .then((destination) => {
        if (destination) {
          router.replace(destination as never);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    refreshLocalPetReminders();

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        refreshLocalPetReminders();
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="forgot-password" />

      <Stack.Protected guard={canUseAuthRoutes}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>

      <Stack.Protected guard={canUseProtectedRoutes}>
        <Stack.Screen name="home" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="account/delete" />
        <Stack.Screen name="add-pet" />
        <Stack.Screen name="adopt/[id]/apply" />
        <Stack.Screen name="adopt/[id]/index" />
        <Stack.Screen name="adoption/create-pet-first" />
        <Stack.Screen name="adoption/select-pet" />
        <Stack.Screen name="adoption/list-existing/[petId]" />
        <Stack.Screen name="adoption-chat/[conversationId]" />
        <Stack.Screen name="adoptions/[id]/applications" />
        <Stack.Screen
          name="chat/[matchId]"
          options={{
            animation: "slide_from_right",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen name="my-adoption-applications/[id]" />
        <Stack.Screen name="my-adoption-applications/index" />
        <Stack.Screen name="my-adoption-listings/index" />
        <Stack.Screen name="my-adoption-listings/[id]/applications" />
        <Stack.Screen name="my-adoption-listings/[id]/index" />
        <Stack.Screen name="pets/[petId]" />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="reports/create" />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary onError={captureBoundaryError}>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <PetsProvider>
                  <GlobalMatchProvider>
                    <StatusBar style="auto" />

                    <RootLayoutNav />
                    <FirstRunOnboarding />

                    <InAppMessageBanner />
                  </GlobalMatchProvider>
                </PetsProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default wrapRootComponent(RootLayout);
