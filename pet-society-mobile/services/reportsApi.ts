import { apiRequest, getApiErrorMessage } from "@/services/apiClient";
import type { Id, Report, ReportPayload } from "@/types/adoption";

export const REPORT_REASONS = [
  "inappropriate_content",
  "fake_information",
  "suspicious_behavior",
  "harassment",
  "animal_safety",
  "other",
] as const;

export const REPORT_REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  inappropriate_content: "Inappropriate content",
  fake_information: "Fake information",
  suspicious_behavior: "Suspicious behavior",
  harassment: "Harassment",
  animal_safety: "Animal safety",
  other: "Other",
};

export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportTarget = {
  reportable_type: "pet" | "adoption_listing" | "conversation" | "message" | "user" | string;
  reportable_id: Id;
  reported_user_id?: Id | null;
};

const REPORT_ERROR_MESSAGES: Record<string, string> = {
  REPORT_LIMIT_REACHED: "You have reached the report limit for today.",
  UNAUTHORIZED_ADOPTION_ACTION: "This resource cannot be reported.",
};

export function getReportErrorMessage(error: unknown, fallback?: string) {
  return getApiErrorMessage(
    error,
    fallback ?? "We could not submit this report. Please try again.",
    REPORT_ERROR_MESSAGES,
  );
}

export function createReport(token: string, payload: ReportPayload) {
  return apiRequest<Report>(token, "/api/reports", {
    method: "POST",
    body: payload,
    errorCodeMessages: REPORT_ERROR_MESSAGES,
  });
}

export async function getMyReports(token: string) {
  return apiRequest<unknown>(token, "/api/my/reports", {
    errorCodeMessages: REPORT_ERROR_MESSAGES,
  });
}
