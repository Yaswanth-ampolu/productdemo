const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../database');
const router = express.Router();

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
    } else {
      next();
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all users (admin only)
router.get('/', isAdmin, (req, res) => {
  try {
    const users = db.prepare(
      'SELECT id, name, username, email, role, created_at FROM users'
    ).all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new user (admin only)
router.post('/', isAdmin, async (req, res) => {
  const { name, username, email, password, role } = req.body;

  if (!name || !username || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['admin', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const result = db.prepare(
      'INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)'
    ).run(name, username, email, hashedPassword, role);
    
    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      username,
      email,
      role
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (admin only)
router.put('/:id', isAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  const userId = req.params.id;

  if (userId === req.session.userId) {
    return res.status(400).json({ error: 'Cannot modify your own account through this endpoint' });
  }

  try {
    let updates = [];
    let params = [];

    if (username) {
      updates.push('username = ?');
      params.push(username);
    }
    
    if (password) {
      updates.push('password = ?');
      const hashedPassword = await bcrypt.hash(password, 10);
      params.push(hashedPassword);
    }
    
    if (role) {
      if (!['admin', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.push('role = ?');
      params.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(userId);
    
    const result = db.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).run(params);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/:id', isAdmin, (req, res) => {
  const userId = req.params.id;

  if (userId === req.session.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 