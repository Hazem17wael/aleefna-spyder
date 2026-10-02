import type { Pet } from "@/types/pet";
import { devWarn } from "@/utils/logger";
import { normalizePetDocumentFields } from "@/utils/petDocuments";

export function normalizePet<T extends Record<string, unknown>>(pet: T): T {
  return normalizePetDocumentFields(pet);
}

export function normalizePetList(raw: unknown, context: string): Pet[] {
  if (!Array.isArray(raw)) {
    if (raw != null) {
      devWarn(
        `[pets] normalizePetList (${context}): expected array, got`,
        typeof raw,
      );
    }

    return [];
  }

  const dropped: unknown[] = [];
  const out: Pet[] = [];

  for (const item of raw) {
    if (item == null || typeof item !== "object") {
      dropped.push(item);
      continue;
    }

    const id = (item as { id?: unknown }).id;

    if (id == null || id === "") {
      dropped.push(item);
      continue;
    }

    out.push(normalizePet(item as Record<string, unknown>) as unknown as Pet);
  }

  if (dropped.length > 0) {
    devWarn(
      `[pets] normalizePetList (${context}): dropped ${dropped.length} item(s) missing id`,
    );
  }

  return out;
}

export function extractPetArrayFromResponse(json: {
  success?: boolean;
  data?: unknown;
}): unknown[] {
  const d = json?.data;

  if (Array.isArray(d)) return d;

  if (d && typeof d === "object") {
    const o = d as Record<string, unknown>;

    if (Array.isArray(o.pets)) return o.pets;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.items)) return o.items;
  }

  return [];
}
