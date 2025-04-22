# Database Structure Documentation

## Overview

The project uses PostgreSQL as its database system. The schema is designed to support user authentication, chat sessions, file management, AI model integration, and dashboard metrics tracking. This document outlines the tables, relationships, and key functionalities implemented in the database.

## Tables

### 1. `users`
- Primary user account information
- Contains authentication details and role assignment
- Fields:
  - `id` (UUID, PK): Unique identifier
  - `username` (varchar): Unique username
  - `password` (text): Hashed password
  - `role` (varchar): User role (default: 'user')
  - `email` (varchar): User email
  - `name` (varchar): User's full name
  - `created_at`/`updated_at` (timestamp): Tracking dates

### 2. `sessions`
- Stores active user sessions
- Fields:
  - `id` (UUID, PK): Session identifier
  - `user_id` (UUID, FK): Reference to user
  - `token` (text): Session token
  - `expires_at` (timestamp): Expiration time
  - `created_at` (timestamp): Creation time

### 3. `chat_sessions`
- Represents a conversation thread
- Fields:
  - `id` (UUID, PK): Unique session identifier
  - `user_id` (UUID, FK): Owner of the session
  - `title` (varchar): Session title
  - `last_message_timestamp` (timestamp): Last activity
  - `created_at` (timestamp): Creation time
  - `is_active` (boolean): Session status

### 4. `messages`
- Stores individual messages in chat sessions
- Fields:
  - `id` (bigint, PK): Message identifier
  - `user_id` (UUID, FK): Message sender
  - `message` (text): User's message content
  - `response` (text): AI response
  - `file_path` (text): Optional reference to file
  - `pdf_id` (UUID, FK): Optional reference to PDF
  - `timestamp` (timestamp): Message time
  - `session_id` (UUID, FK): Parent chat session
  - `model_id` (UUID, FK): AI model used

### 5. `ai_models`
- Configuration for available AI models (including Ollama models)
- Fields:
  - `id` (UUID, PK): Model identifier
  - `model_id` (varchar): Model identifier used in chat interfaces
  - `ollama_model_id` (varchar): The ID used by Ollama (e.g., "llama3:latest")
  - `name` (varchar): Human-readable name
  - `description` (text): Model description
  - `parameters` (jsonb): Configuration parameters (size, etc.)
  - `is_active` (boolean): Availability status
  - `created_at` (timestamp): Creation time
  - `updated_at` (timestamp): Last update time

### 6. `pdfs`
- Tracks uploaded PDF documents
- Fields:
  - `id` (UUID, PK): Document identifier
  - `user_id` (UUID, FK): Document owner
  - `file_path` (text): Storage path
  - `file_name` (varchar): Original filename
  - `chroma_collection` (varchar): Vector DB collection
  - `uploaded_at` (timestamp): Upload time

### 7. `message_files`
- Tracks files attached to messages
- Fields:
  - `id` (bigint, PK): File entry identifier
  - `message_id` (bigint, FK): Parent message
  - `user_id` (UUID, FK): File owner
  - `file_path` (text): Storage path
  - `file_type` (varchar): MIME type
  - `uploaded_at` (timestamp): Upload time

### 8. `mcp_connections`
- Tracks connections to external MCP systems
- Fields:
  - `id` (bigint, PK): Connection identifier
  - `user_id` (UUID, FK): Connection owner
  - `mcp_host` (varchar): Host address
  - `mcp_port` (integer): Connection port
  - `status` (varchar): Connection status
  - `last_file_path` (text): Last accessed file
  - `last_pdf_id` (UUID, FK): Last accessed PDF
  - `created_at` (timestamp): Creation time

### 9. `dashboard_metrics`
- Stores aggregated metrics for dashboard
- Fields:
  - `id` (integer, PK): Metric identifier
  - `metric_name` (varchar): Metric identifier
  - `metric_value` (jsonb): Structured metric data
  - `updated_at` (timestamp): Last update time

## AI Integration Tables

