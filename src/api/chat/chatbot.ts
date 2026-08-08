import { type ChatbotChannelResponse, type ChatbotSendResponse, type ChatbotSessionResponse } from '@/models/v4/chat';

import { api } from '../common/client';

const CHATBOT = '/Chatbot';

/** Gets (creating if needed) the caller's chatbot conversation channel. */
export const getChatbotChannel = async (signal?: AbortSignal) => {
  const response = await api.get<ChatbotChannelResponse>(`${CHATBOT}/GetChatChannel`, { signal });
  return response.data?.Data ?? null;
};

/**
 * Sends a message to the chatbot. The reply arrives asynchronously in the same
 * channel over SignalR (chatbotMessageReceived). Idempotent via clientMessageId.
 */
export const sendChatbotMessage = async (text: string, clientMessageId: string) => {
  const response = await api.post<ChatbotSendResponse>(`${CHATBOT}/SendChatMessage`, {
    Text: text,
    ClientMessageId: clientMessageId,
  });
  return response.data?.Data ?? null;
};

/** Resets the chatbot conversational session (message history is retained). */
export const newChatbotSession = async () => {
  const response = await api.post<ChatbotSessionResponse>(`${CHATBOT}/NewChatSession`, {});
  return response.data;
};
