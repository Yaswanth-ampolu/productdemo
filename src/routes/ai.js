const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const OllamaService = require('../services/ollamaService');

// Initialize the Ollama service
const ollamaService = new OllamaService();

// Load settings at startup
let serviceInitialized = false;
const initService = async () => {
  if (!serviceInitialized) {
    await ollamaService.initialize();
    serviceInitialized = true;
  }
};
initService();

/**
 * Simple chat endpoint for AI requests
 * POST /api/ai/chat
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, modelId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    logger.info(`Processing chat request: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

    // Make sure service is initialized to get settings
    if (!serviceInitialized) {
      await initService();
    }
    
    // Get default model from service settings
    let defaultModel = '';
    try {
      if (ollamaService.settings && ollamaService.settings.default_model) {
        defaultModel = ollamaService.settings.default_model;
      }
    } catch (err) {
      logger.warn('Could not get default model from settings:', err);
    }

    try {
      // Use provided modelId, or service default, or environment variable, or lastly a fallback
      const selectedModel = modelId || defaultModel || process.env.DEFAULT_OLLAMA_MODEL || 'llama3';
      const aiResponse = await ollamaService.generateResponse(message, selectedModel);

      return res.json({ response: aiResponse });
    } catch (aiError) {
      logger.error('Error with Ollama service:', aiError);
      
      // Fallback: Return error message
      return res.status(500).json({ 
        error: 'AI service unavailable. Please check Ollama configuration.'
      });
    }
  } catch (error) {
    logger.error('Error processing chat request:', error);
    return res.status(500).json({ error: 'Failed to process chat request' });
  }
});

module.exports = router;
