import { Platform } from "react-native";

import {
  ApiError,
  apiRequest as sharedApiRequest,
  apiRequestWithFallback,
  getApiErrorMessage,
  getApiValidationErrors,
  normalizeApiData,
} from "@/services/apiClient";
import {
  buildAttachmentFormData,
  normalizeMessageAttachments,
  type ChatLocationMetadata,
  type PendingMessageAttachment,
} from "@/services/chat/messageAttachments";
import type {
  AdoptionApplication,
  AdoptionApplyPayload,
  AdoptionConversation,
  AdoptionMessagesPage,
  AdoptionMessage,
  AdoptionListing,
  CreateAdoptionListingPayload,
  FieldErrors,
  Id,
  NotificationItem,
  PaginatedResult,
  Pet,
  Report,
  ReportPayload,
} from "@/types/adoption";
import { normalizePet } from "@/utils/pets";

export const ADOPTION_ERROR_MESSAGES: Record<string, string> = {
  CANNOT_APPLY_TO_OWN_LISTING: "You cannot apply to adopt your own pet.",
  LISTING_NOT_OPEN: "This listing is no longer accepting applications.",
  ALREADY_APPLIED: "You have already applied for this pet.",
  NOT_LISTING_OWNER: "Only the pet owner can do this action.",
  PET_PROFILE_INCOMPLETE: "Complete the pet profile before listing for adoption.",
  APPLICATION_NOT_PENDING: "This application is no longer pending.",
  APPLICATION_NOT_ACTIONABLE: "This application can no longer be updated.",
  CONTACT_LOCKED_UNTIL_ACCEPTED: "Contact details unlock after acceptance.",
  UNAUTHORIZED_ADOPTION_ACTION: "You are not allowed to do this action.",
  ADOPTION_ALREADY_HAS_ACCEPTED_APPLICATION:
    "This listing already has an accepted applicant.",
  ADOPTION_CHAT_NOT_AVAILABLE:
    "Adoption chat is available after an application is accepted.",
  ADOPTION_CHAT_READ_ONLY:
    "This adoption chat is read-only because the adoption is completed.",
  ADOPTION_CONVERSATION_FORBIDDEN:
    "You are not allowed to access this adoption chat.",
  HANDOVER_NOT_ALLOWED: "Handover confirmation is not available yet.",
  ADOPTION_COMPLETION_NOT_ALLOWED:
    "This adoption cannot be completed from its current state.",
  ADOPTION_LISTING_CANCELLED: "This adoption listing has been removed.",
  ADOPTION_ALREADY_COMPLETED: "This adoption is already complete.",
  PET_OWNERSHIP_CHANGED: "This pet can no longer be transferred from this listing.",
  ACTIVE_ADOPTION_LISTING_EXISTS:
    "Remove this pet from adoption before deleting the pet profile.",
  REPORT_LIMIT_REACHED: "You have reached the report limit for today.",
};

export class AdoptionApiError extends ApiError {
  constructor(params: {
    message: string;
    status: number;
    code?: string;
    errors?: FieldErrors;
    raw?: unknown;
  }) {
    super(params);
    this.name = "AdoptionApiError";
  }
}

export function getAdoptionErrorMessage(error: unknown, fallback?: string) {
  return getApiErrorMessage(
    error,
    fallback ?? "Something went wrong. Please try again.",
    ADOPTION_ERROR_MESSAGES,
  );
}

export function getAdoptionValidationErrors(error: unknown) {
  return getApiValidationErrors(error);
}

export { normalizeApiData };

function apiRequest<T>(
  token: string,
  path: string,
  options: Parameters<typeof sharedApiRequest>[2] = {},
): Promise<T> {
  return sharedApiRequest<T>(token, path, {
    ...options,
    errorCodeMessages: ADOPTION_ERROR_MESSAGES,
  });
}

function buildQuery(params?: Record<string, unknown>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null || value === "" || value === "All") continue;

    if (typeof value === "boolean") {
      if (value) query.append(key, "1");
      continue;
    }

    query.append(key, String(value));
  }

  const asString = query.toString();

  return asString ? `?${asString}` : "";
}

function extractArray<T>(payload: any, preferredKeys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];

  for (const key of preferredKeys) {
    if (Array.isArray(payload?.[key])) return payload[key] as T[];
  }

  if (Array.isArray(payload?.data)) return payload.data as T[];
  if (Array.isArray(payload?.items)) return payload.items as T[];

  return [];
}

