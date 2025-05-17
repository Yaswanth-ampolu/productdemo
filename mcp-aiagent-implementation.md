# MCP AI Agent Implementation Plan

## Overview

This document outlines the implementation plan for creating an AI agent that integrates with the Model Context Protocol (MCP) system. The agent will provide a three-way communication flow between the user, the AI model, and the MCP server, allowing for command execution with user approval.

## Core Components

### 1. MCP Agent Architecture

The MCP AI Agent will consist of the following components:

1. **Agent Controller**: Orchestrates the interaction between the AI model, user, and MCP server
2. **Command Parser**: Extracts and formats commands from AI responses
3. **Command Approval UI**: Presents commands to the user for approval/rejection
4. **MCP Client**: Handles communication with the MCP server
5. **Result Processor**: Processes and displays results from MCP tool executions
6. **Context Manager**: Maintains conversation context and agent state

### 2. Workflow

The agent workflow will follow these steps:

1. **Activation**: User toggles the MCP agent on in the chat interface
2. **Connection**: Agent connects to the configured MCP server
3. **Tool Discovery**: Agent discovers available tools on the MCP server
4. **User Input**: User sends a message to the AI
5. **AI Processing**: AI generates a response, potentially including MCP commands
6. **Command Extraction**: Agent extracts commands from the AI response
7. **Command Approval**: User approves or rejects each command
8. **Command Execution**: Approved commands are sent to the MCP server
9. **Result Display**: Results are displayed to the user and fed back to the AI
10. **Continuation**: AI continues the conversation based on command results

## Implementation Plan

### Phase 1: Agent Core Components

#### 1.1 Create MCP Agent Context

Create a new context provider to manage the agent state and provide access to agent functionality throughout the application.

```typescript
// client/src/contexts/MCPAgentContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useMCP } from './MCPContext';

interface MCPAgentContextType {
  isAgentEnabled: boolean;
  toggleAgent: () => void;
  isProcessingCommand: boolean;
  pendingCommands: MCPCommand[];
  approveCommand: (commandId: string) => Promise<void>;
  rejectCommand: (commandId: string) => Promise<void>;
  modifyCommand: (commandId: string, newCommand: string) => void;
  commandResults: MCPCommandResult[];
}

interface MCPCommand {
  id: string;
  tool: string;
  parameters: Record<string, any>;
  originalText: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
}

interface MCPCommandResult {
  commandId: string;
  result: any;
  error?: string;
}

const MCPAgentContext = createContext<MCPAgentContextType | undefined>(undefined);

export const MCPAgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isConnected, executeCommand, availableTools } = useMCP();
  const [isAgentEnabled, setIsAgentEnabled] = useState<boolean>(false);
  const [isProcessingCommand, setIsProcessingCommand] = useState<boolean>(false);
  const [pendingCommands, setPendingCommands] = useState<MCPCommand[]>([]);
  const [commandResults, setCommandResults] = useState<MCPCommandResult[]>([]);

  // Toggle agent enabled state
  const toggleAgent = () => {
    setIsAgentEnabled(prev => !prev);
  };

  // Approve and execute a command
  const approveCommand = async (commandId: string) => {
    // Implementation details
  };

  // Reject a command
  const rejectCommand = async (commandId: string) => {
    // Implementation details
  };

  // Modify a command before approval
  const modifyCommand = (commandId: string, newCommand: string) => {
    // Implementation details
  };

  return (
    <MCPAgentContext.Provider
      value={{
        isAgentEnabled,
        toggleAgent,
        isProcessingCommand,
        pendingCommands,
        approveCommand,
        rejectCommand,
        modifyCommand,
        commandResults
      }}
    >
      {children}
    </MCPAgentContext.Provider>
  );
};

export const useMCPAgent = () => {
  const context = useContext(MCPAgentContext);
  if (context === undefined) {
    throw new Error('useMCPAgent must be used within an MCPAgentProvider');
  }
  return context;
};
```

#### 1.2 Create Command Parser Service

