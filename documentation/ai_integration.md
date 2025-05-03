# AI Integration Documentation

## Overview
This document provides details about the AI integration for the platform dashboard using Ollama, including implementation details, configuration, and troubleshooting. The integration enables administrators to configure connections to an Ollama server, manage available models, and allows users to interact with selected AI models through the chat interface.

## Components

### Backend Components
- `src/services/ollamaService.js`: Core service handling communication with the Ollama API (`/api/tags`, `/api/chat`, `/api/version` etc.). Manages database interactions for settings and models.
- `src/routes/ollama.js`: API routes (`/api/ollama/*`) exposing functionality for settings management, model syncing, connection testing, and chat interaction.
- `src/database.js`: Database interface including interaction logic for `ollama_settings` and `ai_models` tables.

### Frontend Components
- `client/src/services/ollamaService.ts`: Frontend service wrapper for calling backend Ollama-related API endpoints.
- `client/src/components/settings/OllamaSettings.tsx`: UI component for administrators to manage Ollama server connection settings, test connectivity, sync models, and enable/disable models stored in the database.
- `client/src/pages/Chatbot.tsx`: Main chat interface, updated to include a model selector populated with active models from the database.
- `client/src/components/chat/ModelSelector.tsx`: Dropdown component for selecting an active AI model for the chat session.

## Database Schema
The AI integration utilizes the following tables (defined in `DatabaseStructure.md`):
- `ollama_settings`: Stores connection settings (host, port) for the Ollama server and the default model name. Expects a single row.
- `ai_models`: Stores information about available AI models synced from the Ollama server, including their Ollama ID (`ollama_model_id`), display name, description, and an `is_active` flag to control availability in the chat UI.

## API Endpoints (Backend)

### Settings Management (Admin Only)
- `GET /api/ollama/settings`: Retrieve current Ollama settings from the `ollama_settings` table.
- `PUT /api/ollama/settings`: Update Ollama server settings in the `ollama_settings` table.
- `POST /api/ollama/test-connection`: Test connectivity to the configured Ollama server (e.g., by calling `/api/version`).

### Model Management (Admin Only, except GET active)
- `GET /api/ollama/models/available`: Fetch models directly from the configured Ollama server's `/api/tags` endpoint.
- `POST /api/ollama/models/sync`: Fetch models from Ollama server (`/api/tags`) and update the `ai_models` table in the database.
- `GET /api/ollama/models/db`: Get all models currently stored in the `ai_models` database table (for admin UI).
- `PUT /api/ollama/models/:id/status`: Toggle the `is_active` status of a model in the `ai_models` table.
- `GET /api/ollama/models/active`: Get active AI models (`is_active = true`) from the `ai_models` table (for chat UI model selector).

### Chat Interaction (Authenticated Users)
- `POST /api/ollama/chat`: Takes a user message, conversation history, and selected model ID (from `ai_models` table). Formats the request for Ollama's `/api/chat` endpoint, calls it using the configured server and selected model, and streams the response back to the client.

### API Status
- `GET /api/ollama/status`: Check if the configured Ollama API is reachable from the backend.

## Workflow

1.  **Admin Configures:** An admin user navigates to Settings -> Ollama Integration.
2.  **Enter Details:** Enters the Ollama server Host and Port.
3.  **Test Connection:** Clicks "Test Connection" to verify the backend can reach the Ollama server.
4.  **Save Settings:** Clicks "Save Settings" to store the host/port in the `ollama_settings` table.
5.  **Fetch/Sync Models:** Clicks "Fetch Available Models" (optional preview) and then "Sync Models". The backend calls Ollama's `/api/tags`, gets the list of models (e.g., `llama3:latest`), and populates/updates the `ai_models` table in the database.
6.  **Enable Models:** Admin enables desired models using the toggle switches in the UI (updates `is_active` flag in `ai_models`).
7.  **User Chats:** A regular user goes to the Chat page.
8.  **Select Model:** The user selects an *active* model from the dropdown (populated by `/api/ollama/models/active`).
9.  **Send Message:** User types a message and sends it.
10. **Backend Processes:** The frontend sends the message, chat history, and selected model DB ID to `/api/ollama/chat`.
11. **Ollama Interaction:** The backend retrieves the actual Ollama model name, formats the request for `/api/chat`, calls the Ollama server, and streams the response back.
12. **Display Response:** The frontend displays the streamed response in the chat UI.

