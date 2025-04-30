/**
 * Vector Store Service
 * Handles interactions with ChromaDB for document embeddings storage and retrieval
 */

const path = require('path');
const fs = require('fs');
const { ChromaClient } = require('chromadb');

class VectorStoreService {
  constructor(config = {}) {
    this.config = {
      persistDirectory: path.join(process.cwd(), 'chroma_db'),
      collectionName: 'rag_docs',
      ...config
    };
    this.client = null;
    this.collection = null;
    this.isInitialized = false;
    this.useChromaDB = true;
    this.vectorStoreDir = path.join(process.cwd(), 'vector_store'); // Fallback directory

    // Create the persistence directory if it doesn't exist
    if (!fs.existsSync(this.config.persistDirectory)) {
      fs.mkdirSync(this.config.persistDirectory, { recursive: true });
    }

    // Create the fallback vector store directory if it doesn't exist
    if (!fs.existsSync(this.vectorStoreDir)) {
      fs.mkdirSync(this.vectorStoreDir, { recursive: true });
    }
  }

  /**
   * Initialize the vector store
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.isInitialized) return true;

    try {
      // Try to initialize ChromaDB
      if (this.useChromaDB) {
        try {
          console.log(`Initializing ChromaDB at: ${this.config.persistDirectory}`);

          // Create ChromaClient with the persistence directory
          this.client = new ChromaClient({
            path: this.config.persistDirectory
          });

          // Get or create collection
          try {
            this.collection = await this.client.getCollection({
              name: this.config.collectionName
            });
            console.log(`Retrieved existing ChromaDB collection: ${this.config.collectionName}`);
          } catch (collectionError) {
            console.log(`Creating new ChromaDB collection: ${this.config.collectionName}`);
            this.collection = await this.client.createCollection({
              name: this.config.collectionName,
              metadata: { description: 'Document collection for RAG' }
            });
          }

          console.log('ChromaDB initialized successfully');
          this.isInitialized = true;
          return true;
        } catch (chromaError) {
          console.error('Failed to initialize ChromaDB:', chromaError);
          console.log('Falling back to file-based vector store');
          this.useChromaDB = false;
        }
      }

      // Fallback to file-based storage if ChromaDB initialization fails
      console.log(`Initialized file-based vector store at: ${this.vectorStoreDir}`);
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      return false;
    }
  }

  /**
   * Add document chunks to the vector store
   * @param {Array} chunks - Array of chunks with text and embedding
   * @param {string} documentId - Document ID
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Result object
   */
  async addDocumentChunks(chunks, documentId, metadata = {}) {
    if (!await this.initialize()) {
      return {
        success: false,
        error: 'Vector store not initialized'
      };
    }

    try {
      // Ensure documentId is a string
      const documentIdStr = String(documentId);

      // If ChromaDB is available, use it
      if (this.useChromaDB && this.collection) {
        try {
          const ids = chunks.map((_, index) => `${documentIdStr}_chunk_${index}`);
          const embeddings = chunks.map(chunk => chunk.embedding);
          const documents = chunks.map(chunk => chunk.text);
          const metadatas = chunks.map(() => ({
            documentId: documentIdStr,
            source: metadata.fileName || 'unknown',
            ...metadata
          }));

          await this.collection.add({
            ids,
            embeddings,
            documents,
            metadatas
          });

          console.log(`Stored ${chunks.length} vectors for document ${documentId} in ChromaDB`);
          return { success: true, count: chunks.length };
        } catch (chromaError) {
          console.error('Failed to store in ChromaDB, falling back to file-based store:', chromaError);
          this.useChromaDB = false; // Disable ChromaDB for future operations if it fails
        }
      }

      // Fallback to file-based storage
      const documentDir = path.join(this.vectorStoreDir, documentIdStr);
      if (!fs.existsSync(documentDir)) {
        fs.mkdirSync(documentDir, { recursive: true });
      }

      const vectorData = {
        documentId,
        metadata,
        chunks: chunks.map((chunk, index) => ({
          id: `${documentIdStr}_chunk_${index}`,
          text: chunk.text,
          embedding: chunk.embedding,
          metadata: {
            documentId: documentIdStr,
            source: metadata.fileName || 'unknown',
            ...metadata
          }
        }))
      };

      const vectorFilePath = path.join(documentDir, 'vectors.json');
      fs.writeFileSync(vectorFilePath, JSON.stringify(vectorData, null, 2));

      console.log(`Stored ${chunks.length} vectors for document ${documentId} in file-based store`);
      return { success: true, count: chunks.length };
    } catch (error) {
      console.error('Error adding document chunks to vector store:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Search for similar documents using a query embedding
   * @param {Array} queryEmbedding - Query embedding vector
   * @param {number} limit - Number of results to return
   * @returns {Promise<Object>} Search results
   */
  async search(queryEmbedding, limit = 5) {
    if (!await this.initialize()) {
      return {
        success: false,
        error: 'Vector store not initialized'
      };
    }

    try {
      if (this.useChromaDB && this.collection) {
        const results = await this.collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: limit,
          include: ['documents', 'metadatas', 'distances']
        });

        return {
          success: true,
          results: results.documents[0].map((text, index) => ({
            text,
            metadata: results.metadatas[0][index],
            score: 1 - results.distances[0][index] // Convert distance to similarity score
          }))
        };
      }

      // Fallback to file-based search
      const documentDirs = fs.readdirSync(this.vectorStoreDir)
        .filter(dir => fs.statSync(path.join(this.vectorStoreDir, dir)).isDirectory());

      if (documentDirs.length === 0) {
        return {
          success: true,
          results: []
        };
      }

      let allChunks = [];
      for (const documentId of documentDirs) {
        const vectorFilePath = path.join(this.vectorStoreDir, documentId, 'vectors.json');
        if (fs.existsSync(vectorFilePath)) {
          const vectorData = JSON.parse(fs.readFileSync(vectorFilePath, 'utf8'));
          allChunks = allChunks.concat(vectorData.chunks);
        }
      }

      if (allChunks.length === 0) {
        return {
          success: true,
          results: []
        };
      }

      const similarities = allChunks.map(chunk => {
        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        return {
          ...chunk,
          score: similarity
        };
      });

      const topResults = similarities
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return {
        success: true,
        results: topResults.map(result => ({
          text: result.text,
          metadata: result.metadata,
          score: result.score
        }))
      };
    } catch (error) {
      console.error('Error searching vector store:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {Array} vecA - First vector
   * @param {Array} vecB - Second vector
   * @returns {number} Cosine similarity (-1 to 1)
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Delete document chunks from the vector store
   * @param {string} documentId - Document ID
   * @returns {Promise<Object>} Result object
   */
  async deleteDocumentChunks(documentId) {
    if (!await this.initialize()) {
      return {
        success: false,
        error: 'Vector store not initialized'
      };
    }

    try {
      const documentIdStr = String(documentId);

      if (this.useChromaDB && this.collection) {
        await this.collection.delete({
          where: { documentId: documentIdStr }
        });
        console.log(`Deleted document ${documentId} from ChromaDB`);
      }

      const documentDir = path.join(this.vectorStoreDir, documentIdStr);
      if (fs.existsSync(documentDir)) {
        fs.rmdirSync(documentDir, { recursive: true });
        console.log(`Deleted document ${documentId} from file-based vector store`);
      }

      return { success: true };
    } catch (error) {
      console.error(`Error deleting document ${documentId} from vector store:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get vector store statistics
   * @returns {Promise<Object>} Vector store stats
   */
  async getStats() {
    if (!await this.initialize()) {
      return {
        success: false,
        error: 'Vector store not initialized'
      };
    }

    try {
      if (this.useChromaDB && this.collection) {
        const count = await this.collection.count();
        return {
          success: true,
          count,
          documents: count, // Approximate, as ChromaDB doesn't track documents directly
          storageType: 'chromadb'
        };
      }

      const documentDirs = fs.existsSync(this.vectorStoreDir)
        ? fs.readdirSync(this.vectorStoreDir).filter(dir =>
            fs.statSync(path.join(this.vectorStoreDir, dir)).isDirectory())
        : [];

      let totalChunks = 0;
      for (const documentId of documentDirs) {
        const vectorFilePath = path.join(this.vectorStoreDir, documentId, 'vectors.json');
        if (fs.existsSync(vectorFilePath)) {
          const vectorData = JSON.parse(fs.readFileSync(vectorFilePath, 'utf8'));
          totalChunks += vectorData.chunks.length;
        }
      }

      return {
        success: true,
        count: totalChunks,
        documents: documentDirs.length,
        storageType: 'file-based'
      };
    } catch (error) {
      console.error('Error getting vector store stats:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new VectorStoreService();