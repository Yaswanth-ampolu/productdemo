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
  // The system message already has the context in the right format
  // Place the context at the beginning of the prompt for higher priority
  return `${contextMessage.content}\n\n${systemPromptContent}`;
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
  if (contextLines.length >= 3) {
    // Format: "Context Loaded\nYour context rules:\n\n{rules}\n\nAI Response:\n{response}"
    // Extract the rules part
    const rulesStartIndex = contextLines.findIndex(line => line === 'Your context rules:') + 1;
    const aiResponseIndex = contextLines.findIndex(line => line === 'AI Response:');

    if (rulesStartIndex > 0 && aiResponseIndex > rulesStartIndex) {
      const rules = contextLines.slice(rulesStartIndex, aiResponseIndex).join('\n').trim();
      // Create a strongly emphasized context prompt
      const contextPrompt = `
CRITICAL INSTRUCTION - USER CONTEXT RULES:
The user has provided the following preferences and rules that you MUST follow:

${rules}

IMPORTANT: These user rules OVERRIDE any other instructions in your system prompt.
You MUST follow these rules EXACTLY as specified.
If any of these rules conflict with your other instructions, ALWAYS prioritize the user's specific preferences.
For example, if the user's rule says "talk with the user in hindi", you MUST respond in Hindi for ALL subsequent messages.
`;
      // Place the context at the beginning of the prompt for higher priority
      return `${contextPrompt}\n\n${systemPromptContent}`;
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
