import { api } from './api';
import { ChatMessage, ChatSession, ChatSessionResponse } from '../types';

export interface ChatMessageResponse extends ChatMessage {
  sessionId: string;
}

export const chatbotService = {
  // Session management
  createSession: async (title?: string): Promise<ChatSession> => {
    const response = await api.post('/chatbot/sessions', { title });
    return response.data;
  },

  getSessions: async (): Promise<ChatSession[]> => {
    const response = await api.get('/chatbot/sessions');
    return response.data;
  },

  getSession: async (sessionId: string, limit = 12, offset = 0): Promise<ChatSessionResponse> => {
    const response = await api.get(`/chatbot/sessions/${sessionId}?limit=${limit}&offset=${offset}`);
    return response.data;
  },

  updateSession: async (sessionId: string, data: { title?: string, is_active?: boolean }): Promise<void> => {
    await api.put(`/chatbot/sessions/${sessionId}`, data);
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    await api.delete(`/chatbot/sessions/${sessionId}`);
  },

  // Message sending
  sendMessage: async (message: string, sessionId?: string, response?: string): Promise<ChatMessageResponse> => {
    try {
      console.log('Sending message to database:', {
        messageLength: message.length,
        responseLength: response ? response.length : 0,
        sessionId
      });

      const apiResponse = await api.post('/chatbot/message', {
        message,
        sessionId,
        response
      });

      console.log('Message saved successfully:', apiResponse.data);
      return apiResponse.data;
    } catch (error) {
      console.error('Error in chatbotService.sendMessage:', error);
      throw error;
    }
  }
};

export default chatbotService;