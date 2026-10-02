import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { devError, devWarn } from "@/utils/logger";
import { explainNotificationPermission } from "@/utils/permissions";
import {
    getActiveAdoptionConversationId,
    getActiveConversationId,
} from "@/services/inAppMessageBus";

const EAS_PROJECT_ID = "44a1e2a4-468e-4760-b3f7-fa13ecee3fac";
const NOTIFICATION_PERMISSION_EXPLAINED_KEY =
    "notification_permission_explained";
const NOTIFICATION_PERMISSION_DECLINED_KEY =
    "notification_permission_declined";

let pushTokenRequest: Promise<string | null> | null = null;

const MATCH_NOTIFICATION_TYPES = new Set(["match.created"]);
const MESSAGE_NOTIFICATION_TYPES = new Set([
    "message",
    "chat",
    "conversation",
    "message.sent",
    ".message.sent",
    "message.created",
    ".message.created",
]);
const ADOPTION_MESSAGE_NOTIFICATION_TYPES = new Set([
    "adoption_conversation",
    "adoption_message",
    "adoption.message.sent",
    ".adoption.message.sent",
]);
const CARE_REMINDER_TYPES = new Set([
    "play",
    "care_streak",
    "water",
    "food",
    "comeback",
    "swipe",
]);

const LOCAL_REMINDER_SOURCE = "aleefna_local_pet_reminder";

const SUPPRESS_FOREGROUND_NOTIFICATION = {
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
} as Notifications.NotificationBehavior;

const SHOW_FOREGROUND_NOTIFICATION = {
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
} as Notifications.NotificationBehavior;

function stringValue(value: unknown) {
    return typeof value === "string" ? value : null;
}

function idValue(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.trim()) return value.trim();

    return null;
}

function nestedRecord(value: unknown) {
    return value && typeof value === "object"
        ? value as Record<string, unknown>
        : null;
}

function firstId(data: Record<string, unknown>, keys: string[]) {
    const nested = nestedRecord(data.data);
    const records = [data, nested].filter(Boolean) as Array<Record<string, unknown>>;

    for (const record of records) {
        for (const key of keys) {
            const value = idValue(record[key]);

            if (value) return value;
        }
    }

    return null;
}

function isViewingSameNormalChat(data: Record<string, unknown>) {
    const conversationId = firstId(data, ["conversation_id", "conversationId"]);
    const activeConversationId = getActiveConversationId();

    return Boolean(
        conversationId &&
        activeConversationId != null &&
        String(activeConversationId) === String(conversationId),
    );
}

function isViewingSameAdoptionChat(data: Record<string, unknown>) {
    const conversationId = firstId(data, [
        "adoption_conversation_id",
        "adoptionConversationId",
    ]);
    const activeConversationId = getActiveAdoptionConversationId();

    return Boolean(
        conversationId &&
        activeConversationId != null &&
        String(activeConversationId) === String(conversationId),
    );
}

export function getForegroundNotificationBehavior(
    notification: Notifications.Notification,
): Notifications.NotificationBehavior {
    const data = notification.request.content.data ?? {};
    const type = stringValue(data.type);
    const source = stringValue(data.source);

    /**
     * Foreground policy:
     * - Matches are suppressed because realtime match UI handles active app UX.
     * - Messages show a foreground banner/list entry with sound and badge.
     * - Care reminders show a foreground banner/list entry with sound and badge.
     * - Unknown notification types remain visible to avoid losing server notices.
     */
    if (type && MATCH_NOTIFICATION_TYPES.has(type)) {
        return SUPPRESS_FOREGROUND_NOTIFICATION;
    }

    if (type && MESSAGE_NOTIFICATION_TYPES.has(type)) {
        if (isViewingSameNormalChat(data)) {
            return SUPPRESS_FOREGROUND_NOTIFICATION;
        }

        return SHOW_FOREGROUND_NOTIFICATION;
    }

    if (type && ADOPTION_MESSAGE_NOTIFICATION_TYPES.has(type)) {
        if (isViewingSameAdoptionChat(data)) {
            return SUPPRESS_FOREGROUND_NOTIFICATION;
        }

        return SHOW_FOREGROUND_NOTIFICATION;
    }

    if (
        source === LOCAL_REMINDER_SOURCE ||
        (type && CARE_REMINDER_TYPES.has(type))
    ) {
        return SHOW_FOREGROUND_NOTIFICATION;
    }

    return SHOW_FOREGROUND_NOTIFICATION;
}

Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        return getForegroundNotificationBehavior(notification);
    },
});

export function initializePushNotifications() {
    return true;
}

async function configureAndroidNotificationChannel() {
    if (Platform.OS !== "android") return;

    await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#ffffff",
        sound: "dog_bark_cute_sound.wav",
    });
}

async function hasNotificationPermission(requestPermission: boolean) {
    const existingPermission = await Notifications.getPermissionsAsync();

    if (existingPermission.status === "granted") {
        await AsyncStorage.removeItem(NOTIFICATION_PERMISSION_DECLINED_KEY);
        return true;
    }

    if (!requestPermission || existingPermission.canAskAgain === false) {
        return false;
    }

    const declined = await AsyncStorage.getItem(
        NOTIFICATION_PERMISSION_DECLINED_KEY,
    );

    if (declined === "true") {
        return false;
    }

    const explained = await AsyncStorage.getItem(
        NOTIFICATION_PERMISSION_EXPLAINED_KEY,
    );

    if (explained !== "true") {
        const shouldAsk = await explainNotificationPermission();
        await AsyncStorage.setItem(NOTIFICATION_PERMISSION_EXPLAINED_KEY, "true");

        if (!shouldAsk) {
            await AsyncStorage.setItem(NOTIFICATION_PERMISSION_DECLINED_KEY, "true");
            return false;
        }
    }

    const requestedPermission = await Notifications.requestPermissionsAsync();

    if (requestedPermission.status === "granted") {
        await AsyncStorage.removeItem(NOTIFICATION_PERMISSION_DECLINED_KEY);
        return true;
    }

    await AsyncStorage.setItem(NOTIFICATION_PERMISSION_DECLINED_KEY, "true");
    return false;
}

async function readExpoPushToken(requestPermission: boolean): Promise<string | null> {
    try {
        if (!Device.isDevice) {
            devWarn("[Push] Physical device is required for push notifications.");
            return null;
        }

        const canUseNotifications = await hasNotificationPermission(requestPermission);

        if (!canUseNotifications) {
            devWarn("[Push] Notification permission was not granted.");
            return null;
        }

        await configureAndroidNotificationChannel();

        const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ??
            Constants.easConfig?.projectId ??
            EAS_PROJECT_ID;

        const token = await Notifications.getExpoPushTokenAsync({
            projectId,
        });

        return token.data;
    } catch {
        devError("[Push] getExpoPushToken failed.");
        return null;
    }
}

export async function getExpoPushToken(): Promise<string | null> {
    if (pushTokenRequest) return pushTokenRequest;

    pushTokenRequest = readExpoPushToken(true).finally(() => {
        pushTokenRequest = null;
    });

    return pushTokenRequest;
}

export function getExistingExpoPushToken(): Promise<string | null> {
    return readExpoPushToken(false);
}

export async function getNotificationPermissionStatus(): Promise<string> {
    try {
        const permission = await Notifications.getPermissionsAsync();

        return permission.status;
    } catch {
        devError("[Push] getNotificationPermissionStatus failed.");
        return "unknown";
    }
}
