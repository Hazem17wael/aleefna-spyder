import { ApiError } from "@/services/apiClient";
import { fetchPetByIdRequest } from "@/src/features/pets/api/petsApi";
import type { Pet } from "@/types/pet";

export class PetsApiError extends ApiError {
  constructor(message: string, status: number) {
    super({ message, status });
    this.name = "PetsApiError";
  }
}

export async function fetchPetById(
  token: string,
  petId: string | number,
): Promise<Pet> {
  try {
    return await fetchPetByIdRequest(token, petId);
  } catch (error) {
    if (error instanceof ApiError) {
      throw new PetsApiError(error.message, error.status);
    }

    throw error;
  }
}
