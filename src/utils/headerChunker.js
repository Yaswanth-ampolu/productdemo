/**
 * Header-Based Text Chunker
 * Splits documents into chunks based on section headers for improved RAG retrieval
 */

/**
 * Splits text into chunks based on section headers
 * @param {string} text - The document text to chunk
 * @param {Object} options - Chunking options
 * @param {number} options.chunkSize - Maximum chunk size in characters (default: 1000)
 * @param {number} options.overlap - Overlap between chunks in characters (default: 200)
 * @param {string} options.headerRegex - Custom regex for header detection
 * @returns {Array<Object>} Array of chunks with metadata
 */
function chunkBySection(text, options = {}) {
  if (!text || typeof text !== 'string' || text.length === 0) {
    return [];
  }

  const {
    chunkSize = 1000,
    overlap = 200,
    headerRegex = /^\s*(\d+(?:\.\d+)*)\s+([A-Z][^\n]{3,})$/gm
  } = options;

  // Split text into lines for processing
  const lines = text.split('\n');
  const chunks = [];
  let currentChunk = {
    text: '',
    sectionTitle: 'Introduction', // Default title for content before first header
    index: 0,
    startChar: 0,
    endChar: 0
  };
  
  let currentSectionTitle = 'Introduction';
  let currentPosition = 0;
  let inSection = false;
  
  // Helper function to check if a line matches header pattern
  function isHeader(line) {
    // Reset regex lastIndex to ensure it works correctly
    headerRegex.lastIndex = 0;
    return headerRegex.test(line);
  }

  // Helper function to finalize and add a chunk
  function finalizeChunk(chunk, endPosition) {
    if (chunk.text.trim().length > 0) {
      // Update the end character position
      chunk.endChar = endPosition - 1;
      
      chunks.push({...chunk});
      console.log(`Created chunk for section: ${chunk.sectionTitle} (${chunk.text.length} chars)`);
    }
  }

  // Helper function to split a large section into smaller chunks
  function splitLargeSection(sectionText, sectionTitle, startPosition) {
    // If the section is small enough, return it as a single chunk
    if (sectionText.length <= chunkSize) {
      return [{
        text: sectionText,
        sectionTitle,
        index: chunks.length,
        startChar: startPosition,
        endChar: startPosition + sectionText.length - 1
      }];
    }
    
    // Otherwise, split it further by paragraphs
    const paragraphs = sectionText.split('\n\n');
    const subChunks = [];
    let currentSubChunk = {
      text: '',
      sectionTitle,
      index: chunks.length,
      startChar: startPosition,
      endChar: 0
    };
    let currentLength = 0;
    let currentStartChar = startPosition;
    
    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed chunk size, finalize current chunk
      if (currentLength + paragraph.length > chunkSize && currentLength > 0) {
        currentSubChunk.endChar = currentStartChar + currentLength - 1;
        subChunks.push({...currentSubChunk});
        
        // Start a new subchunk with overlap
        const overlapText = currentSubChunk.text.substring(
          Math.max(0, currentSubChunk.text.length - overlap)
        );
        
        currentStartChar = currentSubChunk.endChar - overlapText.length + 1;
        currentSubChunk = {
          text: overlapText,
          sectionTitle: `${sectionTitle} (continued)`,
          index: chunks.length + subChunks.length,
          startChar: currentStartChar,
          endChar: 0
        };
        currentLength = overlapText.length;
      }
      
      // Add paragraph to current subchunk
      currentSubChunk.text += (currentLength > 0 ? '\n\n' : '') + paragraph;
      currentLength += (currentLength > 0 ? 2 : 0) + paragraph.length;
    }
    
    // Add the last subchunk if it has content
    if (currentSubChunk.text.trim().length > 0) {
      currentSubChunk.endChar = currentStartChar + currentLength - 1;
      subChunks.push(currentSubChunk);
    }
    
    return subChunks;
  }

  // Process the document line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeaderLine = isHeader(line);
    
    // If we find a header, finalize the current chunk
    if (isHeaderLine) {
      // Extract the section title from the header line
      const headerMatch = line.match(/^\s*(\d+(?:\.\d+)*)\s+(.+)$/);
      const newSectionTitle = headerMatch ? 
        `${headerMatch[1]} ${headerMatch[2].trim()}` : 
        line.trim();
      
      // Finalize the current chunk if it has content
      if (currentChunk.text.trim().length > 0) {
        finalizeChunk(currentChunk, currentPosition);
      }
      
      // Start a new chunk with this header
      currentSectionTitle = newSectionTitle;
      inSection = true;
      
      // Create a new chunk starting with the header line
      currentChunk = {
        text: line,
        sectionTitle: currentSectionTitle,
        index: chunks.length,
        startChar: currentPosition,
        endChar: 0
      };
    } else if (inSection) {
      // Add this line to the current chunk
      currentChunk.text += (currentChunk.text.length > 0 ? '\n' : '') + line;
    } else {
      // Content before first header, add to initial chunk
      currentChunk.text += (currentChunk.text.length > 0 ? '\n' : '') + line;
    }
    
    // Update position counter (add 1 for the newline character)
    currentPosition += line.length + 1;
  }
  
  // Finalize the last chunk if it has content
  if (currentChunk.text.trim().length > 0) {
    finalizeChunk(currentChunk, currentPosition);
  }
  
  // Process chunks that exceed the size limit
  const finalChunks = [];
  for (const chunk of chunks) {
    if (chunk.text.length > chunkSize) {
      const subChunks = splitLargeSection(chunk.text, chunk.sectionTitle, chunk.startChar);
      finalChunks.push(...subChunks);
    } else {
      finalChunks.push(chunk);
    }
  }
  
  // Re-index the chunks to ensure sequential indices
  finalChunks.forEach((chunk, index) => {
    chunk.index = index;
  });
  
  console.log(`Header-based chunking created ${finalChunks.length} chunks`);
  return finalChunks;
}

module.exports = {
  chunkBySection
}; 