Create a service to extract and parse commands from AI responses.

```typescript
// client/src/services/mcpAgentService.ts
interface ParsedCommand {
  id: string;
  tool: string;
  parameters: Record<string, any>;
  originalText: string;
}

export const mcpAgentService = {
  /**
   * Parse AI response to extract MCP commands
   */
  parseCommands: (aiResponse: string): ParsedCommand[] => {
    const commands: ParsedCommand[] = [];
    
    // Regular expression to match MCP command patterns
    // This is a simplified example - actual implementation would be more robust
    const commandRegex = /```mcp\s+([\s\S]+?)```/g;
    let match;
    
    while ((match = commandRegex.exec(aiResponse)) !== null) {
      try {
        const commandText = match[1].trim();
        const commandParts = commandText.split('\n');
        const toolName = commandParts[0].trim();
        
        // Parse parameters
        const parameters: Record<string, any> = {};
        for (let i = 1; i < commandParts.length; i++) {
          const paramLine = commandParts[i].trim();
          if (paramLine && paramLine.includes(':')) {
            const [key, value] = paramLine.split(':', 2);
            parameters[key.trim()] = value.trim();
          }
        }
        
        commands.push({
          id: `cmd-${Date.now()}-${commands.length}`,
          tool: toolName,
          parameters,
          originalText: commandText
        });
      } catch (error) {
        console.error('Error parsing MCP command:', error);
      }
    }
    
    return commands;
  },
  
  /**
   * Format command for display
   */
  formatCommandForDisplay: (command: ParsedCommand): string => {
    return `${command.tool}\n${Object.entries(command.parameters)
      .map(([key, value]) => `  ${key}: ${value}`)
      .join('\n')}`;
  }
};
```

### Phase 2: UI Components

#### 2.1 Create Command Approval Component

Create a component to display commands and allow user approval/rejection.

```typescript
// client/src/components/chat/MCPCommandApproval.tsx
import React, { useState } from 'react';
import { useMCPAgent } from '../../contexts/MCPAgentContext';

interface MCPCommandApprovalProps {
  commandId: string;
  tool: string;
  parameters: Record<string, any>;
  originalText: string;
}

const MCPCommandApproval: React.FC<MCPCommandApprovalProps> = ({
  commandId,
  tool,
  parameters,
  originalText
}) => {
  const { approveCommand, rejectCommand, modifyCommand } = useMCPAgent();
  const [isEditing, setIsEditing] = useState(false);
  const [editedCommand, setEditedCommand] = useState(originalText);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await approveCommand(commandId);
    } catch (error) {
      console.error('Error approving command:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await rejectCommand(commandId);
    } catch (error) {
      console.error('Error rejecting command:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    modifyCommand(commandId, editedCommand);
    setIsEditing(false);
  };

  return (
    <div className="mcp-command-approval">
      <div className="mcp-command-header">
        <span className="mcp-command-tool">{tool}</span>
      </div>
      
      {isEditing ? (
        <div className="mcp-command-edit">
          <textarea
            value={editedCommand}
            onChange={(e) => setEditedCommand(e.target.value)}
            className="mcp-command-edit-textarea"
          />
          <div className="mcp-command-edit-actions">
            <button onClick={handleSaveEdit} disabled={isProcessing}>
              Save
            </button>
            <button onClick={() => setIsEditing(false)} disabled={isProcessing}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mcp-command-content">
          <pre>{Object.entries(parameters)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n')}</pre>
        </div>
      )}
      
      <div className="mcp-command-actions">
        <button 
          onClick={handleApprove} 
          disabled={isProcessing}
          className="mcp-approve-button"
        >
          Approve
        </button>
        <button 
          onClick={handleReject} 
          disabled={isProcessing}
          className="mcp-reject-button"
        >
          Reject
        </button>
        <button 
          onClick={handleEdit} 
          disabled={isProcessing || isEditing}
          className="mcp-edit-button"
        >
          Edit
        </button>
      </div>
    </div>
  );
};

export default MCPCommandApproval;
```

