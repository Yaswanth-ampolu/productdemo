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
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Path to config file',
    default: './config.ini'
  })
  .help()
  .argv;

// Read configuration
const config = ini.parse(fs.readFileSync(argv.config, 'utf-8'));

// Initialize Express app
const app = express();

// Initialize database
initializeDatabase(config);

// Configure CORS based on config
const corsOptions = {
  origin: config.security.allow_embedding ? true : config.frontend.app_sub_url || true,
  credentials: true
};
app.use(cors(corsOptions));

// Basic middleware
app.use(cookieParser());
app.use(express.json());

// Session configuration
app.use(session({
  secret: config.security.secret_key,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.security.cookie_secure === 'true',
    httpOnly: true,
    sameSite: config.security.cookie_samesite,
    maxAge: parseInt(config.security.cookie_max_age)
  }
}));

// API Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);

// Serve static files in production
if (config.frontend.serve_static) {
  const staticPath = path.resolve(config.server.static_root_path);
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(staticPath, 'index.html'));
    });
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
const port = config.server.port || 5634;
const host = config.server.domain || '0.0.0.0';
const server = app.listen(port, host, () => {
  console.log(`Server running on ${config.server.protocol}://${host}:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Performing graceful shutdown...');
  server.close(() => {
    console.log('Server closed. Exiting process.');
    process.exit(0);
  });
}); 