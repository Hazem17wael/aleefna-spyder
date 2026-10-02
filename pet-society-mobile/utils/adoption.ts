import type { AdoptionApplication, AdoptionListing, ContactInfo, Id, Pet } from "@/types/adoption";
import { PET_TYPE_FILTER_OPTIONS } from "@/constants/petTypes";
import {
  resolvePetBreed,
  resolvePetImage,
  resolvePetName,
  resolvePetTypeWithEmoji,
} from "@/utils/pet";

export const ADOPTION_ACTIVE_STATUSES = ["draft", "open", "paused", "under_review"];

export const ADOPTION_PET_TYPES = [...PET_TYPE_FILTER_OPTIONS];

export const ADOPTION_REASONS = [
  "inappropriate_content",
  "fake_information",
  "suspicious_behavior",
  "harassment",
  "animal_safety",
  "other",
];

export const ADOPTION_DEFAULT_FEE_CURRENCY = "EGP";

export const ADOPTION_PAYMENT_DISCLAIMER =
  "Payment is arranged directly between adopter and owner. Aleefna does not process payments yet.";

export function asBool(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function formatFeeAmount(value?: number | string | null) {
  if (value == null || value === "") return null;

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) return null;

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function formatAdoptionFee(listing?: AdoptionListing | null) {
  if (listing?.adoption_fee_label) {
    return listing.adoption_fee_label === "Free adoption" ||
      listing.adoption_fee_label.startsWith("Adoption fee:")
      ? listing.adoption_fee_label
      : `Adoption fee: ${listing.adoption_fee_label}`;
  }

  if (!asBool(listing?.is_adoption_fee_enabled)) return "Free adoption";

  const amount = formatFeeAmount(listing?.adoption_fee_amount);

  if (!amount) return "Free adoption";

  return `Adoption fee: ${amount} ${
    listing?.adoption_fee_currency || ADOPTION_DEFAULT_FEE_CURRENCY
  }`;
}

export function hasAdoptionFee(listing?: AdoptionListing | null) {
  if (listing?.adoption_fee_label) {
    return listing.adoption_fee_label !== "Free adoption";
  }

  if (!asBool(listing?.is_adoption_fee_enabled)) return false;

  const amount = Number(listing?.adoption_fee_amount);

  return Number.isFinite(amount) && amount > 0;
}

export function petName(pet?: Pet | null) {
  return resolvePetName(pet);
}

export function petType(pet?: Pet | null) {
  return resolvePetTypeWithEmoji(pet);
}

export function petBreed(pet?: Pet | null) {
  return resolvePetBreed(pet) || "Mixed breed";
}

export function petGender(pet?: Pet | null) {
  return pet?.gender || "Unknown";
}

export function petImage(pet?: Pet | null) {
  return resolvePetImage(pet);
}

export function petAgeLabel(age?: string | number | null) {
  if (age == null || age === "") return "Age unknown";

  const value = Number(age);

  if (!Number.isFinite(value)) return String(age);

  return `${value} yr${value === 1 ? "" : "s"}`;
}

export function distanceLabel(distance?: string | number | null) {
  if (distance == null || distance === "") return null;

  const value = Number(distance);

  if (!Number.isFinite(value)) return null;

  return `${value.toFixed(value < 10 ? 1 : 0)} km away`;
}

export function formatDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimeAgo(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days}d ago`;

  return formatDate(value);
}

export function statusLabel(status?: string | null) {
  if (!status) return "Unknown";

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function statusColor(status?: string | null) {
  switch (status) {
    case "open":
    case "accepted":
    case "adopted":
    case "completed":
      return "#00a86b";
    case "pending":
    case "draft":
    case "under_review":
      return "#f59f00";
    case "shortlisted":
      return "#6c63ff";
    case "rejected":
    case "removed_by_admin":
      return "#e53935";
    case "paused":
    case "withdrawn":
    case "cancelled":
      return "#7a7a7a";
    default:
      return "#7a7a7a";
  }
}

export function isActiveAdoptionStatus(status?: string | null) {
  return Boolean(status && ADOPTION_ACTIVE_STATUSES.includes(status));
}

export function isPetCompleteForAdoption(pet?: Pet | null) {
  return Boolean(
    pet &&
      petImage(pet) &&
      petType(pet) &&
      pet.age != null &&
      pet.gender &&
      pet.latitude != null &&
      pet.longitude != null,
  );
}

export function listingPetId(listing?: AdoptionListing | null): Id | null {
  return listing?.pet?.id ?? listing?.pet_id ?? null;
}

export function listingOwner(listing?: AdoptionListing | null) {
  return listing?.owner ?? listing?.user ?? null;
}

export function applicationListing(application?: AdoptionApplication | null) {
  return application?.listing ?? application?.adoption_listing ?? null;
}

export function applicationListingId(application?: AdoptionApplication | null) {
  const listing = applicationListing(application);

  return application?.listing_id ?? application?.adoption_listing_id ?? listing?.id ?? null;
}

export function applicationConversationId(application?: AdoptionApplication | null) {
  return application?.adoption_conversation_id ?? application?.adoption_conversation?.id ?? null;
}

export function applicationPet(application?: AdoptionApplication | null) {
  return application?.pet ?? applicationListing(application)?.pet ?? null;
}

export function applicationOwner(application?: AdoptionApplication | null) {
  return application?.owner ?? listingOwner(applicationListing(application));
}

export function canManageListing(listing?: AdoptionListing | null, currentUserId?: Id | null) {
  if (!listing) return false;
  if (typeof listing.can_manage === "boolean") return listing.can_manage;
  if (typeof listing.is_owner === "boolean") return listing.is_owner;

  const owner = listingOwner(listing);

  return Boolean(currentUserId && owner?.id != null && String(owner.id) === String(currentUserId));
}

export function canApplyToListing(listing?: AdoptionListing | null, currentUserId?: Id | null) {
  if (!listing) return false;
  if (typeof listing.can_apply === "boolean") return listing.can_apply;
  if (listing.status !== "open") return false;

  return !canManageListing(listing, currentUserId) && !listing.has_applied;
}

export function contactLines(contact?: ContactInfo | null) {
  if (!contact) return [];

  return [
    contact.name ? { label: "Name", value: contact.name } : null,
    contact.phone ? { label: "Phone", value: contact.phone } : null,
    contact.email ? { label: "Email", value: contact.email } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

export function getApplicantName(application?: AdoptionApplication | null) {
  return application?.applicant?.name ?? "Applicant";
}

export function getApplicantAvatar(application?: AdoptionApplication | null) {
  return application?.applicant?.avatar ?? application?.applicant?.profile_image ?? null;
}
