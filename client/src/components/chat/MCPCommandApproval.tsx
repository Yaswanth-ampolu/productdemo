import React, { useState } from 'react';
import { useMCP } from '../../contexts/MCPContext';
import { useMCPAgent } from '../../contexts/MCPAgentContext';
import {
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  ArrowPathIcon,
  CommandLineIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface MCPCommandApprovalProps {
  commandId: string;
  command: string;
  toolName: string;
  parameters: any;
  description: string;
}

const MCPCommandApproval: React.FC<MCPCommandApprovalProps> = ({
  commandId,
  command,
  toolName,
  parameters,
  description
}) => {
  const [editedParameters, setEditedParameters] = useState<any>(parameters);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const { isConnected, defaultServer } = useMCP();
  const { approveCommand, rejectCommand, modifyCommand } = useMCPAgent();

  // Handle parameters edit
  const handleEdit = () => {
    setIsEditing(true);
  };

  // Handle save edit
  const handleSaveEdit = () => {
    try {
      // If editedParameters is a string, try to parse it as JSON
      let parsedParams = editedParameters;
      if (typeof editedParameters === 'string') {
        try {
          parsedParams = JSON.parse(editedParameters);
        } catch (error) {
          console.error('Invalid JSON parameters:', error);
          // Keep the string version if parsing fails
        }
      }
      
      // Update the command with modified parameters
      modifyCommand(commandId, parsedParams);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving parameters:', error);
    }
  };

  // Handle command reject
  const handleReject = () => {
    rejectCommand(commandId);
  };

  // Handle command approval
  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await approveCommand(commandId);
    } catch (error) {
      console.error('Error approving command:', error);
      setIsLoading(false);
    }
  };

  // Format parameters for display
  const formatParameters = (params: any): string => {
    try {
      return JSON.stringify(params, null, 2);
    } catch (error) {
      return String(params);
    }
  };

  return (
    <div className="rounded-lg border p-4 my-3 transition-all" 
      style={{ 
        backgroundColor: 'var(--color-surface-light)', 
        borderColor: 'var(--color-primary-light)',
        borderLeft: '3px solid var(--color-primary)'
      }}
    >
      <div className="flex items-center mb-3">
        <CommandLineIcon className="h-5 w-5 mr-2" style={{ color: 'var(--color-primary)' }} />
        <h4 className="font-medium" style={{ color: 'var(--color-text)' }}>
          MCP Command Approval
        </h4>
        
        {isConnected ? (
          <span className="ml-auto text-xs px-2 py-1 rounded-full" style={{ 
            backgroundColor: 'var(--color-success-bg)', 
            color: 'var(--color-success)'
          }}>
            Connected to {defaultServer?.mcp_nickname || 'MCP'}
          </span>
        ) : (
          <span className="ml-auto text-xs px-2 py-1 rounded-full" style={{ 
            backgroundColor: 'var(--color-error-bg)', 
            color: 'var(--color-error)'
          }}>
            Not Connected
          </span>
        )}
      </div>
      
      <div className="mb-3">
        <div className="flex items-start mb-2">
          <div className="font-medium text-sm mr-1">Command:</div>
          <div className="text-sm" style={{ color: 'var(--color-text)' }}>{command}</div>
        </div>
        
        <div className="flex items-start mb-2">
          <div className="font-medium text-sm mr-1">Tool:</div>
          <div className="text-sm" style={{ color: 'var(--color-text)' }}>{toolName}</div>
        </div>
        
        <div className="mb-3 p-3 rounded-md text-sm" style={{ 
          backgroundColor: 'var(--color-primary-translucent)', 
          color: 'var(--color-text)'
        }}>
          <div className="flex items-start">
            <InformationCircleIcon className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-primary)' }}/>
            <div>{description}</div>
          </div>
        </div>
        
        <div className="mb-1">
          <div className="font-medium text-sm">Parameters:</div>
        </div>
        
        {isEditing ? (
          <div className="relative">
            <textarea
              value={typeof editedParameters === 'string' ? editedParameters : formatParameters(editedParameters)}
              onChange={(e) => setEditedParameters(e.target.value)}
              className="w-full p-3 rounded font-mono text-sm focus:outline-none focus:ring-1"
              rows={4}
              style={{
                backgroundColor: 'var(--color-surface-dark)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
            />
            <button
              onClick={handleSaveEdit}
              className="absolute bottom-2 right-2 p-1.5 rounded"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'white'
              }}
            >
              <CheckCircleIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div 
              className="p-3 rounded font-mono text-sm relative overflow-x-auto"
              style={{
                backgroundColor: 'var(--color-surface-dark)',
                color: 'var(--color-text)'
              }}
            >
              <pre className="whitespace-pre-wrap break-words"><code>{formatParameters(editedParameters)}</code></pre>
            </div>
            <button
              onClick={handleEdit}
              className="absolute top-2 right-2 p-1.5 rounded"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-secondary)'
              }}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      
      <div className="flex justify-between">
        <p className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
          Review the command before approving. You can edit parameters if needed.
        </p>
        
        <div className="flex space-x-2">
          <button
            onClick={handleReject}
            disabled={isLoading}
            className="px-3 py-1.5 rounded flex items-center text-sm"
            style={{
              backgroundColor: 'var(--color-error-bg)',
              color: 'var(--color-error)',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            <XCircleIcon className="h-4 w-4 mr-1" />
            Reject
          </button>
          
          <button
            onClick={handleApprove}
            disabled={isLoading || !isConnected}
            className="px-3 py-1.5 rounded flex items-center text-sm"
            style={{
              backgroundColor: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              opacity: (isLoading || !isConnected) ? 0.7 : 1
            }}
          >
            {isLoading ? (
              <>
                <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4 mr-1" />
                Approve & Execute
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MCPCommandApproval; 