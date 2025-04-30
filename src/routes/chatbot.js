const express = require('express');
const router = express.Router();
const { db, pool } = require('../database');
const path = require('path');
const fs = require('fs');
const documentService = require('../services/documentService');
let multer;
let uuidv4;

// Try to require multer and uuid, but don't fail if they're not available
try {
  multer = require('multer');
} catch (error) {
  console.error('Multer package not found. File upload functionality will not be available.');
  console.error('Please install multer: npm install multer');
}

try {
  const { v4 } = require('uuid');
  uuidv4 = v4;
} catch (error) {
  console.error('UUID package not found. Using timestamp-based IDs instead.');
  console.error('Please install uuid: npm install uuid');
  // Fallback implementation of uuidv4
  uuidv4 = () => `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Create documents directory if it doesn't exist
const documentsDir = path.join(__dirname, '../../documents');
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// Configure multer for file uploads if available
let upload = null;

if (multer) {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Create user directory if it doesn't exist
      const userDir = path.join(documentsDir, req.session.userId);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      cb(null, userDir);
    },
    filename: function (req, file, cb) {
      // Generate a unique filename with original extension
      const fileExt = path.extname(file.originalname);
      const fileName = `${uuidv4()}${fileExt}`;
      cb(null, fileName);
    }
  });

  // File filter to only allow certain file types
  const fileFilter = (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'), false);
    }
  };

  upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });
} else {
  console.warn('Multer not available, file upload routes will return 503 Service Unavailable');
  // Create a dummy middleware that returns 503 for file upload routes
  upload = {
    single: () => (req, res, next) => {
      res.status(503).json({
        error: 'File upload service unavailable. Please install multer: npm install multer'
      });
    }
  };
}

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

    // Get the response from the request or use a placeholder
    // When called from the Ollama AI flow, the frontend will have already generated a response
    // and is just using this endpoint to save the message to the database
    let response = req.body.response;

    // If no response is provided (direct API call), use placeholder logic
    if (!response) {
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
    }

    // Log the message and response being saved
    console.log(`Saving message to database - User: ${userId}, Session: ${activeSessionId}`);
    console.log(`Message length: ${message.length}, Response length: ${response ? response.length : 0}`);

    try {
      // Store message and response in database
      const result = await pool.query(
        'INSERT INTO messages (user_id, message, response, session_id, timestamp) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, timestamp',
        [userId, message, response, activeSessionId]
      );

      const messageId = result.rows[0].id;
      const timestamp = result.rows[0].timestamp;

      console.log(`Message saved successfully with ID: ${messageId}`);

      // Update the session's last_message_timestamp
      await pool.query(
        'UPDATE chat_sessions SET last_message_timestamp = NOW() WHERE id = $1',
        [activeSessionId]
      );

      // Return formatted message data
      res.json({
        id: messageId,
        content: response,
        timestamp,
        sessionId: activeSessionId
      });
    } catch (dbError) {
      console.error('Database error when saving message:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Error processing message' });
  }
});

// Send message with file attachment
router.post('/message-with-file', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const userId = req.session.userId;
    const file = req.file;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

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

    // Save document using the document service and trigger processing
    const document = await documentService.saveDocument({
      userId,
      filename: file.filename,
      originalName: file.originalname,
      filePath: file.path,
      fileType: file.mimetype,
      fileSize: file.size,
      collectionId: null
    }, true); // true = process document

    // Store message and response in database with file reference
    const result = await pool.query(
      'INSERT INTO messages (user_id, message, response, session_id, timestamp, file_path, document_id) VALUES ($1, $2, $3, $4, NOW(), $5, $6) RETURNING id, timestamp',
      [userId, message, "I've received your file. What would you like to know about it?", activeSessionId, file.path, document.id]
    );

    const messageId = result.rows[0].id;
    const timestamp = result.rows[0].timestamp;

    // Update the session's last_message_timestamp
    await pool.query(
      'UPDATE chat_sessions SET last_message_timestamp = NOW() WHERE id = $1',
      [activeSessionId]
    );

    // Return formatted message data
    res.json({
      id: messageId,
      content: "I've received your file. What would you like to know about it?",
      timestamp,
      sessionId: activeSessionId,
      fileAttachment: {
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        documentId: document.id
      }
    });
  } catch (error) {
    console.error('Error processing message with file:', error);
    res.status(500).json({ error: 'Error processing message with file' });
  }
});

// Get files for a session
router.get('/sessions/:sessionId/files', isAuthenticated, async (req, res) => {
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

    // Get files for session
    const result = await pool.query(
      `SELECT d.id, d.original_name, d.file_type, d.file_size, d.status, d.created_at
       FROM documents d
       JOIN messages m ON d.id = m.document_id
       WHERE m.session_id = $1 AND m.user_id = $2
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
      [sessionId, userId]
    );

    // Format files for client
    const files = result.rows.map(row => ({
      id: row.id,
      name: row.original_name,
      type: row.file_type,
      size: row.file_size,
      status: row.status,
      createdAt: row.created_at
    }));

    res.json(files);
  } catch (error) {
    console.error('Error retrieving session files:', error);
    res.status(500).json({ error: 'Error retrieving session files' });
  }
});

module.exports = router;