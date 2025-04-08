import api from './api';

interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
}

export const chatbotService = {
  sendMessage: async (message: string): Promise<ChatMessage> => {
    const response = await api.post('/chatbot/message', { message });
    return response.data;
  }
};

export default chatbotService; 