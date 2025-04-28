/**
 * Ollama AI Service
 * Handles communication with Ollama API for settings, model management, and chat interactions
 */

const axios = require('axios');
const { db } = require('../database');
const { logger } = require('../utils/logger');
const path = require('path');

// Default timeout for Ollama API requests (in milliseconds)
const DEFAULT_TIMEOUT = 120000; // Increased to 2 minutes for streaming
const STREAMING_TIMEOUT = 300000; // 5 minutes for streaming requests

/**
 * OllamaService manages communication with Ollama API and database operations
 * related to AI models and settings
 */
class OllamaService {
  constructor(config) {
    this.config = config;
    this.settings = null;
  }

  /**
   * Initializes the service by loading settings from database
   */
  async initialize() {
    try {
      await this.loadSettings();
      logger.info('OllamaService initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize OllamaService:', error);
      return false;
    }
  }

  /**
   * Loads Ollama settings from database
   */
  async loadSettings() {
    try {
      const result = await db.query('SELECT * FROM ollama_settings ORDER BY id DESC LIMIT 1');

      if (result.rows && result.rows.length > 0) {
        this.settings = result.rows[0];
        logger.info('Loaded Ollama settings from database');
      } else {
        // Create default settings if none exist
        logger.info('No Ollama settings found, creating defaults');
        await this.saveSettings({
          host: 'localhost',
          port: 11434,
          default_model: ''
        });
        const result = await db.query('SELECT * FROM ollama_settings ORDER BY id DESC LIMIT 1');
        this.settings = result.rows[0];
      }

      return this.settings;
    } catch (error) {
      logger.error('Error loading Ollama settings:', error);
      throw error;
    }
  }

  /**
   * Saves Ollama settings to database
   */
  async saveSettings(settings) {
    try {
      const { host, port, default_model } = settings;

      if (this.settings && this.settings.id) {
        // Update existing settings
        await db.query(
          'UPDATE ollama_settings SET host = $1, port = $2, default_model = $3, updated_at = NOW() WHERE id = $4',
          [host, port, default_model, this.settings.id]
        );
      } else {
        // Insert new settings
        await db.query(
          'INSERT INTO ollama_settings (host, port, default_model) VALUES ($1, $2, $3)',
          [host, port, default_model]
        );
      }

      // Reload settings
      await this.loadSettings();
      logger.info('Saved Ollama settings to database');

      return this.settings;
    } catch (error) {
      logger.error('Error saving Ollama settings:', error);
      throw error;
    }
  }