#### 2.2 Create Command Result Component

Create a component to display the results of executed commands.

```typescript
// client/src/components/chat/MCPCommandResult.tsx
import React from 'react';

interface MCPCommandResultProps {
  result: any;
  error?: string;
}

const MCPCommandResult: React.FC<MCPCommandResultProps> = ({ result, error }) => {
  if (error) {
    return (
      <div className="mcp-command-result error">
        <div className="mcp-result-header">
          <span className="mcp-result-error-label">Error</span>
        </div>
        <div className="mcp-result-content">
          <pre>{error}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="mcp-command-result">
      <div className="mcp-result-header">
        <span className="mcp-result-label">Result</span>
      </div>
      <div className="mcp-result-content">
        {typeof result === 'object' ? (
          <pre>{JSON.stringify(result, null, 2)}</pre>
        ) : (
          <pre>{String(result)}</pre>
        )}
      </div>
    </div>
  );
};

export default MCPCommandResult;
```

### Phase 3: Integration with Chat Interface

#### 3.1 Update Chat Input Component

Add MCP agent toggle to the chat input component.

```typescript
// client/src/components/chat/ChatInput.tsx (update)
import { useMCPAgent } from '../../contexts/MCPAgentContext';
import { useMCP } from '../../contexts/MCPContext';

// Inside the ChatInput component
const { isConnected } = useMCP();
const { isAgentEnabled, toggleAgent } = useMCPAgent();

// Add to the JSX
<div className="chat-input-controls">
  {/* Existing controls */}
  
  {isConnected && (
    <button
      className={`mcp-agent-toggle ${isAgentEnabled ? 'active' : ''}`}
      onClick={toggleAgent}
      title={isAgentEnabled ? 'Disable MCP Agent' : 'Enable MCP Agent'}
    >
      <CpuChipIcon className="h-5 w-5" />
    </button>
  )}
</div>
```

#### 3.2 Update Message Component

Enhance the message component to display command approvals and results.

```typescript
// client/src/components/chat/ChatMessage.tsx (update)
import MCPCommandApproval from './MCPCommandApproval';
import MCPCommandResult from './MCPCommandResult';
import { useMCPAgent } from '../../contexts/MCPAgentContext';

// Inside the ChatMessage component
const { pendingCommands, commandResults } = useMCPAgent();

// Add to the JSX where message content is rendered
{message.role === 'assistant' && pendingCommands.length > 0 && (
  <div className="mcp-commands-container">
    {pendingCommands.map(command => (
      <MCPCommandApproval
        key={command.id}
        commandId={command.id}
        tool={command.tool}
        parameters={command.parameters}
        originalText={command.originalText}
      />
    ))}
  </div>
)}

{message.role === 'assistant' && commandResults.length > 0 && (
  <div className="mcp-results-container">
    {commandResults.map(result => (
      <MCPCommandResult
        key={result.commandId}
        result={result.result}
        error={result.error}
      />
    ))}
  </div>
)}
```

### Phase 4: AI Model Integration

#### 4.1 Update AI Chat Service

Enhance the AI chat service to include MCP agent capabilities in the prompt.

```typescript
// client/src/services/aiChatService.ts (update)
// Add to the sendChatCompletion and streamChatCompletion methods

// If MCP agent is enabled, add system message about MCP capabilities
if (request.enableMCPAgent && request.mcpTools) {
  const mcpSystemMessage = {
    role: 'system',
    content: `You have access to the following MCP tools that can interact with the user's system:
${request.mcpTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

To use a tool, format your response with a command block like this:
\`\`\`mcp
toolName
param1: value1
param2: value2
\`\`\`

The user will be asked to approve or reject each command before execution.`
  };
  
  // Add the MCP system message to the beginning of the messages array
  transformedRequest.messages = [mcpSystemMessage, ...transformedRequest.messages];
}
```

#### 4.2 Update Chatbot Component

Enhance the main Chatbot component to integrate with the MCP agent.

```typescript
// client/src/pages/Chatbot.tsx (update)
import { useMCPAgent } from '../contexts/MCPAgentContext';
import { useMCP } from '../contexts/MCPContext';
import { mcpAgentService } from '../services/mcpAgentService';

