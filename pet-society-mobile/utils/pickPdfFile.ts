import * as DocumentPicker from "expo-document-picker";

import { explainDocumentPickerPermission } from "@/utils/permissions";

export type PickedPdf = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
};

export const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;

export async function pickPdfFile(): Promise<PickedPdf | null> {
  const shouldOpenPicker = await explainDocumentPickerPermission();

  if (!shouldOpenPicker) return null;

  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];

  if (!asset) return null;

  const isPdf =
    asset.mimeType === "application/pdf" ||
    asset.name?.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    throw new Error("Please select a PDF file only.");
  }

  if (asset.size && asset.size > MAX_PDF_SIZE_BYTES) {
    throw new Error("PDF file size must be 5MB or less.");
  }

  return {
    uri: asset.uri,
    name: asset.name || `pet-document-${Date.now()}.pdf`,
    mimeType: asset.mimeType || "application/pdf",
    size: asset.size,
  };
}
