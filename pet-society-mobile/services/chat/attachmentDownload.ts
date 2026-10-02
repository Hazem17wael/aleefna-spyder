import * as FileSystem from "expo-file-system/legacy";

import { apiUrl } from "@/config/realtime";
import { handleUnauthorizedResponse } from "@/services/apiClient";
import type { MessageAttachment } from "@/services/chat/messageAttachments";

export type AttachmentConversationScope = {
  kind: "match" | "adoption";
  conversationId: string | number;
};

const CACHE_DIR = `${FileSystem.cacheDirectory ?? ""}chat-attachments/`;

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function extensionFromMime(mimeType: string, fallback: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") return "m4a";
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") return "wav";
  if (mimeType === "audio/webm") return "webm";
  if (mimeType === "audio/aac") return "aac";

  return fallback;
}

function attachmentExtension(attachment: MessageAttachment) {
  const mimeType = firstString(attachment.mime_type) ?? "";
  const name = firstString(attachment.original_name, attachment.file_name);
  const fromName = name?.includes(".") ? name.split(".").pop()?.toLowerCase() : null;

  if (fromName) return fromName.replace(/[^a-z0-9]+/gi, "") || "bin";

  if (attachment.type === "image") {
    return extensionFromMime(mimeType, "jpg");
  }

  if (attachment.type === "pdf") {
    return extensionFromMime(mimeType, "pdf");
  }

  if (attachment.type === "voice") {
    return extensionFromMime(mimeType, "m4a");
  }

  return extensionFromMime(mimeType, "bin");
}

function cacheId(attachment: MessageAttachment, url: string) {
  if (attachment.id != null && String(attachment.id).trim()) {
    return String(attachment.id).replace(/[^a-zA-Z0-9._-]+/g, "_");
  }

  let hash = 0;

  for (let index = 0; index < url.length; index += 1) {
    hash = (hash << 5) - hash + url.charCodeAt(index);
    hash |= 0;
  }

  return `url-${Math.abs(hash).toString(36)}`;
}

export function resolveAttachmentDownloadUrl(
  attachment: MessageAttachment,
  scope?: AttachmentConversationScope,
): string | null {
  const direct = firstString(attachment.download_url);

  if (direct) {
    if (/^https?:\/\//i.test(direct)) return direct;

    const normalizedPath = direct.startsWith("/") ? direct : `/${direct}`;

    return apiUrl(normalizedPath);
  }

  if (attachment.id == null || !scope) return null;

  const path =
    scope.kind === "adoption"
      ? `/api/auth/adoption-conversations/${scope.conversationId}/attachments/${attachment.id}`
      : `/api/auth/conversations/${scope.conversationId}/attachments/${attachment.id}`;

  return apiUrl(path);
}

async function ensureCacheDir() {
  if (!FileSystem.cacheDirectory) {
    throw new Error("Local file cache is unavailable on this device.");
  }

  await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
}

export async function downloadMessageAttachment(params: {
  token: string;
  attachment: MessageAttachment;
  scope?: AttachmentConversationScope;
  force?: boolean;
}): Promise<string> {
  const url = resolveAttachmentDownloadUrl(params.attachment, params.scope);

  if (!url) {
    throw new Error("Attachment download URL is unavailable.");
  }

  await ensureCacheDir();

  const fileName = `${cacheId(params.attachment, url)}.${attachmentExtension(params.attachment)}`;
  const localUri = `${CACHE_DIR}${fileName}`;

  if (!params.force) {
    const existing = await FileSystem.getInfoAsync(localUri);

    if (existing.exists && (existing.size ?? 0) > 0) {
      return localUri;
    }
  } else {
    await FileSystem.deleteAsync(localUri, { idempotent: true });
  }

  const downloaded = await FileSystem.downloadAsync(url, localUri, {
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: "*/*",
    },
  });

  if (downloaded.status === 401) {
    handleUnauthorizedResponse(downloaded.status);
    await FileSystem.deleteAsync(localUri, { idempotent: true });
    throw new Error("Your session expired. Please sign in again.");
  }

  if (downloaded.status < 200 || downloaded.status >= 300) {
    await FileSystem.deleteAsync(localUri, { idempotent: true });
    throw new Error("Could not download attachment.");
  }

  const saved = await FileSystem.getInfoAsync(localUri);

  if (!saved.exists || (saved.size ?? 0) <= 0) {
    throw new Error("Downloaded attachment file is empty.");
  }

  return downloaded.uri || localUri;
}
