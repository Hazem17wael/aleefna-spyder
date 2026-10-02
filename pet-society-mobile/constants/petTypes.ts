export const SUPPORTED_PET_TYPES = [
  {
    label: "Dog",
    value: "Dog",
    emoji: "🐶",
    color: "#ff6b6b",
  },
  {
    label: "Cat",
    value: "Cat",
    emoji: "🐱",
    color: "#6c63ff",
  },
] as const;

export type SupportedPetType = typeof SUPPORTED_PET_TYPES[number]["value"];
export type PetType = SupportedPetType | string;

export const SUPPORTED_PET_TYPE_VALUES = SUPPORTED_PET_TYPES.map(
  (type) => type.value,
);

export const PET_TYPE_FILTER_OPTIONS = [
  "All",
  ...SUPPORTED_PET_TYPE_VALUES,
] as const;

const FALLBACK_PET_TYPE = {
  label: "Unsupported type",
  value: "Unsupported type",
  emoji: "🐾",
  color: "#636e72",
};

export function normalizePetTypeValue(
  type?: string | null,
): SupportedPetType | null {
  const normalized = type?.trim().toLowerCase();

  if (normalized === "dog") return "Dog";
  if (normalized === "cat") return "Cat";

  return null;
}

export function isSupportedPetType(
  type?: string | null,
): boolean {
  return normalizePetTypeValue(type) !== null;
}

export function getPetTypeOption(type?: string | null) {
  const normalized = normalizePetTypeValue(type);

  return (
    SUPPORTED_PET_TYPES.find((item) => item.value === normalized) ??
    FALLBACK_PET_TYPE
  );
}

export function formatPetType(type?: string | null): string {
  if (!type) return "Unknown";

  const option = getPetTypeOption(type);

  if (option.value !== FALLBACK_PET_TYPE.value) {
    return option.label;
  }

  return type.trim() || "Unknown";
}

export function formatPetTypeWithEmoji(type?: string | null): string {
  const label = formatPetType(type);
  const option = getPetTypeOption(type);

  if (label === "Unknown") return label;
  if (option.value === FALLBACK_PET_TYPE.value) return label;

  return `${label} ${option.emoji}`;
}

export function getPetTypeEmoji(type?: string | null): string {
  return getPetTypeOption(type).emoji;
}

export function getPetTypeColor(type?: string | null): string {
  return getPetTypeOption(type).color;
}

export function toApiPetType(type: SupportedPetType): SupportedPetType {
  return type;
}
