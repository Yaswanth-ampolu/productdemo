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
  executeCommand: (command: string) => Promise<any>;
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
  const [isMCPEnabled, setIsMCPEnabled] = useState<boolean>(() => {
    // Try to get the MCP enabled state from localStorage
    const savedState = localStorage.getItem('mcp_enabled');
    return savedState ? JSON.parse(savedState) : false;
  });

  // Fetch MCP status on mount and whenever isMCPEnabled changes
  useEffect(() => {
    if (isMCPEnabled) {
      refreshConnection();
    } else {
      setIsConnected(false);
      setDefaultServer(null);
    }
  }, [isMCPEnabled]);

  // Save MCP enabled state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('mcp_enabled', JSON.stringify(isMCPEnabled));
  }, [isMCPEnabled]);

  // Function to refresh MCP connection status
  const refreshConnection = async () => {
    if (!isMCPEnabled) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get MCP status
      const statusResponse = await axios.get('/api/mcp/status');
      
      if (statusResponse.data.success) {
        setIsConnected(true);
        setDefaultServer(statusResponse.data.defaultServer || null);
        setAvailableServers(statusResponse.data.servers || []);
        
        // If we have a default server, fetch available tools
        if (statusResponse.data.defaultServer) {
          try {
            const toolsResponse = await axios.get('/api/mcp/tools');
            setAvailableTools(toolsResponse.data.tools || []);
          } catch (toolsError) {
            console.error('Failed to fetch MCP tools:', toolsError);
            setAvailableTools([]);
          }
        }
      } else {
        setIsConnected(false);
        setDefaultServer(null);
        setAvailableTools([]);
        if (statusResponse.data.error) {
          setError(statusResponse.data.error);
        }
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
    setIsMCPEnabled(prev => !prev);
  };

  // Execute a command on the MCP server
  const executeCommand = async (command: string) => {
    if (!isConnected || !defaultServer) {
      throw new Error('Not connected to MCP server');
    }
    
    try {
      const response = await axios.post('/api/mcp/execute', {
        command,
        serverId: defaultServer.id
      });
      
      return response.data;
    } catch (err: any) {
      console.error('Error executing MCP command:', err);
      throw new Error(err.response?.data?.error || 'Failed to execute command');
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
    executeCommand
  };

  return <MCPContext.Provider value={contextValue}>{children}</MCPContext.Provider>;
};

export default MCPContext; 