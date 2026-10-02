import type { PetLike } from "@/types/pet";
import type { MessageAttachment } from "@/services/chat/messageAttachments";

export type Id = string | number;

export type UserMinimal = {
  id: Id;
  name: string;
  avatar?: string | null;
  profile_image?: string | null;
};

export type ContactInfo = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type Pet = PetLike & {
  id: Id;
  active_adoption_listing_id?: Id | null;
  adoption_status?: string | null;
  [key: string]: unknown;
};

export type AdoptionListingStatus =
  | "draft"
  | "open"
  | "paused"
  | "under_review"
  | "adopted"
  | "cancelled"
  | "removed_by_admin"
  | string;

export type AdoptionApplicationStatus =
  | "pending"
  | "shortlisted"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "completed"
  | string;

export type AdoptionListing = {
  id: Id;
  status: AdoptionListingStatus;
  reason?: string | null;
  health_notes?: string | null;
  requirements?: string | null;
  is_vaccinated?: boolean | number | null;
  good_with_kids?: boolean | number | null;
  good_with_pets?: boolean | number | null;
  is_adoption_fee_enabled?: boolean | number | null;
  adoption_fee_amount?: number | string | null;
  adoption_fee_currency?: string | null;
  adoption_fee_label?: string | null;
  distance_km?: number | string | null;
  contact_locked?: boolean | null;
  owner_contact?: ContactInfo | null;
  applicant_contact?: ContactInfo | null;
  is_owner?: boolean;
  has_applied?: boolean;
  current_user_application_id?: Id | null;
  can_apply?: boolean;
  can_manage?: boolean;
  can_confirm_owner_handover?: boolean;
  can_confirm_adopter_handover?: boolean;
  can_complete_adoption?: boolean;
  pet?: Pet | null;
  owner?: UserMinimal | null;
  user?: UserMinimal | null;
  pet_id?: Id | null;
  owner_id?: Id | null;
  applications_count?: number | string | null;
  accepted_application_id?: Id | null;
  accepted_application?: AdoptionApplication | null;
  owner_handover_confirmed_at?: string | null;
  adopter_handover_confirmed_at?: string | null;
  adopted_at?: string | null;
  cancelled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type AdoptionApplication = {
  id: Id;
  status: AdoptionApplicationStatus;
  message?: string | null;
  experience?: string | null;
  home_environment?: string | null;
  has_other_pets?: boolean | number | null;
  can_afford_care?: boolean | number | null;
  contact_locked?: boolean | null;
  phone?: string | null;
  applicant?: UserMinimal | null;
  owner?: UserMinimal | null;
  listing?: AdoptionListing | null;
  adoption_listing?: AdoptionListing | null;
  pet?: Pet | null;
  listing_id?: Id | null;
  adoption_listing_id?: Id | null;
  applicant_contact?: ContactInfo | null;
  owner_contact?: ContactInfo | null;
  can_confirm_adopter_handover?: boolean;
  adoption_conversation?: {
    id: Id;
    status?: string | null;
    is_read_only?: boolean | null;
  } | null;
  adoption_conversation_id?: Id | null;
  created_at?: string | null;
  accepted_at?: string | null;
  completed_at?: string | null;
  [key: string]: unknown;
};

export type AdoptionConversation = {
  id: Id;
  status?: string | null;
  is_read_only?: boolean | null;
  unread_count?: number | string | null;
  adoption_application_id?: Id | null;
  adoption_listing_id?: Id | null;
  owner_id?: Id | null;
  applicant_id?: Id | null;
  application?: Pick<
    AdoptionApplication,
    "id" | "status" | "accepted_at" | "completed_at"
  > | null;
  listing?: AdoptionListing | null;
  pet?: Pet | null;
  owner?: UserMinimal | null;
  applicant?: UserMinimal | null;
  can_confirm_owner_handover?: boolean;
  can_confirm_adopter_handover?: boolean;
  can_complete_adoption?: boolean;
  last_message?: AdoptionMessage | null;
  last_message_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type AdoptionMessage = {
  id: Id;
  adoption_conversation_id: Id;
  sender_id: Id;
  sender?: UserMinimal | null;
  type?: string | null;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
  attachment?: MessageAttachment | null;
  attachments?: MessageAttachment[];
  read_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type AdoptionMessagesPage = {
  data: AdoptionMessage[];
  has_more: boolean;
  next_cursor: string | null;
};

export type NotificationItem = {
  id: Id;
  type?: string | null;
  title?: string | null;
  body?: string | null;
  message?: string | null;
  data?: {
    deep_link?: string;
    deepLink?: string;
    link?: string;
    url?: string;
    type?: string;
    [key: string]: unknown;
  } | null;
  read_at?: string | null;
  is_read?: boolean;
  created_at?: string | null;
  [key: string]: unknown;
};

export type Report = {
  id: Id;
  reason?: string | null;
  details?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export type PaginatedResult<T> = {
  items: T[];
  nextPage: number | null;
  hasMore: boolean;
  raw: unknown;
};

export type FieldErrors = Record<string, string>;

export type AdoptionApplyPayload = {
  message: string;
  experience?: string;
  home_environment?: string;
  has_other_pets: boolean;
  can_afford_care: boolean;
  phone?: string;
};

export type CreateAdoptionListingPayload = {
  reason: string;
  health_notes: string;
  requirements?: string;
  is_vaccinated: boolean;
  good_with_kids: boolean;
  good_with_pets: boolean;
  is_adoption_fee_enabled?: boolean;
  adoption_fee_amount?: number | string | null;
  adoption_fee_currency?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type ReportPayload = {
  reason: string;
  details?: string;
  reportable_type: string;
  reportable_id: Id;
  reported_user_id?: Id | null;
};
