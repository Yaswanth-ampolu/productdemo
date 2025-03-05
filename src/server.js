const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const ini = require('ini');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { initializeDatabase } = require('./database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');

// Read configuration
const config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));

const app = express();

// Initialize database
initializeDatabase();

// Middleware
app.use(cookieParser());
app.use(express.json());

// Configure CORS
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true // Allow cookies
}));

// Session configuration
app.use(session({
  secret: config.server.session_secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: parseInt(config.security.cookie_max_age)
  }
}));

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Start server
const port = config.server.port || 5634;
app.listen(port, config.server.domain, () => {
  console.log(`Server running on http://${config.server.domain}:${port}`);
}); 