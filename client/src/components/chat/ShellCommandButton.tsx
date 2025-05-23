import React, { useState, useEffect, useRef } from 'react';
import { PlayIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { CommandLineIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { shellCommandService } from '../../services/shellCommandService';

interface ShellCommandButtonProps {
  onComplete: (result: any, aiResponse?: string) => void;
  toolText?: string;
  messageId?: string;
  conversationId?: string;
  command: string;
}

/**
 * A button component that triggers shell command execution
 * Displays Run/Decline buttons that, when Run is clicked, executes the shell command
 * via the MCP orchestrator and updates the current message with the result
 */
const ShellCommandButton: React.FC<ShellCommandButtonProps> = ({
  onComplete,
  toolText,
  messageId,
  conversationId,
  command
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'initial' | 'executing' | 'processing'>('initial');
  const [executionResult, setExecutionResult] = useState<any>(null);
  
  // Use a ref to track if the component has already been executed
  const hasExecuted = useRef<boolean>(false);

  // Check localStorage on mount to see if this button has already been executed
  useEffect(() => {
    if (conversationId && messageId) {
      const commandKey = `shell_command_${conversationId}_${messageId}`;
      const savedState = localStorage.getItem(commandKey);
      
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (parsed.executed && !hasExecuted.current) {
            setIsComplete(true);
            setIsLoading(false);
            setExecutionResult(parsed.result);
            hasExecuted.current = true;
            
            // Restore the result to the parent
            if (parsed.aiResponse) {
              onComplete(parsed.result, parsed.aiResponse);
            }
          }
        } catch (error) {
          console.error('Error parsing saved shell command state:', error);
        }
      }
    }
  }, [conversationId, messageId, onComplete]);

  const handleRunCommand = async () => {
    if (isLoading || isComplete || isDeclined || hasExecuted.current) return;

    setIsLoading(true);
    setLoadingStage('executing');

    try {
      console.log('Executing shell command:', command);

      // Execute the shell command via the service
      const result = await shellCommandService.executeCommand(command);
      setExecutionResult(result);

      // Update loading stage
      setLoadingStage('processing');

      // Format the result for display
      let aiResponseContent: string;
      
      if (result.success) {
        // Format successful result
        aiResponseContent = `Command executed successfully!\n\n`;
        aiResponseContent += `**Command:** \`${result.command}\`\n`;
        aiResponseContent += `**Server:** ${result.serverConfig?.name} (${result.serverConfig?.host}:${result.serverConfig?.port})\n`;
        aiResponseContent += `**Time:** ${new Date(result.timestamp).toLocaleString()}\n\n`;
        
        if (result.result) {
          if (typeof result.result === 'string') {
            aiResponseContent += `**Output:**\n\`\`\`\n${result.result}\n\`\`\``;
          } else if (result.result.output) {
            aiResponseContent += `**Output:**\n\`\`\`\n${result.result.output}\n\`\`\``;
          } else if (result.result.stdout) {
            aiResponseContent += `**Output:**\n\`\`\`\n${result.result.stdout}\n\`\`\``;
          } else {
            aiResponseContent += `**Result:**\n\`\`\`json\n${JSON.stringify(result.result, null, 2)}\n\`\`\``;
          }
        }
      } else {
        // Format error result
        aiResponseContent = `Command execution failed.\n\n`;
        aiResponseContent += `**Command:** \`${result.command}\`\n`;
        if (result.serverConfig) {
          aiResponseContent += `**Server:** ${result.serverConfig.name} (${result.serverConfig.host}:${result.serverConfig.port})\n`;
        }
        aiResponseContent += `**Time:** ${new Date(result.timestamp).toLocaleString()}\n\n`;
        aiResponseContent += `**Error:** ${result.error}\n`;
        
        if (result.stderr) {
          aiResponseContent += `**Error Output:**\n\`\`\`\n${result.stderr}\n\`\`\``;
        }
        
        if (result.output) {
          aiResponseContent += `**Output:**\n\`\`\`\n${result.output}\n\`\`\``;
        }
      }

      // Mark as complete
      setIsComplete(true);
      setIsLoading(false);
      hasExecuted.current = true;

      // Save the state to localStorage
      if (conversationId && messageId) {
        const commandKey = `shell_command_${conversationId}_${messageId}`;
        const stateToSave = {
          executed: true,
          isComplete: true,
          isLoading: false,
          result: result,
          aiResponse: aiResponseContent,
          timestamp: new Date().toISOString(),
          messageId: messageId,
          conversationId: conversationId,
          command: command
        };

        localStorage.setItem(commandKey, JSON.stringify(stateToSave));
        console.log('Saved shell command state to storage:', commandKey);
      }

      // Call the completion handler
      onComplete(result, aiResponseContent);

      // Dispatch an event to refresh the messages
      if (conversationId) {
        window.dispatchEvent(new CustomEvent('refreshMessages', {
          detail: {
            conversationId,
            source: 'shell_command_tool'
          }
        }));
      }

    } catch (error: any) {
      console.error('Error executing shell command:', error);
      
      const errorResult = {
        success: false,
        command: command,
        error: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      };

      setExecutionResult(errorResult);

      const errorResponse = `Failed to execute command: ${command}\n\nError: ${error.message || 'Unknown error occurred'}`;
      
      setIsComplete(true);
      setIsLoading(false);
      hasExecuted.current = true;

      // Save error state to localStorage
      if (conversationId && messageId) {
        const commandKey = `shell_command_${conversationId}_${messageId}`;
        const stateToSave = {
          executed: true,
          isComplete: true,
          isLoading: false,
          result: errorResult,
          aiResponse: errorResponse,
          timestamp: new Date().toISOString(),
          messageId: messageId,
          conversationId: conversationId,
          command: command,
          error: true
        };

        localStorage.setItem(commandKey, JSON.stringify(stateToSave));
      }

      onComplete(errorResult, errorResponse);
    }
  };

  const handleDeclineCommand = () => {
    if (isLoading || isComplete || isDeclined) return;

    setIsDeclined(true);
    const declineResponse = `Command execution declined: \`${command}\`\n\nIs there something else I can help you with?`;
    
    // Save declined state to localStorage
    if (conversationId && messageId) {
      const commandKey = `shell_command_${conversationId}_${messageId}`;
      const stateToSave = {
        executed: false,
        declined: true,
        isComplete: false,
        isLoading: false,
        timestamp: new Date().toISOString(),
        messageId: messageId,
        conversationId: conversationId,
        command: command
      };

      localStorage.setItem(commandKey, JSON.stringify(stateToSave));
    }

    onComplete(null, declineResponse);
  };

  const getStatusIcon = () => {
    if (isComplete && executionResult?.success) {
      return <CheckCircleIcon className="h-4 w-4 mr-2" style={{ color: 'var(--color-success)' }} />;
    } else if (isComplete && !executionResult?.success) {
      return <ExclamationTriangleIcon className="h-4 w-4 mr-2" style={{ color: 'var(--color-error)' }} />;
    } else if (isDeclined) {
      return <XMarkIcon className="h-4 w-4 mr-2" style={{ color: 'var(--color-text-muted)' }} />;
    } else {
      return <CommandLineIcon className="h-4 w-4 mr-2" style={{ color: 'var(--color-primary)' }} />;
    }
  };

  const getStatusText = () => {
    if (isComplete && executionResult?.success) {
      return 'Command Executed Successfully';
    } else if (isComplete && !executionResult?.success) {
      return 'Command Execution Failed';
    } else if (isDeclined) {
      return 'Command Declined';
    } else if (isLoading) {
      return loadingStage === 'executing' ? 'Executing Command...' : 'Processing Result...';
    } else {
      return 'Shell Command';
    }
  };

  const getStatusColor = () => {
    if (isComplete && executionResult?.success) {
      return 'var(--color-success)';
    } else if (isComplete && !executionResult?.success) {
      return 'var(--color-error)';
    } else if (isDeclined) {
      return 'var(--color-text-muted)';
    } else {
      return 'var(--color-primary)';
    }
  };

  return (
    <div className="shell-command-button-container my-3">
      <div className="flex flex-col rounded-md overflow-hidden" style={{
        backgroundColor: 'var(--color-surface-accent)',
        border: '1px solid var(--color-border-accent)'
      }}>
        {/* Tool header with command icon */}
        <div className="flex items-center p-2 border-b border-opacity-20" style={{
          borderColor: 'var(--color-border-accent)',
          backgroundColor: isComplete
            ? (executionResult?.success ? 'rgba(var(--color-success-rgb), 0.1)' : 'rgba(var(--color-error-rgb), 0.1)')
            : isDeclined
            ? 'rgba(var(--color-text-muted-rgb), 0.1)'
            : 'rgba(var(--color-primary-rgb), 0.1)'
        }}>
          {getStatusIcon()}
          <span className="text-xs font-medium" style={{ color: getStatusColor() }}>
            {getStatusText()}
          </span>
          {toolText && !isComplete && !isDeclined && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-auto text-xs underline"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {isExpanded ? 'Hide code' : 'Show code'}
            </button>
          )}
        </div>

        {/* Tool code (optional) */}
        {isExpanded && toolText && !isComplete && !isDeclined && (
          <div className="p-2 text-xs font-mono overflow-x-auto" style={{
            backgroundColor: 'rgba(0,0,0,0.1)',
            color: 'var(--color-text-muted)',
            maxHeight: '100px'
          }}>
            <pre>{toolText}</pre>
          </div>
        )}

        {/* Command display */}
        <div className="p-3">
          <div className="text-sm mb-2" style={{ color: 'var(--color-text)' }}>
            <strong>Command:</strong> <code className="px-1 py-0.5 rounded text-xs" style={{
              backgroundColor: 'rgba(0,0,0,0.1)',
              color: 'var(--color-text)'
            }}>{command}</code>
          </div>

          {/* Action buttons - only show if not completed, declined, or loading */}
          {!isComplete && !isDeclined && !isLoading && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleRunCommand}
                className="flex items-center px-3 py-1 text-xs font-medium rounded transition-colors"
                style={{
                  backgroundColor: 'var(--color-success)',
                  color: 'white'
                }}
                disabled={isLoading}
              >
                <PlayIcon className="h-3 w-3 mr-1" />
                Run
              </button>
              <button
                onClick={handleDeclineCommand}
                className="flex items-center px-3 py-1 text-xs font-medium rounded transition-colors"
                style={{
                  backgroundColor: 'var(--color-text-muted)',
                  color: 'white'
                }}
                disabled={isLoading}
              >
                <XMarkIcon className="h-3 w-3 mr-1" />
                Decline
              </button>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 mr-2" style={{
                borderColor: 'var(--color-primary)'
              }}></div>
              {loadingStage === 'executing' ? 'Executing command via MCP orchestrator...' : 'Processing result...'}
            </div>
          )}

          {/* Completion status */}
          {(isComplete || isDeclined) && (
            <div className="mt-3 text-xs" style={{
              color: isComplete
                ? (executionResult?.success ? 'var(--color-success)' : 'var(--color-error)')
                : 'var(--color-text-muted)'
            }}>
              {isComplete
                ? (executionResult?.success
                  ? '✓ Command executed successfully'
                  : '✗ Command execution failed')
                : '⚬ Command execution declined'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShellCommandButton; 