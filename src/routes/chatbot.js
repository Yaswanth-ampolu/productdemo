const express = require('express');
const router = express.Router();
const { db, pool } = require('../database');
const { v4: uuidv4 } = require('uuid');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Create a new chat session
router.post('/sessions', isAuthenticated, async (req, res) => {
  try {
    const { title = "New Chat" } = req.body;
    const userId = req.session.userId;
    
    // Generate a new session ID
    const sessionId = uuidv4();
    
    // Insert new session
    await pool.query(
      'INSERT INTO chat_sessions (id, user_id, title) VALUES ($1, $2, $3)',
      [sessionId, userId, title]
    );
    
    res.status(201).json({ 
      id: sessionId,
      title,
      created_at: new Date(),
      last_message_timestamp: new Date(),
      is_active: true
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ error: 'Error creating chat session' });
  }
});

// Get all chat sessions for current user
router.get('/sessions', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    // Get all sessions for user, ordered by last message timestamp
    const result = await pool.query(
      `SELECT id, title, created_at, last_message_timestamp, is_active 
       FROM chat_sessions 
       WHERE user_id = $1 
       ORDER BY last_message_timestamp DESC`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error retrieving chat sessions:', error);
    res.status(500).json({ error: 'Error retrieving chat sessions' });
  }
});

// Get a specific chat session and its messages
router.get('/sessions/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.userId;
    const { limit = 12, offset = 0 } = req.query;
    
    // Verify session belongs to user
    const sessionCheck = await pool.query(
      'SELECT id, title, created_at, last_message_timestamp, is_active FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    // Get messages for session with pagination
    const messagesResult = await pool.query(
      `SELECT id, message, response, timestamp 
       FROM messages 
       WHERE session_id = $1 
       ORDER BY timestamp DESC
       LIMIT $2 OFFSET $3`,
      [sessionId, limit, offset]
    );
    
    // Format messages for client
    const formattedMessages = messagesResult.rows.map(row => ([
      {
        id: `${row.id}-user`,
        role: 'user',
        content: row.message,
        timestamp: row.timestamp
      },
      {
        id: `${row.id}-assistant`,
        role: 'assistant',
        content: row.response,
        timestamp: row.timestamp
      }
    ])).flat();
    
    // Sort by timestamp
    formattedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json({
      session: sessionCheck.rows[0],
      messages: formattedMessages,
      total: await getSessionMessageCount(sessionId)
    });
  } catch (error) {
    console.error('Error retrieving chat session:', error);
    res.status(500).json({ error: 'Error retrieving chat session' });
  }
});

// Helper function to get total message count for a session
async function getSessionMessageCount(sessionId) {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM messages WHERE session_id = $1',
      [sessionId]
    );
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error counting messages:', error);
    return 0;
  }
}

// Update chat session (rename, mark inactive)
router.put('/sessions/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.userId;
    const { title, is_active } = req.body;
    
    // Verify session belongs to user
    const sessionCheck = await pool.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    // Update fields that were provided
    let query = 'UPDATE chat_sessions SET ';
    const queryParams = [];
    const updates = [];
    
    if (title !== undefined) {
      queryParams.push(title);
      updates.push(`title = $${queryParams.length}`);
    }
    
    if (is_active !== undefined) {
      queryParams.push(is_active);
      updates.push(`is_active = $${queryParams.length}`);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    query += updates.join(', ');
    query += ` WHERE id = $${queryParams.length + 1} AND user_id = $${queryParams.length + 2}`;
    queryParams.push(sessionId, userId);
    
    await pool.query(query, queryParams);
    
    res.json({ message: 'Session updated successfully' });
  } catch (error) {
    console.error('Error updating chat session:', error);
    res.status(500).json({ error: 'Error updating chat session' });
  }
});

// Delete a chat session
router.delete('/sessions/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.userId;
    
    // Verify session belongs to user
    const sessionCheck = await pool.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    // Delete session (cascade will delete messages)
    await pool.query(
      'DELETE FROM chat_sessions WHERE id = $1',
      [sessionId]
    );
    
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat session:', error);
    res.status(500).json({ error: 'Error deleting chat session' });
  }
});

// Send message to chatbot
router.post('/message', isAuthenticated, async (req, res) => {
  const { message, sessionId } = req.body;
  const userId = req.session.userId;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  try {
    // Verify session if provided
    let activeSessionId = sessionId;
    
    if (sessionId) {
      const sessionCheck = await pool.query(
        'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, userId]
      );
      
      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Chat session not found' });
      }
    } else {
      // Create a new session if none provided
      const newSession = await pool.query(
        'INSERT INTO chat_sessions (id, user_id, title) VALUES ($1, $2, $3) RETURNING id',
        [uuidv4(), userId, "New Chat"]
      );
      
      activeSessionId = newSession.rows[0].id;
    }
    
    // This is a placeholder for actual AI integration
    // In a real implementation, you would call an AI service here
    
    // Simple response logic (for demonstration)
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
    
    // Store message and response in database
    const result = await pool.query(
      'INSERT INTO messages (user_id, message, response, session_id, timestamp) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, timestamp',
      [userId, message, response, activeSessionId]
    );
    
    const messageId = result.rows[0].id;
    const timestamp = result.rows[0].timestamp;
    
    // Return formatted message data
    res.json({
      id: messageId,
      content: response,
      timestamp,
      sessionId: activeSessionId
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Error processing message' });
  }
});

module.exports = router; 