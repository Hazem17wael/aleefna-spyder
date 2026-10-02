import { apiRequest } from "@/services/apiClient";
import type { Match } from "@/context/PetsContext";
import { normalizeMatchDocuments } from "@/src/features/matches/api/matchesApi";

export type SwipePetRequest = {
  fromPetId: string;
  toPetId: string;
};

export type LikePetResult = {
  matched: boolean;
  match?: Match;
};

type LikePetPayload = {
  matched?: boolean;
  match?: Match | null;
};

export async function likePetRequest(
  token: string,
  params: SwipePetRequest,
): Promise<LikePetResult> {
  const payload = await apiRequest<LikePetPayload>(
    token,
    "/api/auth/swipe/like",
    {
      method: "POST",
      body: {
        from_pet_id: params.fromPetId,
        to_pet_id: params.toPetId,
      },
      fallbackMessage: "We could not like this pet. Please try again.",
    },
  );

  if (payload?.matched && payload?.match) {
    return {
      matched: true,
      match: normalizeMatchDocuments(payload.match),
    };
  }

  return { matched: false };
}

export async function dislikePetRequest(
  token: string,
  params: SwipePetRequest,
): Promise<void> {
  await apiRequest<unknown>(token, "/api/auth/swipe/dislike", {
    method: "POST",
    body: {
      from_pet_id: params.fromPetId,
      to_pet_id: params.toPetId,
    },
    fallbackMessage: "We could not pass on this pet. Please try again.",
  });
}
