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
const chatbotRoutes = require('./routes/chatbot');
const runsRoutes = require('./routes/runs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Path to config file',
    default: './conf/config.ini'
  })
  .help()
  .argv;

// Read configuration
const configPath = path.resolve(argv.config);
console.log(`Loading configuration from: ${configPath}`);
const config = ini.parse(fs.readFileSync(configPath, 'utf-8'));

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
  },
  rolling: true // Resets the cookie expiration on every response
}));

// API Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/chatbot', chatbotRoutes);
app.use('/runs', runsRoutes);

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
const host = config.server.domain || 'localhost';
const server = app.listen(port, host, () => {
  console.log(`Server running on ${config.server.protocol}://${host}:${port}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please use a different port.`);
  } else {
    console.error('Error starting server:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Performing graceful shutdown...');
  server.close(() => {
    console.log('Server closed. Exiting process.');
    process.exit(0);
  });
}); 