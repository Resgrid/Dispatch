/**
 * Chatbot (assistant) API response shapes. Unlike the Chat controller, the
 * Chatbot web-chat endpoints return plain objects (not the { Data } envelope).
 */

export interface ChatbotChannelResponse {
  ChatChannelId: string;
  Name?: string | null;
  LastMessageSeq: number;
  LastMessageOn?: string | null;
}

export interface ChatbotSendResponse {
  ChatMessageId: string;
  MessageSeq: number;
  SentOn: string;
}

export interface ChatbotSessionResponse {
  success: boolean;
}
