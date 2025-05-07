import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ServerIcon
} from '@heroicons/react/24/outline';
import { api } from '../services/api';

interface SSHConfiguration {
  id: string;
  machine_nickname: string;
  ssh_host: string;
  ssh_port: number;
  ssh_user: string;
  ssh_auth_method: string;
  last_ssh_connection_status?: string;
  last_ssh_error_message?: string;
}

interface MCPTool {
  id: string;
  name: string;
  installCommand: string;
  description?: string;
  isDefault?: boolean;
}

const MCPInstall: React.FC = () => {
  const navigate = useNavigate();
  const [sshConfigurations, setSSHConfigurations] = useState<SSHConfiguration[]>([]);
  const [mcpTools, setMCPTools] = useState<MCPTool[]>([]);
  const [selectedSSH, setSelectedSSH] = useState<string>('');
  const [selectedMCP, setSelectedMCP] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [installing, setInstalling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [installationOutput, setInstallationOutput] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch SSH configurations
      const sshResponse = await api.get('/mcp/ssh/config');
      setSSHConfigurations(sshResponse.data.configurations || []);

      // Fetch MCP tools from config
      const mcpResponse = await api.get('/mcp/config');
      
      // Create a default MCP tool from config
      const defaultTool = mcpResponse.data.defaultTool;
      if (defaultTool) {
        setMCPTools([{
          id: 'default',
          name: defaultTool.name || 'Default MCP Tool',
          installCommand: defaultTool.installCommand || '',
          description: 'Default MCP installation tool from configuration',
          isDefault: true
        }]);
        
        // Set as selected by default
        setSelectedMCP('default');
      }
      
      setError(null);
    } catch (err: any) {
      setError('Failed to load configurations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallMCP = async () => {
    if (!selectedSSH || !selectedMCP) {
      setError('Please select both an SSH configuration and an MCP tool');
      return;
    }

    setInstalling(true);
    setError(null);
    setSuccess(null);
    setInstallationOutput('Starting MCP installation...\n');

    try {
      const response = await api.post('/mcp/ssh/install', {
        sshConfigId: selectedSSH,
        mcpToolId: selectedMCP
      });

      if (response.data.success) {
        setSuccess('MCP server installed successfully');
        setInstallationOutput(prev => prev + '\nInstallation completed successfully!\n');
      } else {
        setError(`Installation failed: ${response.data.error}`);
        setInstallationOutput(prev => prev + `\nInstallation failed: ${response.data.error}\n`);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to install MCP server';
      setError(errorMessage);
      setInstallationOutput(prev => prev + `\nError: ${errorMessage}\n`);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="py-6 px-4 md:px-8 max-w-[1400px] mx-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate('/settings/mcp/ssh-setup')}
          className="mr-4 flex items-center text-sm"
          style={{ color: 'var(--color-primary)' }}
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to SSH Setup
        </button>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          MCP Installation
        </h1>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-800 rounded-md text-green-400 flex items-start">
          <CheckCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md text-red-400 flex items-start">
          <XCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-6">
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface-dark)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-start">
            <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Install MCP on your target machines using SSH. Select an SSH configuration and an MCP installation tool to proceed.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
            Loading configurations...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SSH Configuration Selection */}
            <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface-light)', borderColor: 'var(--color-border)' }}>
              <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>
                1. Select SSH Configuration
              </h2>
              
              {sshConfigurations.length === 0 ? (
                <div className="p-3 rounded-md" style={{ backgroundColor: 'var(--color-surface-dark)', color: 'var(--color-text-muted)' }}>
                  No SSH configurations found. Please add one first.
                </div>
              ) : (
                <div className="space-y-3">
                  {sshConfigurations.map(config => (
                    <div 
                      key={config.id}
                      className={`p-3 rounded-md cursor-pointer border transition-colors ${
                        selectedSSH === config.id ? 'border-blue-500' : 'border-transparent'
                      }`}
                      style={{ 
                        backgroundColor: selectedSSH === config.id ? 'var(--color-primary-light)' : 'var(--color-surface-dark)',
                        color: 'var(--color-text)'
                      }}
                      onClick={() => setSelectedSSH(config.id)}
                    >
                      <div className="flex items-center">
                        <ServerIcon className="h-5 w-5 mr-2" style={{ color: 'var(--color-primary)' }} />
                        <div>
                          <div className="font-medium">{config.machine_nickname}</div>
                          <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {config.ssh_user}@{config.ssh_host}:{config.ssh_port}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MCP Tool Selection */}
            <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface-light)', borderColor: 'var(--color-border)' }}>
              <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text)' }}>
                2. Select MCP Installation Tool
              </h2>
              
              {mcpTools.length === 0 ? (
                <div className="p-3 rounded-md" style={{ backgroundColor: 'var(--color-surface-dark)', color: 'var(--color-text-muted)' }}>
                  No MCP tools found. Please check your configuration.
                </div>
              ) : (
                <div className="space-y-3">
                  {mcpTools.map(tool => (
                    <div 
                      key={tool.id}
                      className={`p-3 rounded-md cursor-pointer border transition-colors ${
                        selectedMCP === tool.id ? 'border-blue-500' : 'border-transparent'
                      }`}
                      style={{ 
                        backgroundColor: selectedMCP === tool.id ? 'var(--color-primary-light)' : 'var(--color-surface-dark)',
                        color: 'var(--color-text)'
                      }}
                      onClick={() => setSelectedMCP(tool.id)}
                    >
                      <div className="font-medium">{tool.name}</div>
                      <div className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {tool.description}
                      </div>
                      <div className="text-xs mt-2 font-mono p-2 rounded" style={{ backgroundColor: 'var(--color-bg-dark)' }}>
                        {tool.installCommand}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Installation Output */}
        {installationOutput && (
          <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface-light)', borderColor: 'var(--color-border)' }}>
            <h2 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Installation Output
            </h2>
            <pre 
              className="p-3 rounded-md font-mono text-sm overflow-auto max-h-60"
              style={{ backgroundColor: 'var(--color-bg-dark)', color: 'var(--color-text)' }}
            >
              {installationOutput}
            </pre>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between">
          <button
            onClick={() => navigate('/settings/mcp/ssh-setup')}
            className="px-4 py-2 rounded"
            style={{
              backgroundColor: 'var(--color-surface-dark)',
              color: 'var(--color-text)'
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={handleInstallMCP}
            disabled={installing || !selectedSSH || !selectedMCP}
            className="px-4 py-2 rounded"
            style={{
              backgroundColor: installing || !selectedSSH || !selectedMCP ? 'var(--color-primary-muted)' : 'var(--color-primary)',
              color: 'white',
              cursor: installing || !selectedSSH || !selectedMCP ? 'not-allowed' : 'pointer'
            }}
          >
            {installing ? 'Installing...' : 'Install MCP Server'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MCPInstall;
