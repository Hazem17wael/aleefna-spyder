import { normalizePetTypeValue } from "@/constants/petTypes";

export const DOG_BREEDS = [
  "Golden Retriever",
  "Labrador Retriever",
  "German Shepherd",
  "Husky",
  "Rottweiler",
  "Pitbull",
  "Doberman",
  "Poodle",
  "Beagle",
  "Cocker Spaniel",
  "Shih Tzu",
  "Pomeranian",
  "Chihuahua",
  "Bulldog",
  "Boxer",
  "Great Dane",
  "Dalmatian",
  "Border Collie",
  "Maltese",
  "Mixed Breed",
  "Other",
] as const;

export const CAT_BREEDS = [
  "Persian",
  "Siamese",
  "British Shorthair",
  "Scottish Fold",
  "Maine Coon",
  "Bengal",
  "Ragdoll",
  "Sphynx",
  "Russian Blue",
  "Abyssinian",
  "Birman",
  "Himalayan",
  "Turkish Angora",
  "Egyptian Mau",
  "Domestic Shorthair",
  "Domestic Longhair",
  "Mixed Breed",
  "Other",
] as const;

export const PET_BREEDS_BY_TYPE = {
  Dog: DOG_BREEDS,
  Cat: CAT_BREEDS,
} as const;

export type DogBreed = typeof DOG_BREEDS[number];
export type CatBreed = typeof CAT_BREEDS[number];
export type PetBreed = DogBreed | CatBreed;

export function getPetBreedsForType(
  type?: string | null,
): readonly PetBreed[] {
  const normalized = normalizePetTypeValue(type);

  return normalized ? PET_BREEDS_BY_TYPE[normalized] : [];
}

export function isBreedForPetType(
  breed?: string | null,
  type?: string | null,
): boolean {
  const value = breed?.trim();

  return Boolean(value && getPetBreedsForType(type).includes(value as PetBreed));
}

export function getBreedOptionsForType(
  type?: string | null,
  currentBreed?: string | null,
): string[] {
  const breeds = [...getPetBreedsForType(type)];
  const current = currentBreed?.trim();

  if (current && !breeds.includes(current as PetBreed)) {
    return [current, ...breeds];
  }

  return breeds;
}