// Inside the Chatbot component
const { isAgentEnabled, pendingCommands, setPendingCommands } = useMCPAgent();
const { isConnected, availableTools } = useMCP();

// Modify handleSendMessage to include MCP agent information
const handleSendMessage = async (content: string) => {
  // Existing code...
  
  // If MCP agent is enabled, include MCP tools in the request
  const mcpOptions = isAgentEnabled && isConnected
    ? {
        enableMCPAgent: true,
        mcpTools: availableTools
      }
    : {};
  
  // Include mcpOptions in the AI request
  const aiResponse = await aiChatService.sendChatCompletion({
    modelId: selectedModelId,
    messages: conversationHistory,
    ...mcpOptions
  });
  
  // If MCP agent is enabled, parse the response for commands
  if (isAgentEnabled && isConnected) {
    const parsedCommands = mcpAgentService.parseCommands(aiResponse.choices[0].message.content);
    if (parsedCommands.length > 0) {
      setPendingCommands(parsedCommands.map(cmd => ({
        ...cmd,
        status: 'pending'
      })));
    }
  }
  
  // Existing code...
};
```

### Phase 5: Styling and User Experience

#### 5.1 Create CSS Styles for MCP Components

Create styles for the MCP agent components.

```css
/* client/src/styles/mcpAgent.css */
.mcp-command-approval {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin: 12px 0;
  overflow: hidden;
  background-color: var(--color-bg-secondary);
}

.mcp-command-header {
  background-color: var(--color-primary);
  color: white;
  padding: 8px 12px;
  font-weight: 600;
}

.mcp-command-content {
  padding: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.mcp-command-content pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: monospace;
}

.mcp-command-actions {
  display: flex;
  padding: 8px 12px;
  border-top: 1px solid var(--color-border);
  background-color: var(--color-bg-tertiary);
}

.mcp-command-actions button {
  margin-right: 8px;
  padding: 6px 12px;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
}

.mcp-approve-button {
  background-color: var(--color-success);
  color: white;
  border: none;
}

.mcp-reject-button {
  background-color: var(--color-danger);
  color: white;
  border: none;
}

.mcp-edit-button {
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
}

.mcp-command-edit-textarea {
  width: 100%;
  min-height: 100px;
  padding: 8px;
  font-family: monospace;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  resize: vertical;
}

.mcp-command-edit-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.mcp-command-result {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin: 12px 0;
  overflow: hidden;
}

.mcp-command-result.error {
  border-color: var(--color-danger);
}

.mcp-result-header {
  background-color: var(--color-success);
  color: white;
  padding: 6px 12px;
  font-weight: 600;
}

.mcp-result-error-label {
  background-color: var(--color-danger);
}

.mcp-result-content {
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.mcp-agent-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  cursor: pointer;
}

.mcp-agent-toggle.active {
  background-color: var(--color-primary);
  color: white;
}
```

## Implementation Timeline

### Week 1: Core Components
- Create MCPAgentContext
- Implement command parsing service
- Set up basic UI components

### Week 2: UI Integration
- Integrate with chat interface
- Implement command approval flow
- Style components

### Week 3: AI Integration
- Enhance AI prompts for MCP tools
- Implement command extraction
- Test with various commands

### Week 4: Testing and Refinement
- End-to-end testing
- Bug fixes
- Performance optimization
- Documentation

## Future Enhancements

1. **Command History**: Store and display history of executed commands
2. **Command Templates**: Predefined templates for common tasks
3. **Multi-step Workflows**: Support for sequences of commands
4. **Visual Command Builder**: GUI for building commands
5. **Result Visualization**: Enhanced display of command results (charts, tables, etc.)
6. **Command Suggestions**: AI-powered suggestions for useful commands
7. **Permission Management**: Fine-grained control over which tools can be used
