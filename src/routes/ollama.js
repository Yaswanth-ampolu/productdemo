/**
 * Ollama API Routes
 * Handles API endpoints for Ollama settings, models, and chat interactions
 */

const express = require('express');
const router = express.Router();
const OllamaService = require('../services/ollamaService');
const { requireAuth, requireAdmin } = require('./auth');
const { logger } = require('../utils/logger');

module.exports = function(config) {
  // Initialize the Ollama service
  const ollamaService = new OllamaService(config);
  ollamaService.initialize().catch(err => {
    logger.error(`Failed to initialize OllamaService: ${err.message}`);
  });

  /**
   * Get current Ollama settings (Admin only)
   * GET /api/ollama/settings
   */
  router.get('/settings', requireAdmin, async (req, res) => {
    try {
      await ollamaService.loadSettings();
      res.json(ollamaService.settings);
    } catch (error) {
      logger.error(`Error getting Ollama settings: ${error.message}`);
      res.status(500).json({ error: 'Failed to retrieve Ollama settings' });
    }
  });

  /**
   * Update Ollama settings (Admin only)
   * PUT /api/ollama/settings
   */
  router.put('/settings', requireAdmin, async (req, res) => {
    try {
      const { host, port, default_model } = req.body;
      
      if (!host) {
        return res.status(400).json({ 
          success: false,
          message: 'Host is required' 
        });
      }
      
      if (!port || isNaN(parseInt(port))) {
        return res.status(400).json({ 
          success: false,
          message: 'Valid port is required' 
        });
      }
      
      const settings = await ollamaService.saveSettings({
        host,
        port: parseInt(port),
        default_model: default_model || ''
      });
      
      // Return a properly formatted success response
      res.json({
        success: true,
        settings,
        message: 'Settings saved successfully'
      });
    } catch (error) {
      logger.error(`Error saving Ollama settings: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: `Failed to save settings: ${error.message}`
      });
    }
  });

  /**
   * Test connection to Ollama server (Admin only)
   * POST /api/ollama/test-connection
   */
  router.post('/test-connection', requireAdmin, async (req, res) => {
    try {
      const { host, port } = req.body;
      const result = await ollamaService.testConnection(host, port);
      res.json(result);
    } catch (error) {
      logger.error(`Error testing Ollama connection: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to test connection',
        error: error.message
      });
    }
  });

  /**
   * Get available models directly from Ollama server (Admin only)
   * GET /api/ollama/models/available
   */
  router.get('/models/available', requireAdmin, async (req, res) => {
    try {
      const result = await ollamaService.getAvailableModels();
      res.json(result);
    } catch (error) {
      logger.error(`Error fetching available models: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        models: [],
        error: `Failed to fetch available models: ${error.message}` 
      });
    }
  });

  /**
   * Sync models from Ollama server to database (Admin only)
   * POST /api/ollama/models/sync
   */
  router.post('/models/sync', requireAdmin, async (req, res) => {
    try {
      const result = await ollamaService.syncModels();
      
      if (result.success) {
        res.json({
          success: true,
          syncedCount: result.added + result.updated,
          added: result.added,
          updated: result.updated,
          unchanged: result.unchanged,
          total: result.total
        });
      } else {
        res.status(500).json({ 
          success: false,
          message: result.error || 'Failed to sync models'
        });
      }
    } catch (error) {
      logger.error(`Error syncing models: ${error.message}`);
      res.status(500).json({ 
        success: false,
        message: `Failed to sync models: ${error.message}` 
      });
    }
  });

  /**
   * Get all models from database (Admin only)
   * GET /api/ollama/models/db
   */
  router.get('/models/db', requireAdmin, async (req, res) => {
    try {
      const result = await ollamaService.getModelsFromDB();
      res.json(result);
    } catch (error) {
      logger.error(`Error fetching models from DB: ${error.message}`);
      res.status(500).json({ 
        success: false,
        models: [],
        error: `Failed to fetch models from database: ${error.message}` 
      });
    }
  });

  /**
   * Toggle model active status (Admin only)
   * PUT /api/ollama/models/:id/status
   */
  router.put('/models/:id/status', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { is_active } = req.body;
      
      if (is_active === undefined) {
        return res.status(400).json({ error: 'is_active status is required' });
      }
      
      const result = await ollamaService.updateModelStatus(id, is_active);
      
      if (!result.success) {
        return res.status(404).json({ error: result.error || 'Model not found' });
      }
      
      res.json(result.model);
    } catch (error) {
      logger.error(`Error updating model status: ${error.message}`);
      res.status(500).json({ error: `Failed to update model status: ${error.message}` });
    }
  });

  /**
   * Get active models from database (Authenticated users)
   * GET /api/ollama/models/active
   */
  router.get('/models/active', requireAuth, async (req, res) => {
    try {
      const result = await ollamaService.getActiveModels();
      res.json(result);
    } catch (error) {
      logger.error(`Error fetching active models: ${error.message}`);
      res.status(500).json({ 
        success: false,
        models: [],
        error: `Failed to fetch active models: ${error.message}` 
      });
    }
  });

  /**
   * Check Ollama API status
   * GET /api/ollama/status
   */
  router.get('/status', requireAuth, async (req, res) => {
    try {
      const result = await ollamaService.testConnection();
      res.json(result);
    } catch (error) {
      logger.error(`Error checking Ollama status: ${error.message}`);
      res.status(500).json({ 
        success: false,
        message: 'Failed to check Ollama status',
        error: error.message
      });
    }
  });

  /**
   * Send a chat message to Ollama (Authenticated users)
   * POST /api/ollama/chat
   * 
   * Request body:
   * {
   *   "modelId": "uuid-of-model-from-db",
   *   "messages": [
   *     { "role": "user", "content": "Hello" },
   *     { "role": "assistant", "content": "Hi there!" },
   *     { "role": "user", "content": "How are you?" }
   *   ],
   *   "options": {
   *     "temperature": 0.7,
   *     "max_tokens": 2048
   *   }
   * }
   */
  router.post('/chat', requireAuth, async (req, res) => {
    try {
      const { model, messages, system_prompt } = req.body;
      
      if (!model) {
        return res.status(400).json({ error: 'Model ID is required' });
      }
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Valid messages array is required' });
      }
      
      const result = await ollamaService.chat(model, messages, system_prompt);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Chat request failed' });
      }
      
      res.json(result.response);
    } catch (error) {
      logger.error(`Error in chat with Ollama: ${error.message}`);
      res.status(500).json({ error: `Chat request failed: ${error.message}` });
    }
  });

  return router;
}; 