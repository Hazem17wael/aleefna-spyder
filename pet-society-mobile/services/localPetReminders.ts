import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { devWarn } from "@/utils/logger";

const LOCAL_REMINDER_SOURCE = "aleefna_local_pet_reminder";
const LOCAL_REMINDER_CHANNEL_ID = "pet-care-reminders";
const LOCAL_REMINDER_STATE_KEY = "aleefna:local-pet-reminders";
const LOCAL_REMINDER_ENABLED_KEY = "aleefna:local-pet-reminders:enabled";
const CARE_STREAK_REMINDER_HOUR = 19;
const CARE_STREAK_REMINDER_MINUTE = 0;

export type LocalPetReminderType =
  | "play"
  | "care_streak"
  | "water"
  | "food"
  | "comeback"
  | "swipe";

type LocalPetReminderMessage = {
  type: LocalPetReminderType;
  title: string;
  body: string;
};

type LocalPetReminderKind = "care_streak" | "random_engagement";

type LocalPetReminderState = {
  lastOpenedAt?: string;
  lastScheduledAt?: string;
  nextReminderAt?: string;
  nextCareStreakReminderAt?: string;
  nextRandomEngagementReminderAt?: string;
  scheduledNotificationIds?: string[];
  careStreakNotificationId?: string;
  randomEngagementNotificationId?: string;
  lastMessageType?: LocalPetReminderType;
  lastCareStreakMessageType?: LocalPetReminderType;
  lastRandomEngagementMessageType?: LocalPetReminderType;
  permissionPromptedAt?: string;
  permissionStatus?: Notifications.PermissionStatus | "unknown";
};

const CARE_STREAK_REMINDER_MESSAGES: LocalPetReminderMessage[] = [
  {
    type: "care_streak",
    title: "Don’t forget today’s Care Streak 🐾",
    body: "Food, water, play, and care keep your pet happy today.",
  },
  {
    type: "care_streak",
    title: "Your pet’s daily care moment is waiting",
    body: "Complete today’s habits and keep the routine going.",
  },
  {
    type: "care_streak",
    title: "Care Streak check-in",
    body: "A tiny care ritual today keeps the streak warm.",
  },
];

export const LOCAL_PET_REMINDER_MESSAGES: LocalPetReminderMessage[] = [
  {
    type: "play",
    title: "Give your pet a little attention today",
    body: "A quick care check can brighten the day.",
  },
  {
    type: "swipe",
    title: "Your pet might be ready for a new friend 🐾",
    body: "Check nearby pets today.",
  },
  {
    type: "comeback",
    title: "See what’s new in Aleefna",
    body: "Open the app for a quick pet-friendly check-in.",
  },
  {
    type: "swipe",
    title: "A quick swipe could lead to a new match",
    body: "Discover nearby pets when you have a minute.",
  },
  {
    type: "swipe",
    title: "New pet friends may be waiting",
    body: "Explore compatible pets around you.",
  },
];

let refreshPromise: Promise<void> | null = null;

function isLocalPetReminderType(value: unknown): value is LocalPetReminderType {
  return (
    value === "play" ||
    value === "care_streak" ||
    value === "water" ||
    value === "food" ||
    value === "comeback" ||
    value === "swipe"
  );
}

function localReminderRoute(type: LocalPetReminderType) {
  if (type === "swipe") return "/(tabs)/swipe";

  return "/(tabs)";
}

export function getLocalPetReminderRoute(data?: Record<string, unknown> | null) {
  const isLocalReminder = data?.source === LOCAL_REMINDER_SOURCE;
  const reminderType = data?.reminder_type;

  if (isLocalReminder && reminderType === "care_streak") {
    return {
      pathname: "/(tabs)",
      params: { focus: "care_streak" },
    };
  }

  const type =
    data?.localReminderType ??
    (data?.source === LOCAL_REMINDER_SOURCE ? data?.type : null);

  if (!isLocalPetReminderType(type)) {
    return isLocalReminder && reminderType === "random_engagement"
      ? { pathname: "/(tabs)" }
      : null;
  }

  return {
    pathname: localReminderRoute(type),
    params:
      type === "play" ||
      type === "care_streak" ||
      type === "water" ||
      type === "food"
        ? { focus: "care_streak" }
        : undefined,
  };
}

