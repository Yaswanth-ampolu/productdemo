const express = require('express');
const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Simple chatbot response endpoint
router.post('/message', isAuthenticated, (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  // This is a placeholder for actual AI integration
  // In a real implementation, you would call an AI service here
  
  // Simulate processing time
  setTimeout(() => {
    // Simple response logic
    let response;
    
    if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
      response = "Hello! How can I assist you today?";
    } else if (message.toLowerCase().includes('help')) {
      response = "I'm here to help! You can ask me questions about our platform, how to use features, or general information.";
    } else if (message.toLowerCase().includes('feature') || message.toLowerCase().includes('dashboard')) {
      response = "Our dashboard provides various features including user management, analytics, and this AI assistant. What would you like to know more about?";
    } else if (message.toLowerCase().includes('thank')) {
      response = "You're welcome! Is there anything else I can help you with?";
    } else {
      response = "I understand you're asking about that. While I'm still learning, I'll do my best to assist. Could you provide more details or ask in a different way?";
    }
    
    res.json({
      id: Date.now().toString(),
      content: response,
      timestamp: new Date()
    });
  }, 500);
});

module.exports = router; 