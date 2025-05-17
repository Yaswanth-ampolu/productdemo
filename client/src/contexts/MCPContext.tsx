import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface MCPServer {
  id: string;
  mcp_nickname: string;
  mcp_host: string;
  mcp_port: number;
  mcp_connection_status: string;
  is_default: boolean;
  tools_count?: number;
}

interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

interface MCPContextType {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  defaultServer: MCPServer | null;
  availableServers: MCPServer[];
  availableTools: MCPTool[];
  toggleMCPEnabled: () => void;
  isMCPEnabled: boolean;
  refreshConnection: () => Promise<void>;
  executeCommand: (toolName: string, parameters?: any) => Promise<any>;
  selectServer: (serverId: string) => Promise<void>;
  showServerSelector: boolean;
  setShowServerSelector: (show: boolean) => void;
  connectToServer: (server: MCPServer) => Promise<void>;
  testServerConnection: (server: MCPServer) => Promise<any>;
}

const MCPContext = createContext<MCPContextType | undefined>(undefined);

export const useMCP = () => {
  const context = useContext(MCPContext);
  if (context === undefined) {
    throw new Error('useMCP must be used within a MCPProvider');
  }
  return context;
};

interface MCPProviderProps {
  children: ReactNode;
}

export const MCPProvider: React.FC<MCPProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultServer, setDefaultServer] = useState<MCPServer | null>(null);
  const [availableServers, setAvailableServers] = useState<MCPServer[]>([]);
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [showServerSelector, setShowServerSelector] = useState<boolean>(false);
  const [isMCPEnabled, setIsMCPEnabled] = useState<boolean>(() => {
    // Try to get the MCP enabled state from localStorage
    const savedState = localStorage.getItem('mcp_enabled');
    return savedState ? JSON.parse(savedState) : false;
  });

  // Fetch MCP status on mount
  useEffect(() => {
    // Initial load of available servers
    const fetchServers = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get('/api/mcp/server/config');
        if (response.data && response.data.configurations && response.data.configurations.length > 0) {
          setAvailableServers(response.data.configurations);

          // Find default server if any
          const defaultServer = response.data.configurations.find((server: MCPServer) => server.is_default);
          if (defaultServer) {
            setDefaultServer(defaultServer);

            // If MCP is enabled, connect to the default server
            if (isMCPEnabled) {
              connectToServer(defaultServer);
            }
          } else {
            // If no default server but we have servers, use the first one
            setDefaultServer(response.data.configurations[0]);

            // If MCP is enabled, connect to this server
            if (isMCPEnabled) {
              connectToServer(response.data.configurations[0]);
            }
          }
        } else {
          // No servers found
          setAvailableServers([]);
          setDefaultServer(null);
          setError('No MCP servers configured. Please configure a server in the settings page.');
          
          // If MCP is enabled but no servers, show selector to guide user
          if (isMCPEnabled) {
            setShowServerSelector(true);
          }
        }
      } catch (error) {
        console.error('Failed to fetch MCP servers:', error);
        setAvailableServers([]);
        setDefaultServer(null);
        setError('Failed to retrieve MCP server configurations. Please try again later.');
        
        // If MCP is enabled but failed to fetch servers, show selector
        if (isMCPEnabled) {
          setShowServerSelector(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchServers();
  }, []);

  // Connect when MCP is enabled
  useEffect(() => {
    if (isMCPEnabled) {
      if (defaultServer) {
        connectToServer(defaultServer);
      } else {
        // If no default server but we have servers, show selector
        if (availableServers.length > 0) {
          setShowServerSelector(true);
        } else {
          // No servers configured, show error
          setError('No MCP servers configured. Please configure a server in the settings page.');
          setShowServerSelector(true);
        }
      }
    } else {
      setIsConnected(false);
    }
  }, [isMCPEnabled]);

  // Save MCP enabled state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('mcp_enabled', JSON.stringify(isMCPEnabled));
  }, [isMCPEnabled]);

  // Helper function to connect to a server
  const connectToServer = async (server: MCPServer) => {
    setIsLoading(true);
    setError(null);

    try {
      // Test connection to the server
      const testResult = await testServerConnection(server);

      if (testResult.success) {
        setIsConnected(true);
        setDefaultServer(server);

        // Fetch tools if available
        if (testResult.toolCount) {
          try {
            await fetchServerTools(server);
          } catch (toolsError) {
            console.error('Failed to fetch MCP tools:', toolsError);
            setAvailableTools([]);
          }
        }
      } else {
        setIsConnected(false);
        setError(testResult.error || 'Failed to connect to MCP server');
      }
    } catch (err: any) {
      console.error('Error connecting to MCP server:', err);
      setIsConnected(false);
      setError(err.message || 'Failed to connect to MCP server');
    } finally {
      setIsLoading(false);
    }
  };

  // Test connection to a server
  const testServerConnection = async (server: MCPServer) => {
    try {
      console.log(`Testing connection to MCP server: ${server.mcp_host}:${server.mcp_port}`);

      // Use the information endpoint from config.ini
      const infoEndpoint = '/info'; // From config.ini: mcp_terminal_name_1_information_endpoint
      const toolsEndpoint = '/tools'; // From config.ini: mcp_terminal_name_1_fetch_tool_endpoint

      // Direct connection to the MCP server
      const response = await axios.get(`http://${server.mcp_host}:${server.mcp_port}${infoEndpoint}`, {
        timeout: 5000
      });

      console.log('MCP server info response:', response.data);

      if (response.status === 200 && response.data) {
        try {
          // Also fetch tools to check if they're available
          const toolsResponse = await axios.get(`http://${server.mcp_host}:${server.mcp_port}${toolsEndpoint}`, {
            timeout: 5000
          });

          console.log('MCP server tools response:', toolsResponse.data);

          return {
            success: true,
            server: response.data,
            toolCount: Array.isArray(toolsResponse.data) ? toolsResponse.data.length : 0
          };
        } catch (toolsError) {
          console.error('Error fetching MCP tools:', toolsError);

          // Even if tools fetch fails, consider the connection successful
          // as long as the info endpoint worked
          return {
            success: true,
            server: response.data,
            toolCount: 0
          };
        }
      }

      return {
        success: false,
        error: 'Invalid response from MCP server'
      };
    } catch (err: any) {
      console.error('Error testing MCP connection:', err);
      return {
        success: false,
        error: err.message || 'Failed to connect to MCP server'
      };
    }
  };

  // Fetch tools from a server
  const fetchServerTools = async (server: MCPServer) => {
    try {
      console.log(`Fetching tools from MCP server: ${server.mcp_host}:${server.mcp_port}`);

      // Use the tools endpoint from config.ini
      const toolsEndpoint = '/tools'; // From config.ini: mcp_terminal_name_1_fetch_tool_endpoint

      const response = await axios.get(`http://${server.mcp_host}:${server.mcp_port}${toolsEndpoint}`, {
        timeout: 5000
      });

      console.log('MCP server tools response:', response.data);

      if (response.status === 200 && response.data) {
        // Make sure we have an array of tools
        const tools = Array.isArray(response.data) ? response.data : [];
        setAvailableTools(tools);
        return tools;
      }

      return [];
    } catch (err) {
      console.error('Error fetching MCP tools:', err);
      setAvailableTools([]);
      return [];
    }
  };

  // Function to refresh MCP connection status
  const refreshConnection = async () => {
    if (!isMCPEnabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get available servers
      const serversResponse = await axios.get('/api/mcp/server/config');

      if (serversResponse.data && serversResponse.data.configurations) {
        setAvailableServers(serversResponse.data.configurations);

        // Find default server
        const defaultServerConfig = serversResponse.data.configurations.find((s: MCPServer) => s.is_default);

        if (defaultServerConfig) {
          // Connect to the default server
          await connectToServer(defaultServerConfig);
        } else if (serversResponse.data.configurations.length > 0) {
          // If no default but we have servers, show selector
          setShowServerSelector(true);
        } else {
          setIsConnected(false);
          setDefaultServer(null);
          setAvailableTools([]);
          setError('No MCP servers configured. Please configure a server in the settings page.');
        }
      } else {
        setIsConnected(false);
        setDefaultServer(null);
        setAvailableTools([]);
        setError('No MCP servers available. Please configure a server in the settings page.');
      }
    } catch (err: any) {
      console.error('Error fetching MCP status:', err);
      setIsConnected(false);
      setDefaultServer(null);
      setAvailableTools([]);
      setError(err.response?.data?.error || 'Failed to connect to MCP server');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle MCP enabled state
  const toggleMCPEnabled = () => {
    const newValue = !isMCPEnabled;
    setIsMCPEnabled(newValue);

    // If enabling MCP and no default server is selected, show the server selector
    if (newValue && !defaultServer) {
      setShowServerSelector(true);
    }
  };

  // Select an MCP server
  const selectServer = async (serverId: string) => {
    try {
      // Find the server in the available servers
      const server = availableServers.find(s => s.id === serverId);

      if (!server) {
        throw new Error('Server not found');
      }

      // Connect to the server using our helper function
      await connectToServer(server);

      // Close the server selector
      setShowServerSelector(false);

      // Update server as default in the database if needed
      try {
        await axios.put(`/api/mcp/server/config/${serverId}`, {
          ...server,
          is_default: true
        });
      } catch (updateError) {
        console.error('Failed to update server as default:', updateError);
      }
    } catch (err: any) {
      console.error('Error selecting MCP server:', err);
      setError(err.message || 'Failed to select MCP server');
    }
  };

  // Execute a command on the MCP server
  const executeCommand = async (toolName: string, parameters: any = {}) => {
    if (!defaultServer) {
      throw new Error('No MCP server configured');
    }

    try {
      console.log(`Executing MCP command: ${toolName}`, parameters);

      // Use the messages endpoint from config.ini
      const messagesEndpoint = '/messages'; // From config.ini: mcp_terminal_name_1_messages_endpoint

      // Generate a unique message ID
      const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Create the message payload
      const message = {
        id: messageId,
        type: 'invoke_tool',
        content: {
          name: toolName,
          parameters: parameters
        },
        clientId: 'web-client' // This is a placeholder, the server will assign a real client ID
      };

      console.log('Sending MCP command:', message);

      // Send the request directly to the MCP server
      const response = await axios.post(
        `http://${defaultServer.mcp_host}:${defaultServer.mcp_port}${messagesEndpoint}`,
        message,
        { timeout: 10000 }
      );

      console.log('MCP command response:', response.data);

      if (response.data && response.data.type === 'tool_result') {
        return response.data.content;
      } else if (response.data && response.data.type === 'error') {
        throw new Error(response.data.error?.message || 'Tool execution failed');
      } else {
        throw new Error('Invalid response from MCP server');
      }
    } catch (err: any) {
      console.error('Error executing MCP command:', err);
      throw new Error(err.message || 'Failed to execute command');
    }
  };

  const contextValue: MCPContextType = {
    isConnected,
    isLoading,
    error,
    defaultServer,
    availableServers,
    availableTools,
    toggleMCPEnabled,
    isMCPEnabled,
    refreshConnection,
    executeCommand,
    selectServer,
    showServerSelector,
    setShowServerSelector,
    connectToServer,
    testServerConnection
  };

  return <MCPContext.Provider value={contextValue}>{children}</MCPContext.Provider>;
};

export default MCPContext;