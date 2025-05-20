import React, { useState } from 'react';
import { useMCP } from '../../contexts/MCPContext';
import { useMCPAgent } from '../../contexts/MCPAgentContext';

/**
 * MCP Diagnostics Button Component
 * Shows detailed connection status and allows for direct reconnection
 */
const MCPDiagnosticsButton: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);
  const { isConnected, mcpConnection, defaultServer, reconnect, getClientId } = useMCP();
  const { attemptClientIdRecovery } = useMCPAgent();
  
  if (!defaultServer) {
    return null;
  }
  
  const handleDiagnostics = () => {
    setShowDetails(!showDetails);
  };
  
  const handleReconnect = () => {
    reconnect();
  };
  
  const handleClientIdRecovery = () => {
    attemptClientIdRecovery();
  };
  
  const clientId = getClientId();
  
  return (
    <div className="mcp-diagnostics">
      <button
        className="text-xs px-2 py-1 rounded-md flex items-center"
        style={{
          backgroundColor: 'var(--color-surface-light)',
          color: isConnected ? 'var(--color-success)' : 'var(--color-error)'
        }}
        onClick={handleDiagnostics}
      >
        MCP: {isConnected ? '✓' : '✗'}
      </button>
      
      {showDetails && (
        <div
          className="fixed right-0 bottom-14 bg-surface shadow-lg rounded-md p-4 max-w-xs w-full"
          style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            zIndex: 100,
            border: '1px solid var(--color-border)'
          }}
        >
          <h3 className="font-medium text-sm mb-2">MCP Connection Details</h3>
          
          <div className="mb-2">
            <span className="text-xs font-medium">Status:</span> 
            <span 
              className="text-xs ml-1"
              style={{ 
                color: mcpConnection.status === 'connected' 
                  ? 'var(--color-success)' 
                  : mcpConnection.status === 'connecting'
                    ? 'var(--color-warning)'
                    : 'var(--color-error)'
              }}
            >
              {mcpConnection.status}
            </span>
          </div>
          
          <div className="mb-2">
            <span className="text-xs font-medium">Server:</span> 
            <span className="text-xs ml-1">
              {defaultServer.mcp_nickname} ({defaultServer.mcp_host}:{defaultServer.mcp_port})
            </span>
          </div>
          
          <div className="mb-2">
            <span className="text-xs font-medium">Client ID:</span> 
            <span 
              className="text-xs ml-1 font-mono"
              style={{ color: clientId ? 'var(--color-success)' : 'var(--color-error)' }}
            >
              {clientId ? clientId.substring(0, 10) + '...' : 'Not available'}
            </span>
          </div>
          
          {mcpConnection.error && (
            <div className="mb-2">
              <span className="text-xs font-medium">Error:</span> 
              <span className="text-xs ml-1" style={{ color: 'var(--color-error)' }}>
                {mcpConnection.error}
              </span>
            </div>
          )}
          
          <div className="flex justify-end space-x-2 mt-3">
            <button
              className="text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: 'var(--color-warning-bg)',
                color: 'var(--color-warning)'
              }}
              onClick={handleClientIdRecovery}
            >
              Fix ClientId
            </button>
            <button
              className="text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'white'
              }}
              onClick={handleReconnect}
            >
              Reconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPDiagnosticsButton; 