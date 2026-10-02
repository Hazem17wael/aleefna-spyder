import * as FileSystem from "expo-file-system/legacy";

import {
  downloadMessageAttachment,
  resolveAttachmentDownloadUrl,
} from "@/services/chat/attachmentDownload";
import {
  hasPdfOpenerDependency,
  hasVoicePlayerDependency,
  PDF_OPENER_DEPENDENCY,
  VOICE_PLAYER_DEPENDENCY,
} from "@/services/chat/openAttachment";

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  makeDirectoryAsync: jest.fn(async () => undefined),
  downloadAsync: jest.fn(async () => ({
    status: 200,
    uri: "file:///cache/chat-attachments/42.jpg",
    headers: {},
    mimeType: "application/octet-stream",
  })),
  getInfoAsync: jest.fn(async () => ({
    exists: false,
    uri: "file:///cache/chat-attachments/file.bin",
    isDirectory: false,
  })),
  deleteAsync: jest.fn(async () => undefined),
}));

const fileSystem = jest.mocked(FileSystem);

function existingFile(size = 128) {
  return {
    exists: true as const,
    uri: "file:///cache/chat-attachments/file.bin",
    size,
    isDirectory: false,
    modificationTime: 1,
  };
}

function missingFile() {
  return {
    exists: false as const,
    uri: "file:///cache/chat-attachments/file.bin",
    isDirectory: false as const,
  };
}

function downloadResult(uri: string) {
  return {
    status: 200,
    uri,
    headers: {},
    mimeType: "application/octet-stream",
  };
}

describe("attachment download helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileSystem.getInfoAsync.mockResolvedValue(missingFile());
    fileSystem.downloadAsync.mockResolvedValue(
      downloadResult("file:///cache/chat-attachments/42.jpg"),
    );
  });

  it("resolves absolute download_url unchanged", () => {
    expect(
      resolveAttachmentDownloadUrl({
        download_url: "https://api.test/private/photo.jpg",
      }),
    ).toBe("https://api.test/private/photo.jpg");
  });

  it("resolves relative download_url through api base", () => {
    expect(
      resolveAttachmentDownloadUrl({
        download_url: "/api/auth/conversations/9/attachments/3/download",
      }),
    ).toBe("https://api.test/api/auth/conversations/9/attachments/3/download");
  });

  it("builds match conversation fallback download path from attachment id", () => {
    expect(
      resolveAttachmentDownloadUrl(
        { id: 12 },
        { kind: "match", conversationId: 44 },
      ),
    ).toBe("https://api.test/api/auth/conversations/44/attachments/12");
  });

  it("builds adoption conversation fallback download path from attachment id", () => {
    expect(
      resolveAttachmentDownloadUrl(
        { id: 7 },
        { kind: "adoption", conversationId: 88 },
      ),
    ).toBe(
      "https://api.test/api/auth/adoption-conversations/88/attachments/7",
    );
  });

  it("downloads with bearer auth and returns cached local uri", async () => {
    fileSystem.getInfoAsync
      .mockResolvedValueOnce(missingFile())
      .mockResolvedValueOnce(existingFile());

    const uri = await downloadMessageAttachment({
      token: "secret-token",
      attachment: {
        id: 42,
        type: "image",
        mime_type: "image/jpeg",
        download_url: "/api/auth/conversations/1/attachments/42/download",
      },
      scope: { kind: "match", conversationId: 1 },
    });

    expect(fileSystem.downloadAsync).toHaveBeenCalledWith(
      "https://api.test/api/auth/conversations/1/attachments/42/download",
      "file:///cache/chat-attachments/42.jpg",
      {
        headers: {
          Authorization: "Bearer secret-token",
          Accept: "*/*",
        },
      },
    );
    expect(uri).toBe("file:///cache/chat-attachments/42.jpg");
  });

  it("reuses an existing cached file without re-downloading", async () => {
    fileSystem.getInfoAsync.mockResolvedValueOnce(existingFile());

    const uri = await downloadMessageAttachment({
      token: "secret-token",
      attachment: {
        id: 5,
        type: "pdf",
        mime_type: "application/pdf",
        download_url: "/api/auth/conversations/1/attachments/5/download",
      },
    });

    expect(fileSystem.downloadAsync).not.toHaveBeenCalled();
    expect(uri).toBe("file:///cache/chat-attachments/5.pdf");
  });

  it("reports opener dependencies for this runtime", () => {
    expect(hasPdfOpenerDependency()).toBe(true);
    expect(hasVoicePlayerDependency()).toBe(false);
    expect(PDF_OPENER_DEPENDENCY).toBe("expo-sharing");
    expect(VOICE_PLAYER_DEPENDENCY).toBe("expo-audio");
  });
});
