const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const ini = require('ini');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { initializeDatabase, runModelIdMigration } = require('./database');
const { router: authRoutes } = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatbotRoutes = require('./routes/chatbot');
const runsRoutes = require('./routes/runs');
const settingsRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');
const configRoutes = require('./routes/config');
const ollamaRoutes = require('./routes/ollama');
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

// Initialize the database and start the server when ready
async function startServer() {
  try {
    // Initialize database - now async
    await initializeDatabase(config);
    console.log('Database initialization completed');

    // Run model_id migration to ensure compatibility
    await runModelIdMigration();

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

    // API Routes - Now all prefixed with /api
    const apiRouter = express.Router();
    apiRouter.use('/auth', authRoutes);
    apiRouter.use('/users', userRoutes);
    apiRouter.use('/chatbot', chatbotRoutes);
    apiRouter.use('/runs', runsRoutes);
    apiRouter.use('/settings', settingsRoutes);
    apiRouter.use('/dashboard', dashboardRoutes);
    apiRouter.use('/ollama', ollamaRoutes(config));
    apiRouter.use('/', configRoutes(config)); // Add config routes at the API root
    
    // Mount all API routes under /api
    app.use('/api', apiRouter);

    // Serve static files from client/build
    const staticPath = config.server.static_root_path || path.join(__dirname, '../client/build');
    console.log(`Serving static files from: ${staticPath}`);
    
    if (fs.existsSync(staticPath)) {
      // Serve static files
      app.use(express.static(staticPath));
      
      // For any request that doesn't match an API route or static file,
      // send the React app's index.html (for client-side routing)
      app.get('*', (req, res) => {
        // Use path.resolve to create an absolute path to index.html
        const indexPath = path.resolve(staticPath, 'index.html');
        res.sendFile(indexPath);
      });
    } else {
      console.warn(`Static file path does not exist: ${staticPath}`);
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

  } catch (error) {
    console.error('Error starting the application:', error);
    process.exit(1);
  }
}

// Start the server
startServer(); 