## Endpoint Choice: `/api/chat` vs `/api/generate`

We are using Ollama's **`/api/chat`** endpoint for the chatbot interaction.
- **Reasoning:** It natively supports conversational history through the `messages` array, simplifying backend logic compared to the deprecated `context` parameter in `/api/generate`.
- **Future-Proofing:** The `/api/chat` endpoint supports `tools` (function calling), which provides a better foundation for future RAG implementations or agentic features where the AI might need to interact with external knowledge sources or tools.

## Connection Troubleshooting

### Common Issues
1.  **Connection Refused**: Ollama server not running or wrong host/port configured. Verify server status (`ollama ps` or Task Manager) and settings in the UI.
2.  **Timeout**: Network issue, firewall blocking the port (default 11434), or Ollama server is slow/unresponsive. Check network connectivity and firewall rules.
3.  **Sync Fails / No Models Found**: Ollama server has no models pulled (`ollama pull <modelname>`), or connection failed during the `/api/tags` call. Check Ollama server status and ensure models are present.
4.  **Chat Errors**: Model selected might not exist on the Ollama server (if deleted after sync), Ollama server issues, or errors during response streaming. Check backend logs and Ollama server logs.
5.  **Authentication Errors**: Ensure the user is logged in and API endpoints are correctly protected (admin vs. regular user).

### Debugging Steps
1.  Use the "Test Connection" button in the admin settings.
2.  Verify Ollama server status and models using Ollama CLI (`ollama list`).
3.  Check network connectivity between the application backend server and the Ollama server (ping, curl `http://<ollama_host>:<ollama_port>/api/version`).
4.  Review application backend logs (`server.log`) for detailed errors during API calls to Ollama.
5.  Review Ollama server logs for any processing errors.

## Usage Guidelines

### Setting Up Ollama
1.  Install Ollama ([link](https://ollama.ai/download)).
2.  Pull desired models (e.g., `ollama pull llama3`).
3.  Ensure the Ollama server is running.
4.  Configure the connection in the Platform Dashboard admin settings.
5.  Test the connection and sync models.
6.  Enable the models you want to make available for chat.

### Using AI Chat
1.  Navigate to the Chat interface.
2.  Select an enabled AI model from the dropdown.
3.  Type your prompt and submit. The conversation history will be automatically sent with subsequent messages in the same session.

## Performance Considerations
- Model response time depends on the model size, hardware (CPU/GPU), and prompt complexity.
- The first request to a model might be slower as Ollama loads it into memory. Use `ollama ps` to see loaded models. [See Ollama FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-tell-if-my-model-was-loaded-onto-the-gpu)
- Streaming responses improve perceived performance for the user.

## Security Notes
- Ollama API does not have built-in authentication. Access should be controlled at the network level (firewall) or via a reverse proxy if exposed.
- Ensure the application backend properly authenticates and authorizes requests to its own Ollama-related endpoints (e.g., admin-only for settings).
- Consider data privacy: prompts and responses are sent to the Ollama server.

## Future Enhancements
- Implementing response streaming in the backend and frontend.
- Allowing configuration of model parameters (temperature, context window size `num_ctx`, etc.) per request or globally. [See Ollama API Docs](https://github.com/ollama/ollama/blob/main/docs/api.md)
- User-specific model preferences.
- Integrating RAG capabilities using the `/api/chat` endpoint's structure. 