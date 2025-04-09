# MCP Co-Pilot Implementation Plan

## Overview

This document outlines a detailed plan for building a co-pilot application that functions as an MCP (Model Context Protocol) client. The application will allow multiple users to interact with an AI assistant that can execute terminal commands and other operations through MCP.

## System Architecture

### High-Level Architecture

```
┌─────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│             │    │               │    │               │    │               │
│   Frontend  │◄───┤ Backend API   │◄───┤  MCP Client   │◄───┤  MCP Server   │
│   (React)   │    │ (Express.js)  │    │  Integration  │    │               │
│             │    │               │    │               │    │               │
└─────────────┘    └───────────────┘    └───────────────┘    └───────────────┘
                          ▲                     ▲
                          │                     │
                          ▼                     │
                   ┌─────────────┐             │
                   │             │             │
                   │  Database   │◄────────────┘
                   │  (SQLite)   │
                   │             │
                   └─────────────┘
```

### Phased Implementation Approach

1. **Phase 1**: Implement standard chatbot with user authentication
2. **Phase 2**: Add MCP client integration for executing terminal commands
3. **Phase 3**: Extend MCP capabilities with additional tool integrations

## Component Breakdown

### 1. Frontend (React/TypeScript)

#### Core Features
- User authentication (login/signup)
- Chat interface with conversation history
- Message streaming for real-time responses
- UI for displaying MCP tool executions and results
- Settings for configuring MCP preferences

#### Implementation Details
- Extend existing `Chatbot.tsx` component for MCP integration
- Add MCP-specific UI components for tool execution approval
- Implement WebSocket connection for real-time updates from MCP tool executions
- Create dedicated MCP settings page/panel

### 2. Backend API (Express.js)

#### Core Features
- Authentication endpoints (login, logout, register)
- Chat history persistence
- MCP proxy endpoints for security
- Session management
- WebSocket implementation for real-time updates

#### Implementation Details
- Add new routes for MCP client interactions
- Implement proxy for MCP requests to maintain security
- Create database schema extensions for MCP settings and history

### 3. MCP Client Integration

#### Approach Options

#### Option A: Direct Frontend Integration (TypeScript SDK)
- Integrate MCP client directly in frontend using TypeScript SDK
- Pros: Simpler implementation, direct communication with MCP server
- Cons: Security concerns with client-side tool execution, harder to implement access controls

#### Option B: Backend Integration (Python or TypeScript SDK)
- Implement MCP client in backend API server
- Pros: Better security, centralized control, easier to implement access controls
- Cons: Adds complexity, requires proxy implementation

#### Option C: Separate MCP Microservice (Python SDK)
- Create dedicated MCP microservice using Python SDK
- Pros: Clean separation of concerns, scalable, can use Python's robust ecosystem
- Cons: Requires additional service, more complex deployment

#### Recommended Approach: Option B or C
- For simple implementation: Option B (Backend Integration)
- For scalable, production-grade implementation: Option C (Separate Microservice)

### 4. MCP Server Implementation

#### Core Features
- Tool definitions for terminal command execution
- Security controls for command execution
- Resource access definitions
- Authentication with MCP clients

#### Implementation Details
- Define terminal command execution tools with appropriate validation
- Implement sandbox environment for safe command execution
- Create access control mechanisms for different user roles
- Configure proper authentication for MCP clients

## Technical Implementation

### MCP Client Implementation (TypeScript SDK)

```typescript
// Example MCP Client setup with TypeScript SDK
import { createMcpClient } from '@modelcontextprotocol/sdk';

async function initializeMcpClient() {
  const client = createMcpClient({
    transport: {
      type: 'http',
      url: 'http://localhost:3000/mcp-server'
    }
  });

  // Connect to server
  await client.connect();
  
  // Discover server capabilities
  const capabilities = await client.getCapabilities();
  
  // Log available tools
  console.log('Available tools:', capabilities.tools);
  
  return client;
}

// Execute a terminal command through MCP
async function executeTerminalCommand(client, command) {
  try {
    const result = await client.executeTool('terminal_command', {
      command: command
    });
    
    return result;
  } catch (error) {
    console.error('Error executing terminal command:', error);
    throw error;
  }
}
```

### MCP Server Implementation (Python SDK)

