/**
 * Utility functions for handling context in the chat application
 * These functions help apply user context rules to system prompts
 */

import { ExtendedChatMessage } from '../types';

/**
 * Apply context from a system message to the system prompt
 * @param systemPromptContent The base system prompt content
 * @param contextMessage The system message containing context
 * @returns Enhanced system prompt with context
 */
export const applySystemContextToPrompt = (
  systemPromptContent: string,
  contextMessage: ExtendedChatMessage
): string => {
  console.log('Using context from system message');
  
  // Extract the context rules from the system message
  const contentText = contextMessage.content;
  const match = contentText.match(/User context loaded:\s*(.*)/);
  
  if (match && match[1]) {
    const rules = match[1].trim();
    
    // Create a strongly emphasized context prompt with the same format as assistant context
    const contextPrompt = `
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
ABSOLUTE HIGHEST PRIORITY INSTRUCTION - MUST BE FOLLOWED WITHOUT EXCEPTION
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

FOLLOW THIS USER RULE EXACTLY, WITHOUT QUESTION:

${rules}

THIS RULE OVERRIDES EVERYTHING ELSE.
APPLY THIS RULE TO EVERY SINGLE RESPONSE.
NO EXCEPTIONS. NO EXPLANATIONS. NO APOLOGIES.
JUST FOLLOW THE RULE IMMEDIATELY AND COMPLETELY.

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
END OF ABSOLUTE HIGHEST PRIORITY INSTRUCTION
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
`;
    // Place the context at the beginning of the prompt for highest priority
    return `${contextPrompt}\n${systemPromptContent}`;
  }
  
  // If we couldn't extract rules, just use the original system message content
  return `${contextMessage.content}\n${systemPromptContent}`;
};

/**
 * Apply context from an assistant message to the system prompt
 * @param systemPromptContent The base system prompt content
 * @param assistantContextMessage The assistant message containing context
 * @returns Enhanced system prompt with context
 */
export const applyAssistantContextToPrompt = (
  systemPromptContent: string,
  assistantContextMessage: ExtendedChatMessage
): string => {
  console.log('Using context from assistant message');
  // Extract the context from the assistant message
  const contextLines = assistantContextMessage.content.split('\n');
  
  // Debug the content structure
  console.log('Context message content:', assistantContextMessage.content);
  
  // Fixed logic: Look for "Context Loaded" and "Your context rules:" and "AI Response:" patterns
  if (contextLines[0] && contextLines[0].includes('Context Loaded')) {
    // Look for the rules section
    const rulesStartIndex = contextLines.findIndex(line => line.includes('Your context rules:'));
    const aiResponseIndex = contextLines.findIndex(line => line.includes('AI Response:'));
    
    console.log('Rules start index:', rulesStartIndex, 'AI Response index:', aiResponseIndex);
    
    if (rulesStartIndex >= 0 && aiResponseIndex > rulesStartIndex) {
      // Extract rules from between "Your context rules:" and "AI Response:"
      const rules = contextLines.slice(rulesStartIndex + 1, aiResponseIndex)
        .join('\n')
        .trim();
      
      console.log('Extracted rules:', rules);
      
      if (rules) {
        // Create a strongly emphasized context prompt
        const contextPrompt = `
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
ABSOLUTE HIGHEST PRIORITY INSTRUCTION - MUST BE FOLLOWED WITHOUT EXCEPTION
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

FOLLOW THIS USER RULE EXACTLY, WITHOUT QUESTION:

${rules}

THIS RULE OVERRIDES EVERYTHING ELSE.
APPLY THIS RULE TO EVERY SINGLE RESPONSE.
NO EXCEPTIONS. NO EXPLANATIONS. NO APOLOGIES.
JUST FOLLOW THE RULE IMMEDIATELY AND COMPLETELY.

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
END OF ABSOLUTE HIGHEST PRIORITY INSTRUCTION
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
`;
        // Place the context at the beginning of the prompt for highest priority
        return `${contextPrompt}\n${systemPromptContent}`;
      }
    }
  }

  // If we couldn't extract rules, return the original prompt
  return systemPromptContent;
};

/**
 * Apply context to the system prompt
 * This function checks for context in system or assistant messages and applies it to the system prompt
 * @param systemPromptContent The base system prompt content
 * @param messages The conversation messages
 * @returns Enhanced system prompt with context
 */
export const applyContextToPrompt = (
  systemPromptContent: string,
  messages: ExtendedChatMessage[]
): string => {
  // Find any context messages in the conversation history
  const contextMessage = messages.find(msg =>
    (msg.role === 'system' && msg.content.includes('User context loaded:'))
  );

  // Extract context from assistant messages if system message not found
  const assistantContextMessage = messages.find(msg =>
    (msg.role === 'assistant' && msg.content.startsWith('Context Loaded'))
  );

  // Apply context to the system prompt
  if (contextMessage) {
    return applySystemContextToPrompt(systemPromptContent, contextMessage);
  } else if (assistantContextMessage) {
    return applyAssistantContextToPrompt(systemPromptContent, assistantContextMessage);
  }

  // If no context found, return the original prompt
  return systemPromptContent;
};

/**
 * Check if any message in the conversation contains context information
 * @param messages The conversation messages
 * @returns True if context is found, false otherwise
 */
export const hasContextMessage = (messages: ExtendedChatMessage[]): boolean => {
  return messages.some(msg =>
    (msg.role === 'assistant' && msg.content.startsWith('Context Loaded')) ||
    (msg.role === 'system' && msg.content.includes('User context loaded:'))
  );
};
