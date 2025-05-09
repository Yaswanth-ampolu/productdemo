/**
 * WebSocket Routes
 *
 * Provides endpoints for WebSocket functionality
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');

/**
 * Get WebSocket connection statistics
 * GET /api/websocket/stats
 */
router.get('/stats', requireAuth, (req, res) => {
  try {
    // Get the WebSocket server instance
    const wsServer = req.app.get('wsServer');

    if (!wsServer) {
      return res.status(500).json({ error: 'WebSocket server not available' });
    }

    // Get connection statistics
    const stats = wsServer.getStats();

    res.json(stats);
  } catch (error) {
    console.error('Error getting WebSocket stats:', error);
    res.status(500).json({ error: 'Failed to get WebSocket statistics' });
  }
});

/**
 * Get pending messages for a user
 * GET /api/websocket/pending-messages/:userId
 */
router.get('/pending-messages/:userId', requireAuth, (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow admins or the user themselves to access their pending messages
    if (req.session.userId !== userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get the WebSocket server instance
    const wsServer = req.app.get('wsServer');

    if (!wsServer) {
      return res.status(500).json({ error: 'WebSocket server not available' });
    }

    // Get pending messages for the user
    const pendingMessages = wsServer.getPendingMessages(userId);

    res.json({
      userId,
      pendingMessageCount: pendingMessages.length,
      pendingMessages
    });
  } catch (error) {
    console.error('Error getting pending messages:', error);
    res.status(500).json({ error: 'Failed to get pending messages' });
  }
});

/**
 * Clear pending messages for a user
 * DELETE /api/websocket/pending-messages/:userId
 */
router.delete('/pending-messages/:userId', requireAuth, (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow admins or the user themselves to clear their pending messages
    if (req.session.userId !== userId && !req.session.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get the WebSocket server instance
    const wsServer = req.app.get('wsServer');

    if (!wsServer) {
      return res.status(500).json({ error: 'WebSocket server not available' });
    }

    // Clear pending messages for the user
    const clearedCount = wsServer.clearPendingMessages(userId);

    res.json({
      userId,
      clearedCount,
      message: `Cleared ${clearedCount} pending messages for user ${userId}`
    });
  } catch (error) {
    console.error('Error clearing pending messages:', error);
    res.status(500).json({ error: 'Failed to clear pending messages' });
  }
});

module.exports = router;