```python
# Example MCP Server setup with Python SDK
from modelcontextprotocol.server import MCPServer
from modelcontextprotocol.tools import Tool, ToolParameter
import subprocess
import shlex

# Define a tool for executing terminal commands
terminal_command_tool = Tool(
    name="terminal_command",
    description="Execute a terminal command",
    parameters=[
        ToolParameter(
            name="command",
            description="The command to execute",
            type="string",
            required=True
        )
    ]
)

# Implement the tool handler
async def handle_terminal_command(params):
    command = params["command"]
    
    # Security validation (implement more robust validation in production)
    if any(bad_cmd in command for bad_cmd in ["rm -rf", "sudo", "> /etc/"]):
        return {"error": "Forbidden command detected"}
    
    try:
        # Execute command safely
        args = shlex.split(command)
        process = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        return {
            "stdout": process.stdout,
            "stderr": process.stderr,
            "exit_code": process.returncode
        }
    except Exception as e:
        return {"error": str(e)}

# Create and start the MCP server
server = MCPServer()
server.register_tool(terminal_command_tool, handle_terminal_command)

if __name__ == "__main__":
    server.start(host="0.0.0.0", port=5000)
```

### Integration with LLM

```typescript
// Example LLM integration with MCP client
import { createMcpClient } from '@modelcontextprotocol/sdk';
import { ChatCompletionCreateParams } from 'openai';

// Initialize MCP client
const mcpClient = await initializeMcpClient();

// Configure LLM with MCP tool definitions
const toolDefinitions: ChatCompletionCreateParams.Tool[] = [
  {
    type: 'function',
    function: {
      name: 'terminal_command',
      description: 'Execute a terminal command',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to execute'
          }
        },
        required: ['command']
      }
    }
  }
];

// LLM Call
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "system", content: "You are a helpful assistant that can execute terminal commands." },
    { role: "user", content: "List all files in the current directory" }
  ],
  tools: toolDefinitions,
  tool_choice: "auto"
});

// Process tool calls
if (response.choices[0].message.tool_calls) {
  for (const toolCall of response.choices[0].message.tool_calls) {
    if (toolCall.function.name === 'terminal_command') {
      const args = JSON.parse(toolCall.function.arguments);
      
      // Request user approval before execution
      const approved = await requestUserApproval(args.command);
      
      if (approved) {
        // Execute via MCP
        const result = await mcpClient.executeTool('terminal_command', {
          command: args.command
        });
        
        // Send result back to LLM for processing
        const toolResponse = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            ...previousMessages,
            response.choices[0].message,
            {
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(result)
            }
          ]
        });
        
        // Display final response to user
        displayMessage(toolResponse.choices[0].message.content);
      }
    }
  }
}
```

## User Authentication and Authorization

### User Roles and Permissions

1. **Admin Users**
   - Can execute any terminal command
   - Can configure MCP settings
   - Can manage other users

2. **Standard Users**
   - Can execute safe terminal commands
   - Limited to their own workspace
   - Require approval for certain operations

3. **Guest Users**
   - Read-only access
   - No terminal command execution
   - Basic chat functionality only

### Authentication Implementation

Leverage the existing authentication system in the application, extending it with MCP-specific roles and permissions.

### Command Approval Flow

1. User requests a command through the chat interface
2. LLM generates a command and requests execution via MCP
3. Backend validates command against security rules
4. If needed, user receives an approval prompt
5. Upon approval, command is executed and results are returned
6. Results are displayed in the chat and sent back to LLM for context

## Database Schema Extensions

### MCP Sessions Table

```sql
CREATE TABLE mcp_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_id TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
```

### MCP Commands History Table

```sql
CREATE TABLE mcp_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  chat_id INTEGER NOT NULL,
  command TEXT NOT NULL,
  result TEXT,
  status TEXT NOT NULL, -- 'pending', 'approved', 'rejected', 'executed', 'failed'
  executed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (chat_id) REFERENCES chat_history (id)
);
```

### MCP User Settings Table

```sql
CREATE TABLE mcp_user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  auto_approve BOOLEAN DEFAULT FALSE,
  allowed_commands TEXT, -- JSON array of allowed command patterns
  workspace_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
```

## Implementation Approaches

### Approach 1: Integrated Backend Solution

