# MCP Integration Implementation Progress Tracker

## Overview
This document tracks the implementation of Model Context Protocol (MCP) integration into our application. MCP will allow the AI to interact with the user's environment through a secure, controlled interface. This integration needs to be completed in phases with careful attention to security and user experience.

## Implementation Phases

### Phase 1: Database Schema Creation
- [ ] **Create database migration scripts:**
  - [ ] Create `user_ssh_configurations` table migration in `src/migrations/{timestamp}_create_user_ssh_configurations.js`
  - [ ] Create `user_mcp_server_configurations` table migration in `src/migrations/{timestamp}_create_user_mcp_server_configurations.js`
  - [ ] Add appropriate indexes and constraints
  - [ ] Update `DatabaseStructure.md` with new table definitions

#### Database Schema Details
```sql
-- Enable the uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- user_ssh_configurations table
CREATE TABLE IF NOT EXISTS user_ssh_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_nickname VARCHAR(255) NOT NULL,
  ssh_host VARCHAR(255) NOT NULL,
  ssh_port INTEGER NOT NULL DEFAULT 22,
  ssh_user VARCHAR(255) NOT NULL,
  ssh_auth_method VARCHAR(50) NOT NULL,
  ssh_password_encrypted TEXT,
  ssh_key_path TEXT,
  last_ssh_connection_status VARCHAR(50) DEFAULT 'unknown',
  last_ssh_error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, machine_nickname)
);

CREATE INDEX idx_user_ssh_configurations_user_id ON user_ssh_configurations(user_id);

-- user_mcp_server_configurations table
CREATE TABLE IF NOT EXISTS user_mcp_server_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ssh_configuration_id UUID REFERENCES user_ssh_configurations(id) ON DELETE SET NULL,
  mcp_nickname VARCHAR(255) NOT NULL,
  mcp_host VARCHAR(255) NOT NULL,
  mcp_port INTEGER NOT NULL,
  mcp_connection_status VARCHAR(50) DEFAULT 'unknown',
  mcp_last_error_message TEXT,
  mcp_discovered_tools_schema JSONB,
  mcp_server_version VARCHAR(100),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, mcp_nickname)
);

CREATE INDEX idx_user_mcp_server_configurations_user_id ON user_mcp_server_configurations(user_id);
CREATE INDEX idx_user_mcp_server_configurations_ssh_config_id ON user_mcp_server_configurations(ssh_configuration_id);
```

### Phase 2: Backend Services Implementation
- [x] **Create core MCP service:**
  - [x] Create `src/services/mcpService.js` for MCP connection management with the following functions:
    - `connectToMCP` - Connect to an MCP server
    - `disconnectFromMCP` - Disconnect from an MCP server
    - `getMCPStatus` - Get MCP connection status
    - `discoverTools` - Discover available MCP tools
    - `executeTool` - Execute an MCP tool
    - `getActiveConnections` - Get active MCP connections
    - `testMCPConnection` - Test connection to an MCP server
  - [x] Add EventSource for Server-Sent Events (SSE) connection
  - [x] Implement timeout and reconnection logic
  - [x] Add proper error handling and logging

- [x] **Create SSH management service:**
  - [x] Create `src/services/sshService.js` with the following functions:
    - `testSSHConnection` - Test SSH connection
    - `executeSSHCommand` - Execute command over SSH
    - `installMCPViaSSH` - Install MCP via SSH
    - `encryptPassword` - Secure password encryption
    - `decryptPassword` - Secure password decryption
  - [x] Add secure password storage with encryption
  - [x] Implement proper connection validation
  - [x] Add proper error handling and logging

- [x] **Create database access layer:**
  - [x] Create `src/services/mcpDBService.js` with the following functions:
    - SSH Configuration CRUD operations
    - MCP Server Configuration CRUD operations
    - Status update functions
  - [x] Add transaction support for critical operations
  - [x] Implement proper data validation
  - [x] Add proper error handling and logging

