import { readAIContext } from './aiContextService';

/**
 * Interface for AI tools that can be used in the chat
 */
export interface AITool {
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
}

/**
 * Read context tool for AI
 * Allows the AI to access the user's context (rules, preferences, etc.)
 */
export const readContextTool: AITool = {
  name: 'read_context',
  description: 'Read the user\'s context including rules and preferences',
  execute: async () => {
    try {
      const context = await readAIContext();
      return {
        success: true,
        context
      };
    } catch (error) {
      console.error('Error executing read_context tool:', error);
      return {
        success: false,
        error: 'Failed to read context'
      };
    }
  }
};

/**
 * List of available AI tools
 */
export const aiTools: AITool[] = [
  readContextTool
];

/**
 * Get an AI tool by name
 * @param name The name of the tool to get
 * @returns The tool or undefined if not found
 */
export const getToolByName = (name: string): AITool | undefined => {
  return aiTools.find(tool => tool.name === name);
};