function paginated<T>(payload: any, preferredKeys: string[]): PaginatedResult<T> {
  const container =
    Array.isArray(payload) || Array.isArray(payload?.data)
      ? payload
      : payload?.listings ??
        payload?.applications ??
        payload?.notifications ??
        payload?.reports ??
        payload;

  const items = extractArray<T>(container, preferredKeys);
  const currentPage = Number(container?.current_page ?? payload?.current_page ?? 1);
  const lastPage = Number(container?.last_page ?? payload?.last_page ?? currentPage);
  const nextPageUrl = container?.next_page_url ?? payload?.next_page_url;
  const hasMore =
    Boolean(nextPageUrl) ||
    Boolean(container?.has_more ?? payload?.has_more) ||
    currentPage < lastPage;

  return {
    items,
    nextPage: hasMore ? currentPage + 1 : null,
    hasMore,
    raw: payload,
  };
}

function resource<T>(payload: any, keys: string[]): T {
  for (const key of keys) {
    if (payload?.[key] && typeof payload[key] === "object") {
      return payload[key] as T;
    }
  }

  return payload as T;
}

function normalizeAdoptionPet(pet?: Pet | null): Pet | null | undefined {
  if (!pet || typeof pet !== "object") return pet;

  return normalizePet(pet as unknown as Record<string, unknown>) as unknown as Pet;
}

function normalizeAdoptionListing(listing: AdoptionListing): AdoptionListing {
  if (!listing || typeof listing !== "object") return listing;

  return {
    ...listing,
    pet: normalizeAdoptionPet(listing.pet) ?? listing.pet,
  };
}

function normalizeAdoptionApplication(
  application: AdoptionApplication,
): AdoptionApplication {
  if (!application || typeof application !== "object") return application;

  return {
    ...application,
    pet: normalizeAdoptionPet(application.pet) ?? application.pet,
    listing: application.listing
      ? normalizeAdoptionListing(application.listing)
      : application.listing,
    adoption_listing: application.adoption_listing
      ? normalizeAdoptionListing(application.adoption_listing)
      : application.adoption_listing,
  };
}

function normalizeAdoptionConversation(
  conversation: AdoptionConversation,
): AdoptionConversation {
  if (!conversation || typeof conversation !== "object") return conversation;

  return {
    ...conversation,
    pet: normalizeAdoptionPet(conversation.pet) ?? conversation.pet,
    listing: conversation.listing
      ? normalizeAdoptionListing(conversation.listing)
      : conversation.listing,
  };
}

function normalizeListingPage(
  result: PaginatedResult<AdoptionListing>,
): PaginatedResult<AdoptionListing> {
  return {
    ...result,
    items: result.items.map(normalizeAdoptionListing),
  };
}

function normalizeApplicationPage(
  result: PaginatedResult<AdoptionApplication>,
): PaginatedResult<AdoptionApplication> {
  return {
    ...result,
    items: result.items.map(normalizeAdoptionApplication),
  };
}

function normalizeConversationPage(
  result: PaginatedResult<AdoptionConversation>,
): PaginatedResult<AdoptionConversation> {
  return {
    ...result,
    items: result.items.map(normalizeAdoptionConversation),
  };
}

export async function getAdoptionListings(
  token: string,
  params?: Record<string, unknown>,
) {
  const payload = await apiRequest<any>(
    token,
    `/api/adoptions${buildQuery(params)}`,
  );

  return normalizeListingPage(
    paginated<AdoptionListing>(payload, ["adoptions", "listings"]),
  );
}

export async function getAdoptionListing(token: string, id: Id) {
  const payload = await apiRequest<any>(token, `/api/adoptions/${id}`);

  return normalizeAdoptionListing(
    resource<AdoptionListing>(payload, [
      "listing",
      "adoption",
      "adoption_listing",
      "listing",
    ]),
  );
}

export async function createAdoptionListing(
  token: string,
  petId: Id,
  payload: CreateAdoptionListingPayload,
) {
  return apiRequest<any>(token, `/api/pets/${petId}/adoption`, {
    method: "POST",
    body: payload,
  }).then((data) =>
    normalizeAdoptionListing(
      resource<AdoptionListing>(data, [
        "listing",
        "adoption",
        "adoption_listing",
      ]),
    ),
  );
}

export function updateAdoptionListing(
  token: string,
  id: Id,
  payload: Partial<CreateAdoptionListingPayload> & { status?: string },
) {
  return apiRequest<any>(token, `/api/adoptions/${id}`, {
    method: "PATCH",
    body: payload,
  }).then((data) =>
    normalizeAdoptionListing(
      resource<AdoptionListing>(data, [
        "listing",
        "adoption",
        "adoption_listing",
      ]),
    ),
  );
}