- [x] **Create MCP API routes:**
  - [x] Create `src/routes/mcp.js` to handle API requests for:
    - SSH Configuration management
    - MCP Server configuration management
    - MCP connection and status
    - Tool discovery and execution
    - Test MCP connection
    - [x] Fix API endpoint parameters mismatch between frontend and backend for test-connection
    - [x] Update MCP connection testing to use /info endpoint instead of /health for more reliable testing
  - [x] Add authentication/authorization middleware
  - [x] Implement proper request validation
  - [x] Add proper error handling and logging

- [x] **Update server.js:**
  - [x] Add MCP API routes to express app
  - [x] Configure MCP API endpoints under '/api/mcp'
  - [x] Add MCP pages routes under '/settings/mcp'

### Phase 3: Frontend Components Creation
- [x] **Create MCP settings component:**
  - [x] Create `client/src/components/settings/MCPSettings.tsx` - Main MCP settings component
  - [x] Implement connection testing UI
  - [x] Add server management interface
  - [x] Create tool discovery and display

- [x] **Create SSH configuration components:**
  - [x] Create `client/src/components/settings/SSHConfigForm.tsx` - SSH configuration form
  - [x] Create `client/src/components/settings/SSHConfigList.tsx` - List of SSH configurations
  - [x] Implement secure credential handling on frontend

- [ ] **Create MCP installation components:**
  - [ ] Create `client/src/components/settings/MCPInstaller.tsx` with:
    - Installation step progress indicator
    - SSH connection selector
    - Installation command customization
    - Installation progress display
  - [ ] Create `client/src/components/settings/MCPInstallStatus.tsx` with:
    - Real-time installation status updates
    - Error display and troubleshooting guidance
    - Success confirmation and next steps

- [x] **Create MCP chat integration components:**
  - [x] Create `client/src/components/chat/MCPCommandApproval.tsx` - Command approval UI
  - [x] Create `client/src/components/chat/MCPToolResult.tsx` - Tool result display

### Phase 4: Frontend Services and Context
- [x] **Create MCP context:**
  - [x] Create `client/src/contexts/MCPContext.tsx` for app-wide MCP state management
  - [x] Implement connection status tracking
  - [x] Add tool availability state
  - [x] Create context provider in app hierarchy

- [ ] **Create frontend services:**
  - [ ] Create `client/src/services/mcpService.ts` with the following methods:
    ```typescript
    // Main methods to implement
    async function getMCPStatus(): Promise<MCPStatusResponse>
    async function getMCPTools(): Promise<MCPToolsResponse>
    async function testMCPConnection(config: MCPConnectionConfig): Promise<MCPTestResponse>
    async function saveMCPConnection(config: MCPConnectionConfig): Promise<MCPSaveResponse>
    async function deleteMCPServer(serverId: string): Promise<MCPDeleteResponse>
    async function executeMCPCommand(command: string, serverId: string): Promise<MCPExecuteResponse>
    ```
  - [ ] Create `client/src/services/sshService.ts` with the following methods:
    ```typescript
    // Main methods to implement
    async function getSSHConfigurations(): Promise<SSHConfigResponse>
    async function saveSSHConfiguration(config: SSHConfig): Promise<SSHSaveResponse>
    async function testSSHConnection(config: SSHTestConfig): Promise<SSHTestResponse>
    async function deleteSSHConfiguration(configId: string): Promise<SSHDeleteResponse>
    async function installMCPViaSSH(sshId: string, options?: InstallOptions): Promise<InstallResponse>
    ```
  - [ ] Implement proper TypeScript interfaces for all API responses
  - [ ] Set up Axios interceptors for error handling
  - [ ] Add proper error types and handling

### Phase 5: Settings Page Integration
- [x] **Add MCP tab to settings page:**
  - [x] Modify `client/src/pages/Settings.tsx` to include MCP tab
  - [x] Import the newly created MCP settings components
  - [x] Add icon and label for MCP settings

