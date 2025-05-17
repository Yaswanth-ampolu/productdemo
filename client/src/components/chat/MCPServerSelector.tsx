import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  XMarkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ServerIcon,
  PlusIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { useMCP } from '../../contexts/MCPContext';

interface MCPServer {
  id: string;
  mcp_nickname: string;
  mcp_host: string;
  mcp_port: number;
  mcp_connection_status: string;
  is_default: boolean;
  tools_count?: number;
  mcp_server_version?: string;
}

interface MCPServerSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onServerSelect: (serverId: string) => void;
}

const MCPServerSelector: React.FC<MCPServerSelectorProps> = ({
  isOpen,
  onClose,
  onServerSelect
}) => {
  const { testServerConnection, connectToServer } = useMCP();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [testingServer, setTestingServer] = useState<string | null>(null);

  // Direct connection states
  const [showDirectConnect, setShowDirectConnect] = useState(false);
  const [directHost, setDirectHost] = useState('');
  const [directPort, setDirectPort] = useState('8080');
  const [directName, setDirectName] = useState('');
  const [directConnecting, setDirectConnecting] = useState(false);

  // Fetch MCP servers when the component mounts
  useEffect(() => {
    if (isOpen) {
      fetchServers();
    }
  }, [isOpen]);

  // Fetch MCP servers from the API
  const fetchServers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get('/api/mcp/server/config');

      if (response.data && (response.data.servers || response.data.configurations)) {
        // Handle both response formats (servers or configurations)
        const serverData = response.data.servers || response.data.configurations || [];
        setServers(serverData);

        // If there's a default server, select it
        const defaultServer = serverData.find((server: MCPServer) => server.is_default);
        if (defaultServer) {
          setSelectedServerId(defaultServer.id);
        } else if (serverData.length > 0) {
          // Otherwise, select the first server
          setSelectedServerId(serverData[0].id);
        }
      } else {
        setServers([]);
      }
    } catch (err: any) {
      console.error('Error fetching MCP servers:', err);
      setError(err.response?.data?.error || 'Failed to fetch MCP servers');
    } finally {
      setLoading(false);
    }
  };

  // Test connection to a server
  const testConnection = async (server: MCPServer) => {
    try {
      setTestingServer(server.id);

      // Use the direct test connection from MCPContext
      const testResult = await testServerConnection(server);

      if (testResult.success) {
        // Update server status in the UI
        setServers(prevServers =>
          prevServers.map(s =>
            s.id === server.id
              ? {
                  ...s,
                  mcp_connection_status: 'connected',
                  mcp_server_version: testResult.server?.version || 'unknown',
                  tools_count: testResult.toolCount || 0
                }
              : s
          )
        );

        // Select this server
        setSelectedServerId(server.id);
      } else {
        // Update server status to error
        setServers(prevServers =>
          prevServers.map(s =>
            s.id === server.id
              ? { ...s, mcp_connection_status: 'error' }
              : s
          )
        );

        // Show error
        setError(testResult.error || 'Failed to connect to MCP server');
      }
    } catch (err: any) {
      console.error('Error testing MCP connection:', err);

      // Update server status to error
      setServers(prevServers =>
        prevServers.map(s =>
          s.id === server.id
            ? { ...s, mcp_connection_status: 'error' }
            : s
        )
      );

      // Show error
      setError(err.message || 'Failed to connect to MCP server');
    } finally {
      setTestingServer(null);
    }
  };

  // Handle server selection
  const handleServerSelect = () => {
    if (selectedServerId) {
      // Find the selected server
      const selectedServer = servers.find(s => s.id === selectedServerId);
      
      // Only proceed if the server is connected or we haven't tested it yet
      if (selectedServer && (selectedServer.mcp_connection_status === 'connected' || selectedServer.mcp_connection_status !== 'error')) {
        onServerSelect(selectedServerId);
      } else {
        setError('Please test the connection to the server before connecting');
      }
    }
  };

  // Handle direct connection
  const handleDirectConnect = async () => {
    // Simple validation
    if (!directHost.trim()) {
      setError('Please enter a valid host');
      return;
    }
    if (!directName.trim()) {
      setError('Please enter a name for the server');
      return;
    }
    if (isNaN(parseInt(directPort))) {
      setError('Please enter a valid port number');
      return;
    }

    setDirectConnecting(true);
    setError(null);

    try {
      // Create a temporary server object
      const tempServer: MCPServer = {
        id: `direct-${Date.now()}`,
        mcp_nickname: directName,
        mcp_host: directHost,
        mcp_port: parseInt(directPort),
        mcp_connection_status: 'connecting',
        is_default: true
      };

      // Test connection
      const testResult = await testServerConnection(tempServer);

      if (testResult.success) {
        // Connect to the server
        await connectToServer(tempServer);

        // Save the server configuration to the database
        try {
          const response = await axios.post('/api/mcp/server/config', {
            server_name: directName,
            mcp_host: directHost,
            mcp_port: parseInt(directPort),
            is_default: true
          });

          if (response.data && response.data.id) {
            // Close the dialog
            onClose();
          }
        } catch (saveError: any) {
          console.error('Failed to save MCP server configuration:', saveError);
          // Still close the dialog as we're connected
          onClose();
        }
      } else {
        setError(testResult.error || 'Failed to connect to MCP server');
      }
    } catch (err: any) {
      console.error('Error connecting to MCP server:', err);
      setError(err.message || 'Failed to connect to MCP server');
    } finally {
      setDirectConnecting(false);
    }
  };

  // If the dialog is not open, don't render anything
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
        style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">MCP AI Agent</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        {/* Explanation banner */}
        <div 
          className="p-3 rounded-md mb-4 flex items-start"
          style={{ backgroundColor: 'var(--color-primary-translucent)', borderLeft: '3px solid var(--color-primary)' }}
        >
          <InformationCircleIcon className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-primary)' }}/>
          <div className="text-sm">
            <p className="mb-1 font-medium">The MCP AI Agent uses an MCP server to execute commands on your behalf.</p>
            <p>Please select a server to connect to, or add a new server connection.</p>
          </div>
        </div>

        {error && (
          <div
            className="mb-4 p-3 rounded-md flex items-start"
            style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', borderLeft: '3px solid var(--color-error)' }}
          >
            <ExclamationCircleIcon className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
          </div>
        ) : servers.length === 0 && !showDirectConnect ? (
          <div className="py-8 text-center">
            <ServerIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">No MCP servers configured</p>
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => setShowDirectConnect(true)}
                className="inline-block px-4 py-2 rounded-md"
                style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
              >
                <div className="flex items-center justify-center">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Connect to MCP Server
                </div>
              </button>
              <a
                href="/settings/mcp"
                className="inline-block px-4 py-2 rounded-md"
                style={{ backgroundColor: 'var(--color-surface-dark)', color: 'var(--color-text)' }}
              >
                Configure in Settings
              </a>
            </div>
          </div>
        ) : showDirectConnect ? (
          <div className="py-4">
            <h3 className="text-lg font-medium mb-4">Connect to MCP Server</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Server Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={directName}
                  onChange={(e) => setDirectName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md"
                  style={{
                    backgroundColor: 'var(--color-surface-light)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)'
                  }}
                  placeholder="Enter a name for this server"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Host <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={directHost}
                  onChange={(e) => setDirectHost(e.target.value)}
                  className="w-full px-3 py-2 rounded-md"
                  style={{
                    backgroundColor: 'var(--color-surface-light)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)'
                  }}
                  placeholder="Enter host (e.g., localhost or IP address)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Port <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={directPort}
                  onChange={(e) => setDirectPort(e.target.value)}
                  className="w-full px-3 py-2 rounded-md"
                  style={{
                    backgroundColor: 'var(--color-surface-light)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)'
                  }}
                  placeholder="Enter port (e.g., 8080)"
                />
              </div>
              <div className="text-xs text-gray-500 italic mt-1">
                <p>Note: This will add the server to your saved configurations.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Select a Server</h3>
              <button
                onClick={() => setShowDirectConnect(true)}
                className="flex items-center text-sm"
                style={{ color: 'var(--color-primary)' }}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add New
              </button>
            </div>
            <div className="mb-4 max-h-60 overflow-y-auto">
              {servers.map(server => (
                <div
                  key={server.id}
                  className={`p-3 mb-2 rounded-md cursor-pointer border transition-all ${
                    selectedServerId === server.id ? 'border-blue-500 dark:border-blue-400' : 'border-gray-200 dark:border-gray-700'
                  }`}
                  style={{
                    borderColor: selectedServerId === server.id ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: selectedServerId === server.id ? 'var(--color-primary-translucent)' : 'var(--color-surface-light)'
                  }}
                  onClick={() => setSelectedServerId(server.id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{server.mcp_nickname}</div>
                      <div className="text-sm opacity-70">{server.mcp_host}:{server.mcp_port}</div>
                      {server.mcp_connection_status === 'connected' && server.tools_count !== undefined && (
                        <div className="text-xs mt-1 opacity-70">
                          {server.tools_count} tools available • v{server.mcp_server_version || 'unknown'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center">
                      {testingServer === server.id ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
                      ) : server.mcp_connection_status === 'connected' ? (
                        <div className="flex items-center">
                          <span className="text-xs mr-2" style={{ color: 'var(--color-success)' }}>Connected</span>
                          <CheckCircleIcon className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
                        </div>
                      ) : server.mcp_connection_status === 'error' ? (
                        <div className="flex items-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              testConnection(server);
                            }}
                            className="text-xs mr-2 underline"
                            style={{ color: 'var(--color-error)' }}
                          >
                            Retry
                          </button>
                          <ExclamationCircleIcon className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            testConnection(server);
                          }}
                          className="px-2 py-1 rounded-md text-xs"
                          style={{ backgroundColor: 'var(--color-surface-dark)', color: 'var(--color-text)' }}
                          title="Test connection"
                        >
                          <div className="flex items-center">
                            <ArrowPathIcon className="h-3 w-3 mr-1" />
                            Test
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={showDirectConnect ? () => setShowDirectConnect(false) : onClose}
                className="px-4 py-2 rounded-md"
                style={{
                  backgroundColor: 'var(--color-surface-dark)',
                  color: 'var(--color-text)'
                }}
              >
                {showDirectConnect ? 'Back' : 'Cancel'}
              </button>

              {showDirectConnect ? (
                <button
                  onClick={handleDirectConnect}
                  disabled={directConnecting || !directHost || !directPort || !directName}
                  className="px-4 py-2 rounded-md flex items-center"
                  style={{
                    backgroundColor: (directHost && directPort && directName) ? 'var(--color-primary)' : 'var(--color-surface-dark)',
                    color: (directHost && directPort && directName) ? 'white' : 'var(--color-text-muted)',
                    opacity: (directHost && directPort && directName && !directConnecting) ? 1 : 0.7,
                    cursor: (directHost && directPort && directName && !directConnecting) ? 'pointer' : 'not-allowed'
                  }}
                >
                  {directConnecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 mr-2" style={{ borderColor: 'white' }}></div>
                      Connecting...
                    </>
                  ) : (
                    'Connect'
                  )}
                </button>
              ) : (
                <button
                  onClick={handleServerSelect}
                  disabled={!selectedServerId}
                  className="px-4 py-2 rounded-md"
                  style={{
                    backgroundColor: selectedServerId ? 'var(--color-primary)' : 'var(--color-surface-dark)',
                    color: selectedServerId ? 'white' : 'var(--color-text-muted)',
                    opacity: selectedServerId ? 1 : 0.7,
                    cursor: selectedServerId ? 'pointer' : 'not-allowed'
                  }}
                >
                  Connect
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MCPServerSelector;
