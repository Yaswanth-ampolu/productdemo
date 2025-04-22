/**
 * Simple logger module for application logging
 */

// Define logging levels
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Current log level (can be configured from environment variable)
const currentLevel = process.env.LOG_LEVEL ? 
  LogLevel[process.env.LOG_LEVEL.toUpperCase()] || LogLevel.INFO : 
  LogLevel.INFO;

/**
 * Logger class with basic logging functionality
 */
const logger = {
  /**
   * Log error messages
   * @param {string} message - Error message
   * @param {Error|any} [error] - Optional error object
   */
  error: (message, error) => {
    if (currentLevel >= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`);
      if (error) {
        if (error instanceof Error) {
          console.error(`        ${error.message}`);
          if (error.stack) {
            console.error(`        ${error.stack}`);
          }
        } else {
          console.error('        ', error);
        }
      }
    }
  },

  /**
   * Log warning messages
   * @param {string} message - Warning message
   */
  warn: (message) => {
    if (currentLevel >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`);
    }
  },

  /**
   * Log informational messages
   * @param {string} message - Info message
   */
  info: (message) => {
    if (currentLevel >= LogLevel.INFO) {
      console.info(`[INFO] ${message}`);
    }
  },

  /**
   * Log debug messages
   * @param {string} message - Debug message
   * @param {any} [data] - Optional data to log
   */
  debug: (message, data) => {
    if (currentLevel >= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`);
      if (data) {
        console.debug(data);
      }
    }
  }
};

module.exports = { logger, LogLevel }; 