import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useMCP } from './MCPContext';
import axios from 'axios';

// Define the structure for a command that needs approval
interface PendingCommand {
  id: string;
  command: string;
  toolName: string;
  parameters: any;
  description: string;
  timestamp: number;
}

// Define the structure for a command result
interface CommandResult {
  id: string;
  commandId: string;
  success: boolean;
  result: any;
  error?: string;
  timestamp: number;
}

// Define the context type
interface MCPAgentContextType {
  isAgentEnabled: boolean;
  toggleAgent: () => void;
  pendingCommands: PendingCommand[];
  commandResults: CommandResult[];
  approveCommand: (commandId: string) => Promise<void>;
  rejectCommand: (commandId: string) => void;
  modifyCommand: (commandId: string, newParameters: any) => void;
  clearCommandResult: (resultId: string) => void;
  processUserRequest: (request: string) => Promise<void>;
  isProcessing: boolean;
}

// Create the context
const MCPAgentContext = createContext<MCPAgentContextType | undefined>(undefined);

// Hook for using the context
export const useMCPAgent = () => {
  const context = useContext(MCPAgentContext);
  if (context === undefined) {
    throw new Error('useMCPAgent must be used within a MCPAgentProvider');
  }
  return context;
};

interface MCPAgentProviderProps {
  children: ReactNode;
}

