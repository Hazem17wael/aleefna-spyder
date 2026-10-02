import {
  clearCareWidgetSnapshot,
  syncCareWidgetSnapshotFromStorage,
} from "@/services/careWidget";
import type { Pet } from "@/types/pet";

export function clearPetsCareWidgetSnapshot() {
  clearCareWidgetSnapshot();
}

export function syncPetsCareWidgetSnapshot(params: {
  enabled: boolean;
  userId?: string | number;
  pets: Pet[];
}) {
  if (!params.enabled) return Promise.resolve();

  return syncCareWidgetSnapshotFromStorage({
    userId: params.userId,
    pets: params.pets,
  });
}