async function readState(): Promise<LocalPetReminderState> {
  try {
    const stored = await AsyncStorage.getItem(LOCAL_REMINDER_STATE_KEY);

    if (!stored) return {};

    const parsed = JSON.parse(stored);

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeState(state: LocalPetReminderState) {
  return AsyncStorage.setItem(LOCAL_REMINDER_STATE_KEY, JSON.stringify(state));
}

export async function getLocalPetRemindersEnabled() {
  const stored = await AsyncStorage.getItem(LOCAL_REMINDER_ENABLED_KEY);

  return stored !== "false";
}

export async function setLocalPetRemindersEnabled(enabled: boolean) {
  await AsyncStorage.setItem(
    LOCAL_REMINDER_ENABLED_KEY,
    enabled ? "true" : "false",
  );

  if (!enabled) {
    const state = await readState();

    await cancelScheduledLocalReminders(state);
    await writeState({
      ...state,
      lastOpenedAt: new Date().toISOString(),
      scheduledNotificationIds: [],
      careStreakNotificationId: undefined,
      randomEngagementNotificationId: undefined,
      nextReminderAt: undefined,
      nextCareStreakReminderAt: undefined,
      nextRandomEngagementReminderAt: undefined,
    });

    return;
  }

  await refreshLocalPetReminders();
}

async function configureLocalReminderChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(LOCAL_REMINDER_CHANNEL_ID, {
    name: "Pet care reminders",
    description: "Friendly local reminders for pet care and Aleefna routines.",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: "#ff6b6b",
  });
}

async function ensureLocalReminderPermission(state: LocalPetReminderState) {
  if (Platform.OS === "web") return false;

  const existingPermission = await Notifications.getPermissionsAsync();

  if (existingPermission.status === "granted") return true;

  if (state.permissionPromptedAt || existingPermission.canAskAgain === false) {
    await writeState({
      ...state,
      permissionStatus: existingPermission.status,
    });

    return false;
  }

  const requestedPermission = await Notifications.requestPermissionsAsync();

  await writeState({
    ...state,
    permissionPromptedAt: new Date().toISOString(),
    permissionStatus: requestedPermission.status,
  });

  return requestedPermission.status === "granted";
}

async function cancelScheduledLocalReminders(state: LocalPetReminderState) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const storedIds = new Set(state.scheduledNotificationIds ?? []);

  await Promise.all(
    scheduled
      .filter((notification) => {
        const data = notification.content.data;

        return (
          data?.source === LOCAL_REMINDER_SOURCE ||
          storedIds.has(notification.identifier)
        );
      })
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier),
      ),
  );
}

function nextFriendlyReminderDate(now = new Date()) {
  const reminderDate = new Date(now);
  const hour = 11 + Math.floor(Math.random() * 10);
  const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)];

  reminderDate.setHours(hour, minute, 0, 0);

  if (reminderDate <= now) {
    reminderDate.setDate(reminderDate.getDate() + 1);
  }

  return reminderDate;
}

function nextCareStreakReminderDate(now = new Date()) {
  const reminderDate = new Date(now);

  reminderDate.setHours(
    CARE_STREAK_REMINDER_HOUR,
    CARE_STREAK_REMINDER_MINUTE,
    0,
    0,
  );

  if (reminderDate <= now) {
    reminderDate.setDate(reminderDate.getDate() + 1);
  }

  return reminderDate;
}

function randomReminderMessage(messages: LocalPetReminderMessage[]) {
  const index = Math.floor(Math.random() * messages.length);

  return messages[index];
}

function nextReminderRouteFocus(type: LocalPetReminderType) {
  return type === "play" ||
    type === "care_streak" ||
    type === "water" ||
    type === "food"
    ? "care_streak"
    : undefined;
}

