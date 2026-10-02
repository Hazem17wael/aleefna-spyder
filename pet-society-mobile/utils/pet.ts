import {
  formatPetType,
  formatPetTypeWithEmoji,
  normalizePetTypeValue,
} from "@/constants/petTypes";
import type { PetLike } from "@/types/pet";

export function resolvePetName(pet?: PetLike | null, fallback = "Pet") {
  return pet?.name ?? pet?.pet_name ?? fallback;
}

export function resolvePetTypeRaw(pet?: PetLike | null) {
  return pet?.type ?? pet?.pet_type ?? null;
}

export function resolvePetType(pet?: PetLike | null) {
  return formatPetType(resolvePetTypeRaw(pet));
}

export function resolvePetTypeWithEmoji(pet?: PetLike | null) {
  return formatPetTypeWithEmoji(resolvePetTypeRaw(pet));
}

export function resolvePetBreed(pet?: PetLike | null, fallback = "") {
  return pet?.breed ?? fallback;
}

const R2_BASE_URL =
  "https://e02b54ab142797de2742a7fcd7fced1d.r2.cloudflarestorage.com/pet-society-media";

/**
 * Ensures an image path from the API is always a full URL.
 * The backend should return full URLs, but if it returns a relative
 * path (e.g. "/pets/images/abc.png"), this builds the full R2 URL.
 */
function resolveImageUrl(raw?: string | null): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  // relative path — prepend R2 base
  return `${R2_BASE_URL}/${raw.replace(/^\/+/, "")}`;
}

export function resolvePetImage(pet?: PetLike | null): string | null {
  const raw =
    pet?.image_url ??
    pet?.image ??
    pet?.images?.[0]?.url ??
    pet?.images?.[0]?.image_path ??
    null;

  return resolveImageUrl(raw);
}

export function resolveOriginalPetName(pet?: PetLike | null) {
  return pet?.name ?? pet?.pet_name ?? "";
}

export function resolveOriginalPetType(pet?: PetLike | null) {
  return normalizePetTypeValue(resolvePetTypeRaw(pet));
}
