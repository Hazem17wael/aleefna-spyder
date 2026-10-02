import { apiRequest } from "@/services/apiClient";

export type AppCounts = {
  unread_notifications: number;
  unread_match_chats: number;
  unread_adoption_chats: number;
  pending_adoption_applications: number;
  my_active_applications: number;
  new_matches: number;
  total_match_chats?: number;
  total_adoption_chats?: number;
  owner_pending_applications?: number;
  applicant_pending_applications?: number;
  applicant_approved_applications?: number;
  applicant_withdrawn_applications?: number;
  applicant_rejected_applications?: number;
};

function toCount(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function normalizeAppCounts(payload: unknown): AppCounts {
  const data =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;

  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  return {
    unread_notifications: toCount(record.unread_notifications),
    unread_match_chats: toCount(record.unread_match_chats),
    unread_adoption_chats: toCount(record.unread_adoption_chats),
    pending_adoption_applications: toCount(record.pending_adoption_applications),
    my_active_applications: toCount(record.my_active_applications),
    new_matches: toCount(record.new_matches),
    total_match_chats: toCount(record.total_match_chats),
    total_adoption_chats: toCount(record.total_adoption_chats),
    owner_pending_applications: toCount(record.owner_pending_applications),
    applicant_pending_applications: toCount(record.applicant_pending_applications),
    applicant_approved_applications: toCount(record.applicant_approved_applications),
    applicant_withdrawn_applications: toCount(record.applicant_withdrawn_applications),
    applicant_rejected_applications: toCount(record.applicant_rejected_applications),
  };
}

export async function fetchAppCounts(token: string): Promise<AppCounts> {
  const payload = await apiRequest<Record<string, unknown>>(token, "/api/auth/app-counts", {
    fallbackMessage: "Failed to fetch app counts",
  });

  return normalizeAppCounts(payload);
}
