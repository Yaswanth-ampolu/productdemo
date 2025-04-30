import { api } from './api';

export interface RagChatRequest {
  model: string;
  message: string;
  sessionId?: string;
}

export interface RagChatResponse {
  content: string;
  sources: RagSource[];
  ragAvailable: boolean;
}

export interface RagSource {
  text: string;
  metadata: {
    documentId: string;
    fileName: string;
    userId: string;
    fileType: string;
    [key: string]: any;
  };
  score: number;
}

export const ragChatService = {
  /**
   * Send a message to the RAG-enhanced chat API
   * @param request The RAG chat request
   * @returns The RAG chat response with sources
   */
  sendRagChatMessage: async (request: RagChatRequest): Promise<RagChatResponse> => {
    try {
      console.log('Sending RAG chat request:', {
        model: request.model,
        messageLength: request.message.length,
        sessionId: request.sessionId
      });

      const response = await api.post('/ollama/rag-chat', request);
      return response.data;
    } catch (error) {
      console.error('Error in ragChatService.sendRagChatMessage:', error);
      throw error;
    }
  },

  /**
   * Check if RAG is available
   * @returns Whether RAG is available
   */
  isRagAvailable: async (): Promise<boolean> => {
    try {
      // We'll use a simple test message to check if RAG is available
      const response = await api.post('/ollama/rag-chat', {
        model: 'llama3',
        message: 'test'
      });
      return response.data.ragAvailable === true;
    } catch (error: any) {
      // If we get a 400 error with ragAvailable: false, RAG is not available
      if (error.response?.data?.ragAvailable === false) {
        return false;
      }
      // For other errors, log and return false
      console.error('Error checking RAG availability:', error);
      return false;
    }
  }
};
