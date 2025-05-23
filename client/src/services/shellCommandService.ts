import { api } from './api';

/**
 * Interface for shell command execution result
 */
export interface ShellCommandResult {
  success: boolean;
  command: string;
  result?: any;
  error?: string;
  output?: string;
  stderr?: string;
  serverConfig?: {
    id: string;
    name: string;
    host: string;
    port: string;
  };
  timestamp: string;
}

/**
 * Interface for MCP server configuration
 */
export interface MCPServerConfig {
  id: string;
  user_id: string;
  server_name: string;
  mcp_host: string;
  mcp_port: string;
  is_default: boolean;
  last_connection_status?: string;
  last_error_message?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Interface for MCP tools response
 */
export interface MCPToolsResult {
  success: boolean;
  tools?: string;
  error?: string;
  serverConfig?: {
    id: string;
    name: string;
    host: string;
    port: string;
  };
  timestamp: string;
}

/**
 * Shell Command Service
 * Provides methods for executing shell commands and managing MCP servers
 */
export class ShellCommandService {
  /**
   * Execute a shell command via MCP orchestrator
   * @param command The shell command to execute
   * @param options Execution options
   * @returns Promise with execution result
   */
  async executeCommand(
    command: string,
    options: {
      serverId?: string;
      timeout?: number;
    } = {}
  ): Promise<ShellCommandResult> {
    try {
      const response = await api.post('/ai/tools/runshellcommand', {
        command,
        serverId: options.serverId,
        timeout: options.timeout || 30
      });

      return response.data;
    } catch (error: any) {
      console.error('Error executing shell command:', error);
      
      const errorMessage = error.response?.data?.error || error.message || 'Failed to execute shell command';
      
      return {
        success: false,
        command,
        error: errorMessage,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test MCP server connection
   * @param serverId Optional server ID (uses default if not provided)
   * @returns Promise with connection test result
   */
  async testConnection(serverId?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const params = serverId ? { serverId } : {};
      const response = await api.get('/ai/tools/runshellcommand/test', { params });

      return response.data;
    } catch (error: any) {
      console.error('Error testing MCP connection:', error);
      
      const errorMessage = error.response?.data?.error || error.message || 'Failed to test MCP connection';
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get available tools from MCP server
   * @param serverId Optional server ID (uses default if not provided)
   * @returns Promise with available tools
   */
  async getAvailableTools(serverId?: string): Promise<MCPToolsResult> {
    try {
      const params = serverId ? { serverId } : {};
      const response = await api.get('/ai/tools/runshellcommand/tools', { params });

      return response.data;
    } catch (error: any) {
      console.error('Error getting available tools:', error);
      
      const errorMessage = error.response?.data?.error || error.message || 'Failed to get available tools';
      
      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get user's MCP server configurations
   * @returns Promise with user's MCP servers
   */
  async getUserMCPServers(): Promise<{
    success: boolean;
    servers?: MCPServerConfig[];
    defaultServer?: MCPServerConfig | null;
    error?: string;
  }> {
    try {
      const response = await api.get('/ai/tools/runshellcommand/servers');

      return response.data;
    } catch (error: any) {
      console.error('Error getting user MCP servers:', error);
      
      const errorMessage = error.response?.data?.error || error.message || 'Failed to get MCP servers';
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Generate a shell command suggestion based on user request
   * This is a helper function to suggest common commands
   * @param userRequest The user's natural language request
   * @returns Suggested shell command
   */
  generateCommandSuggestion(userRequest: string): string {
    const request = userRequest.toLowerCase();

    // Common command patterns
    if (request.includes('list') && (request.includes('files') || request.includes('folder') || request.includes('directory'))) {
      return 'ls -la';
    }
    
    if (request.includes('current') && request.includes('directory')) {
      return 'pwd';
    }
    
    if (request.includes('disk') && request.includes('space')) {
      return 'df -h';
    }
    
    if (request.includes('memory') || request.includes('ram')) {
      return 'free -h';
    }
    
    if (request.includes('process') && request.includes('running')) {
      return 'ps aux';
    }
    
    if (request.includes('network') && request.includes('connection')) {
      return 'netstat -tuln';
    }
    
    if (request.includes('system') && request.includes('info')) {
      return 'uname -a';
    }
    
    if (request.includes('date') || request.includes('time')) {
      return 'date';
    }
    
    if (request.includes('who') && request.includes('logged')) {
      return 'who';
    }
    
    if (request.includes('create') && request.includes('directory')) {
      return 'mkdir new_directory';
    }

    // If no pattern matches, return a generic suggestion
    return 'echo "Please specify the command you want to execute"';
  }

  /**
   * Format command result for display
   * @param result The command execution result
   * @returns Formatted display string
   */
  formatResultForDisplay(result: ShellCommandResult): string {
    if (!result.success) {
      return `❌ Command failed: ${result.error}\n${result.stderr ? `Error output: ${result.stderr}` : ''}`;
    }

    let display = `✅ Command executed successfully\n`;
    display += `📋 Command: ${result.command}\n`;
    display += `🖥️ Server: ${result.serverConfig?.name || 'Unknown'} (${result.serverConfig?.host}:${result.serverConfig?.port})\n`;
    display += `⏰ Time: ${new Date(result.timestamp).toLocaleString()}\n\n`;

    if (result.result) {
      // Handle different result formats
      if (typeof result.result === 'string') {
        display += `📄 Output:\n${result.result}`;
      } else if (result.result.output) {
        display += `📄 Output:\n${result.result.output}`;
      } else if (result.result.stdout) {
        display += `📄 Output:\n${result.result.stdout}`;
      } else {
        display += `📄 Result:\n${JSON.stringify(result.result, null, 2)}`;
      }
    } else if (result.output) {
      display += `📄 Output:\n${result.output}`;
    }

    return display;
  }
}

// Export singleton instance
export const shellCommandService = new ShellCommandService(); 