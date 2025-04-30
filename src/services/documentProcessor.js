const fs = require('fs');
const path = require('path');
const documentService = require('./documentService');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// Get the OllamaService
let OllamaService;
try {
  OllamaService = require('./ollamaService');
} catch (error) {
  console.warn('OllamaService not found. Embedding generation will be limited.');
}

// Import LangChain components
let PDFLoader;
let DocxLoader;
let RecursiveCharacterTextSplitter;
try {
  const { PDFLoader: PDFLoaderImport } = require('langchain/document_loaders/fs/pdf');
  const { RecursiveCharacterTextSplitter: TextSplitterImport } = require('langchain/text_splitter');

  // Try to import DocxLoader if available
  try {
    const { DocxLoader: DocxLoaderImport } = require('langchain/document_loaders/fs/docx');
    DocxLoader = DocxLoaderImport;
  } catch (docxError) {
    console.warn('LangChain DocxLoader not available. Using fallback for DOCX files.');
    DocxLoader = null;
  }

  PDFLoader = PDFLoaderImport;
  RecursiveCharacterTextSplitter = TextSplitterImport;
  console.log('LangChain loaded successfully for document processing');
} catch (error) {
  console.warn('LangChain packages not found. Using fallback document processing methods.');
  console.warn('Install LangChain for better document processing: npm install langchain pdf-parse');
  PDFLoader = null;
  DocxLoader = null;
  RecursiveCharacterTextSplitter = null;
}

// We'll use these packages if they're available, but provide fallbacks if not
let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (error) {
  console.warn('pdf-parse package not found. PDF text extraction will be limited.');
  pdfParse = null;
}

let mammoth;
try {
  mammoth = require('mammoth');
} catch (error) {
  console.warn('mammoth package not found. DOCX text extraction will be limited.');
  mammoth = null;
}

/**
 * Service for processing documents (text extraction, chunking, embedding generation)
 */
class DocumentProcessor {
  constructor() {
    // Initialize dependencies
    this.documentsDir = path.join(__dirname, '../../documents');
    this.embeddingsDir = path.join(__dirname, '../../embeddings');

    // Create embeddings directory if it doesn't exist
    if (!fs.existsSync(this.embeddingsDir)) {
      fs.mkdirSync(this.embeddingsDir, { recursive: true });
    }

    // Set up services
    this.ollamaService = null;
    this.vectorStoreService = null;
    this.config = {
      embedding: {
        model: 'nomic-embed-text',
        batchSize: 5,
        dimensions: 768
      },
      vectorStore: {
        persistDirectory: path.join(process.cwd(), 'chroma_db'),
        collectionName: 'rag_docs'
      }
    };

    // Initialize services as soon as we can
    this.initOllamaService();
    this.initVectorStoreService();
  }

  /**
   * Initialize the Ollama service for embedding generation
   */
  async initOllamaService() {
    if (!OllamaService) {
      console.warn('OllamaService not available, using placeholder embeddings');
      return false;
    }

    try {
      // Create Ollama service instance
      this.ollamaService = new OllamaService(this.config);
      await this.ollamaService.initialize();
      console.log('OllamaService initialized for document processing');
      return true;
    } catch (error) {
      console.error('Failed to initialize OllamaService:', error);
      this.ollamaService = null;
      return false;
    }
  }

  /**
   * Initialize the Vector Store service for embedding storage
   */
  async initVectorStoreService() {
    try {
      // Get the vectorStoreService
      const vectorStoreService = require('./vectorStoreService');
      if (!vectorStoreService) {
        console.warn('VectorStoreService not available, using file-based storage only');
        return false;
      }

      this.vectorStoreService = vectorStoreService;
      console.log('VectorStoreService initialized for document processing');
      return true;
    } catch (error) {
      console.error('Failed to initialize VectorStoreService:', error);
      console.error(error.stack);
      this.vectorStoreService = null;
      return false;
    }
  }

