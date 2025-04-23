import { api } from './api';

export interface ChatCompletionRequest {
  modelId: string;
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }[];
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stream?: boolean;
  };
}

export interface ChatCompletionResponse {
  id: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamChunk {
  id: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: string | null;
  }[];
}

export const aiChatService = {
  /**
   * Send a message to the Ollama API
   * @param request The chat completion request
   * @returns The chat completion response
   */
  sendChatCompletion: async (request: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
    // Transform the request to match Ollama API expectations
    const transformedRequest = {
      model: request.modelId, // Change modelId to model as expected by Ollama API
      messages: request.messages,
      ...(request.options && { options: request.options })
    };

    const response = await api.post('/ollama/chat', transformedRequest);

    // Ensure the response has the expected format
    if (!response.data || !response.data.choices) {
      // If the response doesn't match our expected format, transform it
      const ollamaResponse = response.data;

      // Create a standardized response format
      return {
        id: ollamaResponse.id || `chat-${Date.now()}`,
        created: ollamaResponse.created || Date.now(),
        model: ollamaResponse.model || request.modelId,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: ollamaResponse.message?.content || ollamaResponse.content || ''
            },
            finish_reason: ollamaResponse.finish_reason || 'stop'
          }
        ],
        usage: ollamaResponse.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    }

    return response.data;
  },

  /**
   * Send a streaming message to the Ollama API
   * @param request The chat completion request
   * @param onChunk Callback for each received chunk
   * @param onComplete Callback when streaming is complete
   * @param onError Callback when an error occurs
   */
  streamChatCompletion: async (
    request: ChatCompletionRequest,
    onChunk: (chunk: StreamChunk) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ): Promise<void> => {
    try {
      // Transform the request to match Ollama API expectations
      const transformedRequest = {
        model: request.modelId, // Change modelId to model
        messages: request.messages,
        options: {
          ...request.options,
          stream: true
        }
      };

      const response = await api.post('/ollama/chat', transformedRequest, {
        responseType: 'stream'
      });

      const reader = response.data.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk and add it to our buffer
        buffer += decoder.decode(value, { stream: true });

        // Process each complete json object
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the incomplete line in the buffer

        for (const line of lines) {
          if (line.trim() === '') continue;
          try {
            const chunk = JSON.parse(line);
            onChunk(chunk);
          } catch (e) {
            console.error('Error parsing stream chunk:', e);
          }
        }
      }

      // Handle any remaining data
      if (buffer.trim() !== '') {
        try {
          const chunk = JSON.parse(buffer);
          onChunk(chunk);
        } catch (e) {
          console.error('Error parsing final stream chunk:', e);
        }
      }

      onComplete();
    } catch (error) {
      onError(error);
    }
  },

  /**
   * Get available AI models
   * @returns Array of available models
   */
  getAvailableModels: async () => {
    const response = await api.get('/ollama/models/active');
    return response.data.models;
  }
};

export default aiChatService;