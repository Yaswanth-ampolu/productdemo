import { api } from './api';
import { ChatMessage, ChatSession, ChatSessionResponse, FileAttachment } from '../types';

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
  },

  // Send message with file attachment
  sendMessageWithFile: async (
    message: string,
    file: File,
    sessionId?: string,
    onUploadProgress?: (progress: number) => void
  ): Promise<ChatMessageResponse> => {
    try {
      const formData = new FormData();
      formData.append('message', message);
      formData.append('file', file);

      if (sessionId) {
        formData.append('sessionId', sessionId);
      }

      const apiResponse = await api.post('/chatbot/message-with-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onUploadProgress) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onUploadProgress(progress);
          }
        }
      });

      console.log('Message with file saved successfully:', apiResponse.data);
      return apiResponse.data;
    } catch (error) {
      console.error('Error in chatbotService.sendMessageWithFile:', error);
      throw error;
    }
  },

  // Get uploaded files for a session
  getSessionFiles: async (sessionId: string): Promise<FileAttachment[]> => {
    try {
      const response = await api.get(`/chatbot/sessions/${sessionId}/files`);
      return response.data;
    } catch (error) {
      console.error('Error getting session files:', error);
      throw error;
    }
  },

  // Get document status
  getDocumentStatus: async (documentId: string): Promise<{ status: string, error?: string }> => {
    try {
      const response = await api.get(`/documents/${documentId}/status`);
      return {
        status: response.data.status,
        error: response.data.error
      };
    } catch (error) {
      console.error('Error getting document status:', error);
      throw error;
    }
  }
};

export default chatbotService;