async function scheduleLocalReminder(params: {
  reminderType: LocalPetReminderKind;
  message: LocalPetReminderMessage;
  date: Date;
}) {
  const { reminderType, message, date } = params;
  const deepLink = localReminderRoute(message.type);

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: message.title,
      body: message.body,
      data: {
        source: LOCAL_REMINDER_SOURCE,
        type: message.type,
        localReminderType: message.type,
        reminder_type: reminderType,
        deep_link: deepLink,
        target: nextReminderRouteFocus(message.type),
      },
      sound: true,
      color: "#ff6b6b",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: LOCAL_REMINDER_CHANNEL_ID,
    },
  });

  return identifier;
}

async function scheduleNextLocalReminders(state: LocalPetReminderState) {
  const careMessage = randomReminderMessage(CARE_STREAK_REMINDER_MESSAGES);
  const randomMessage = randomReminderMessage(LOCAL_PET_REMINDER_MESSAGES);
  const careReminderAt = nextCareStreakReminderDate();
  const randomReminderAt = nextFriendlyReminderDate();
  const nowIso = new Date().toISOString();
  const careStreakNotificationId = await scheduleLocalReminder({
    reminderType: "care_streak",
    message: careMessage,
    date: careReminderAt,
  });
  const randomEngagementNotificationId = await scheduleLocalReminder({
    reminderType: "random_engagement",
    message: randomMessage,
    date: randomReminderAt,
  });
  const nextReminderAt =
    careReminderAt < randomReminderAt ? careReminderAt : randomReminderAt;

  await writeState({
    ...state,
    lastOpenedAt: nowIso,
    lastScheduledAt: nowIso,
    nextReminderAt: nextReminderAt.toISOString(),
    nextCareStreakReminderAt: careReminderAt.toISOString(),
    nextRandomEngagementReminderAt: randomReminderAt.toISOString(),
    scheduledNotificationIds: [
      careStreakNotificationId,
      randomEngagementNotificationId,
    ],
    careStreakNotificationId,
    randomEngagementNotificationId,
    lastMessageType: randomMessage.type,
    lastCareStreakMessageType: careMessage.type,
    lastRandomEngagementMessageType: randomMessage.type,
    permissionStatus: Notifications.PermissionStatus.GRANTED,
  });
}

async function refreshLocalPetRemindersInternal() {
  if (Platform.OS === "web") return;

  const state = await readState();
  const remindersEnabled = await getLocalPetRemindersEnabled();

  await configureLocalReminderChannel();

  if (!remindersEnabled) {
    await cancelScheduledLocalReminders(state);
    await writeState({
      ...state,
      lastOpenedAt: new Date().toISOString(),
      scheduledNotificationIds: [],
      careStreakNotificationId: undefined,
      randomEngagementNotificationId: undefined,
      nextReminderAt: undefined,
      nextCareStreakReminderAt: undefined,
      nextRandomEngagementReminderAt: undefined,
    });

    return;
  }

  // Cancel all source-tagged Aleefna local reminders before scheduling the
  // current pair. This preserves one Care Streak and one engagement reminder.
  await cancelScheduledLocalReminders(state);

  const nowIso = new Date().toISOString();
  const hasPermission = await ensureLocalReminderPermission({
    ...state,
    lastOpenedAt: nowIso,
    scheduledNotificationIds: [],
  });

  if (!hasPermission) {
    const latestState = await readState();

    await writeState({
      ...latestState,
      lastOpenedAt: nowIso,
      scheduledNotificationIds: [],
    });

    return;
  }

  await scheduleNextLocalReminders({
    ...state,
    lastOpenedAt: nowIso,
    scheduledNotificationIds: [],
  });
}

export function refreshLocalPetReminders() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = refreshLocalPetRemindersInternal()
    .catch((error) => {
      devWarn("[LocalReminders] Could not refresh reminders.", error);
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}