```tsx
// Example addition to Settings.tsx tabs array
const tabs = [
  { id: 'profile', name: 'Profile', icon: UserIcon },
  { id: 'appearance', name: 'Appearance', icon: PaintBrushIcon },
  { id: 'ollama', name: 'Ollama AI', icon: ServerIcon },
  { id: 'mcp', name: 'MCP Integration', icon: CpuChipIcon },
];

// Example content section to add
{activeTab === 'mcp' && (
  <div>
    <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
      MCP Integration Settings
    </h2>
    <MCPSettings isAdmin={user?.role === 'admin'} />
  </div>
)}
```

### Phase 6: Chat Interface Integration
- [ ] **Implement MCP toggle in chat interface:**
  - [ ] Add MCP toggle button in `client/src/components/chat/ChatHeader.tsx`
  - [ ] Connect toggle to MCPContext's toggleMCPEnabled function
  - [ ] Add visual indicators for MCP connection status in chat interface
  - [ ] Add tooltip with connection details

- [ ] **Implement command approval workflow:**
  - [x] Add command parsing in chat messages
  - [x] Create approval UI for commands
  - [ ] Modify `client/src/components/chat/ChatInterface.tsx` to detect command requests
  - [ ] Implement command extraction from AI responses
  - [ ] Connect MCPCommandApproval component to MCPContext
  - [ ] Implement approval/rejection handling with callbacks
  - [ ] Add command history tracking

- [ ] **Implement result display:**
  - [ ] Create special message type for MCP results in `client/src/types/chat.ts`
  - [ ] Update `client/src/components/chat/Message.tsx` to render MCP tool results
  - [ ] Add formatting for different result types (text, JSON, error)
  - [ ] Implement error handling for failed commands
  - [ ] Add copy-to-clipboard functionality for results

### Phase 7: Security Audit and Testing
- [ ] **Security review:**
  - [ ] Audit SSH credential management with focus on:
    - Password encryption implementation
    - Storage of sensitive data
    - Transmission security (HTTPS)
  - [ ] Review MCP connection security:
    - Command sanitization
    - Input validation
    - Authentication for all endpoints
  - [ ] Check for possible injection vulnerabilities:
    - SQL injection in database operations
    - Command injection in SSH commands
    - Input validation in all API endpoints
  - [ ] Ensure secure password storage and transmission:
    - Use of proper encryption algorithms
    - Secure key management
    - No logging of sensitive data

- [ ] **User acceptance testing:**
  - [ ] Test MCP installation flow:
    - Manual installation instructions
    - SSH-based installation
    - Installation error handling
  - [ ] Test connection management:
    - Adding/editing/deleting MCP servers
    - Adding/editing/deleting SSH configurations
    - Connection testing
  - [ ] Test command execution and approval:
    - Command parsing from AI responses
    - Command approval UI
    - Command execution and result display
  - [ ] Test error handling and recovery:
    - Connection failures
    - Command execution failures
    - Authentication failures

### Phase 8: Integration with Main Application
- [ ] **Integrate with AI chat system:**
  - [ ] Update AI prompt templates to include MCP capabilities
  - [ ] Create special handling for MCP tool requests in chat
  - [ ] Implement MCP command detection in AI responses
  - [ ] Add MCP status to chat context for AI awareness

- [ ] **Update application initialization:**
  - [ ] Add MCPProvider to main application component
  - [ ] Initialize MCP connection on application start
  - [ ] Implement connection status monitoring
  - [ ] Add MCP status to application health checks

- [ ] **Create documentation:**
  - [ ] Update user documentation with MCP features
  - [ ] Create administrator documentation for MCP setup
  - [ ] Create developer documentation for MCP integration
  - [ ] Add troubleshooting guides for common issues

