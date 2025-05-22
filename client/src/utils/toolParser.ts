/**
 * Interface for a parsed tool call
 */
export interface ParsedToolCall {
  toolName: string;
  parameters: Record<string, any>;
  originalText: string;
  isContextReadingTool?: boolean;
}

/**
 * Extracts tool calls from AI responses
 * @param text The AI response text to parse
 * @returns The parsed tool call or null if no tool call was found
 */
export const extractToolCall = (text: string): ParsedToolCall | null => {
  try {
    // First, check for read_context tool specifically (most common case)
    if (text.includes('read_context')) {
      // Look for any format of read_context tool call
      const readContextRegex = /TOOL:\s*\{\s*"tool":\s*"read_context"[^}]*\}/i;
      const readContextMatch = text.match(readContextRegex);

      if (readContextMatch) {
        return {
          toolName: 'read_context',
          parameters: {},
          originalText: readContextMatch[0],
          isContextReadingTool: true
        };
      }

      // Alternative format check (with single quotes or different spacing)
      const altReadContextRegex = /TOOL:\s*\{\s*['"]?tool['"]?\s*:\s*['"]?read_context['"]?/i;
      const altReadContextMatch = text.match(altReadContextRegex);

      if (altReadContextMatch) {
        // Find the closing brace by scanning forward
        const startIndex = altReadContextMatch.index || 0;
        let endIndex = startIndex;
        let braceCount = 0;
        let foundOpenBrace = false;

        for (let i = startIndex; i < text.length; i++) {
          if (text[i] === '{') {
            foundOpenBrace = true;
            braceCount++;
          } else if (text[i] === '}') {
            braceCount--;
            if (foundOpenBrace && braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }

        const originalText = text.substring(startIndex, endIndex);

        return {
          toolName: 'read_context',
          parameters: {},
          originalText,
          isContextReadingTool: true
        };
      }
    }

    // General case - try to parse JSON
    const toolMatch = text.match(/TOOL:\s*(\{[\s\S]*?\})/);
    if (toolMatch && toolMatch[1]) {
      try {
        const jsonStr = toolMatch[1];
        const toolCall = JSON.parse(jsonStr);

        if (toolCall.tool) {
          return {
            toolName: toolCall.tool,
            parameters: toolCall.parameters || {},
            originalText: toolMatch[0],
            isContextReadingTool: toolCall.tool === 'read_context'
          };
        }
      } catch (jsonError) {
        console.log('JSON parsing error, trying alternative approach:', jsonError);

        // If JSON parsing fails, check if it's a read_context tool
        if (toolMatch[0].includes('read_context')) {
          return {
            toolName: 'read_context',
            parameters: {},
            originalText: toolMatch[0],
            isContextReadingTool: true
          };
        }
      }
    }

    return null;
  } catch (e) {
    console.error('Error extracting tool call:', e);
    return null;
  }
};

/**
 * Replaces a tool call in the text with a placeholder
 * @param text The original text
 * @param toolCall The parsed tool call to replace
 * @param replacement The replacement text
 * @returns The text with the tool call replaced
 */
export const replaceToolCall = (
  text: string,
  toolCall: ParsedToolCall,
  replacement: string
): string => {
  return text.replace(toolCall.originalText, replacement);
};

/**
 * Checks if the AI response contains a tool call
 * @param text The AI response text to check
 * @returns True if the text contains a tool call, false otherwise
 */
export const containsToolCall = (text: string): boolean => {
  return text.includes('TOOL:') && extractToolCall(text) !== null;
};

/**
 * Checks if the AI response contains a read_context tool call
 * @param text The AI response text to check
 * @returns True if the text contains a read_context tool call, false otherwise
 */
export const containsReadContextToolCall = (text: string): boolean => {
  // First try the extractToolCall method
  const toolCall = extractToolCall(text);
  if (toolCall !== null && toolCall.isContextReadingTool === true) {
    return true;
  }

  // Fallback: simple string matching for common patterns
  const patterns = [
    /TOOL:\s*{\s*"tool":\s*"read_context"/i,
    /TOOL:\s*{\s*'tool':\s*'read_context'/i,
    /TOOL:\s*{\s*tool:\s*['"]?read_context['"]?/i,
    /read_context.*tool/i,
    /tool.*read_context/i
  ];

  return patterns.some(pattern => pattern.test(text));
};
