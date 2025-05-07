import React, { useState } from 'react';
import {
  CommandLineIcon,
  DocumentTextIcon,
  ArrowsPointingOutIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

interface MCPToolResultProps {
  command: string;
  result: {
    success: boolean;
    content: string | any[];
    contentType?: 'text' | 'json' | 'image';
    error?: string;
  };
}

const MCPToolResult: React.FC<MCPToolResultProps> = ({
  command,
  result
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Toggle expanded state
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Toggle fullscreen view
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Format the content based on its type
  const formatContent = () => {
    if (!result.success) {
      return (
        <div className="p-3 rounded-md text-sm" style={{ 
          backgroundColor: 'var(--color-error-bg)', 
          color: 'var(--color-error)' 
        }}>
          <p>{result.error || 'Command execution failed'}</p>
        </div>
      );
    }

    if (typeof result.content === 'string') {
      return (
        <div className="p-3 rounded-md font-mono text-sm whitespace-pre-wrap overflow-x-auto max-h-80 overflow-y-auto" style={{ 
          backgroundColor: 'var(--color-surface-dark)', 
          color: 'var(--color-text)' 
        }}>
          {result.content}
        </div>
      );
    }

    if (Array.isArray(result.content)) {
      return (
        <div className="p-3 rounded-md font-mono text-sm overflow-x-auto max-h-80 overflow-y-auto" style={{ 
          backgroundColor: 'var(--color-surface-dark)', 
          color: 'var(--color-text)' 
        }}>
          <pre>{JSON.stringify(result.content, null, 2)}</pre>
        </div>
      );
    }

    // Default case
    return (
      <div className="p-3 rounded-md text-sm" style={{ 
        backgroundColor: 'var(--color-surface-dark)', 
        color: 'var(--color-text)' 
      }}>
        <p>Command executed successfully.</p>
      </div>
    );
  };

  // Render component
  return (
    <div 
      className={`transition-all duration-200 ${isFullscreen ? 'fixed inset-0 z-50 p-4 flex flex-col' : 'relative my-3'}`}
      style={{ 
        backgroundColor: isFullscreen ? 'var(--color-bg)' : 'transparent'
      }}
    >
      <div 
        className={`rounded-lg border transition-all ${isFullscreen ? 'flex-1 flex flex-col overflow-hidden' : ''}`}
        style={{ 
          backgroundColor: 'var(--color-surface-light)', 
          borderColor: result.success ? 'var(--color-success)' : 'var(--color-error)',
          borderWidth: '1px'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center">
            <CommandLineIcon className="h-5 w-5 mr-2" style={{ color: result.success ? 'var(--color-success)' : 'var(--color-error)' }} />
            <h4 className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              MCP Command Result
            </h4>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={toggleExpanded}
              className="p-1 rounded hover:bg-opacity-80"
              style={{ backgroundColor: 'var(--color-surface)' }}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUpIcon className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
              ) : (
                <ChevronDownIcon className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
              )}
            </button>
            
            <button
              onClick={toggleFullscreen}
              className="p-1 rounded hover:bg-opacity-80"
              style={{ backgroundColor: 'var(--color-surface)' }}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              <ArrowsPointingOutIcon className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
            </button>
          </div>
        </div>
        
        {/* Command */}
        <div 
          className="px-3 py-2 border-b text-xs font-mono flex items-center"
          style={{ 
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)'
          }}
        >
          <DocumentTextIcon className="h-4 w-4 mr-1" style={{ color: 'var(--color-text-muted)' }} />
          $ {command}
        </div>
        
        {/* Result content */}
        {isExpanded && (
          <div className={`p-3 ${isFullscreen ? 'flex-1 overflow-auto' : ''}`}>
            {formatContent()}
          </div>
        )}

        {/* Status footer */}
        <div 
          className="px-3 py-2 text-xs border-t"
          style={{ 
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-muted)'
          }}
        >
          {result.success ? (
            <span style={{ color: 'var(--color-success)' }}>
              ✓ Command executed successfully
            </span>
          ) : (
            <span style={{ color: 'var(--color-error)' }}>
              ✖ Command execution failed
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MCPToolResult; 