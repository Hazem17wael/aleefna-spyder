import { ApiError, apiRequest } from "@/services/apiClient";
import type { Pet } from "@/types/pet";
import {
  extractPetArrayFromResponse,
  normalizePet,
  normalizePetList,
} from "@/utils/pets";

export type BrowseCursor = {
  distance: number;
  id: number;
};

export type BrowsePetFilters = {
  petId: string | number;
  radius?: string | number;
  limit?: string | number;
  cursor?: BrowseCursor | null;
};

export type BrowsePetsResult = {
  pets: Pet[];
  hasMore: boolean;
  nextCursor: BrowseCursor | null;
};

type BrowsePetsPayload = {
  data?: unknown;
  has_more?: boolean;
  next_cursor?: BrowseCursor | null;
};

function normalizePetDocumentFields(pet: unknown): Pet | null {
  if (!pet || typeof pet !== "object") return null;

  return normalizePet(pet as Record<string, unknown>) as unknown as Pet;
}

function extractPet(payload: unknown): Pet | null {
  if (!payload || typeof payload !== "object") return null;

  const container = payload as { pet?: unknown };

  return normalizePetDocumentFields(container.pet ?? payload);
}

export async function fetchMyPetsRequest(token: string): Promise<Pet[]> {
  const payload = await apiRequest<unknown>(
    token,
    "/api/auth/pets/show-all",
    {
      fallbackMessage: "We could not load your pets. Please try again.",
    },
  );

  const raw = extractPetArrayFromResponse({ data: payload });

  return normalizePetList(raw, "fetchMyPets");
}

export async function fetchPetByIdRequest(
  token: string,
  petId: string | number,
): Promise<Pet> {
  const payload = await apiRequest<unknown>(
    token,
    `/api/pets/${encodeURIComponent(String(petId))}`,
    {
      fallbackMessage: "Pet profile is not available right now.",
    },
  );

  const pet = extractPet(payload);

  if (!pet) {
    throw new ApiError({
      message: "Pet profile response was incomplete.",
      status: 200,
    });
  }

  return pet;
}

export async function fetchBrowsePetsRequest(
  token: string,
  filters: BrowsePetFilters,
): Promise<BrowsePetsResult> {
  const params = new URLSearchParams({
    pet_id: String(filters.petId),
    radius: String(filters.radius ?? 500),
    limit: String(filters.limit ?? 20),
  });

  if (filters.cursor) {
    params.append("cursor_distance", String(filters.cursor.distance));
    params.append("cursor_id", String(filters.cursor.id));
  }

  const payload = await apiRequest<BrowsePetsPayload>(
    token,
    `/api/auth/feed?${params.toString()}`,
    {
      fallbackMessage: "We could not load pets to browse. Please try again.",
    },
  );

  return {
    pets: normalizePetList(payload?.data ?? [], "fetchBrowsePets"),
    hasMore: Boolean(payload?.has_more),
    nextCursor: payload?.next_cursor ?? null,
  };
}

export async function createPetRequest(
  token: string,
  data: FormData,
): Promise<Pet> {
  const payload = await apiRequest<unknown>(token, "/api/auth/pets/store", {
    method: "POST",
    body: data,
    skipContentType: true,
    fallbackMessage: "We could not save this pet. Please try again.",
  });

  const pet = extractPet(payload);

  if (!pet) {
    throw new Error("Pet creation response was incomplete.");
  }

  return pet;
}

export async function updatePetRequest(
  token: string,
  id: string,
  data: FormData,
): Promise<Pet> {
  data.append("_method", "PUT");

  const payload = await apiRequest<unknown>(
    token,
    `/api/auth/pets/update/${id}`,
    {
      method: "POST",
      body: data,
      skipContentType: true,
      fallbackMessage: "We could not update this pet. Please try again.",
    },
  );

  const pet = extractPet(payload);

  if (!pet) {
    throw new Error("Pet update response was incomplete.");
  }

  return pet;
}

export async function deletePetRequest(
  token: string,
  id: string,
): Promise<boolean> {
  await apiRequest<unknown>(token, `/api/auth/pets/delete/${id}`, {
    method: "DELETE",
    fallbackMessage: "We could not delete this pet. Please try again.",
  });

  return true;
}
