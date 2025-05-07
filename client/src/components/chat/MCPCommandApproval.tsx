import React, { useState } from 'react';
import { useMCP } from '../../contexts/MCPContext';
import {
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  ArrowPathIcon,
  CommandLineIcon
} from '@heroicons/react/24/outline';

interface MCPCommandApprovalProps {
  command: string;
  onApprove: (command: string) => void;
  onReject: () => void;
}

const MCPCommandApproval: React.FC<MCPCommandApprovalProps> = ({
  command,
  onApprove,
  onReject
}) => {
  const [editedCommand, setEditedCommand] = useState<string>(command);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { isConnected, defaultServer } = useMCP();

  // Handle command edit
  const handleEdit = () => {
    setIsEditing(true);
  };

  // Handle save edit
  const handleSaveEdit = () => {
    setIsEditing(false);
  };

  // Handle command reject
  const handleReject = () => {
    onReject();
  };

  // Handle command approval
  const handleApprove = async () => {
    setIsLoading(true);
    try {
      onApprove(editedCommand);
    } catch (error) {
      console.error('Error approving command:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg border p-4 my-3 transition-all" 
      style={{ 
        backgroundColor: 'var(--color-surface-light)', 
        borderColor: 'var(--color-primary-light)' 
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
        <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
          AI is requesting to execute the following command:
        </p>
        
        {isEditing ? (
          <div className="relative">
            <textarea
              value={editedCommand}
              onChange={(e) => setEditedCommand(e.target.value)}
              className="w-full p-3 rounded font-mono text-sm focus:outline-none focus:ring-1"
              rows={3}
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
              <code>{editedCommand}</code>
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
          Review the command before approving. You can edit it if needed.
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