### Phase 9: SPA Routing and Frontend-Backend Connection
- [x] **Add SPA route handling for MCP pages:**
  - [x] Create `src/routes/mcp-pages.js` to handle MCP frontend routes:
    ```javascript
    const express = require('express');
    const path = require('path');
    const router = express.Router();
    const { requireAuth } = require('./auth');

    // MCP SSH Setup page
    router.get('/ssh-setup', requireAuth, (req, res) => {
      // Return the SPA for handling on frontend
      res.sendFile(path.resolve(__dirname, '../../client/build/index.html'));
    });

    // MCP Manual Install page
    router.get('/manual-install', requireAuth, (req, res) => {
      // Return the SPA for handling on frontend
      res.sendFile(path.resolve(__dirname, '../../client/build/index.html'));
    });

    module.exports = router;
    ```

  - [x] Update `src/server.js` to include the MCP pages router:
    ```javascript
    // Add this to the existing routes section
    app.use('/settings/mcp', mcpPagesRoutes);
    ```
  
  - [ ] Create new React component `client/src/pages/MCPSSHSetup.tsx`:
    ```typescript
    import React, { useState, useEffect } from 'react';
    import { useNavigate } from 'react-router-dom';
    import SSHConfigList from '../components/settings/SSHConfigList';
    import SSHConfigForm from '../components/settings/SSHConfigForm';
    import axios from 'axios';

    const MCPSSHSetup: React.FC = () => {
      const [configurations, setConfigurations] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [showAddForm, setShowAddForm] = useState(false);
      const navigate = useNavigate();

      useEffect(() => {
        fetchSSHConfigs();
      }, []);

      const fetchSSHConfigs = async () => {
        setLoading(true);
        try {
          const response = await axios.get('/api/mcp/ssh/config');
          setConfigurations(response.data.configurations || []);
        } catch (err) {
          setError('Failed to load SSH configurations');
          console.error(err);
        } finally {
          setLoading(false);
        }
      };

      // Implementation of onSave, onDelete, onTest handlers

      return (
        <div className="py-6 px-4 md:px-8">
          <div className="flex items-center mb-6">
            <button
              onClick={() => navigate('/settings')}
              className="mr-4 text-sm"
              style={{ color: 'var(--color-primary)' }}
            >
              ← Back to Settings
            </button>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              SSH Setup for MCP Installation
            </h1>
          </div>

          <div className="space-y-6">
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Configure SSH connections to install MCP on remote machines.
            </p>

            <SSHConfigList
              configurations={configurations}
              onSave={handleSaveConfig}
              onDelete={handleDeleteConfig}
              onTest={handleTestConnection}
            />

            <div className="mt-8">
              <button
                onClick={() => navigate('/settings/mcp/install-mcp')}
                className="px-4 py-2 rounded"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'white'
                }}
              >
                Continue to MCP Installation
              </button>
            </div>
          </div>
        </div>
      );
    };

    export default MCPSSHSetup;
    ```

  - [ ] Update `client/src/App.tsx` to include the new routes:
    ```typescript
    <Routes>
      {/* Existing routes... */}
      <Route path="/settings/mcp/ssh-setup" element={<MCPSSHSetup />} />
      <Route path="/settings/mcp/manual-install" element={<MCPManualInstall />} />
    </Routes>
    ```

## Technical Implementation Details

### SSH Authentication Security
- Password encryption will use AES-256-GCM with a secure key management strategy
- Private keys will be handled securely, never stored in plaintext
- All credentials will be validated server-side before use

### MCP Connection Management
- The application will establish a persistent SSE connection to the MCP server
- Connection status will be monitored and reported to the user
- Reconnection will be handled automatically when possible

### Command Approval Security
- All commands will require explicit user approval before execution
- The UI will clearly show what commands will be executed
- Users can modify or reject commands before execution

### Error Handling Strategy
- Clear error messages for connection issues
- Detailed logging for troubleshooting
- Graceful fallbacks when MCP is unavailable 
