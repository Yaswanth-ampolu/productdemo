import React, { useEffect, useState } from 'react';
import { useMCPAgent } from '../../contexts/MCPAgentContext';
import { useMCP } from '../../contexts/MCPContext';
import MCPCommandApproval from './MCPCommandApproval';
import MCPCommandResult from '../mcp/MCPCommandResult';
import MCPStatusIndicator from '../mcp/MCPStatusIndicator';
import MCPAgentControls from './MCPAgentControls';
import axios from 'axios';

// Add interface for AI models
interface AIModel {
  id: string;
  name: string;
  model_id: string;
  ollama_model_id: string;
  is_active: boolean;
  description: string;
}

const MCPAgentCommands: React.FC = () => {
  const { 
    pendingCommands, 
    commandResults, 
    isAgentEnabled,
    isProcessing,
    sseStatus,
    addCommandResult,
    isAnalyzing,
    isStopped
  } = useMCPAgent();
  
  const { 
    defaultServer, 
    availableTools,
    mcpConnection
  } = useMCP();

  // Add state for active models
  const [activeModels, setActiveModels] = useState<AIModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState<boolean>(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  
  // Track welcome message to prevent duplicates
  const [welcomeMessageSent, setWelcomeMessageSent] = useState<boolean>(false);

  // Fetch active models when component mounts
  useEffect(() => {
    const fetchActiveModels = async () => {
      try {
        setModelsLoading(true);
        setModelsError(null);
        const response = await axios.get('/api/ollama/models/active');
        if (response.data && response.data.models) {
          setActiveModels(response.data.models);
        }
      } catch (error) {
        console.error('Error fetching active models:', error);
        setModelsError('Failed to fetch active AI models. Some features may be limited.');
      } finally {
        setModelsLoading(false);
      }
    };

    if (isAgentEnabled) {
      fetchActiveModels();
    }
  }, [isAgentEnabled]);

  // Add connection status message when connecting
  useEffect(() => {
    // When connecting, show connecting message
    if (mcpConnection.status === 'connecting' && defaultServer && !welcomeMessageSent) {
      const connectingMessage = {
        id: `result-connecting-${Date.now()}`,
        commandId: 'system',
        success: true,
        result: {
          type: 'text',
          text: `Establishing connection to MCP server ${defaultServer.mcp_nickname || defaultServer.mcp_host}. Please wait...`
        },
        timestamp: Date.now()
      };
      
      if (addCommandResult) {
        addCommandResult(connectingMessage);
      }
    }
    
    // When connection is established, show connected message
    if (mcpConnection.status === 'connected' && mcpConnection.clientId && defaultServer && !welcomeMessageSent) {
      const connectedMessage = {
        id: `result-connected-${Date.now()}`,
        commandId: 'system',
        success: true,
        result: {
          type: 'text',
          text: `MCP Agent initialized. Connected to ${defaultServer.mcp_nickname || defaultServer.mcp_host} at ${defaultServer.mcp_host}:${defaultServer.mcp_port}. ${availableTools.length} tools available. ClientId: ${mcpConnection.clientId}`
        },
        timestamp: Date.now()
      };
      
      if (addCommandResult) {
        addCommandResult(connectedMessage);
        setWelcomeMessageSent(true);
      }
    }
    
    // Reset welcome message flag when disconnected
    if (mcpConnection.status === 'disconnected') {
      setWelcomeMessageSent(false);
    }
  }, [mcpConnection.status, mcpConnection.clientId, defaultServer, availableTools.length, addCommandResult, welcomeMessageSent]);

  // Generate initial AI greeting when connection is established
  useEffect(() => {
    // Check if this is a fresh connection and there are no existing commands or results
    const isNewConnection = mcpConnection.status === 'connected' && 
                          pendingCommands.length === 0 && 
                          commandResults.length === 0 &&
                          defaultServer && 
                          !isProcessing &&
                          welcomeMessageSent; // Only generate greeting after welcome message

    if (isNewConnection) {
      // Generate AI greeting
      generateAIGreeting();
    }
  }, [mcpConnection.status, pendingCommands.length, commandResults.length, defaultServer, isProcessing, mcpConnection.clientId, welcomeMessageSent]);

  // Function to generate AI greeting using the backend AI service
  const generateAIGreeting = async () => {
    try {
      // Get the active model from localStorage
      const activeModel = localStorage.getItem('selectedModelId');
      
      // Check if the active model exists and is valid
      const isModelValid = activeModel && activeModels.some(model => model.ollama_model_id === activeModel);
      
      if (!activeModel || !isModelValid) {
        // If no valid model selected, use fallback greeting
        addFallbackGreeting();
        
        // Add model warning if needed
        if (activeModels.length === 0) {
          const modelWarning = {
            id: `result-model-warning-${Date.now()}`,
            commandId: 'warning',
            success: true,
            result: {
              type: 'text',
              text: 'No active AI models found. Please go to Settings > AI Settings to configure and activate models for better performance.'
            },
            timestamp: Date.now()
          };
          
          if (addCommandResult) {
            addCommandResult(modelWarning);
          }
        } else if (!activeModel) {
          const modelSelectionWarning = {
            id: `result-model-select-warning-${Date.now()}`,
            commandId: 'warning',
            success: true,
            result: {
              type: 'text',
              text: 'No AI model selected. Please select a model from the dropdown to get the best experience.'
            },
            timestamp: Date.now()
          };
          
          if (addCommandResult) {
            addCommandResult(modelSelectionWarning);
          }
        }
        
        return;
      }

      // Call the AI service to generate a greeting
      const response = await axios.post('/api/ai/generate-greeting', {
        mcpServer: defaultServer,
        tools: availableTools,
        modelId: activeModel
      });

      if (response.data && response.data.greeting) {
        // Add the greeting as a command result
        const greetingResult = {
          id: `result-greeting-${Date.now()}`,
          commandId: 'greeting',
          success: true,
          result: {
            type: 'text',
            text: response.data.greeting
          },
          timestamp: Date.now()
        };

        // Update the command results using context method
        if (addCommandResult) {
          addCommandResult(greetingResult);
        } else {
          // Fallback if method not available
          addFallbackGreeting();
        }
      } else {
        // Fallback greeting if no valid response
        addFallbackGreeting();
      }
    } catch (error) {
      console.error('Error generating AI greeting:', error);
      // Use fallback greeting on error
      addFallbackGreeting();
    }
  };

  // Fallback greeting function
  const addFallbackGreeting = () => {
    // Create a standard greeting
    const greeting = `Hello! I'm your MCP AI Agent assistant, connected to ${defaultServer?.mcp_nickname}. I can help you interact with the server using ${availableTools.length} available tools. What would you like to do today?`;
    
    // Create a greeting result
    const greetingResult = {
      id: `result-greeting-${Date.now()}`,
      commandId: 'greeting',
      success: true,
      result: {
        type: 'text',
        text: greeting
      },
      timestamp: Date.now()
    };
    
    // Add the result using context method if available
    if (addCommandResult) {
      addCommandResult(greetingResult);
    }
  };

  // Don't render anything if the agent is not enabled
  if (!isAgentEnabled) {
    return null;
  }
  
  // Determine if there's any active processing happening
  const isActive = isProcessing || isAnalyzing;
  const showControls = isActive || pendingCommands.length > 0 || isStopped;

  return (
    <div className="mcp-agent-commands">
      {/* MCP Status Indicator */}
      <MCPStatusIndicator />

      {/* MCP Agent Controls - for stop/resume and status indicators */}
      {showControls && <MCPAgentControls />}
      
      {/* Model error warning */}
      {modelsError && (
        <div className="mb-4 p-3 rounded-lg border border-warning-300"
          style={{ 
            backgroundColor: 'var(--color-warning-bg)',
            color: 'var(--color-warning)'
          }}>
          <p className="text-sm">{modelsError}</p>
        </div>
      )}

      {/* If connected and no pending commands or results, show welcome and capabilities */}
      {mcpConnection.status === 'connected' && 
       pendingCommands.length === 0 && 
       commandResults.length === 0 && 
       defaultServer && (
        <div 
          className="mb-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
          style={{ 
            backgroundColor: 'var(--color-surface-light)', 
            borderLeft: '3px solid var(--color-primary)',
          }}
        >
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text)' }}>
            MCP Agent Ready
          </h3>
          
          <p className="mb-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Connected to <b>{defaultServer.mcp_nickname}</b> at {defaultServer.mcp_host}:{defaultServer.mcp_port}.
            You can ask me to perform tasks using {availableTools.length} available tools.
          </p>
          
          <div className="text-sm mb-2 font-medium" style={{ color: 'var(--color-text)' }}>
            Examples of what you can ask:
          </div>
          
          <ul className="list-disc pl-5 text-sm space-y-1" style={{ color: 'var(--color-text-muted)' }}>
            <li>List files in the current directory</li>
            <li>Show the content of a file</li>
            <li>Create a new file with specific content</li>
            <li>Run a command in the terminal</li>
            <li>Help me troubleshoot an issue with my code</li>
          </ul>
        </div>
      )}

      {/* Display pending commands */}
      {pendingCommands.length > 0 && (
        <div className="my-4">
          {pendingCommands.map(command => (
            <MCPCommandApproval
              key={command.id}
              commandId={command.id}
              command={command.command}
              toolName={command.toolName}
              parameters={command.parameters}
              description={command.description}
            />
          ))}
        </div>
      )}

      {/* Display command results */}
      {commandResults.length > 0 && (
        <div className="my-4">
          {commandResults.map(result => (
            <MCPCommandResult
              key={result.id}
              resultId={result.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MCPAgentCommands;
