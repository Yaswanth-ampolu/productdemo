const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');
const ini = require('ini');
const fs = require('fs');

// Get config path from command line arguments or use default
const configPath = process.argv.find(arg => arg.startsWith('--config='))
  ? process.argv.find(arg => arg.startsWith('--config=')).split('=')[1]
  : './conf/config.ini';

console.log(`Database loading configuration from: ${configPath}`);
const config = ini.parse(fs.readFileSync(path.resolve(configPath), 'utf-8'));

// PostgreSQL connection configuration
const pgConfig = {
  host: config.database['database-host'],
  port: config.database['database-port'],
  user: config.database['database-user'],
  password: config.database['database-password'],
  database: config.database['database-name'],
  max: config.database.max_connections || 20,
  ssl: config.database.ssl === 'true'
};

console.log(`Connecting to PostgreSQL at ${pgConfig.host}:${pgConfig.port}`);

const pool = new Pool(pgConfig);

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err);
    process.exit(1);
  }
  console.log(`Connected to PostgreSQL database: ${pgConfig.database}`);
  release();
});

// Helper function to convert SQLite '?' placeholders to PostgreSQL '$1' style placeholders
function convertPlaceholders(text) {
  let paramIndex = 0;
  return text.replace(/\?/g, () => `$${++paramIndex}`);
}

// Create a database interface object that mimics the SQLite interface
// to minimize changes in existing code
const db = {
  // Query executor function
  async query(text, params) {
    try {
      const convertedText = convertPlaceholders(text);
      const result = await pool.query(convertedText, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  },
  
  // For code compatibility with SQLite, we'll provide similar methods
  // but adapted for PostgreSQL
  prepare(text) {
    const convertedText = convertPlaceholders(text);
    
    return {
      get: async (...params) => {
        try {
          const result = await pool.query(convertedText, params);
          return result.rows[0] || null;
        } catch (error) {
          console.error(`Error in db.prepare().get() with query '${convertedText}':`, error);
          throw error;
        }
      },
      all: async (...params) => {
        try {
          const result = await pool.query(convertedText, params);
          return result.rows;
        } catch (error) {
          console.error(`Error in db.prepare().all() with query '${convertedText}':`, error);
          throw error;
        }
      },
      run: async (...params) => {
        try {
          const result = await pool.query(convertedText, params);
          // For compatibility with better-sqlite3, we add lastInsertRowid
          // This approximation works only for single inserts
          let lastInsertRowid = null;
          if (result.rows && result.rows[0] && result.rows[0].id) {
            lastInsertRowid = result.rows[0].id;
          }
          
          return {
            changes: result.rowCount || 0,
            lastInsertRowid: lastInsertRowid
          };
        } catch (error) {
          console.error(`Error in db.prepare().run() with query '${convertedText}':`, error);
          throw error;
        }
      }
    };
  },
  
  // Execute raw SQL
  async exec(text) {
    try {
      await pool.query(text);
    } catch (error) {
      console.error('SQL execution error:', error);
      throw error;
    }
  }
};

async function initializeDatabase() {
  console.log('Checking PostgreSQL database connection');
  
  try {
    // Add name column to users table if it doesn't exist
    try {
      console.log('Checking if name column exists in users table...');
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name = 'name'
          ) THEN
            ALTER TABLE users ADD COLUMN name VARCHAR(100);
            RAISE NOTICE 'Added name column to users table';
          ELSE
            RAISE NOTICE 'name column already exists in users table';
          END IF;
        END $$;
      `);
      console.log('Name column check completed');
    } catch (error) {
      console.error('Error checking/adding name column:', error.message);
    }

    // Check if admin user exists, if not create default admin
    const userQuery = await pool.query("SELECT * FROM users WHERE username = $1", [config.admin.default_username]);
    
    if (userQuery.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync(config.admin.default_password, 10);
      
      // Modified query to include name field
      await pool.query(
        "INSERT INTO users (username, password, email, role, name) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [config.admin.default_username, hashedPassword, config.admin.default_email || 'admin@local.host', 'admin', 'Administrator']
      );
      console.log('Default admin user created');
    } else {
      // Update admin user to add name if it's missing
      if (userQuery.rows[0].name === null || userQuery.rows[0].name === undefined) {
        await pool.query(
          "UPDATE users SET name = $1 WHERE username = $2",
          ['Administrator', config.admin.default_username]
        );
        console.log('Updated admin user with name');
      }
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    // Don't exit the process, just log the error
    console.error('More details:', error.message);
  }
}

process.on('exit', () => {
  // Close the pool when the application exits
  pool.end();
  console.log('Database connection pool closed');
});

/**
 * Runs a migration script file
 */
const runMigration = async (scriptPath) => {
  try {
    const scriptContent = fs.readFileSync(path.resolve(__dirname, scriptPath), 'utf8');
    await db.query(scriptContent);
    console.log(`Migration script ${scriptPath} executed successfully`);
    return true;
  } catch (error) {
    console.error(`Error executing migration script ${scriptPath}:`, error);
    return false;
  }
};

/**
 * Runs database migrations for model_id column
 */
const runModelIdMigration = async () => {
  try {
    await runMigration('scripts/sql/add_model_id_to_ai_models.sql');
    console.log('Model ID migration completed');
    return true;
  } catch (error) {
    console.error('Error running model_id migration:', error);
    return false;
  }
};

// Export functions
module.exports = {
  db,
  pool, // Export the pool for direct access if needed
  initializeDatabase,
  runMigration,
  runModelIdMigration
}; 