  /**
   * Process a document after upload
   * @param {number} documentId - Document ID
   * @returns {Promise<Object>} - Processing result
   */
  async processDocument(documentId) {
    try {
      // Get document info
      const document = await documentService.getDocument(documentId);

      // Update status to PROCESSING
      await documentService.updateDocumentStatus(documentId, 'PROCESSING');

      // Log the processing start
      console.log(`Processing document ${documentId}: ${document.original_name}`);

      // Extract text from the document
      const extractedText = await this.extractText(document);

      // Create user's embeddings directory if it doesn't exist
      const userEmbeddingsDir = path.join(this.embeddingsDir, document.user_id);
      if (!fs.existsSync(userEmbeddingsDir)) {
        await mkdir(userEmbeddingsDir, { recursive: true });
      }

      // Save the extracted text
      const textFilePath = path.join(userEmbeddingsDir, `${document.id}_text.txt`);
      await writeFile(textFilePath, extractedText, 'utf8');

      // Chunk the text using LangChain or fallback method
      console.log(`Chunking text for document ${documentId} (${extractedText.length} characters)`);
      const chunks = await this.chunkText(extractedText);
      console.log(`Created ${chunks.length} chunks for document ${documentId}`);

      // Save the chunks
      const chunksFilePath = path.join(userEmbeddingsDir, `${document.id}_chunks.json`);
      await writeFile(chunksFilePath, JSON.stringify(chunks, null, 2), 'utf8');

      // Update status to EMBEDDING
      await documentService.updateDocumentStatus(documentId, 'EMBEDDING', null, true); // Added flag to indicate long-running process

      try {
        // Generate embeddings - this is a long-running process
        const embeddingsResult = await this.generateEmbeddings(chunks, document.id, userEmbeddingsDir);

        // Check if embedding generation was successful
        if (!embeddingsResult.success) {
          console.warn(`Embedding generation failed: ${embeddingsResult.error}`);
          // Continue with processing but log the error
        }

        // Update status to PROCESSED
        await documentService.updateDocumentStatus(documentId, 'PROCESSED');

        return {
          success: true,
          documentId,
          status: 'PROCESSED',
          textLength: extractedText.length,
          chunkCount: chunks.length,
          embeddingsGenerated: embeddingsResult.success
        };
      } catch (error) {
        console.error(`Error in embedding generation:`, error);
        throw error;
      }
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);

      // Update status to ERROR
      try {
        await documentService.updateDocumentStatus(
          documentId,
          'ERROR',
          error.message || 'Unknown error during processing'
        );
      } catch (updateError) {
        console.error(`Error updating document status:`, updateError);
      }

      return {
        success: false,
        documentId,
        error: error.message || 'Unknown error during processing',
        status: 'ERROR'
      };
    }
  }

  /**
   * Generate embeddings for document chunks
   * @param {Array} chunks - Text chunks to embed
   * @param {string} documentId - Document ID
   * @param {string} userEmbeddingsDir - Directory to store embeddings
   * @returns {Promise<Object>} - Embedding generation result
   */
  async generateEmbeddings(chunks, documentId, userEmbeddingsDir) {
    try {
      // Create progress tracking file
      const progressFilePath = path.join(userEmbeddingsDir, `${documentId}_embedding_progress.json`);
      await writeFile(
        progressFilePath,
        JSON.stringify({ documentId, total: chunks.length, completed: 0, inProgress: true }, null, 2),
        'utf8'
      );

      // Check if OllamaService is available
      if (!this.ollamaService) {
        await this.initOllamaService();
      }

      // If we still don't have OllamaService, use placeholder
      if (!this.ollamaService) {
        return this.generatePlaceholderEmbeddings(chunks, documentId, userEmbeddingsDir);
      }

      // Extract just the text content from chunks
      const chunkTexts = chunks.map(chunk => chunk.text);

      // Track progress
      let completed = 0;
      const updateProgress = async (progress, completedCount) => {
        completed = completedCount;
        await writeFile(
          progressFilePath,
          JSON.stringify({
            documentId,
            total: chunks.length,
            completed,
            progress,
            inProgress: true
          }, null, 2),
          'utf8'
        );

        // Also update document status in the database every 10% progress
        // This helps keep the session alive by creating database activity
        if (progress % 10 === 0) {
          try {
            await documentService.updateDocumentStatus(
              documentId,
              'EMBEDDING',
              `Embedding generation ${progress}% complete (${completed}/${chunks.length} chunks)`,
              true // Mark as long-running to keep session active
            );
          } catch (error) {
            console.warn(`Failed to update document status during embedding progress: ${error.message}`);
          }
        }
      };

      // Generate embeddings using OllamaService in smaller batches to avoid timeouts
      console.log(`Generating embeddings for ${chunks.length} chunks using Ollama`);
      const result = await this.ollamaService.generateEmbeddingsBatch(
        chunkTexts,
        null, // use default model
        this.config.embedding.batchSize,
        updateProgress
      );

      if (!result.success) {
        throw new Error(`Failed to generate embeddings: ${result.error}`);
      }

      // Prepare embeddings data structure
      const embeddingsData = {
        documentId,
        model: result.model,
        dimensions: result.embeddings[0]?.length || this.config.embedding.dimensions,
        count: result.count,
        timestamp: new Date().toISOString(),
        chunks: chunks.map((chunk, index) => ({
          ...chunk,
          embeddingIndex: index
        }))
      };

      // Save embeddings in JSON format
      const embeddingsFilePath = path.join(userEmbeddingsDir, `${documentId}_embeddings.json`);
      await writeFile(
        embeddingsFilePath,
        JSON.stringify(embeddingsData, null, 2),
        'utf8'
      );

      // Save raw embeddings in binary format for efficiency
      const embeddingsBinaryPath = path.join(userEmbeddingsDir, `${documentId}_embeddings.bin`);
      const embeddingsBuffer = this.convertEmbeddingsToBuffer(result.embeddings);
      await writeFile(embeddingsBinaryPath, embeddingsBuffer);

      // Store embeddings in vector database if available
      let vectorStoreResult = { success: false, error: 'Vector store not initialized' };
      if (this.vectorStoreService) {
        try {
          // Update progress to indicate vector storage
          await writeFile(
            progressFilePath,
            JSON.stringify({
              documentId,
              total: chunks.length,
              completed: chunks.length,
              progress: 95, // Not quite done yet
              inProgress: true,
              status: 'Storing in vector database'
            }, null, 2),
            'utf8'
          );

          console.log(`Storing ${chunks.length} embeddings in ChromaDB for document ${documentId}`);

          // Get document metadata for storage
          const document = await documentService.getDocument(documentId);

          // Prepare chunks with embeddings for vector store
          const chunksWithEmbeddings = chunks.map((chunk, index) => ({
            text: chunk.text,
            embedding: result.embeddings[index]
          }));

          // Add chunks to vector store
          vectorStoreResult = await this.vectorStoreService.addDocumentChunks(
            chunksWithEmbeddings,
            documentId,
            {
              fileName: document.original_name || path.basename(document.file_path),
              userId: document.user_id,
              fileType: document.file_type
            }
          );

          if (vectorStoreResult.success) {
            console.log(`Successfully stored ${vectorStoreResult.count} chunks in ChromaDB for document ${documentId}`);
          } else {
            console.warn(`Failed to store embeddings in ChromaDB: ${vectorStoreResult.error}`);
          }
        } catch (vectorError) {
          console.error(`Error storing embeddings in ChromaDB:`, vectorError);
          console.error(vectorError.stack);
          vectorStoreResult = { success: false, error: vectorError.message };
          // Continue with file-based storage as fallback
        }
      } else {
        console.warn('VectorStoreService not available, skipping ChromaDB storage');
      }

      // Update progress file to mark completion
      await writeFile(
        progressFilePath,
        JSON.stringify({
          documentId,
          total: chunks.length,
          completed: chunks.length,
          progress: 100,
          inProgress: false,
          completed_at: new Date().toISOString(),
          vector_storage: vectorStoreResult.success ? 'completed' : 'skipped',
          vector_storage_error: vectorStoreResult.success ? null : vectorStoreResult.error
        }, null, 2),
        'utf8'
      );

      return {
        success: true,
        model: result.model,
        count: result.count,
        documentId,
        vectorStorage: vectorStoreResult.success
      };
    } catch (error) {
      console.error(`Error generating embeddings:`, error);

      // Fall back to placeholder if real embedding generation fails
      return this.generatePlaceholderEmbeddings(chunks, documentId, userEmbeddingsDir);
    }
  }

  /**
   * Generate placeholder embeddings when Ollama is not available
   * @param {Array} chunks - Text chunks
   * @param {string} documentId - Document ID
   * @param {string} userEmbeddingsDir - Directory to store embeddings
   * @returns {Promise<Object>} - Placeholder result
   */
  async generatePlaceholderEmbeddings(chunks, documentId, userEmbeddingsDir) {
    console.log(`Using placeholder embeddings for document ${documentId}`);

    // For now, we'll mock a delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Create a placeholder embeddings file
    const embeddingsPlaceholderFilePath = path.join(userEmbeddingsDir, `${documentId}_embeddings_placeholder.json`);
    await writeFile(
      embeddingsPlaceholderFilePath,
      JSON.stringify({
        documentId,
        status: "placeholder",
        note: "Using placeholder embeddings. Real embeddings couldn't be generated.",
        timestamp: new Date().toISOString(),
        chunkCount: chunks.length
      }, null, 2),
      'utf8'
    );

    return {
      success: true,
      isPlaceholder: true,
      documentId,
      chunkCount: chunks.length
    };
  }

  /**
   * Convert embeddings array to binary buffer for storage
   * @param {Array} embeddings - Array of embedding vectors
   * @returns {Buffer} - Binary buffer containing embeddings
   */
  convertEmbeddingsToBuffer(embeddings) {
    if (!embeddings || embeddings.length === 0 || !embeddings[0]) {
      return Buffer.alloc(0);
    }

    const dimensions = embeddings[0].length;
    const buffer = Buffer.alloc(embeddings.length * dimensions * 4); // 4 bytes per float32

    embeddings.forEach((embedding, embIndex) => {
      if (embedding) {
        embedding.forEach((value, valueIndex) => {
          buffer.writeFloatLE(value, (embIndex * dimensions + valueIndex) * 4);
        });
      }
    });

    return buffer;
  }

  /**
   * Extract text from a document based on its file type
   * @param {Object} document - Document object
   * @returns {Promise<string>} - Extracted text
   */
  async extractText(document) {
    const { file_path, file_type } = document;

    try {
      switch (file_type) {
        case 'application/pdf':
          return await this.extractPdfText(file_path);

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractDocxText(file_path);

        case 'text/plain':
          return await readFile(file_path, 'utf8');

        default:
          throw new Error(`Unsupported file type: ${file_type}`);
      }
    } catch (error) {
      console.error(`Error extracting text from ${file_path}:`, error);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }

  /**
   * Extract text from a PDF file
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<string>} - Extracted text
   */
  async extractPdfText(filePath) {
    try {
      // Try using LangChain's PDFLoader first
      if (PDFLoader) {
        console.log(`Using LangChain PDFLoader for ${filePath}`);
        try {
          const loader = new PDFLoader(filePath, {
            splitPages: false // We want the full text, we'll do our own chunking
          });
          const docs = await loader.load();

          // Combine all page content
          const fullText = docs.map(doc => doc.pageContent).join('\n\n');
          console.log(`Successfully extracted ${docs.length} pages from PDF using LangChain`);
          return fullText;
        } catch (langchainError) {
          console.warn(`LangChain PDF extraction failed: ${langchainError.message}. Falling back to pdf-parse.`);
          // Fall through to pdf-parse
        }
      }

      // Fall back to pdf-parse if LangChain fails or isn't available
      if (pdfParse) {
        console.log(`Using pdf-parse for ${filePath}`);
        const dataBuffer = await readFile(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
      } else {
        // Final fallback: read the file as binary and return a placeholder
        console.warn(`PDF parsing not available for ${filePath}. Install pdf-parse package for better results.`);
        return `[PDF content from ${path.basename(filePath)}. Install pdf-parse package for text extraction.]`;
      }
    } catch (error) {
      console.error(`Error extracting text from PDF ${filePath}:`, error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  /**
   * Extract text from a DOCX file
   * @param {string} filePath - Path to the DOCX file
   * @returns {Promise<string>} - Extracted text
   */
  async extractDocxText(filePath) {
    try {
      // Try using LangChain's DocxLoader first
      if (DocxLoader) {
        console.log(`Using LangChain DocxLoader for ${filePath}`);
        try {
          const loader = new DocxLoader(filePath);
          const docs = await loader.load();

          // Combine all content
          const fullText = docs.map(doc => doc.pageContent).join('\n\n');
          console.log(`Successfully extracted DOCX content using LangChain`);
          return fullText;
        } catch (langchainError) {
          console.warn(`LangChain DOCX extraction failed: ${langchainError.message}. Falling back to mammoth.`);
          // Fall through to mammoth
        }
      }

      // Fall back to mammoth if LangChain fails or isn't available
      if (mammoth) {
        console.log(`Using mammoth for ${filePath}`);
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
      } else {
        // Final fallback: read the file as binary and return a placeholder
        console.warn(`DOCX parsing not available for ${filePath}. Install mammoth package for better results.`);
        return `[DOCX content from ${path.basename(filePath)}. Install mammoth package for text extraction.]`;
      }
    } catch (error) {
      console.error(`Error extracting text from DOCX ${filePath}:`, error);
      throw new Error(`Failed to extract text from DOCX: ${error.message}`);
    }
  }

  /**
   * Chunk text into smaller pieces for processing
   * @param {string} text - Text to chunk
   * @param {number} chunkSize - Maximum chunk size in characters
   * @param {number} chunkOverlap - Number of characters to overlap between chunks
   * @returns {Promise<Array<Object>>} - Promise resolving to array of text chunks with metadata
   */
  async chunkText(text, chunkSize = 1000, chunkOverlap = 200) {
    if (!text || text.length === 0) {
      return [];
    }

    // Try using LangChain's RecursiveCharacterTextSplitter if available
    if (RecursiveCharacterTextSplitter) {
      try {
        console.log(`Using LangChain RecursiveCharacterTextSplitter with size=${chunkSize}, overlap=${chunkOverlap}`);

        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: chunkSize,
          chunkOverlap: chunkOverlap,
          // These separators help ensure chunks break at natural boundaries
          separators: ["\n\n", "\n", ". ", "! ", "? ", ".", "!", "?", ";", ":", " ", ""]
        });

        // Split the text
        const langchainChunks = await splitter.createDocuments([text]);

        // Convert LangChain documents to our chunk format
        let currentIndex = 0;
        const chunks = langchainChunks.map(doc => {
          const chunkText = doc.pageContent;
          const startIndex = text.indexOf(chunkText, currentIndex);

          // If we couldn't find the exact chunk (due to transformations), use an approximation
          const actualStartIndex = startIndex >= 0 ? startIndex : currentIndex;
          const endIndex = actualStartIndex + chunkText.length;

          // Update currentIndex for next search
          if (startIndex >= 0) {
            currentIndex = startIndex + chunkText.length - chunkOverlap;
          } else {
            currentIndex += chunkText.length - chunkOverlap;
          }

          return {
            text: chunkText,
            startIndex: actualStartIndex,
            endIndex: endIndex,
            length: chunkText.length
          };
        });

        console.log(`LangChain text splitting created ${chunks.length} chunks`);
        return chunks;
      } catch (error) {
        console.warn(`LangChain text splitting failed: ${error.message}. Using fallback chunking method.`);
        // Fall through to custom implementation
      }
    }

    // Fallback to custom implementation if LangChain is not available or fails
    console.log(`Using custom text chunking with size=${chunkSize}, overlap=${chunkOverlap}`);
    const chunks = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      // Calculate end index for this chunk
      let endIndex = startIndex + chunkSize;

      // If we're not at the end of the text, try to find a good breaking point
      if (endIndex < text.length) {
        // Look for a period, question mark, or exclamation point followed by a space or newline
        const breakMatch = text.substring(endIndex - 100, endIndex + 100).match(/[.!?]\s+/);

        if (breakMatch) {
          // Adjust endIndex to end at this sentence boundary
          const matchIndex = breakMatch.index;
          endIndex = endIndex - 100 + matchIndex + 2; // +2 to include the punctuation and space
        } else {
          // If no sentence boundary, look for a space
          const lastSpace = text.lastIndexOf(' ', endIndex);
          if (lastSpace > startIndex) {
            endIndex = lastSpace + 1;
          }
        }
      } else {
        // If we're at the end of the text, just use the end
        endIndex = text.length;
      }

      // Extract the chunk
      const chunk = text.substring(startIndex, endIndex).trim();

      // Add to chunks array with metadata
      if (chunk) {
        chunks.push({
          text: chunk,
          startIndex,
          endIndex,
          length: chunk.length
        });
      }

      // Move to next chunk, accounting for overlap
      startIndex = endIndex - chunkOverlap;

      // Make sure we're making progress
      if (startIndex <= chunks[chunks.length - 1]?.startIndex) {
        startIndex = chunks[chunks.length - 1].startIndex + 1;
      }
    }

    return chunks;
  }
}

module.exports = new DocumentProcessor();
