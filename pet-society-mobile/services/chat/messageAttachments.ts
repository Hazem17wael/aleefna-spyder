import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";

export type MessageAttachmentKind = "image" | "pdf" | "voice";
export type ChatMessageKind = "text" | MessageAttachmentKind | "location";

export type ChatLocationMetadata = {
  latitude: number;
  longitude: number;
  label?: string | null;
  map_url?: string | null;
};

export type PendingMessageAttachment = {
  type: MessageAttachmentKind;
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
  durationMs?: number | null;
};

export type MessageAttachment = {
  id?: string | number;
  type?: string | null;
  mime_type?: string | null;
  original_name?: string | null;
  file_name?: string | null;
  size_bytes?: number | string | null;
  file_size?: number | string | null;
  duration_ms?: number | string | null;
  duration_seconds?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  download_url?: string | null;
};

const IMAGE_PICKER_MEDIA_TYPES: ImagePicker.MediaType[] = ["images"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function safeFileName(name: string | null, fallback: string) {
  return (name ?? fallback).replace(/[\\/]/g, "_");
}

async function ensureLocalFile(uri: string, label: string) {
  const info = await FileSystem.getInfoAsync(uri);

  if (!info.exists || (info.size ?? 0) <= 0) {
    throw new Error(`${label} file is missing. Please try again.`);
  }

  return info.size ?? null;
}

function extensionFromMime(mimeType: string, fallback: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/mp4" || mimeType === "audio/m4a" || mimeType === "audio/x-m4a") return "m4a";
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") return "wav";
  if (mimeType === "audio/webm") return "webm";
  if (mimeType === "audio/aac") return "aac";
  if (mimeType === "video/mp4") return "m4a";

  return fallback;
}

export function normalizeMessageAttachments(message: unknown): MessageAttachment[] {
  if (!isRecord(message)) return [];

  if (Array.isArray(message.attachments)) {
    return message.attachments.filter(isRecord) as MessageAttachment[];
  }

  return isRecord(message.attachment)
    ? [message.attachment as MessageAttachment]
    : [];
}

export function attachmentKind(value?: string | null): MessageAttachmentKind | null {
  if (value === "image" || value === "pdf" || value === "voice") {
    return value;
  }

  return null;
}

export function normalizeLocationMetadata(
  metadata?: Record<string, unknown> | null,
): ChatLocationMetadata | null {
  if (!isRecord(metadata)) return null;

  const latitude = Number(metadata.latitude);
  const longitude = Number(metadata.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    label: firstString(metadata.label),
    map_url: firstString(metadata.map_url),
  };
}

export function formatLocationCoordinates(location: ChatLocationMetadata) {
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
}

export function attachmentDisplayName(attachment: MessageAttachment) {
  return (
    firstString(attachment.original_name, attachment.file_name) ??
    (attachment.type === "image"
      ? "Photo"
      : attachment.type === "pdf"
        ? "PDF"
        : attachment.type === "voice"
          ? "Voice note"
          : "Attachment")
  );
}

export function attachmentPreviewText(
  type?: string | null,
  fallback = "Attachment",
) {
  if (type === "image") return "Photo";
  if (type === "pdf") return "PDF";
  if (type === "voice") return "Voice note";
  if (type === "location") return "Location";

  return fallback;
}

export function messagePreviewText(message: {
  type?: string | null;
  body?: string | null;
  attachments?: MessageAttachment[];
}) {
  const body = message.body?.trim();

  if (body) return body;

  if (message.type === "location") return "Location";

  const firstAttachment = message.attachments?.[0];

  return attachmentPreviewText(firstAttachment?.type ?? message.type, "Message");
}

function imageAttachmentFromAsset(
  asset: ImagePicker.ImagePickerAsset,
  fallbackName: string,
  size: number | null,
): PendingMessageAttachment {
  const mimeType = asset.mimeType ?? "image/jpeg";
  const extension = extensionFromMime(mimeType, "jpg");

  return {
    type: "image",
    uri: asset.uri,
    name: safeFileName(asset.fileName ?? null, `${fallbackName}.${extension}`),
    mimeType,
    size: asset.fileSize ?? size,
  };
}

export async function pickCameraImageAttachment(): Promise<PendingMessageAttachment | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Camera permission is required to take a photo.");
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: IMAGE_PICKER_MEDIA_TYPES,
    allowsEditing: false,
    quality: 0.88,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];

  if (!asset?.uri) return null;

  const size = await ensureLocalFile(asset.uri, "Photo");

  return imageAttachmentFromAsset(asset, "photo", size);
}

export async function pickGalleryImageAttachment(): Promise<PendingMessageAttachment | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Photo library permission is required to attach an image.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: IMAGE_PICKER_MEDIA_TYPES,
    allowsEditing: false,
    quality: 0.88,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];

  if (!asset?.uri) return null;

  const size = await ensureLocalFile(asset.uri, "Photo");

  return imageAttachmentFromAsset(asset, "photo", size);
}

export async function pickImageAttachment(): Promise<PendingMessageAttachment | null> {
  return pickGalleryImageAttachment();
}

export async function pickPdfAttachment(): Promise<PendingMessageAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];

  if (!asset?.uri) return null;

  return {
    type: "pdf",
    uri: asset.uri,
    name: safeFileName(asset.name ?? null, "document.pdf"),
    mimeType: asset.mimeType ?? "application/pdf",
    size: asset.size ?? null,
  };
}

export async function pickVoiceAttachment(): Promise<PendingMessageAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["audio/*", "video/mp4"],
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];

  if (!asset?.uri) return null;

  const mimeType = asset.mimeType ?? "audio/mp4";
  const extension = extensionFromMime(mimeType, "m4a");

  return {
    type: "voice",
    uri: asset.uri,
    name: safeFileName(asset.name ?? null, `voice.${extension}`),
    mimeType,
    size: asset.size ?? null,
  };
}

export function buildAttachmentFormData(params: {
  body?: string | null;
  attachment: PendingMessageAttachment;
}) {
  const formData = new FormData();
  const body = params.body?.trim();

  formData.append("type", params.attachment.type);

  if (body) {
    formData.append("body", body);
  }

  if (params.attachment.durationMs != null) {
    formData.append("duration_ms", String(Math.round(params.attachment.durationMs)));
  }

  formData.append("attachment", {
    uri: params.attachment.uri,
    name: params.attachment.name,
    type: params.attachment.mimeType,
  } as unknown as Blob);

  return formData;
}
