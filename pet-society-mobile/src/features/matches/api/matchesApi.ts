import { apiRequest } from "@/services/apiClient";
import type { Match } from "@/context/PetsContext";
import type { Pet } from "@/types/pet";
import { normalizePet } from "@/utils/pets";
import { devWarn } from "@/utils/logger";

function extractMatchArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const container = payload as Record<string, unknown>;

    if (Array.isArray(container.matches)) return container.matches;
    if (Array.isArray(container.data)) return container.data;
    if (Array.isArray(container.items)) return container.items;
  }

  return [];
}

function normalizePetDocuments(pet: Pet): Pet {
  return normalizePet(pet as unknown as Record<string, unknown>) as unknown as Pet;
}

export function normalizeMatchDocuments(match: Match): Match {
  return {
    ...match,
    pet_one: match.pet_one ? normalizePetDocuments(match.pet_one) : match.pet_one,
    pet_two: match.pet_two ? normalizePetDocuments(match.pet_two) : match.pet_two,
    my_pet: match.my_pet ? normalizePetDocuments(match.my_pet) : match.my_pet,
    matched_pet: match.matched_pet
      ? normalizePetDocuments(match.matched_pet)
      : match.matched_pet,
  };
}

export function normalizeMatches(raw: unknown, context: string): Match[] {
  if (!Array.isArray(raw)) {
    if (raw != null) {
      devWarn(
        `[matchesApi] normalizeMatches (${context}): expected array, got`,
        typeof raw,
      );
    }

    return [];
  }

  return raw
    .filter(
      (item): item is Match =>
        item != null &&
        typeof item === "object" &&
        (item as { id?: unknown }).id != null,
    )
    .map(normalizeMatchDocuments);
}

export async function fetchMatchesRequest(token: string): Promise<Match[]> {
  const payload = await apiRequest<unknown>(token, "/api/auth/matches", {
    fallbackMessage: "We could not load your matches. Please try again.",
  });

  return normalizeMatches(extractMatchArray(payload), "fetchMatches");
}
