/**
 * Chatbot (assistant) API response shapes. Like the Chat controller, the chatbot
 * web-chat endpoints wrap their payload in the standard v4 { Data } envelope.
 */

export interface ChatbotChannelData {
  ChatChannelId: string;
  Name?: string | null;
  LastMessageSeq: number;
  LastMessageOn?: string | null;
}

export interface ChatbotChannelResponse {
  Data?: ChatbotChannelData | null;
}

export interface ChatbotSendData {
  ChatMessageId: string;
  MessageSeq: number;
  SentOn: string;
}

export interface ChatbotSendResponse {
  Data?: ChatbotSendData | null;
}

export interface ChatbotSessionResponse {
  Success: boolean;
}
