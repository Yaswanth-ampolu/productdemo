const fs = require('fs');
const path = require('path');
const { pool } = require('./src/database');

async function applyChatSessionsSchema() {
  try {
    console.log('Reading chat sessions schema file...');
    const schemaFile = fs.readFileSync(path.join(__dirname, 'chat_sessions_schema.sql'), 'utf8');
    
    console.log('Applying chat sessions schema...');
    await pool.query(schemaFile);
    
    console.log('Chat sessions schema applied successfully!');
    
    // Close the pool
    await pool.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error applying chat sessions schema:', error);
    process.exit(1);
  }
}

// Run the function
applyChatSessionsSchema(); 