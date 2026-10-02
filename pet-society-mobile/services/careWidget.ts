import AsyncStorage from "@react-native-async-storage/async-storage";

const CARE_WIDGET_TOTAL_COUNT = 4;

type CareHabitKey = "food" | "water" | "play" | "care";

type CareStateLike = {
  completedHabits?: unknown;
  streakCount?: unknown;
};

type PetLike = {
  id?: string | number | null;
  name?: string | null;
  pet_name?: string | null;
};

export type CareWidgetSnapshot = {
  petName: string | null;
  streakCount: number;
  completedCount: number;
  totalCount: 4;
  completedHabits: string[];
  updatedAt: string;
};

const habitLabels: Record<CareHabitKey, string> = {
  food: "Food",
  water: "Water",
  play: "Play",
  care: "Care",
};

function resolvePetName(pet?: PetLike | null) {
  const value = pet?.name ?? pet?.pet_name ?? null;

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function careStorageKey(userId?: string | number | null, petId?: string | number | null) {
  if (userId && petId != null) {
    return `aleefna:care-streak:user:${userId}:pet:${petId}`;
  }

  if (userId) {
    return `aleefna:care-streak:user:${userId}:general`;
  }

  return "aleefna:care-streak:guest";
}

function normalizeCompletedHabits(raw: unknown) {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is CareHabitKey => {
      return (
        item === "food" ||
        item === "water" ||
        item === "play" ||
        item === "care"
      );
    })
    .map((key) => habitLabels[key]);
}

function normalizeStreakCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

export function makeCareWidgetSnapshot({
  petName,
  careState,
}: {
  petName: string | null;
  careState?: CareStateLike | null;
}): CareWidgetSnapshot {
  const completedHabits = normalizeCompletedHabits(careState?.completedHabits);

  return {
    petName,
    streakCount: normalizeStreakCount(careState?.streakCount),
    completedCount: completedHabits.length,
    totalCount: CARE_WIDGET_TOTAL_COUNT,
    completedHabits,
    updatedAt: new Date().toISOString(),
  };
}

export function updateCareWidgetSnapshot(_snapshot: CareWidgetSnapshot) {}

export function clearCareWidgetSnapshot() {}

export async function syncCareWidgetSnapshotFromStorage({
  userId,
  pets,
}: {
  userId?: string | number | null;
  pets: PetLike[];
}) {
  const activePet = pets[0] ?? null;
  const petName = resolvePetName(activePet);
  const key = careStorageKey(userId, activePet?.id);
  let careState: CareStateLike | null = null;

  try {
    const stored = await AsyncStorage.getItem(key);

    if (stored) {
      const parsed = JSON.parse(stored);
      careState = parsed && typeof parsed === "object" ? parsed : null;
    }
  } catch {
    careState = null;
  }

  updateCareWidgetSnapshot(makeCareWidgetSnapshot({ petName, careState }));
}
