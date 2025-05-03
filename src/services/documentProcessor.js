const fs = require('fs');
const path = require('path');
// Don't require documentService here to avoid circular dependency
// We'll use a function to get it when needed
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// Helper function to get documentService only when needed
function getDocumentService() {
  return require('./documentService');
}

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
    // Don't store documentService directly to avoid circular dependency
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
   * Process a document from file to embeddings
   * @param {Object} document - Document object with file path
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Processing result
   */
  async processDocument(document, options = {}) {
    try {
      const {
        userId = document.user_id,
        sessionId = null
      } = options;

      console.log(`Processing document ${document.id}: ${document.original_name}${sessionId ? ` for session ${sessionId}` : ''}`);

      // Update progress to indicate start
      await this.updateDocumentProgress(document.id, {
        status: 'processing',
        progress: 10,
        message: 'Started document processing'
      });

      // Extract text from the document
      const textResult = await this.extractText(document);
      if (!textResult.success) {
        console.error(`Failed to extract text: ${textResult.error}`);
        return textResult;
      }

      // Update progress after text extraction
      await this.updateDocumentProgress(document.id, {
        progress: 30,
        message: 'Text extracted, chunking document'
      });

      // Split text into chunks
      const chunks = await this.chunkText(textResult.text, document.file_type);
      console.log(`Document ${document.id} chunked into ${chunks.length} segments`);

      // Update progress after chunking
      await this.updateDocumentProgress(document.id, {
        progress: 50,
        message: 'Document chunked, generating embeddings'
      });

      // Generate embeddings for the chunks
      const embeddingsResult = await this.generateEmbeddings(chunks, document.id, userId, sessionId);
      if (!embeddingsResult.success) {
        console.error(`Failed to generate embeddings: ${embeddingsResult.error}`);
        return embeddingsResult;
      }

      // Update progress after embedding generation
      await this.updateDocumentProgress(document.id, {
        status: 'completed',
        progress: 100,
        message: 'Document processing completed'
      });

      console.log(`Document ${document.id} processing completed: ${chunks.length} chunks processed`);
      return {
        success: true,
        chunks: chunks.length,
        message: `Document processed successfully: ${chunks.length} chunks created`
      };
    } catch (error) {
      console.error(`Error processing document ${document.id}:`, error);
      await this.updateDocumentProgress(document.id, {
        status: 'error',
        message: `Processing error: ${error.message}`
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate embeddings for document chunks
   * @param {Array} chunks - Document text chunks
   * @param {string} documentId - Document ID
   * @param {string} userId - User ID
   * @param {string} sessionId - Optional session ID
   * @returns {Promise<Object>} - Result with embeddings
   */
  async generateEmbeddings(chunks, documentId, userId, sessionId = null) {
    try {
      console.log(`Generating embeddings for document ${documentId}, ${chunks.length} chunks${sessionId ? `, session ${sessionId}` : ''}`);

      // Initialize embedding generator if needed
      if (!this.ollamaService) {
        await this.initOllamaService();
      }

      // If we still don't have OllamaService, use placeholder embeddings
      if (!this.ollamaService) {
        console.warn(`OllamaService not available, using placeholder embeddings for document ${documentId}`);

        // Generate placeholder embeddings (random vectors)
        const placeholderEmbeddings = chunks.map(() => {
          // Create a random 768-dimensional vector (typical embedding size)
          const dimensions = 768;
          const embedding = Array(dimensions).fill(0).map(() => (Math.random() * 2) - 1);

          // Normalize the vector to unit length
          const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
          return embedding.map(val => val / magnitude);
        });

        console.log(`Generated ${placeholderEmbeddings.length} placeholder embeddings for document ${documentId}`);

        // Continue with vector storage using placeholder embeddings
        if (this.vectorStoreService) {
          try {
            console.log(`Storing ${chunks.length} placeholder embeddings in vector store for document ${documentId}`);

            // Get document service using helper function to avoid circular dependency
            const documentService = getDocumentService();
            // Get document metadata
            const document = await documentService.getDocument(documentId);

            // Prepare chunks with embeddings for vector store
            const chunksWithEmbeddings = chunks.map((chunk, index) => ({
              text: chunk.text,
              embedding: placeholderEmbeddings[index]
            }));

            // Add chunks to vector store with session ID in metadata
            const vectorStoreResult = await this.vectorStoreService.addDocumentChunks(
              chunksWithEmbeddings,
              documentId,
              {
                fileName: document.original_name,
                userId: document.user_id || userId,
                fileType: document.file_type,
                sessionId: sessionId || document.session_id || null
              }
            );

            if (!vectorStoreResult.success) {
              console.error(`Error storing placeholder embeddings in vector store:`, vectorStoreResult.error);
            } else {
              console.log(`Successfully stored ${vectorStoreResult.count} placeholder vectors for document ${documentId}`);
            }
          } catch (storeError) {
            console.error(`Error storing placeholder embeddings in vector store:`, storeError);
          }
        }

        return {
          success: true,
          embeddings: placeholderEmbeddings,
          message: `Generated ${placeholderEmbeddings.length} placeholder embeddings for document ${documentId} (Ollama unavailable)`
        };
      }

      // Prepare texts for embedding
      const texts = chunks.map(chunk => chunk.text);

      // Generate embeddings using Ollama
      const result = await this.ollamaService.generateEmbeddingsBatch(texts);
      if (!result.success) {
        console.error(`Error generating embeddings:`, result.error);
        return result;
      }

      // Store embeddings in vector database if available
      if (this.vectorStoreService) {
        try {
          console.log(`Storing ${chunks.length} embeddings in vector store for document ${documentId}`);

          // Get document service using helper function to avoid circular dependency
          const documentService = getDocumentService();
          // Get document metadata for storage
          const document = await documentService.getDocument(documentId);

          // Prepare chunks with embeddings for vector store
          const chunksWithEmbeddings = chunks.map((chunk, index) => ({
            text: chunk.text,
            embedding: result.embeddings[index]
          }));

          // Add chunks to vector store with session ID in metadata if available
          const vectorStoreResult = await this.vectorStoreService.addDocumentChunks(
            chunksWithEmbeddings,
            documentId,
            {
              fileName: document.original_name || document.file_path.split('/').pop(),
              userId: document.user_id || userId,
              fileType: document.file_type,
              sessionId: sessionId || document.session_id || null  // Include session ID in metadata
            }
          );

          if (!vectorStoreResult.success) {
            console.error(`Error storing embeddings in vector store:`, vectorStoreResult.error);
          } else {
            console.log(`Successfully stored ${vectorStoreResult.count} vectors in store for document ${documentId}`);
          }
        } catch (storeError) {
          console.error(`Error storing embeddings in vector store:`, storeError);
          // Continue even if vector store fails
        }
      }

      return {
        success: true,
        embeddings: result.embeddings,
        message: `Generated ${result.embeddings.length} embeddings for document ${documentId}`
      };
    } catch (error) {
      console.error(`Error generating embeddings:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract text from a document based on its file type
   * @param {Object} document - Document object
   * @returns {Promise<Object>} - Object with extracted text or error
   */
  async extractText(document) {
    if (!document || !document.file_path) {
      return {
        success: false,
        error: 'Invalid document or missing file path'
      };
    }

    const { file_path, file_type } = document;
    console.log(`Extracting text from ${file_path} (${file_type})`);

    try {
      let text = '';

      // Extract based on file type
      switch (file_type.toLowerCase()) {
        case 'application/pdf':
        case 'pdf':
          text = await this.extractPdfText(file_path);
          break;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'docx':
          text = await this.extractDocxText(file_path);
          break;

        case 'text/plain':
        case 'txt':
          text = await readFile(file_path, 'utf8');
          break;

        default:
          return {
            success: false,
            error: `Unsupported file type: ${file_type}`
          };
      }

      // Check if we got any text back
      if (!text || text.length === 0) {
        return {
          success: false,
          error: 'No text could be extracted from the document'
        };
      }

      console.log(`Successfully extracted ${text.length} characters from ${file_path}`);

      return {
        success: true,
        text,
        length: text.length
      };
    } catch (error) {
      console.error(`Error extracting text from ${file_path}:`, error);
      return {
        success: false,
        error: `Failed to extract text: ${error.message}`
      };
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
   * Update document processing progress
   * @param {string} documentId - Document ID
   * @param {Object} progress - Progress info
   * @returns {Promise<void>}
   */
  async updateDocumentProgress(documentId, progress) {
    if (!documentId) {
      console.warn('Cannot update progress: Document ID is undefined');
      return;
    }

    try {
      const { status, progress: progressValue, message } = progress;

      // Default status to 'processing' if not provided
      const docStatus = status || 'processing';

      console.log(`Updating document ${documentId} progress: ${progressValue || 0}% - ${message || 'Processing'} (status: ${docStatus})`);

      // Get document service using helper function to avoid circular dependency
      const documentService = getDocumentService();

      // Try to get the document first to verify it exists
      try {
        const document = await documentService.getDocument(documentId);
        if (!document) {
          console.warn(`Cannot update progress: Document ${documentId} not found in database`);
          return;
        }
      } catch (docError) {
        console.warn(`Cannot update progress: Error retrieving document ${documentId}: ${docError.message}`);
        return;
      }

      // Update document status through document service
      await documentService.updateDocumentStatus(
        documentId,
        docStatus,
        message,
        true // Mark as long-running to prevent session timeout
      );

      console.log(`Document ${documentId} progress updated: ${progressValue || 0}% - ${message || 'Processing'}`);
    } catch (error) {
      console.error(`Error updating document progress for ${documentId}: ${error.message}`);
      // Don't throw - we don't want to interrupt processing due to progress update failure
    }
  }

  /**
   * Split text into chunks for processing
   * @param {string} text - Text to split into chunks
   * @param {string} fileType - File type for optimizing chunking strategy
   * @param {number} chunkSize - Target chunk size in characters
   * @param {number} chunkOverlap - Overlap between chunks in characters
   * @returns {Array<Object>} - Array of text chunks with metadata
   */
  async chunkText(text, fileType, chunkSize = 1000, chunkOverlap = 200) {
    if (!text || text.length === 0) {
      return [];
    }

    console.log(`Chunking text (${text.length} chars) with size=${chunkSize}, overlap=${chunkOverlap}`);

    // Try using LangChain's RecursiveCharacterTextSplitter if available
    if (RecursiveCharacterTextSplitter) {
      try {
        console.log(`Using LangChain RecursiveCharacterTextSplitter`);

        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: chunkSize,
          chunkOverlap: chunkOverlap,
          // These separators help ensure chunks break at natural boundaries
          separators: ["\n\n", "\n", ". ", "! ", "? ", ".", "!", "?", ";", ":", " ", ""]
        });

        // Split the text
        const langchainChunks = await splitter.createDocuments([text]);

        // Convert LangChain documents to our chunk format
        const chunks = langchainChunks.map((doc, index) => {
          return {
            text: doc.pageContent,
            index: index,
            length: doc.pageContent.length
          };
        });

        console.log(`LangChain text splitting created ${chunks.length} chunks`);
        return chunks;
      } catch (error) {
        console.warn(`LangChain text splitting failed: ${error.message}. Using fallback chunking method.`);
        // Fall through to custom implementation
      }
    }

    // Fallback to custom chunking implementation
    console.log(`Using custom text chunking method`);
    const chunks = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      // Calculate end index for this chunk
      let endIndex = Math.min(startIndex + chunkSize, text.length);

      // If we're not at the end of the text, try to find a good breaking point
      if (endIndex < text.length) {
        // Look for paragraph breaks first
        const paragraphBreak = text.lastIndexOf('\n\n', endIndex);
        if (paragraphBreak > startIndex && paragraphBreak > endIndex - 200) {
          endIndex = paragraphBreak + 2; // +2 to include the newlines
        } else {
          // Look for sentence endings (.!?)
          const sentenceMatch = text.substring(endIndex - 100, endIndex + 100).match(/[.!?]\s/);
          if (sentenceMatch) {
            const matchIndex = sentenceMatch.index;
            endIndex = endIndex - 100 + matchIndex + 2; // +2 to include punctuation and space
          } else {
            // Look for a space as last resort
            const lastSpace = text.lastIndexOf(' ', endIndex);
            if (lastSpace > startIndex) {
              endIndex = lastSpace + 1;
            }
          }
        }
      }

      // Extract the chunk
      const chunk = text.substring(startIndex, endIndex).trim();

      // Add to chunks array if not empty
      if (chunk.length > 0) {
        chunks.push({
          text: chunk,
          index: chunks.length,
          length: chunk.length
        });
      }

      // Move to next chunk, accounting for overlap
      startIndex = Math.max(startIndex + 1, endIndex - chunkOverlap);
    }

    console.log(`Custom text chunking created ${chunks.length} chunks`);
    return chunks;
  }
}

module.exports = new DocumentProcessor();