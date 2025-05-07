/**
 * SSH Service
 * Manages SSH connections and installation of MCP via SSH
 */

const { NodeSSH } = require('node-ssh');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../utils/config');
const { logger } = require('../utils/logger');

// Get encryption key from environment or generate one
const ENCRYPTION_KEY = process.env.SSH_ENCRYPTION_KEY ||
  crypto.randomBytes(32).toString('hex');

/**
 * Test SSH connection with provided configuration
 *
 * @param {Object} sshConfig - SSH connection configuration
 * @param {string} sshConfig.ssh_host - SSH server hostname or IP
 * @param {number} sshConfig.ssh_port - SSH server port
 * @param {string} sshConfig.ssh_user - SSH username
 * @param {string} sshConfig.ssh_auth_method - Authentication method ('password' or 'key')
 * @param {string} [sshConfig.ssh_password] - SSH password (if ssh_auth_method is 'password')
 * @param {string} [sshConfig.ssh_key_path] - Path to private key (if ssh_auth_method is 'key')
 * @returns {Promise<Object>} - Connection test result
 */
async function testSSHConnection(sshConfig) {
  const ssh = new NodeSSH();

  try {
    // Map the frontend field names to what the SSH library expects
    const connectionConfig = {
      host: sshConfig.ssh_host || sshConfig.host,
      port: sshConfig.ssh_port || sshConfig.port || 22, // Default to port 22 if not specified
      username: sshConfig.ssh_user || sshConfig.username,
      // Set auth method based on config
      ...(
        (sshConfig.ssh_auth_method === 'password' || sshConfig.authMethod === 'password')
          ? { password: sshConfig.ssh_password || sshConfig.password }
          : { privateKey: sshConfig.ssh_key_path || sshConfig.keyPath }
      )
    };

    logger.info(`Attempting SSH connection to ${connectionConfig.host}:${connectionConfig.port} as ${connectionConfig.username}`);

    // Try to connect
    await ssh.connect(connectionConfig);

    // Test a simple command
    const result = await ssh.execCommand('echo "SSH connection successful"');

    if (result.code !== 0) {
      throw new Error(`Command execution failed: ${result.stderr}`);
    }

    // Disconnect
    ssh.dispose();

    logger.info(`SSH connection test successful to ${connectionConfig.host}`);

    return {
      success: true,
      message: 'SSH connection test successful'
    };
  } catch (err) {
    // Make sure SSH connection is closed
    ssh.dispose();

    logger.error(`SSH connection test failed: ${err.message}`);

    return {
      success: false,
      error: err.message || 'SSH connection test failed'
    };
  }
}

/**
 * Execute a command over SSH
 *
 * @param {Object} sshConfig - SSH connection configuration
 * @param {string} command - Command to execute
 * @param {Object} [options] - Command execution options
 * @param {boolean} [options.cwd] - Working directory
 * @param {boolean} [options.stream] - Whether to stream output
 * @returns {Promise<Object>} - Command execution result
 */
async function executeSSHCommand(sshConfig, command, options = {}) {
  const ssh = new NodeSSH();

  try {
    // If password is encrypted, decrypt it
    let password = sshConfig.ssh_password || sshConfig.password;
    const authMethod = sshConfig.ssh_auth_method || sshConfig.authMethod;

    if (authMethod === 'password') {
      if (sshConfig.ssh_password_encrypted || sshConfig.passwordEncrypted) {
        password = decryptPassword(sshConfig.ssh_password_encrypted || sshConfig.passwordEncrypted);
      }
    }

    const connectionConfig = {
      host: sshConfig.ssh_host || sshConfig.host,
      port: sshConfig.ssh_port || sshConfig.port,
      username: sshConfig.ssh_user || sshConfig.username,
      // Set auth method based on config
      ...(authMethod === 'password'
        ? { password }
        : { privateKey: sshConfig.ssh_key_path || sshConfig.keyPath })
    };

    // Connect to the SSH server
    await ssh.connect(connectionConfig);

    // Execute the command
    const result = await ssh.execCommand(command, {
      cwd: options.cwd || '.',
      stream: options.stream || false,
      onStdout: options.onStdout,
      onStderr: options.onStderr
    });

    // Disconnect
    ssh.dispose();

    return {
      success: result.code === 0,
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (err) {
    // Make sure SSH connection is closed
    ssh.dispose();

    logger.error(`SSH command execution failed: ${err.message}`);

    return {
      success: false,
      error: err.message || 'SSH command execution failed'
    };
  }
}

/**
 * Install MCP server via SSH
 *
 * @param {Object} sshConfig - SSH connection configuration
 * @returns {Promise<Object>} - Installation result
 */
async function installMCPViaSSH(sshConfig) {
  // Get MCP installation command from config
  const mcpInstallCommand = config.get('mcp-server.mcp_terminal_command_1');

  if (!mcpInstallCommand) {
    return {
      success: false,
      error: 'MCP installation command not found in configuration'
    };
  }

  try {
    // First test SSH connection
    const testResult = await testSSHConnection(sshConfig);

    if (!testResult.success) {
      throw new Error(`SSH connection failed: ${testResult.error}`);
    }

    // Get the host from the config, supporting both naming conventions
    const host = sshConfig.ssh_host || sshConfig.host;

    // Execute installation command
    logger.info(`Installing MCP on ${host} via SSH...`);

    const installResult = await executeSSHCommand(sshConfig, mcpInstallCommand, {
      stream: true
    });

    if (!installResult.success) {
      throw new Error(`MCP installation failed: ${installResult.stderr}`);
    }

    // Verify MCP server is running by checking the port
    const defaultPort = config.get('mcp-server.mcp_terminal_command_default_port_1') || 8080;
    const verifyCommand = `netstat -tulpn | grep ${defaultPort}`;

    const verifyResult = await executeSSHCommand(sshConfig, verifyCommand);

    if (!verifyResult.success || !verifyResult.stdout.includes(defaultPort.toString())) {
      throw new Error(`MCP server installation verification failed: Server not listening on port ${defaultPort}`);
    }

    return {
      success: true,
      message: 'MCP server installed successfully',
      host: host,
      port: defaultPort
    };
  } catch (err) {
    logger.error(`MCP installation failed: ${err.message}`);

    return {
      success: false,
      error: err.message || 'MCP installation failed'
    };
  }
}

/**
 * Encrypt password for storage
 *
 * @param {string} password - Plain text password
 * @returns {string} - Encrypted password
 */
function encryptPassword(password) {
  // Generate a random initialization vector
  const iv = crypto.randomBytes(16);

  // Create cipher using AES-256-GCM
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );

  // Encrypt the password
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get the auth tag
  const authTag = cipher.getAuthTag().toString('hex');

  // Combine IV, encrypted password, and auth tag for storage
  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

/**
 * Decrypt password for use
 *
 * @param {string} encryptedPassword - Encrypted password
 * @returns {string} - Decrypted password
 */
function decryptPassword(encryptedPassword) {
  // Split the stored data
  const [ivHex, encrypted, authTagHex] = encryptedPassword.split(':');

  // Convert hex strings to buffers
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  // Create decipher using AES-256-GCM
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );

  // Set auth tag
  decipher.setAuthTag(authTag);

  // Decrypt the password
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = {
  testSSHConnection,
  executeSSHCommand,
  installMCPViaSSH,
  encryptPassword,
  decryptPassword
};