Integrate MCP client directly into the existing Express.js backend:

1. Add MCP client library to the backend
2. Create new routes for MCP interactions
3. Implement WebSocket for real-time updates
4. Proxy commands to MCP server

**Advantages**:
- Simpler architecture
- Leverages existing authentication
- Easier to implement

**Disadvantages**:
- Less separation of concerns
- May become a bottleneck as scale increases

### Approach 2: Microservice Architecture

Create a separate MCP microservice in Python:

1. Build standalone MCP client service using Python SDK
2. Implement REST API for backend communication
3. Use message queue for asynchronous processing
4. Deploy as separate container/service

**Advantages**:
- Better separation of concerns
- Can scale independently
- Takes advantage of Python's strong MCP SDK

**Disadvantages**:
- More complex deployment
- Requires additional service management
- Needs separate authentication mechanism

### Recommended Approach

Start with **Approach 1** for rapid development and proof of concept. Refactor to **Approach 2** if scaling becomes necessary or if more advanced MCP features are needed.

## Security Considerations

1. **Command Validation**
   - Whitelist approved command patterns
   - Blacklist dangerous commands
   - Sandbox execution environment
   - Set timeouts and resource limits

2. **User Authentication**
   - Secure token handling
   - Session validation
   - Role-based access control

3. **MCP Server Security**
   - Proper authentication between client and server
   - Input validation
   - Rate limiting
   - Access logging

4. **Command Approval Mechanism**
   - Require explicit user approval for certain commands
   - Implement approval timeout
   - Log all approvals and executions

## Development Roadmap

### Phase 1: Basic Chat Functionality (Weeks 1-2)

1. Set up user authentication system
2. Implement basic chat interface
3. Connect to LLM for responses
4. Add chat history persistence

### Phase 2: MCP Integration (Weeks 3-4)

1. Implement MCP client in backend
2. Create MCP server with terminal command tool
3. Add command execution flow with approvals
4. Implement command history and logging

### Phase 3: Advanced Features (Weeks 5-6)

1. Add additional MCP tools
2. Implement user settings for MCP
3. Enhance security with better validation
4. Add admin dashboard for MCP monitoring

### Phase 4: Refinement and Testing (Weeks 7-8)

1. Conduct security audit
2. Optimize performance
3. Refine user experience
4. Prepare for production deployment

## Alternatives and Extensions

### Alternative 1: Browser-Based MCP Client

Create a browser-based MCP client using the TypeScript SDK and WebSockets:

```typescript
// Browser-based MCP client example
import { createMcpClient } from '@modelcontextprotocol/sdk';

// Create WebSocket transport
const client = createMcpClient({
  transport: {
    type: 'websocket',
    url: 'ws://localhost:5000/mcp'
  }
});

// Connect and use
await client.connect();
const result = await client.executeTool('terminal_command', {
  command: 'ls -la'
});
```

**Considerations**:
- Security implications of client-side execution
- Need for server-side proxy for sensitive operations
- Better real-time performance

### Alternative 2: Serverless MCP Implementation

Deploy MCP server as serverless functions:

- Use AWS Lambda or similar for tool execution
- Deploy MCP server on container services like AWS Fargate
- Use API Gateway for access control

**Considerations**:
- Cold start latency
- Function execution limits
- Cost optimization for high-volume usage

### Extension: Additional MCP Tools

Beyond terminal commands, implement these additional MCP tools:

1. **File Management**
   - Upload/download files
   - Edit text files
   - Browse directory structure

2. **Database Operations**
   - Query database
   - Export data
   - Data visualization

3. **Application Integration**
   - Integrate with third-party APIs
   - Connect to internal services
   - Trigger workflows

## Conclusion

Building an MCP client co-pilot application involves several interconnected components and decisions. The plan outlined above provides a comprehensive approach to implementing this system, with flexibility to adapt based on specific requirements and constraints.

The phased implementation approach allows for iterative development and testing, ensuring that each component is properly integrated before moving to more advanced features. The recommended architecture leverages the existing application structure while introducing MCP capabilities in a secure and scalable manner.

By following this plan, you will be able to build a robust co-pilot application that allows multiple users to interact with an AI assistant capable of executing terminal commands and other operations through the Model Context Protocol. 