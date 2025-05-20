import React from 'react';
import { useMCPAgent } from '../../contexts/MCPAgentContext';
import { useMCP } from '../../contexts/MCPContext';

/**
 * MCPAgentControls component displays control buttons for MCP Agent
 * - Stop/Resume button for controlling the analysis loop
 * - Reconnect button for connection issues
 * - Fix ClientId button for clientId issues
 * - Status indicators for processing state
 */
const MCPAgentControls: React.FC = () => {
  const { 
    isProcessing,
    isAnalyzing,
    isStopped,
    toggleStopResume,
    pendingCommands,
    isAgentEnabled,
    sseStatus,
    reconnectToServer
  } = useMCPAgent();

  const {
    mcpConnection,
    reconnect,
    defaultServer
  } = useMCP();

  // Determine connection issues
  const hasConnectionIssue = sseStatus !== 'connected' || mcpConnection.status !== 'connected';
  const hasClientIdIssue = mcpConnection.status === 'connected' && !mcpConnection.clientId;

  // Determine if there's any active processing happening
  const isActive = isProcessing || isAnalyzing;
  const hasPendingCommands = pendingCommands.length > 0;

  // Only hide controls if agent is disabled or no activity and no issues
  if (!isAgentEnabled && !hasConnectionIssue && !hasClientIdIssue) {
    return null;
  }

  // Don't show controls if nothing is happening, no issues, and no pending commands
  if (!isActive && !hasPendingCommands && !isStopped && !hasConnectionIssue && !hasClientIdIssue) {
    return null;
  }

  // Handle reconnection
  const handleReconnect = () => {
    reconnect();
  };

  // Handle clientId recovery
  const handleFixClientId = async () => {
    if (!defaultServer) return;
    
    try {
      // Attempt reconnection first
      reconnect();
      
      // Add visual feedback while attempting recovery
      const controlsElement = document.querySelector('.mcp-agent-controls') as HTMLElement;
      if (controlsElement) {
        const originalBg = controlsElement.style.backgroundColor;
        controlsElement.style.backgroundColor = 'var(--color-warning-bg)';
        
        setTimeout(() => {
          if (controlsElement) {
            controlsElement.style.backgroundColor = originalBg;
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error attempting to fix clientId:', error);
    }
  };

  return (
    <div className="mcp-agent-controls" style={{
      marginBottom: '1rem',
      padding: '0.75rem',
      backgroundColor: hasConnectionIssue 
        ? 'var(--color-error-bg)' 
        : hasClientIdIssue
          ? 'var(--color-warning-bg)'
          : 'var(--color-surface-light)',
      borderRadius: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem'
    }}>
      {/* Connection issue indicator */}
      {hasConnectionIssue && (
        <div className="connection-error" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{
            fontSize: '0.875rem',
            color: 'var(--color-error)'
          }}>
            ⚠️ Connection issue
          </span>
        </div>
      )}

      {/* ClientId issue indicator */}
      {hasClientIdIssue && (
        <div className="clientid-error" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{
            fontSize: '0.875rem',
            color: 'var(--color-warning)'
          }}>
            ⚠️ Missing clientId
          </span>
        </div>
      )}

      {/* Processing status indicator */}
      {isActive && !hasConnectionIssue && !hasClientIdIssue && (
        <div className="processing-indicator" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {/* Animated dots */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <div className="dot" style={{
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
              opacity: 0.7,
              animation: 'pulse 1s infinite',
              animationDelay: '0s'
            }}></div>
            <div className="dot" style={{
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
              opacity: 0.7,
              animation: 'pulse 1s infinite',
              animationDelay: '0.3s'
            }}></div>
            <div className="dot" style={{
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
              opacity: 0.7,
              animation: 'pulse 1s infinite',
              animationDelay: '0.6s'
            }}></div>
          </div>
          
          {/* Status text */}
          <span style={{
            fontSize: '0.875rem',
            color: 'var(--color-text-muted)'
          }}>
            {isProcessing ? 'Processing request...' : 'Analyzing results...'}
          </span>
        </div>
      )}

      {/* Pending commands indicator */}
      {hasPendingCommands && !isActive && !hasConnectionIssue && !hasClientIdIssue && (
        <div className="pending-indicator" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{
            fontSize: '0.875rem',
            color: 'var(--color-text-muted)'
          }}>
            {pendingCommands.length} pending command{pendingCommands.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Stopped indicator */}
      {isStopped && !isActive && !hasConnectionIssue && !hasClientIdIssue && (
        <div className="stopped-indicator" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{
            fontSize: '0.875rem',
            color: 'var(--color-warning)'
          }}>
            Processing paused
          </span>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flexGrow: 1 }}></div>

      {/* Reconnect button for connection issues */}
      {hasConnectionIssue && (
        <button 
          onClick={handleReconnect}
          style={{
            padding: '0.375rem 0.75rem',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            backgroundColor: 'var(--color-surface-light)',
            color: 'var(--color-error)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          <span style={{ fontSize: '0.75rem' }}>
            🔄
          </span>
          Reconnect
        </button>
      )}

      {/* Fix ClientId button */}
      {hasClientIdIssue && (
        <button 
          onClick={handleFixClientId}
          style={{
            padding: '0.375rem 0.75rem',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            backgroundColor: 'var(--color-surface-light)',
            color: 'var(--color-warning)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          <span style={{ fontSize: '0.75rem' }}>
            🔧
          </span>
          Fix ClientId
        </button>
      )}

      {/* Stop/Resume button */}
      {(isActive || hasPendingCommands || isStopped) && !hasConnectionIssue && !hasClientIdIssue && (
        <button 
          onClick={toggleStopResume}
          style={{
            padding: '0.375rem 0.75rem',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            backgroundColor: isStopped 
              ? 'var(--color-success-bg)' 
              : 'var(--color-warning-bg)',
            color: isStopped 
              ? 'var(--color-success)' 
              : 'var(--color-warning)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          {/* Icon - either play or pause */}
          <span style={{ fontSize: '0.75rem' }}>
            {isStopped ? '▶' : '⏸'}
          </span>
          
          {/* Button text */}
          {isStopped ? 'Resume' : 'Pause'}
        </button>
      )}
    </div>
  );
};

// Add some CSS for the animation
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% { opacity: 0.3; }
    50% { opacity: 1; }
    100% { opacity: 0.3; }
  }
`;
document.head.appendChild(style);

export default MCPAgentControls; 