  /**
   * Creates an Ollama API client using current settings
   * @param {boolean} forStreaming - Whether this client will be used for streaming requests
   */
  createClient(forStreaming = false) {
    if (!this.settings) {
      throw new Error('Ollama settings not loaded');
    }

    const { host, port } = this.settings;
    const baseURL = `http://${host}:${port}`;

    return axios.create({
      baseURL,
      timeout: forStreaming ? STREAMING_TIMEOUT : DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Tests connection to Ollama server
   */
  async testConnection(host, port) {
    try {
      const testHost = host || (this.settings && this.settings.host);
      const testPort = port || (this.settings && this.settings.port);

      if (!testHost || !testPort) {
        return {
          success: false,
          message: 'Host or port not specified'
        };
      }

      const url = `http://${testHost}:${testPort}`;
      const startTime = Date.now();

      // Test connection using a simple ping request
      const response = await axios.get(`${url}/api/version`, {
        timeout: 5000 // 5 seconds timeout for test
      });

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        message: 'Successfully connected to Ollama server',
        responseTime,
        version: response.data.version
      };
    } catch (error) {
      logger.error('Error testing connection to Ollama server:', error);

      return {
        success: false,
        message: 'Failed to connect to Ollama server',
        error: error.message
      };
    }
  }

  /**
   * Fetches available models from Ollama server
   */
  async getAvailableModels() {
    try {
      const client = this.createClient();
      const response = await client.get('/api/tags');

      // Process and normalize the Ollama model data
      let models = [];

      if (response.data && response.data.models) {
        models = response.data.models.map(model => ({
          name: model.name || 'Unknown',
          size: model.size || 0,
          modified_at: model.modified_at || new Date().toISOString(),
          details: model.details || {}
        }));
      }

      return {
        success: true,
        models: models
      };
    } catch (error) {
      logger.error('Error fetching available models from Ollama server:', error);

      return {
        success: false,
        models: [],
        error: error.message
      };
    }
  }

  /**
   * Syncs models from Ollama server to database
   * @param {string[]} selectedModelIds - Array of model IDs to set as active
   */
  async syncModels(selectedModelIds = []) {
    try {
      // Get models from Ollama
      const { success, models, error } = await this.getAvailableModels();

      if (!success) {
        return {
          success: false,
          error
        };
      }

      let added = 0;
      let updated = 0;
      let unchanged = 0;
      let inactivated = 0;

      // Process each model
      for (const model of models) {
        const modelId = model.name;
        const isSelected = selectedModelIds.includes(modelId);

        // Check if model exists in database
        const result = await db.query('SELECT * FROM ai_models WHERE ollama_model_id = $1', [modelId]);

        if (result.rows.length === 0) {
          // Add new model
          await db.query(`
            INSERT INTO ai_models (
              name,
              model_id,
              ollama_model_id,
              description,
              parameters,
              is_active
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            model.name,
            model.name, // Use model name as model_id
            model.name,
            `Ollama model: ${model.name}`,
            JSON.stringify({ size: model.size, modified_at: model.modified_at }),
            isSelected // Set is_active based on selection
          ]);

          if (isSelected) {
            added++;
          } else {
            inactivated++;
          }
        } else {
          // Update existing model
          const existingModel = result.rows[0];

          // Safely parse parameters with error handling
          let parameters = {};
          try {
            if (existingModel.parameters) {
              // Check if parameters is already an object (due to pg driver)
              if (typeof existingModel.parameters === 'object' && existingModel.parameters !== null) {
                parameters = existingModel.parameters;
              } else {
                parameters = JSON.parse(existingModel.parameters);
              }
            }
          } catch (err) {
            logger.error(`Error parsing parameters for model ${model.name}:`, err);
            parameters = {}; // Reset to empty object on error
          }

          // Check if anything has changed including active status
          const statusChanged = existingModel.is_active !== isSelected;
          const paramsChanged = parameters.size !== model.size || parameters.modified_at !== model.modified_at;

          if (statusChanged || paramsChanged) {
            // Safely update parameters and status
            let updatedParams = {
              size: model.size,
              modified_at: model.modified_at
            };

            try {
              // Try updating with updated_at field
              await db.query(`
                UPDATE ai_models SET
                  parameters = $1,
                  is_active = $2,
                  updated_at = NOW()
                WHERE id = $3
              `, [
                JSON.stringify(updatedParams),
                isSelected,
                existingModel.id
              ]);
            } catch (updateError) {
              if (updateError.message.includes('column "updated_at" of relation "ai_models" does not exist')) {
                // If updated_at doesn't exist, update without it
                logger.warn('updated_at column not found, updating without timestamp');
                await db.query(`
                  UPDATE ai_models SET
                    parameters = $1,
                    is_active = $2
                  WHERE id = $3
                `, [
                  JSON.stringify(updatedParams),
                  isSelected,
                  existingModel.id
                ]);
              } else {
                // If it's another error, rethrow it
                throw updateError;
              }
            }

            if (statusChanged) {
              if (isSelected) {
                updated++;
              } else {
                inactivated++;
              }
            } else {
              updated++;
            }
          } else {
            unchanged++;
          }
        }
      }

      // Handle any models in DB that were not in the server response
      // Make sure they match the selected status
      const dbModels = await db.query('SELECT * FROM ai_models');
      const serverModelIds = models.map(m => m.name);

      for (const dbModel of dbModels.rows) {
        if (!serverModelIds.includes(dbModel.ollama_model_id)) {
          const isSelected = selectedModelIds.includes(dbModel.ollama_model_id);

          // Only update if status doesn't match selection
          if (dbModel.is_active !== isSelected) {
            try {
              // Try updating with updated_at field
              await db.query(
                'UPDATE ai_models SET is_active = $1, updated_at = NOW() WHERE id = $2',
                [isSelected, dbModel.id]
              );
            } catch (updateError) {
              if (updateError.message.includes('column "updated_at" of relation "ai_models" does not exist')) {
                // If updated_at doesn't exist, update without it
                logger.warn('updated_at column not found, updating without timestamp');
                await db.query(
                  'UPDATE ai_models SET is_active = $1 WHERE id = $2',
                  [isSelected, dbModel.id]
                );
              } else {
                // If it's another error, rethrow it
                throw updateError;
              }
            }

            if (isSelected) {
              updated++;
            } else {
              inactivated++;
            }
          }
        }
      }

      return {
        success: true,
        syncedCount: added + updated,
        added,
        updated,
        unchanged,
        inactivated,
        total: models.length
      };
    } catch (error) {
      logger.error('Error syncing models from Ollama server:', error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Gets models from database
   */
  async getModelsFromDB() {
    try {
      const result = await db.query('SELECT * FROM ai_models ORDER BY name');

      return {
        success: true,
        models: result.rows
      };
    } catch (error) {
      logger.error('Error fetching models from database:', error);

      return {
        success: false,
        models: [],
        error: error.message
      };
    }
  }

  /**
   * Gets active models from database
   */
  async getActiveModels() {
    try {
      const result = await db.query('SELECT * FROM ai_models WHERE is_active = true ORDER BY name');

      return {
        success: true,
        models: result.rows
      };
    } catch (error) {
      logger.error('Error fetching active models from database:', error);

      return {
        success: false,
        models: [],
        error: error.message
      };
    }
  }

  /**
   * Updates model status (active/inactive)
   */
  async updateModelStatus(id, isActive) {
    try {
      const result = await db.query(
        'UPDATE ai_models SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [isActive, id]
      );

      if (result.rows.length === 0) {
        throw new Error('Model not found');
      }

      return {
        success: true,
        model: result.rows[0]
      };
    } catch (error) {
      logger.error('Error updating model status:', error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sends a chat message to Ollama
   * @param {string} model - The model ID to use
   * @param {Array} messages - Array of message objects with role and content
   * @param {string} systemPrompt - Optional system prompt
   * @param {boolean} stream - Whether to stream the response
   * @param {function} onChunk - Callback for each chunk when streaming
   */
  async chat(model, messages, systemPrompt = null, stream = false, onChunk = null) {
    try {
      // Use streaming client with longer timeout if streaming is enabled
      const client = this.createClient(stream);

      // Format messages for Ollama API
      const formattedMessages = messages.map(msg => ({
        role: msg.role || 'user',
        content: msg.content
      }));

      // Add system prompt if provided
      if (systemPrompt) {
        formattedMessages.unshift({
          role: 'system',
          content: systemPrompt
        });
      }

      // If streaming is requested and a callback is provided
      if (stream && typeof onChunk === 'function') {
        try {
          // Set up streaming response
          const response = await client.post('/api/chat', {
            model,
            messages: formattedMessages,
            stream: true
          }, {
            responseType: 'stream'
          });

          // Create a promise that will resolve when streaming is complete
          return new Promise((resolve, reject) => {
            let fullContent = '';
            let messageId = `chat-${Date.now()}`;

            response.data.on('data', (chunk) => {
              try {
                const chunkText = chunk.toString();
                const lines = chunkText.split('\n').filter(line => line.trim());

                for (const line of lines) {
                  try {
                    const data = JSON.parse(line);

                    // Extract content from the chunk
                    const content = data.message?.content || data.content || '';
                    if (content) {
                      fullContent += content;

                      // Create a formatted chunk for the frontend
                      const formattedChunk = {
                        id: data.id || messageId,
                        created: data.created || Date.now(),
                        model: data.model || model,
                        choices: [{
                          index: 0,
                          delta: {
                            content: content
                          },
                          finish_reason: null
                        }]
                      };

                      // Call the callback with the formatted chunk
                      onChunk(formattedChunk);
                    }

                    // If this is the done message
                    if (data.done) {
                      // Create a final formatted response
                      const formattedResponse = {
                        id: data.id || messageId,
                        created: data.created || Date.now(),
                        model: data.model || model,
                        choices: [{
                          index: 0,
                          message: {
                            role: 'assistant',
                            content: fullContent
                          },
                          finish_reason: 'stop'
                        }],
                        usage: data.usage || {
                          prompt_tokens: 0,
                          completion_tokens: 0,
                          total_tokens: 0
                        }
                      };

                      // Resolve the promise with the success response
                      resolve({
                        success: true,
                        response: formattedResponse
                      });
                    }
                  } catch (parseError) {
                    logger.warn(`Error parsing streaming chunk: ${parseError.message}`);
                    // Continue to next chunk even if one fails to parse
                  }
                }
              } catch (chunkError) {
                logger.error('Error processing stream chunk:', chunkError);
                // Don't reject here, try to continue processing
              }
            });

            response.data.on('end', () => {
              // If stream ends without a done message, create a final response
              const formattedResponse = {
                id: messageId,
                created: Date.now(),
                model: model,
                choices: [{
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: fullContent
                  },
                  finish_reason: 'stop'
                }],
                usage: {
                  prompt_tokens: 0,
                  completion_tokens: 0,
                  total_tokens: 0
                }
              };

              resolve({
                success: true,
                response: formattedResponse
              });
            });

            response.data.on('error', (err) => {
              logger.error('Stream error:', err);
              reject({
                success: false,
                error: err.message
              });
            });
          });
        } catch (streamError) {
          logger.error('Error setting up stream:', streamError);
          return {
            success: false,
            error: `Streaming error: ${streamError.message}`
          };
        }
      } else {
        // Non-streaming request
        const response = await client.post('/api/chat', {
          model,
          messages: formattedMessages,
          stream: false
        });

        // Format the response to match the expected structure for the frontend
        const ollamaResponse = response.data;
        const formattedResponse = {
          id: ollamaResponse.id || `chat-${Date.now()}`,
          created: ollamaResponse.created || Date.now(),
          model: ollamaResponse.model || model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: ollamaResponse.message?.content || ollamaResponse.content || ''
              },
              finish_reason: ollamaResponse.finish_reason || 'stop'
            }
          ],
          usage: ollamaResponse.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          }
        };

        return {
          success: true,
          response: formattedResponse
        };
      }
    } catch (error) {
      logger.error('Error sending chat message to Ollama:', error);

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = OllamaService;