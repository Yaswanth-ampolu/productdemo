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

// Get single user (admin only)
router.get('/:id', isAdmin, (req, res) => {
  try {
    const user = db.prepare(
      'SELECT id, name, username, email, role, created_at FROM users WHERE id = ?'
    ).get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
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
  const { name, username, email, password, role } = req.body;
  const userId = req.params.id;

  try {
    // Check if user exists
    const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Start building update query
    let updateFields = [];
    let params = [];

    if (name) {
      updateFields.push('name = ?');
      params.push(name);
    }

    if (username) {
      // Check username uniqueness (excluding current user)
      const usernameExists = db.prepare(
        'SELECT id FROM users WHERE username = ? AND id != ?'
      ).get(username, userId);
      if (usernameExists) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      updateFields.push('username = ?');
      params.push(username);
    }

    if (email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      // Check email uniqueness (excluding current user)
      const emailExists = db.prepare(
        'SELECT id FROM users WHERE email = ? AND id != ?'
      ).get(email, userId);
      if (emailExists) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      updateFields.push('email = ?');
      params.push(email);
    }

    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      updateFields.push('password = ?');
      params.push(hashedPassword);
    }

    if (role) {
      if (!['admin', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updateFields.push('role = ?');
      params.push(role);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add userId to params
    params.push(userId);

    // Execute update query
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...params);

    // Get updated user
    const updatedUser = db.prepare(
      'SELECT id, name, username, email, role, created_at FROM users WHERE id = ?'
    ).get(userId);

    res.json(updatedUser);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/:id', isAdmin, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 