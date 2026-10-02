import { apiRequest } from "@/services/apiClient";
import {
  buildAttachmentFormData,
  type ChatLocationMetadata,
  normalizeMessageAttachments,
  type MessageAttachment,
  type PendingMessageAttachment,
} from "@/services/chat/messageAttachments";

export type ChatMessage = {
  id: string | number;
  conversation_id: string | number;
  sender_id: string | number;
  sender?: {
    id: string | number;
    name: string;
  };
  type: string;
  body: string | null;
  metadata?: Record<string, unknown> | null;
  attachment?: MessageAttachment | null;
  attachments?: MessageAttachment[];
  created_at: string;
  updated_at?: string | null;
};

export type MessagesPage = {
  data: ChatMessage[];
  has_more: boolean;
  next_cursor: string | null;
};

export async function fetchConversationMessages(params: {
  token: string;
  conversationId: string | number;
  cursor?: string | null;
  limit?: number;
}): Promise<MessagesPage> {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 30),
  });

  if (params.cursor) {
    query.set("cursor", params.cursor);
  }

  return apiRequest<MessagesPage>(
    params.token,
    `/api/auth/conversations/${params.conversationId}/messages?${query.toString()}`,
    {
      fallbackMessage: "Failed to fetch messages",
    },
  );
}

export async function sendConversationMessage(params: {
  token: string;
  conversationId: string | number;
  body: string;
  attachment?: PendingMessageAttachment | null;
  location?: ChatLocationMetadata | null;
}): Promise<ChatMessage> {
  const body = params.body.trim();
  const attachment = params.attachment ?? null;
  const location = params.location ?? null;

  if (attachment) {
    const message = await apiRequest<ChatMessage>(
      params.token,
      `/api/auth/conversations/${params.conversationId}/messages`,
      {
        method: "POST",
        body: buildAttachmentFormData({ body, attachment }),
        skipContentType: true,
        fallbackMessage: "Failed to send message",
      },
    );

    return {
      ...message,
      attachments: normalizeMessageAttachments(message),
    };
  }

  if (location) {
    return apiRequest<ChatMessage>(
      params.token,
      `/api/auth/conversations/${params.conversationId}/messages`,
      {
        method: "POST",
        body: {
          type: "location",
          body,
          metadata: location,
        },
        fallbackMessage: "Failed to send location",
      },
    );
  }

  return apiRequest<ChatMessage>(
    params.token,
    `/api/auth/conversations/${params.conversationId}/messages`,
    {
      method: "POST",
      body: { type: "text", body },
      fallbackMessage: "Failed to send message",
    },
  );
}

export async function markConversationRead(params: {
  token: string;
  conversationId: string | number;
}): Promise<void> {
  await apiRequest<unknown>(
    params.token,
    `/api/auth/conversations/${params.conversationId}/read`,
    {
      method: "POST",
      fallbackMessage: "Failed to mark conversation as read",
    },
  );
}