export const MCPAgentProvider: React.FC<MCPAgentProviderProps> = ({ children }) => {
  // Get MCP context
  const { isConnected, defaultServer, availableTools, executeCommand } = useMCP();

  // State for agent
  const [isAgentEnabled, setIsAgentEnabled] = useState<boolean>(() => {
    // Try to get the agent enabled state from localStorage
    const savedState = localStorage.getItem('mcp_agent_enabled');
    return savedState ? JSON.parse(savedState) : false;
  });

  const [pendingCommands, setPendingCommands] = useState<PendingCommand[]>([]);
  const [commandResults, setCommandResults] = useState<CommandResult[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeModel, setActiveModel] = useState<string | null>(null);

  // Get the active AI model from localStorage
  useEffect(() => {
    const storedModel = localStorage.getItem('selectedModelId');
    if (storedModel) {
      setActiveModel(storedModel);
    }
  }, []);

  // Save agent enabled state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('mcp_agent_enabled', JSON.stringify(isAgentEnabled));
  }, [isAgentEnabled]);

  // Initialize the agent when it's enabled and MCP is connected
  useEffect(() => {
    if (isAgentEnabled && isConnected && defaultServer) {
      // Using a function reference to avoid dependency issues
      const initialize = async () => {
        if (!isConnected || !defaultServer) {
          console.error('Cannot initialize agent: MCP is not connected');
          return false;
        }

        try {
          console.log('Initializing MCP Agent...');

          // Add a welcome message as a command result
          const welcomeResult: CommandResult = {
            id: `result-welcome-${Date.now()}`,
            commandId: 'welcome',
            success: true,
            result: {
              type: 'text',
              text: `MCP Agent initialized. Connected to ${defaultServer.mcp_nickname} at ${defaultServer.mcp_host}:${defaultServer.mcp_port}. ${availableTools.length} tools available.`
            },
            timestamp: Date.now()
          };

          setCommandResults(prev => [...prev, welcomeResult]);
          return true;
        } catch (error) {
          console.error('Error initializing MCP Agent:', error);
          return false;
        }
      };

      initialize();
    }
  }, [isAgentEnabled, isConnected, defaultServer, availableTools.length]);

  // Toggle agent enabled state
  const toggleAgent = () => {
    // Simply toggle the state - the useEffect will handle initialization
    setIsAgentEnabled(!isAgentEnabled);
  };

  // Process a user request using AI to generate commands
  const processUserRequest = async (request: string) => {
    if (!isAgentEnabled || !isConnected || !defaultServer) {
      console.error('Cannot process request: Agent is disabled or MCP is not connected');
      return;
    }

    setIsProcessing(true);

    try {
      // Get available tools to include in the AI prompt
      const toolsInfo = availableTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }));

      // First, check if we have a valid model selected
      if (!activeModel) {
        // No model selected, show error
        const errorResult: CommandResult = {
          id: `result-error-${Date.now()}`,
          commandId: 'error',
          success: false,
          result: null,
          error: 'No AI model selected. Please select a model from the dropdown to use the MCP Agent.',
          timestamp: Date.now()
        };

        setCommandResults(prev => [...prev, errorResult]);
        setIsProcessing(false);
        return;
      }

      // Call AI service to generate command
      const aiResponse = await axios.post('/api/ai/generate-command', {
        request,
        tools: toolsInfo,
        mcpServer: {
          host: defaultServer.mcp_host,
          port: defaultServer.mcp_port
        },
        modelId: activeModel // Pass the selected model to use
      });

      if (aiResponse.data && aiResponse.data.commands && aiResponse.data.commands.length > 0) {
        // Add generated commands to pending commands
        const newCommands = aiResponse.data.commands.map((cmd: any) => ({
          id: `cmd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          command: cmd.command,
          toolName: cmd.toolName,
          parameters: cmd.parameters,
          description: cmd.description,
          timestamp: Date.now()
        }));

        setPendingCommands(prev => [...prev, ...newCommands]);
      } else {
        // No commands generated, show a message
        const noCommandsResult: CommandResult = {
          id: `result-no-commands-${Date.now()}`,
          commandId: 'no-commands',
          success: true,
          result: {
            type: 'text',
            text: 'I couldn\'t determine which MCP command to use for your request. Could you provide more details or try a different request?'
          },
          timestamp: Date.now()
        };

        setCommandResults(prev => [...prev, noCommandsResult]);
      }
    } catch (error) {
      console.error('Error processing user request:', error);
      
      // Check if it's a network error
      if (error.message && error.message.includes('Network Error')) {
        const networkErrorResult: CommandResult = {
          id: `result-error-${Date.now()}`,
          commandId: 'error',
          success: false,
          result: null,
          error: 'Unable to connect to the AI service. Please check your network connection and try again.',
          timestamp: Date.now()
        };
        
        setCommandResults(prev => [...prev, networkErrorResult]);
      } else if (error.response && error.response.status === 404) {
        // API not found - likely the backend doesn't have the generate-command endpoint
        const apiErrorResult: CommandResult = {
          id: `result-error-${Date.now()}`,
          commandId: 'error',
          success: false,
          result: null,
          error: 'The AI command generation service is not available. Please make sure the backend API is properly configured.',
          timestamp: Date.now()
        };
        
        setCommandResults(prev => [...prev, apiErrorResult]);
      } else {
        // For all other errors, create a general error message
        const errorResult: CommandResult = {
          id: `result-error-${Date.now()}`,
          commandId: 'error',
          success: false,
          result: null,
          error: `Error generating MCP commands: ${error.message || 'Unknown error'}`,
          timestamp: Date.now()
        };
        
        setCommandResults(prev => [...prev, errorResult]);

        // For debugging purposes, add a simulated command
        if (process.env.NODE_ENV === 'development') {
          console.log('Adding simulated command for development testing');
          const simulatedCommand: PendingCommand = {
            id: `cmd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            command: `Execute request: "${request}"`,
            toolName: 'run_terminal_cmd',
            parameters: { command: `echo "Processing: ${request}"`, is_background: false },
            description: `This is a simulated command for the request: "${request}"`,
            timestamp: Date.now()
          };

          setPendingCommands(prev => [...prev, simulatedCommand]);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Approve and execute a command
  const approveCommand = async (commandId: string) => {
    const command = pendingCommands.find(cmd => cmd.id === commandId);
    if (!command) {
      console.error(`Command with ID ${commandId} not found`);
      return;
    }

    try {
      // Execute the command using MCP
      const result = await executeCommand(command.toolName, command.parameters);

      // Add result to command results
      const commandResult: CommandResult = {
        id: `result-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        commandId: command.id,
        success: true,
        result,
        timestamp: Date.now()
      };

      setCommandResults(prev => [...prev, commandResult]);
    } catch (error: any) {
      // Add error result
      const commandResult: CommandResult = {
        id: `result-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        commandId: command.id,
        success: false,
        result: null,
        error: error.message || 'Unknown error',
        timestamp: Date.now()
      };

      setCommandResults(prev => [...prev, commandResult]);
    } finally {
      // Remove command from pending commands
      setPendingCommands(prev => prev.filter(cmd => cmd.id !== commandId));
    }
  };

  // Reject a command
  const rejectCommand = (commandId: string) => {
    setPendingCommands(prev => prev.filter(cmd => cmd.id !== commandId));
  };

  // Modify a command's parameters
  const modifyCommand = (commandId: string, newParameters: any) => {
    setPendingCommands(prev =>
      prev.map(cmd =>
        cmd.id === commandId
          ? { ...cmd, parameters: newParameters }
          : cmd
      )
    );
  };

  // Clear a command result
  const clearCommandResult = (resultId: string) => {
    setCommandResults(prev => prev.filter(result => result.id !== resultId));
  };

  // Context value
  const contextValue: MCPAgentContextType = {
    isAgentEnabled,
    toggleAgent,
    pendingCommands,
    commandResults,
    approveCommand,
    rejectCommand,
    modifyCommand,
    clearCommandResult,
    processUserRequest,
    isProcessing
  };

  return (
    <MCPAgentContext.Provider value={contextValue}>
      {children}
    </MCPAgentContext.Provider>
  );
};

export default MCPAgentContext;
