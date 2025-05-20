import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
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
  needsAnalysis?: boolean; // Flag to indicate if this result needs analysis
  isAnalyzed?: boolean;    // Flag to indicate if analysis is complete
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
  isConnected: boolean;
  sseStatus: string;
  reconnectToServer: () => void;
  addCommandResult: (result: CommandResult) => void;
  isAnalyzing: boolean;
  isStopped: boolean;
  toggleStopResume: () => void;
  addToPendingAnalysis: (result: CommandResult) => void;
  hasClientIdIssue: boolean;
  attemptClientIdRecovery: () => Promise<boolean>;
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
  const {
    isConnected,
    defaultServer,
    availableTools,
    executeCommand,
    mcpConnection,
    reconnect,
    getClientId,
    registerToolResultHandler,
    dispatchToolResult
  } = useMCP();

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

  // New state for analysis loop
  const [pendingAnalysis, setPendingAnalysis] = useState<CommandResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isStopped, setIsStopped] = useState<boolean>(false);

  // Add state for tracking client ID issues
  const [hasClientIdIssue, setHasClientIdIssue] = useState<boolean>(false);
  const recoveryAttemptsRef = useRef<number>(0);
  const MAX_RECOVERY_ATTEMPTS = 3;

  const lastProcessedClientIdRef = useRef<string | null>(null); // Ref to track processed clientId for welcome message

  // Stable addCommandResult using useCallback
  const addCommandResult = useCallback((result: CommandResult) => {
    setCommandResults(prev => [...prev, result]);
  }, []);

  // Stable addToPendingAnalysis using useCallback (moved up)
  const addToPendingAnalysis = useCallback((result: CommandResult) => {
    setPendingAnalysis(prev => [...prev, result]);
  }, []);

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

  // Session persistence - save state to sessionStorage
  useEffect(() => {
    if (isAgentEnabled && commandResults.length > 0) {
      sessionStorage.setItem('mcp_command_results', JSON.stringify(commandResults));
    }
  }, [isAgentEnabled, commandResults]);

  useEffect(() => {
    if (isAgentEnabled && pendingCommands.length > 0) {
      sessionStorage.setItem('mcp_pending_commands', JSON.stringify(pendingCommands));
    }
  }, [isAgentEnabled, pendingCommands]);

  // Restore state from sessionStorage
  useEffect(() => {
    if (isAgentEnabled && isConnected) {
      const savedResults = sessionStorage.getItem('mcp_command_results');
      const savedCommands = sessionStorage.getItem('mcp_pending_commands');

      if (savedResults && commandResults.length === 0) {
        try {
          setCommandResults(JSON.parse(savedResults));
        } catch (e) {
          console.error('Error restoring command results:', e);
        }
      }

      if (savedCommands && pendingCommands.length === 0) {
        try {
          setPendingCommands(JSON.parse(savedCommands));
        } catch (e) {
          console.error('Error restoring pending commands:', e);
        }
      }
    }
  }, [isAgentEnabled, isConnected]);

  // Register the tool result handler with MCPContext
  useEffect(() => {
    const handleToolResult = (data: any) => {
      console.log('Tool result received in MCPAgentContext:', data);
      const commandId = data.commandId || data.metadata?.commandId || 'unknown';
      const commandResult: CommandResult = {
        id: `result-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        commandId,
        success: !data.error,
        result: data.result || data,
        error: data.error,
        timestamp: Date.now(),
        needsAnalysis: true,
        isAnalyzed: false
      };
      addCommandResult(commandResult);
      if (!data.error) {
        addToPendingAnalysis(commandResult);
      }
    };
    registerToolResultHandler(handleToolResult);
    return () => {
      registerToolResultHandler(() => {});
    };
  }, [registerToolResultHandler, addCommandResult, addToPendingAnalysis]);

  // Analysis worker effect
  useEffect(() => {
    if (
      isAgentEnabled &&
      !isProcessing &&
      !isAnalyzing &&
      pendingAnalysis.length > 0 &&
      !isStopped &&
      isConnected
    ) {
      const analyzeNextResult = async () => {
        setIsAnalyzing(true);

        try {
          const resultToAnalyze = pendingAnalysis[0];

          // Find the original command
          const originalCommand = pendingCommands.find(
            cmd => cmd.id === resultToAnalyze.commandId
          );

          // If we couldn't find the original command, we'll still analyze
          // but with limited context
          const commandContext = originalCommand ? {
            command: originalCommand.command,
            toolName: originalCommand.toolName,
            parameters: originalCommand.parameters
          } : {
            command: "Unknown command",
            toolName: "unknown",
            parameters: {}
          };

          console.log(`Analyzing result for command: ${commandContext.toolName}`);

          // Call analysis endpoint
          const response = await axios.post('/api/ai/analyze-result', {
            result: resultToAnalyze.result,
            originalRequest: commandContext.command,
            toolName: commandContext.toolName,
            parameters: commandContext.parameters,
            modelId: activeModel
          });

          if (response.data) {
            // Add analysis as a command result
            const analysisResult: CommandResult = {
              id: `analysis-${Date.now()}`,
              commandId: 'analysis',
              success: true,
              result: {
                type: 'text',
                text: response.data.analysis
              },
              timestamp: Date.now()
            };

            addCommandResult(analysisResult);

            // Mark the original result as analyzed
            setCommandResults(prev =>
              prev.map(res =>
                res.id === resultToAnalyze.id
                  ? {...res, isAnalyzed: true}
                  : res
              )
            );

            // Add follow-up commands if any
            if (
              response.data.followUpCommands &&
              Array.isArray(response.data.followUpCommands) &&
              response.data.followUpCommands.length > 0
            ) {
              const newCommands = response.data.followUpCommands.map((cmd: any) => ({
                id: `cmd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                command: cmd.command,
                toolName: cmd.toolName,
                parameters: cmd.parameters,
                description: cmd.description,
                timestamp: Date.now()
              }));

              setPendingCommands(prev => [...prev, ...newCommands]);
            } else if (response.data.isComplete) {
              // Task is complete
              const completionMessage: CommandResult = {
                id: `completion-${Date.now()}`,
                commandId: 'completion',
                success: true,
                result: {
                  type: 'text',
                  text: 'Task completed. No further actions needed.'
                },
                timestamp: Date.now()
              };

              addCommandResult(completionMessage);
            }
          }
        } catch (error) {
          console.error('Error analyzing result:', error);

          // Add error message
          const errorResult: CommandResult = {
            id: `analysis-error-${Date.now()}`,
            commandId: 'error',
            success: false,
            result: null,
            error: `Error analyzing result: ${error.message}`,
            timestamp: Date.now()
          };

          addCommandResult(errorResult);
        } finally {
          // Remove the analyzed result from the queue
          setPendingAnalysis(prev => prev.slice(1));
          setIsAnalyzing(false);
        }
      };

      analyzeNextResult();
    }
  }, [
    isAgentEnabled,
    isProcessing,
    isAnalyzing,
    pendingAnalysis,
    isStopped,
    pendingCommands,
    activeModel,
    isConnected,
    addCommandResult,
    addToPendingAnalysis
  ]);

  // Enhanced initialization of agent when connected
  useEffect(() => {
    // Add debouncing for welcome messages to prevent duplicates
    const welcomeMessageDebounceTime = 5000; // 5 seconds
    let welcomeMessageTimer: number | null = null;
    
    // Clear any existing timer
    if (welcomeMessageTimer) {
      clearTimeout(welcomeMessageTimer);
      welcomeMessageTimer = null;
    }
    
    const initializeAgentLogic = () => {
      // If agent enabled, connected, and we have a server
      if (isAgentEnabled && isConnected && defaultServer) {
        const currentClientId = mcpConnection.clientId;
        
        // If we have a valid clientId that's new or different from the last one
        if (currentClientId && currentClientId !== lastProcessedClientIdRef.current) {
          console.log(`[MCP-AGENT] New connection detected with clientId: ${currentClientId}. Scheduling welcome message.`);
          
          // Schedule welcome message with debounce to prevent duplicates
          welcomeMessageTimer = window.setTimeout(() => {
            // Check again to make sure the client ID is still valid by the time timer fires
            if (mcpConnection.clientId === currentClientId) {
              console.log(`[MCP-AGENT] Displaying welcome message for clientId: ${currentClientId}`);
              
              const welcomeResult: CommandResult = {
                id: `result-welcome-${Date.now()}`,
                commandId: 'welcome', // Consistent commandId for welcome messages
                success: true,
                result: {
                  type: 'text',
                  text: `MCP Agent initialized. Connected to ${defaultServer.mcp_nickname} at ${defaultServer.mcp_host}:${defaultServer.mcp_port}. ${availableTools.length} tools available. ClientId: ${currentClientId}`
                },
                timestamp: Date.now()
              };
              
              // Check if a welcome message for this client ID already exists in results
              const alreadyHasWelcome = commandResults.some(
                r => r.commandId === 'welcome' && r.result?.text?.includes(`ClientId: ${currentClientId}`)
              );
              
              if (!alreadyHasWelcome) {
                addCommandResult(welcomeResult);
                lastProcessedClientIdRef.current = currentClientId;
              }
            } else {
              console.log(`[MCP-AGENT] Client ID changed during welcome message debounce, skipping welcome.`);
            }
            
            welcomeMessageTimer = null;
          }, welcomeMessageDebounceTime);
          
        } else if (isConnected && !currentClientId) {
          // We're connected but missing clientId - show connecting message if it doesn't exist
          const connectingMessageExists = commandResults.some(r => r.commandId === 'agent_connecting');
          
          if (!connectingMessageExists && mcpConnection.error === null) {
            const connectingMsg: CommandResult = {
              id: `result-agent-connecting-${Date.now()}`,
              commandId: 'agent_connecting',
              success: true,
              result: {
                type: 'text',
                text: `MCP connection active. Initializing agent services with ${defaultServer.mcp_nickname}...`
              },
              timestamp: Date.now()
            };
            
            addCommandResult(connectingMsg);
          }
        }
      } else if (!isConnected && lastProcessedClientIdRef.current) {
        // If connection lost, reset the ref
        console.log('[MCP-AGENT] MCP connection lost. Resetting last processed clientId for welcome message.');
        lastProcessedClientIdRef.current = null;
        
        // Clear any pending welcome message timer
        if (welcomeMessageTimer) {
          clearTimeout(welcomeMessageTimer);
          welcomeMessageTimer = null;
        }
      }
    };
    
    initializeAgentLogic();
    
    // Clean up timer on unmount
    return () => {
      if (welcomeMessageTimer) {
        clearTimeout(welcomeMessageTimer);
      }
    };
  }, [
    isAgentEnabled,
    isConnected,
    defaultServer,
    availableTools.length,
    mcpConnection.clientId,
    mcpConnection.status,
    mcpConnection.error,
    addCommandResult
  ]);

  // Monitor SSE connection status changes for errors (from MCPAgentContext perspective)
  useEffect(() => {
    if (isAgentEnabled && mcpConnection.status === 'error' && mcpConnection.error) {
      // Add an error message
      const errorResult: CommandResult = {
        id: `result-sse-error-${Date.now()}`,
        commandId: 'error',
        success: false,
        result: null,
        error: `MCP connection error: ${mcpConnection.error}. Please try reconnecting.`,
        timestamp: Date.now()
      };

      addCommandResult(errorResult);
    }
  }, [isAgentEnabled, mcpConnection.status, mcpConnection.error, addCommandResult]);

  // Verify client ID availability
  useEffect(() => {
    const checkClientId = () => {
      const clientId = getClientId();
      const newHasIssue = mcpConnection.status === 'connected' && !clientId;

      if (newHasIssue !== hasClientIdIssue) {
        setHasClientIdIssue(newHasIssue);

        // If issue resolved, reset recovery attempts
        if (!newHasIssue && recoveryAttemptsRef.current > 0) {
          console.log('Client ID issue resolved, resetting recovery attempts');
          recoveryAttemptsRef.current = 0;
        }
      }
    };

    // Check initially
    checkClientId();

    // Set up an interval to check periodically
    const interval = setInterval(checkClientId, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [mcpConnection, getClientId, hasClientIdIssue]);

  // Function to attempt client ID recovery
  const attemptClientIdRecovery = async (): Promise<boolean> => {
    if (!defaultServer) {
      console.error('No default server selected');
      return false;
    }

    if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
      console.error(`Max recovery attempts (${MAX_RECOVERY_ATTEMPTS}) reached`);
      return false;
    }

    recoveryAttemptsRef.current++;
    console.log(`Attempting client ID recovery (attempt ${recoveryAttemptsRef.current}/${MAX_RECOVERY_ATTEMPTS})`);

    try {
      // First try reconnection
      reconnect();

      // Wait a bit and check if that fixed it
      await new Promise(resolve => setTimeout(resolve, 2000));

      // If we have a client ID now, we're good
      const clientId = getClientId();
      if (clientId) {
        console.log('Client ID recovery successful via reconnection');
        return true;
      }

      // If reconnect failed, try the direct API endpoint
      console.log('Reconnection did not provide client ID, trying direct API endpoint...');
      
      // Use the new direct client ID retrieval method
      const response = await axios.get('/api/mcp/get-client-id', {
        params: {
          host: defaultServer.mcp_host,
          port: defaultServer.mcp_port
        },
        timeout: 8000
      });

      if (response.data && response.data.clientId) {
        const directClientId = response.data.clientId;
        console.log(`Recovered client ID via direct API: ${directClientId}`);
        
        // Store this client ID in local storage to be picked up by MCPContext
        const connectionInfo = {
          connectionId: `recovery-${Date.now()}`,
          clientId: directClientId,
          timestamp: Date.now(),
          server: `${defaultServer.mcp_host}:${defaultServer.mcp_port}`
        };
        localStorage.setItem('mcp_connection_info', JSON.stringify(connectionInfo));
        
        // Force a reconnect to use the new client ID
        reconnect();
        
        // Wait a bit and check if we now have a client ID
        await new Promise(resolve => setTimeout(resolve, 2000));
        return getClientId() !== null;
      }

      console.log('Client ID recovery failed');
      return false;
    } catch (error) {
      console.error('Error during client ID recovery:', error);
      return false;
    }
  };

  // Function to reconnect to the server
  const reconnectToServer = () => {
    if (isAgentEnabled) {
      // Clear existing results
      setCommandResults([]);

      // Add a reconnecting message
      const reconnectingResult: CommandResult = {
        id: `result-reconnecting-${Date.now()}`,
        commandId: 'reconnecting',
        success: true,
        result: {
          type: 'text',
          text: 'Reconnecting to MCP server...'
        },
        timestamp: Date.now()
      };

      setCommandResults([reconnectingResult]);

      // Attempt to reconnect
      reconnect();
    }
  };

  // Toggle agent enabled state
  const toggleAgent = () => {
    // Simply toggle the state - the useEffect will handle initialization
    setIsAgentEnabled(!isAgentEnabled);
  };

  // Toggle stop/resume processing
  const toggleStopResume = () => {
    setIsStopped(!isStopped);

    if (isStopped) {
      // We're resuming, add a message
      const resumeMessage: CommandResult = {
        id: `result-resume-${Date.now()}`,
        commandId: 'system',
        success: true,
        result: {
          type: 'text',
          text: 'Processing resumed.'
        },
        timestamp: Date.now()
      };

      addCommandResult(resumeMessage);
    } else {
      // We're stopping, add a message
      const stopMessage: CommandResult = {
        id: `result-stop-${Date.now()}`,
        commandId: 'system',
        success: true,
        result: {
          type: 'text',
          text: 'Processing paused. Click "Resume" to continue.'
        },
        timestamp: Date.now()
      };

      addCommandResult(stopMessage);
    }
  };

  // Process a user request using AI to generate commands
  const processUserRequest = async (request: string) => {
    if (!isAgentEnabled || !isConnected || !defaultServer) {
      console.error('Cannot process request: Agent is disabled or MCP is not connected');
      return;
    }

    // Check if we have a valid SSE connection with clientId
    if (mcpConnection.status !== 'connected' || !mcpConnection.clientId) {
      // Add an error message
      const errorResult: CommandResult = {
        id: `result-no-connection-${Date.now()}`,
        commandId: 'error',
        success: false,
        result: null,
        error: 'Not connected to MCP server. Please reconnect and try again.',
        timestamp: Date.now()
      };

      setCommandResults(prev => [...prev, errorResult]);
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
          port: defaultServer.mcp_port,
          clientId: mcpConnection.clientId
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
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Approve and execute a command
  const approveCommand = async (commandId: string) => {
    const command = pendingCommands.find(cmd => cmd.id === commandId);
    if (!command) {
      console.error(`Command with id ${commandId} not found`);
      return;
    }

    // Mark as processing
    setIsProcessing(true);

    try {
      let result;
      let hasError = false;

      try {
        // Execute command
        result = await executeCommand(command.toolName, command.parameters);
      } catch (error) {
        // Check if this is a client ID issue
        const errorMessage = error.message || '';
        if (
          errorMessage.includes('client') &&
          errorMessage.includes('id') &&
          mcpConnection.status === 'connected'
        ) {
          console.log('Detected client ID issue during command execution, attempting recovery');

          // Try to recover client ID
          const recovered = await attemptClientIdRecovery();

          if (recovered) {
            // Retry the command with the recovered client ID
            console.log('Retrying command with recovered client ID');
            try {
              result = await executeCommand(command.toolName, command.parameters);
              hasError = false;
            } catch (retryError) {
              console.error('Command retry failed:', retryError);
              result = {
                error: `Failed to execute command after client ID recovery: ${retryError.message}`
              };
              hasError = true;
            }
          } else {
            result = {
              error: 'Failed to recover client ID. Please try manually reconnecting.'
            };
            hasError = true;
          }
        } else {
          // This is not a client ID issue or we couldn't recover
          console.error('Command execution error:', error);
          result = { error: error.message || 'Unknown error executing command' };
          hasError = true;
        }
      }

      // Create result entry
      const commandResult: CommandResult = {
        id: `result-${Date.now()}`,
        commandId: command.id,
        success: !hasError,
        result: result,
        timestamp: Date.now(),
        needsAnalysis: !hasError,
        isAnalyzed: false
      };

      // Add result and queue for analysis if successful
      addCommandResult(commandResult);
      if (!hasError) {
        addToPendingAnalysis(commandResult);
      }

      // Remove from pending commands
      setPendingCommands(prev => prev.filter(cmd => cmd.id !== commandId));
    } catch (error) {
      console.error('Error approving command:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reject a command
  const rejectCommand = (commandId: string) => {
    // Simply remove the command from pending commands
    setPendingCommands(prev => prev.filter(cmd => cmd.id !== commandId));
  };

  // Modify a command's parameters
  const modifyCommand = (commandId: string, newParameters: any) => {
    // Update the command's parameters
    setPendingCommands(prev =>
      prev.map(cmd =>
        cmd.id === commandId ? { ...cmd, parameters: newParameters } : cmd
      )
    );
  };

  // Clear a command result
  const clearCommandResult = (resultId: string) => {
    // Remove the result from command results
    setCommandResults(prev => prev.filter(res => res.id !== resultId));
  };

  return (
    <MCPAgentContext.Provider
      value={{
        isAgentEnabled,
        toggleAgent,
        pendingCommands,
        commandResults,
        approveCommand,
        rejectCommand,
        modifyCommand,
        clearCommandResult,
        processUserRequest,
        isProcessing,
        isConnected,
        sseStatus: mcpConnection.status,
        reconnectToServer,
        addCommandResult,
        isAnalyzing,
        isStopped,
        toggleStopResume,
        addToPendingAnalysis,
        hasClientIdIssue,
        attemptClientIdRecovery
      }}
    >
      {children}
    </MCPAgentContext.Provider>
  );
};

export default MCPAgentContext;