export function cancelAdoptionListing(token: string, id: Id) {
  return updateAdoptionListing(token, id, { status: "cancelled" });
}

export function deleteAdoptionListing(token: string, id: Id) {
  return apiRequest<unknown>(token, `/api/adoptions/${id}`, {
    method: "DELETE",
  });
}

export async function applyToAdoptionListing(
  token: string,
  id: Id,
  payload: AdoptionApplyPayload,
) {
  return apiRequest<any>(token, `/api/adoptions/${id}/apply`, {
    method: "POST",
    body: payload,
  }).then((data) =>
    normalizeAdoptionApplication(
      resource<AdoptionApplication>(data, [
        "application",
        "adoption_application",
      ]),
    ),
  );
}

export async function getListingApplications(token: string, id: Id) {
  const payload = await apiRequest<any>(
    token,
    `/api/adoptions/${id}/applications`,
  );

  return normalizeApplicationPage(
    paginated<AdoptionApplication>(payload, ["applications"]),
  );
}

export function shortlistApplication(token: string, id: Id) {
  return apiRequest<any>(
    token,
    `/api/adoption-applications/${id}/shortlist`,
    { method: "PATCH" },
  ).then((data) =>
    normalizeAdoptionApplication(
      resource<AdoptionApplication>(data, [
        "application",
        "adoption_application",
      ]),
    ),
  );
}

export function acceptApplication(token: string, id: Id) {
  return apiRequest<any>(
    token,
    `/api/adoption-applications/${id}/accept`,
    { method: "PATCH" },
  ).then((data) =>
    normalizeAdoptionApplication(
      resource<AdoptionApplication>(data, [
        "application",
        "adoption_application",
      ]),
    ),
  );
}

export function rejectApplication(token: string, id: Id) {
  return apiRequest<any>(
    token,
    `/api/adoption-applications/${id}/reject`,
    { method: "PATCH" },
  ).then((data) =>
    normalizeAdoptionApplication(
      resource<AdoptionApplication>(data, [
        "application",
        "adoption_application",
      ]),
    ),
  );
}

export function withdrawApplication(token: string, id: Id) {
  return apiRequest<any>(
    token,
    `/api/auth/adoption-applications/${id}/withdraw`,
    { method: "POST" },
  ).then((data) =>
    normalizeAdoptionApplication(
      resource<AdoptionApplication>(data, [
        "application",
        "adoption_application",
      ]),
    ),
  );
}

export function confirmOwnerHandover(token: string, listingId: Id) {
  return apiRequest<any>(
    token,
    `/api/adoptions/${listingId}/confirm-owner-handover`,
    { method: "PATCH" },
  ).then((data) =>
    normalizeAdoptionListing(
      resource<AdoptionListing>(data, [
        "listing",
        "adoption",
        "adoption_listing",
      ]),
    ),
  );
}

export function confirmAdopterHandover(token: string, listingId: Id) {
  return apiRequest<any>(
    token,
    `/api/adoptions/${listingId}/confirm-adopter-handover`,
    { method: "PATCH" },
  ).then((data) =>
    normalizeAdoptionListing(
      resource<AdoptionListing>(data, [
        "listing",
        "adoption",
        "adoption_listing",
      ]),
    ),
  );
}

export async function completeAdoptionConversation(token: string, conversationId: Id) {
  const payload = await apiRequest<any>(
    token,
    `/api/auth/adoption-conversations/${conversationId}/complete`,
    { method: "POST" },
  );

  return normalizeAdoptionConversation(
    resource<AdoptionConversation>(payload, [
      "conversation",
      "adoption_conversation",
    ]),
  );
}

export async function createOrGetAdoptionConversation(
  token: string,
  payload: {
    adoption_listing_id?: Id | null;
    adoption_application_id?: Id | null;
    listing_id?: Id | null;
    application_id?: Id | null;
  },
) {
  const data = await apiRequest<any>(token, "/api/auth/adoption-conversations", {
    method: "POST",
    body: payload,
  });

  return normalizeAdoptionConversation(
    resource<AdoptionConversation>(data, [
      "conversation",
      "adoption_conversation",
    ]),
  );
}

export async function getAdoptionConversations(token: string) {
  const payload = await apiRequest<any>(token, "/api/auth/adoption-conversations");

  return normalizeConversationPage(
    paginated<AdoptionConversation>(payload, ["conversations"]),
  );
}

