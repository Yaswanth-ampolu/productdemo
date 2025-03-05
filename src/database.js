const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');
const ini = require('ini');
const fs = require('fs');

const config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
const dbPath = path.resolve(config.database.path);

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;
try {
  db = new Database(dbPath, { fileMustExist: false });
} catch (error) {
  console.error('Error opening database:', error);
  process.exit(1);
}

function initializeDatabase() {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      session_id TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  try {
    // Check if admin user exists, if not create default admin
    const row = db.prepare("SELECT * FROM users WHERE username = ?").get(config.admin.default_username);

    if (!row) {
      const hashedPassword = bcrypt.hashSync(config.admin.default_password, 10);
      db.prepare(
        "INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)"
      ).run('Administrator', config.admin.default_username, 'admin@local.host', hashedPassword, 'admin');
      console.log('Default admin user created');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error handling admin user:', error);
  }
}

module.exports = {
  db,
  initializeDatabase
}; 