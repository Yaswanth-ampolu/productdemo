/**
 * MCP API Routes
 * Handles API endpoints for MCP functionality
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('./auth');
const mcpService = require('../services/mcpService');
const sshService = require('../services/sshService');
const mcpDBService = require('../services/mcpDBService');
const config = require('../utils/config');
const { logger } = require('../utils/logger');

// Get MCP configuration from config file
router.get('/config', requireAuth, (req, res) => {
  try {
    // Get MCP configuration from config
    const mcpConfig = {
      defaultTool: {
        name: config.get('mcp-server.mcp_terminal_name_1') || 'mcp-terminal_executor',
        installCommand: config.get('mcp-server.mcp_terminal_command_1') || '',
        defaultPort: parseInt(config.get('mcp-server.mcp_terminal_command_default_port_1')) || 8080,
        defaultHost: config.get('mcp-server.mcp_terminal_command_default_host_1') || 'localhost',
        timeout: parseInt(config.get('mcp-server.mcp_terminal_command_default_timeout_1')) || 300,
        timeoutUnit: config.get('mcp-server.mcp_terminal_command_default_timeout_unit_1') || 'seconds'
      }
    };

    res.json(mcpConfig);
  } catch (err) {
    logger.error(`Error fetching MCP config: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch MCP configuration' });
  }
});

// Test MCP connection
router.post('/test-connection', requireAuth, async (req, res) => {
  try {
    const { mcp_host, mcp_port } = req.body;

    if (!mcp_host || !mcp_port) {
      return res.status(400).json({ error: 'Host and port are required' });
    }

    // Test the MCP connection
    const result = await mcpService.testMCPConnection({
      mcp_host,
      mcp_port
    });

    res.json(result);
  } catch (err) {
    logger.error(`Error testing MCP connection: ${err.message}`);
    res.status(500).json({ error: 'Failed to test MCP connection' });
  }
});

// SSH Configuration Routes

// Get all SSH configurations
router.get('/ssh/config', requireAuth, async (req, res) => {
  try {
    const configurations = await mcpDBService.getUserSSHConfigurations(req.session.userId);
    res.json({ configurations });
  } catch (err) {
    logger.error(`Error fetching SSH configs: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch SSH configurations' });
  }
});

// Get a specific SSH configuration
router.get('/ssh/config/:id', requireAuth, async (req, res) => {
  try {
    const config = await mcpDBService.getSSHConfiguration(req.params.id, req.session.userId);

    if (!config) {
      return res.status(404).json({ error: 'SSH configuration not found' });
    }

    res.json(config);
  } catch (err) {
    logger.error(`Error fetching SSH config ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch SSH configuration' });
  }
});

// Create a new SSH configuration
router.post('/ssh/config', requireAuth, async (req, res) => {
  try {
    const config = req.body;

    // Validate required fields
    if (!config.machine_nickname || !config.ssh_host || !config.ssh_port ||
        !config.ssh_user || !config.ssh_auth_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate auth method
    if (config.ssh_auth_method === 'password' && !config.ssh_password) {
      return res.status(400).json({ error: 'Password is required for password authentication' });
    }

    if (config.ssh_auth_method === 'key' && !config.ssh_key_path) {
      return res.status(400).json({ error: 'Key path is required for key authentication' });
    }

    const created = await mcpDBService.createSSHConfiguration(config, req.session.userId);
    res.status(201).json(created);
  } catch (err) {
    logger.error(`Error creating SSH config: ${err.message}`);
    res.status(500).json({ error: 'Failed to create SSH configuration' });
  }
});

// Update an existing SSH configuration
router.put('/ssh/config/:id', requireAuth, async (req, res) => {
  try {
    const config = {
      ...req.body,
      id: req.params.id
    };

    // Validate required fields
    if (!config.machine_nickname || !config.ssh_host || !config.ssh_port ||
        !config.ssh_user || !config.ssh_auth_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate auth method
    if (config.ssh_auth_method === 'key' && !config.ssh_key_path) {
      return res.status(400).json({ error: 'Key path is required for key authentication' });
    }

    const updated = await mcpDBService.updateSSHConfiguration(config, req.session.userId);
    res.json(updated);
  } catch (err) {
    logger.error(`Error updating SSH config ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: 'Failed to update SSH configuration' });
  }
});

// Delete an SSH configuration
router.delete('/ssh/config/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await mcpDBService.deleteSSHConfiguration(req.params.id, req.session.userId);

    if (!deleted) {
      return res.status(404).json({ error: 'SSH configuration not found' });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error(`Error deleting SSH config ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete SSH configuration' });
  }
});

// Test SSH connection
router.post('/ssh/test', requireAuth, async (req, res) => {
  try {
    const config = req.body;

    // Validate required fields
    if (!config.ssh_host || !config.ssh_user || !config.ssh_auth_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Set default port if not provided
    if (!config.ssh_port) {
      config.ssh_port = 22;
    }

    // Validate auth method
    if (config.ssh_auth_method === 'password' && !config.ssh_password) {
      return res.status(400).json({ error: 'Password is required for password authentication' });
    }

    if (config.ssh_auth_method === 'key' && !config.ssh_key_path) {
      return res.status(400).json({ error: 'Key path is required for key authentication' });
    }

    // Test the connection
    const result = await sshService.testSSHConnection(config);

    // Update status in DB if config has an ID
    if (config.id) {
      await mcpDBService.updateSSHConnectionStatus(
        config.id,
        result.success ? 'successful' : 'failed',
        result.error || null
      );
    }

    res.json(result);
  } catch (err) {
    logger.error(`Error testing SSH connection: ${err.message}`);
    res.status(500).json({ error: 'Failed to test SSH connection' });
  }
});

// Install MCP via SSH
router.post('/ssh/install', requireAuth, async (req, res) => {
  try {
    const { sshConfigId, mcpToolId } = req.body;

    if (!sshConfigId) {
      return res.status(400).json({ error: 'SSH configuration ID is required' });
    }

    // Get SSH configuration with password
    const sshConfig = await mcpDBService.getSSHConfigurationWithPassword(sshConfigId, req.session.userId);

    if (!sshConfig) {
      return res.status(404).json({ error: 'SSH configuration not found' });
    }

    // Get MCP installation command from config if mcpToolId is 'default'
    if (mcpToolId === 'default') {
      // Use the default MCP installation command from config
      logger.info(`Using default MCP installation tool from config`);
    } else {
      // In the future, we could support custom MCP tools from the database
      logger.info(`Using MCP tool ID: ${mcpToolId}`);
    }

    // Install MCP via SSH
    const result = await sshService.installMCPViaSSH(sshConfig);

    // Update SSH connection status
    await mcpDBService.updateSSHConnectionStatus(
      sshConfigId,
      result.success ? 'successful' : 'failed',
      result.error || null
    );

    // If successful, create an MCP server configuration
    if (result.success) {
      const serverConfig = {
        server_name: `MCP on ${sshConfig.machine_nickname}`,
        mcp_host: result.host,
        mcp_port: result.port,
        is_default: true
      };

      await mcpDBService.createMCPServerConfiguration(serverConfig, req.session.userId);
    }

    res.json(result);
  } catch (err) {
    logger.error(`Error installing MCP via SSH: ${err.message}`);
    res.status(500).json({ error: 'Failed to install MCP' });
  }
});

// MCP Server Configuration Routes

// Get all MCP server configurations
router.get('/server/config', requireAuth, async (req, res) => {
  try {
    const configurations = await mcpDBService.getUserMCPServerConfigurations(req.session.userId);
    res.json({ configurations });
  } catch (err) {
    logger.error(`Error fetching MCP server configs: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch MCP server configurations' });
  }
});

// Get a specific MCP server configuration
router.get('/server/config/:id', requireAuth, async (req, res) => {
  try {
    const config = await mcpDBService.getMCPServerConfiguration(req.params.id, req.session.userId);

    if (!config) {
      return res.status(404).json({ error: 'MCP server configuration not found' });
    }

    res.json(config);
  } catch (err) {
    logger.error(`Error fetching MCP server config ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch MCP server configuration' });
  }
});

// Create a new MCP server configuration
router.post('/server/config', requireAuth, async (req, res) => {
  try {
    const config = req.body;

    // Validate required fields
    if (!config.server_name || !config.mcp_host || !config.mcp_port) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const created = await mcpDBService.createMCPServerConfiguration(config, req.session.userId);
    res.status(201).json(created);
  } catch (err) {
    logger.error(`Error creating MCP server config: ${err.message}`);
    res.status(500).json({ error: 'Failed to create MCP server configuration' });
  }
});

// Update an existing MCP server configuration
router.put('/server/config/:id', requireAuth, async (req, res) => {
  try {
    const config = {
      ...req.body,
      id: req.params.id
    };

    // Validate required fields
    if (!config.server_name || !config.mcp_host || !config.mcp_port) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updated = await mcpDBService.updateMCPServerConfiguration(config, req.session.userId);
    res.json(updated);
  } catch (err) {
    logger.error(`Error updating MCP server config ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: 'Failed to update MCP server configuration' });
  }
});

// Delete an MCP server configuration
router.delete('/server/config/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await mcpDBService.deleteMCPServerConfiguration(req.params.id, req.session.userId);

    if (!deleted) {
      return res.status(404).json({ error: 'MCP server configuration not found' });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error(`Error deleting MCP server config ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete MCP server configuration' });
  }
});

// MCP Connection and Tool Execution Routes

// Connect to an MCP server
router.post('/connect', requireAuth, async (req, res) => {
  try {
    const { serverId } = req.body;

    if (!serverId) {
      return res.status(400).json({ error: 'Server ID is required' });
    }

    // Get server configuration
    const serverConfig = await mcpDBService.getMCPServerConfiguration(serverId, req.session.userId);

    if (!serverConfig) {
      return res.status(404).json({ error: 'MCP server configuration not found' });
    }

    // Connect to the MCP server
    const result = await mcpService.connectToMCP({
      id: serverConfig.id,
      mcp_host: serverConfig.mcp_host,
      mcp_port: serverConfig.mcp_port
    });

    // Update connection status
    await mcpDBService.updateMCPConnectionStatus(
      serverId,
      result.success ? 'connected' : 'error',
      result.error || null
    );

    res.json(result);
  } catch (err) {
    logger.error(`Error connecting to MCP server: ${err.message}`);
    res.status(500).json({ error: 'Failed to connect to MCP server' });
  }
});

// Disconnect from an MCP server
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    const { serverId } = req.body;

    if (!serverId) {
      return res.status(400).json({ error: 'Server ID is required' });
    }

    // Disconnect from the MCP server
    const success = await mcpService.disconnectFromMCP(serverId);

    // Update connection status
    await mcpDBService.updateMCPConnectionStatus(serverId, 'disconnected');

    res.json({ success });
  } catch (err) {
    logger.error(`Error disconnecting from MCP server: ${err.message}`);
    res.status(500).json({ error: 'Failed to disconnect from MCP server' });
  }
});

// Get MCP connection status
router.get('/status/:serverId', requireAuth, async (req, res) => {
  try {
    const { serverId } = req.params;

    if (!serverId) {
      return res.status(400).json({ error: 'Server ID is required' });
    }

    // Get server configuration
    const serverConfig = await mcpDBService.getMCPServerConfiguration(serverId, req.session.userId);

    if (!serverConfig) {
      return res.status(404).json({ error: 'MCP server configuration not found' });
    }

    // Get connection status
    const status = mcpService.getMCPStatus(serverId);

    res.json({ status, config: serverConfig });
  } catch (err) {
    logger.error(`Error getting MCP status: ${err.message}`);
    res.status(500).json({ error: 'Failed to get MCP status' });
  }
});

// Get available MCP tools
router.get('/tools/:serverId', requireAuth, async (req, res) => {
  try {
    const { serverId } = req.params;

    if (!serverId) {
      return res.status(400).json({ error: 'Server ID is required' });
    }

    // Get server configuration
    const serverConfig = await mcpDBService.getMCPServerConfiguration(serverId, req.session.userId);

    if (!serverConfig) {
      return res.status(404).json({ error: 'MCP server configuration not found' });
    }

    // Get connection status
    const status = mcpService.getMCPStatus(serverId);

    if (status !== 'connected') {
      return res.status(400).json({ error: `MCP server is not connected. Current status: ${status}` });
    }

    // Discover tools
    const tools = await mcpService.discoverTools(serverId);

    res.json({ tools });
  } catch (err) {
    logger.error(`Error discovering MCP tools: ${err.message}`);
    res.status(500).json({ error: 'Failed to discover MCP tools' });
  }
});

// Execute an MCP tool
router.post('/execute', requireAuth, async (req, res) => {
  try {
    const { serverId, toolName, parameters } = req.body;

    if (!serverId || !toolName) {
      return res.status(400).json({ error: 'Server ID and tool name are required' });
    }

    // Get server configuration
    const serverConfig = await mcpDBService.getMCPServerConfiguration(serverId, req.session.userId);

    if (!serverConfig) {
      return res.status(404).json({ error: 'MCP server configuration not found' });
    }

    // Get connection status
    const status = mcpService.getMCPStatus(serverId);

    if (status !== 'connected') {
      return res.status(400).json({ error: `MCP server is not connected. Current status: ${status}` });
    }

    // Execute the tool
    const result = await mcpService.executeTool(serverId, toolName, parameters || {});

    res.json(result);
  } catch (err) {
    logger.error(`Error executing MCP tool: ${err.message}`);
    res.status(500).json({ error: 'Failed to execute MCP tool' });
  }
});

// Get active MCP connections
router.get('/connections', requireAuth, (req, res) => {
  try {
    const connections = mcpService.getActiveConnections();
    res.json({ connections });
  } catch (err) {
    logger.error(`Error getting active MCP connections: ${err.message}`);
    res.status(500).json({ error: 'Failed to get active MCP connections' });
  }
});

// Get default MCP server for user
router.get('/default-server', requireAuth, async (req, res) => {
  try {
    const defaultServer = await mcpDBService.getDefaultMCPServerConfiguration(req.session.userId);

    if (!defaultServer) {
      return res.json({ defaultServer: null });
    }

    // Get connection status
    const status = mcpService.getMCPStatus(defaultServer.id);

    res.json({
      defaultServer: {
        ...defaultServer,
        connectionStatus: status
      }
    });
  } catch (err) {
    logger.error(`Error getting default MCP server: ${err.message}`);
    res.status(500).json({ error: 'Failed to get default MCP server' });
  }
});

module.exports = router;