export async function getAdoptionConversation(token: string, conversationId: Id) {
  const payload = await apiRequest<any>(
    token,
    `/api/auth/adoption-conversations/${conversationId}`,
  );

  return normalizeAdoptionConversation(
    resource<AdoptionConversation>(payload, [
      "conversation",
      "adoption_conversation",
    ]),
  );
}

export async function getAdoptionConversationMessages(
  token: string,
  conversationId: Id,
  params?: { cursor?: string | null; limit?: number },
): Promise<AdoptionMessagesPage> {
  const query = buildQuery({
    limit: params?.limit ?? 30,
    cursor: params?.cursor,
  });
  const payload = await apiRequest<any>(
    token,
    `/api/auth/adoption-conversations/${conversationId}/messages${query}`,
  );

  return {
    data: extractArray<AdoptionMessage>(payload, ["messages"]),
    has_more: Boolean(payload?.has_more),
    next_cursor:
      typeof payload?.next_cursor === "string" ? payload.next_cursor : null,
  };
}

export async function sendAdoptionMessage(
  token: string,
  conversationId: Id,
  body: string,
  attachment?: PendingMessageAttachment | null,
  location?: ChatLocationMetadata | null,
) {
  const trimmedBody = body.trim();

  if (attachment) {
    const payload = await apiRequest<any>(
      token,
      `/api/auth/adoption-conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: buildAttachmentFormData({
          body: trimmedBody,
          attachment,
        }),
        skipContentType: true,
      },
    );
    const message = resource<AdoptionMessage>(payload, [
      "message",
      "adoption_message",
    ]);

    return {
      ...message,
      attachments: normalizeMessageAttachments(message),
    };
  }

  if (location) {
    const payload = await apiRequest<any>(
      token,
      `/api/auth/adoption-conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: {
          type: "location",
          body: trimmedBody,
          metadata: location,
        },
      },
    );

    return resource<AdoptionMessage>(payload, ["message", "adoption_message"]);
  }

  const payload = await apiRequest<any>(
    token,
    `/api/auth/adoption-conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: {
        type: "text",
        body: trimmedBody,
      },
    },
  );

  return resource<AdoptionMessage>(payload, ["message", "adoption_message"]);
}

export async function markAdoptionConversationRead(
  token: string,
  conversationId: Id,
) {
  return apiRequest<unknown>(
    token,
    `/api/auth/adoption-conversations/${conversationId}/read`,
    { method: "POST" },
  );
}

export async function getMyAdoptionListings(token: string) {
  const payload = await apiRequest<any>(token, "/api/my/adoption-listings");

  return normalizeListingPage(
    paginated<AdoptionListing>(payload, ["listings", "adoptions"]),
  );
}

export async function getMyAdoptionApplications(token: string) {
  const payload = await apiRequest<any>(token, "/api/my/adoption-applications");

  return normalizeApplicationPage(
    paginated<AdoptionApplication>(payload, ["applications"]),
  );
}

export function registerDeviceToken(
  token: string,
  payload: { token: string; platform?: string; device_id?: string; provider?: string },
) {
  return apiRequestWithFallback(token, ["/api/device-tokens", "/api/auth/device-tokens"], {
    method: "POST",
    body: {
      platform: payload.platform ?? Platform.OS,
      provider: payload.provider ?? "expo",
      ...payload,
    },
  });
}

export function unregisterDeviceToken(
  token: string,
  payload: { token: string },
) {
  return apiRequestWithFallback(
    token,
    ["/api/device-tokens/unregister", "/api/auth/device-tokens/unregister"],
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function getNotifications(token: string) {
  const payload = await apiRequestWithFallback<any>(token, [
    "/api/notifications",
    "/api/auth/notifications",
  ]);

  return paginated<NotificationItem>(payload, ["notifications"]);
}

export function markNotificationRead(token: string, id: Id) {
  return apiRequestWithFallback(token, [
    `/api/notifications/${id}/read`,
    `/api/auth/notifications/${id}/read`,
  ], {
    method: "PATCH",
  });
}

export function markAllNotificationsRead(token: string) {
  return apiRequestWithFallback(token, [
    "/api/notifications/read-all",
    "/api/auth/notifications/read-all",
  ], {
    method: "PATCH",
  });
}

export function createReport(token: string, payload: ReportPayload) {
  return apiRequest<Report>(token, "/api/reports", {
    method: "POST",
    body: payload,
  });
}

export async function getMyReports(token: string) {
  const payload = await apiRequest<any>(token, "/api/my/reports");

  return paginated<Report>(payload, ["reports"]);
}