### ollama_settings
- Stores Ollama AI server connection details and default model for AI chat integration
- Fields:
  - `id` (SERIAL, PK): Unique identifier
  - `host` (varchar): Ollama server host (default: 'localhost')
  - `port` (integer): Ollama server port (default: 11434)
  - `default_model` (varchar): Default AI model name
  - `created_at` (timestamp): Creation time
  - `updated_at` (timestamp): Last update time

### schema_migrations
- Tracks applied database migrations
- Fields:
  - `id` (PK): Unique identifier
  - `version` (varchar): Migration version number
  - `applied_at` (timestamp): When the migration was applied
  - `description` (text): Description of the migration

#### Protocol for Database Changes
- All new tables and schema changes must be documented in this file.
- For every schema change, provide a SQL migration script in `src/scripts/sql/`.
- Document new relationships, triggers, and indexes as needed.

## Key Relationships

1. A user can have multiple:
   - Chat sessions (1:N)
   - Messages (1:N)
   - PDFs (1:N)
   - MCP connections (1:N)
   - Sessions (1:N)

2. A chat session:
   - Belongs to one user (N:1)
   - Contains multiple messages (1:N)

3. A message:
   - Belongs to one user (N:1)
   - Belongs to one chat session (N:1)
   - Can reference one PDF (N:1)
   - Can reference one AI model (N:1)
   - Can have multiple attached files (1:N)

## Functions & Triggers

1. `update_dashboard_metrics()`: Updates dashboard statistics based on current data
2. `trigger_update_dashboard_metrics()`: Wrapper to call the update function from triggers
3. `update_chat_session_timestamp()`: Updates session timestamp when a new message is added

Triggers are set up to:
- Update dashboard metrics when users, messages, or PDFs change
- Update chat session timestamps when new messages are added

## Indexes

- `idx_chat_sessions_timestamp`: Optimizes sorting chat sessions by last activity
- `idx_chat_sessions_user_id`: Speeds up finding a user's chat sessions
- `idx_messages_session_id`: Accelerates retrieving messages for a specific session
- `idx_ollama_settings_updated_at`: Index on ollama_settings.updated_at
- `idx_ai_models_ollama_model_id`: Fast lookup of AI models by their Ollama ID
- `idx_ai_models_is_active`: Quick filtering of active models
- `idx_ai_models_name`: Optimizes searching/sorting models by name

## Design Considerations

1. **UUID for Primary Keys**: Most entities use UUID for primary keys, providing better security and distribution
2. **Cascading Deletes**: When a parent record is deleted, related records are automatically removed
3. **JSON Storage**: Uses JSONB for flexible storage of metrics and model parameters
4. **Timestamp Tracking**: All entities include creation timestamps, many track updates
5. **Database-level Automation**: Triggers ensure dashboard metrics stay current automatically

## Schema Evolution

The schema represents a transition from the initial SQLite design to a more robust PostgreSQL implementation with:
- Enhanced data types (UUID, JSONB)
- Improved automation through triggers
- Better performance through indexing
- Support for more complex relationships
- Integration with Ollama AI services

### Recent Schema Updates

#### AI Models Schema Enhancement (2023-08-20)
- Added `model_id` field to `ai_models` table to fix constraint violations
- Created migration script `add_model_id_to_ai_models.sql` for backward compatibility
- Populated existing records automatically using Ollama model IDs
- Updated schema documentation and creation scripts
- This change ensures proper model references in the chat interface and database integrity

#### Updated Timestamp Column Addition (2024-06-15)
- Added `updated_at` column to `ai_models` table to track changes
- Created migration script `add_updated_at_to_ai_models.sql` for backward compatibility
- Added conditional logic to check if column exists before attempting to add it
- Enhanced OllamaService.js to handle cases where the column might not exist yet
- Implemented proper error handling with fallback to non-timestamped queries
- This update ensures consistent timestamp tracking across all database tables and enables proper sorting by recency

#### Migration Process
All schema migrations follow this process:
1. Create a SQL script in `src/scripts/sql/` with schema changes
2. Add SQL commands to check if changes are needed (conditional alters)
3. Include appropriate indexes and constraints
4. Add entry to `schema_migrations` table with version and description
5. Update `copilotdbcreationscript.sql` for fresh installations
6. Update `DatabaseStructure.md` to reflect changes
7. Apply through the `runMigration` function in database.js 