/**
 * RAG (Retrieval-Augmented Generation) Service
 * Handles retrieval of relevant document chunks and augmentation of prompts
 */

const vectorStoreService = require('./vectorStoreService');
const ollamaService = require('./ollamaService');

class RAGService {
  constructor() {
    this.vectorStoreService = vectorStoreService;
    this.ollamaService = ollamaService;
    this.embeddingModel = 'nomic-embed-text';
  }

  /**
   * Generate a query embedding and retrieve relevant context
   * @param {string} query - User query
   * @param {Object} options - Options for retrieval
   * @returns {Promise<Object>} - Result with context and sources
   */
  async retrieveContext(query, options = {}) {
    const {
      topK = 5,
      model = this.embeddingModel,
      userId = null,
      sessionId = null
    } = options;

    try {
      console.log(`RAG: Generating embedding for query: "${query.substring(0, 50)}..."`);

      // Generate embedding for the query - using the existing generateEmbedding method
      const embedResult = await this.ollamaService.generateEmbedding(query, model);
      if (!embedResult.success) {
        console.error(`RAG: Failed to generate query embedding: ${embedResult.error}`);
        return {
          success: false,
          error: 'Failed to generate query embedding'
        };
      }

      console.log(`RAG: Successfully generated query embedding, searching for relevant chunks...`);

      // Search for relevant documents
      const searchResult = await this.vectorStoreService.search(
        embedResult.embedding,
        topK
      );

      if (!searchResult.success) {
        console.error(`RAG: Failed to retrieve relevant documents: ${searchResult.error}`);
        return {
          success: false,
          error: 'Failed to retrieve relevant documents'
        };
      }

      // If no results found, return empty context
      if (searchResult.results.length === 0) {
        console.log(`RAG: No relevant documents found for query`);
        return {
          success: true,
          context: '',
          sources: []
        };
      }

      console.log(`RAG: Found ${searchResult.results.length} relevant chunks`);

      // Prepare context from retrieved documents
      const context = searchResult.results
        .map(result => result.text)
        .join('\n\n---\n\n');

      // Format sources for citation
      const sources = searchResult.results.map(result => ({
        text: result.text.substring(0, 150) + (result.text.length > 150 ? '...' : ''),
        metadata: result.metadata,
        score: result.score
      }));

      return {
        success: true,
        context,
        sources
      };
    } catch (error) {
      console.error(`RAG: Error retrieving context:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error retrieving context'
      };
    }
  }

  /**
   * Process a chat message with RAG
   * @param {string} message - User message
   * @param {string} model - LLM model to use
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Chat response with sources
   */
  async processRagChat(message, model, options = {}) {
    try {
      console.log(`RAG: Processing chat message with RAG: "${message.substring(0, 50)}..."`);

      // Get context for the query
      const ragResult = await this.retrieveContext(message, options);

      // If retrieval failed, use regular chat
      if (!ragResult.success) {
        console.log(`RAG: Retrieval failed, falling back to regular chat`);
        return await this.ollamaService.chat(model, [
          {
            role: 'user',
            content: message
          }
        ], 'You are a helpful assistant.');
      }

      // If no context found, use regular chat
      if (!ragResult.context) {
        console.log(`RAG: No relevant context found, using regular chat`);
        return await this.ollamaService.chat(model, [
          {
            role: 'user',
            content: message
          }
        ], 'You are a helpful assistant.');
      }

      console.log(`RAG: Using context from ${ragResult.sources.length} sources`);

      // Create the prompt with context
      const messages = [
        {
          role: 'user',
          content: `Use the following context from relevant documents to answer the question:

Context:
${ragResult.context}

Question: ${message}`
        }
      ];

      // Use the RAG-enhanced messages for chat with system prompt
      const systemPrompt = 'You are a helpful assistant that answers questions based on the provided context. If the information is not in the context, acknowledge that and provide your best response based on your general knowledge, but make it clear which parts are from the documents and which are not.';

      // Use the RAG-enhanced messages for chat
      const chatResponse = await this.ollamaService.chat(model, messages, systemPrompt);

      // Add source information to the response
      if (chatResponse.success) {
        chatResponse.sources = ragResult.sources;
        chatResponse.context = ragResult.context;
      }

      return chatResponse;
    } catch (error) {
      console.error(`RAG: Error in RAG chat processing:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error in RAG processing'
      };
    }
  }

  /**
   * Check if RAG is available
   * @returns {Promise<boolean>} - Whether RAG is available
   */
  async isRagAvailable() {
    try {
      const stats = await this.vectorStoreService.getStats();
      return stats.success && stats.count > 0;
    } catch (error) {
      console.error(`RAG: Error checking RAG availability:`, error);
      return false;
    }
  }
}

module.exports = new RAGService();
