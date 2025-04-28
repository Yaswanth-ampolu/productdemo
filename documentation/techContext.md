# Technical Context

## Technologies Used

### Frontend

1. **React 18**
   - Component-based UI library
   - Virtual DOM for efficient rendering
   - Hooks for state management and side effects

2. **TypeScript**
   - Static typing for JavaScript
   - Enhanced IDE support and code completion
   - Improved maintainability and refactoring

3. **React Scripts**
   - Standard build tooling for React applications
   - Production optimization
   - Static file generation

4. **TailwindCSS**
   - Utility-first CSS framework
   - Responsive design utilities
   - Dark mode support

5. **React Router**
   - Client-side routing
   - Nested routes
   - Navigation state management

6. **Axios**
   - Promise-based HTTP client
   - Request/response interception
   - Error handling

### Backend

1. **Node.js**
   - JavaScript runtime
   - Event-driven architecture
   - Non-blocking I/O

2. **Express**
   - Minimal web framework
   - Middleware support
   - Routing system
   - Static file serving

3. **PostgreSQL**
   - Powerful open-source relational database
   - ACID-compliant transactions
   - Advanced indexing and query optimization
   - JSON/JSONB support for flexible data modeling

4. **bcrypt**
   - Password hashing library
   - Salting and key stretching
   - Secure password storage

5. **express-session**
   - Session management middleware
   - Cookie-based sessions
   - Session storage

6. **cors**
   - Cross-Origin Resource Sharing middleware
   - Configurable access control
   - Security headers

## Development Setup

### Prerequisites

- Node.js v14 or higher
- npm or yarn package manager
- Git for version control
- PostgreSQL database server

### Project Structure

```
project-root/
├── client/                 # Frontend application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── contexts/       # React context providers
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── config.ts       # Frontend configuration
│   ├── public/             # Static assets
│   └── build/              # Production build output
│
├── src/                    # Backend application
│   ├── routes/             # API routes
│   ├── database.js         # Database configuration
│   └── server.js           # Express server setup
│
├── conf/                   # Configuration files
├── config.ini              # Application configuration
└── package.json            # Project dependencies
```

### Development Workflow

1. **Local Development**
   - Backend: `npm run dev` - Runs the Express server with hot reload
   - Frontend: `npm run dev:client` - Builds the frontend with watch mode
   - Deploy: `npm run deploy` - Builds frontend and starts the server

2. **Building for Production**
   - Frontend: `npm run build` - Creates optimized production build
   - Deployment: `npm start` - Runs the production server

3. **Testing**
   - Unit tests: `npm test`
   - E2E tests: Not yet implemented

## Technical Constraints

1. **Browser Compatibility**
   - Modern browsers (Chrome, Firefox, Safari, Edge)
   - No IE11 support required
   - Mobile browsers (iOS Safari, Android Chrome)

2. **Performance Requirements**
   - Initial load time < 3 seconds on broadband
   - Time to interactive < 5 seconds
   - API response times < 500ms

3. **Security Requirements**
   - HTTPS in production
   - Secure password storage (bcrypt)
   - CSRF protection
   - Content Security Policy

4. **Scalability Considerations**
   - PostgreSQL provides scalability for growing user bases
   - Connection pooling for efficient database utilization
   - Potential for horizontal scaling with read replicas
   - Vertical scaling through improved hardware

5. **Deployment Environment**
   - Windows Server target deployment
   - Using node-windows for service management
   - Local network deployment (not internet-facing)

## Architecture Overview

### Unified Architecture

The application follows a unified architecture where:
- Express backend serves both API endpoints and frontend static files
- All API endpoints are prefixed with `/api` to separate them from static assets
- Frontend is built with React and TypeScript
- Configuration is centralized in a single `config.ini` file
- SPA routing is handled properly through backend fallback routes

### Key Benefits

1. **Simplified Deployment**
   - Single server process to manage
   - No CORS issues since everything is served from the same origin
   - Consistent behavior between development and production

2. **Centralized Configuration**
   - All settings in `conf/config.ini`
   - Frontend fetches configuration from backend
   - No need for separate frontend environment variables

3. **Improved Security**
   - Reduced attack surface with single server
   - Consistent session handling
   - Better isolation of API endpoints

## Dependencies

### Core Dependencies

```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "ini": "^4.1.1",
    "node-windows": "^1.0.0-beta.8",
    "pg": "^8.14.1",
    "react-markdown": "^10.1.0",
    "react-syntax-highlighter": "^15.6.1",
    "remark-gfm": "^4.0.1",
    "uuid": "^11.1.0"
  }
}
```

### Development Dependencies

```json
{
  "devDependencies": {
    "concurrently": "^8.2.2",
    "jest": "^29.7.0",
    "nodemon": "^3.1.9"
  }
}
```

### Frontend Dependencies

```json
{
  "dependencies": {
    "axios": "^1.6.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "tailwindcss": "^3.3.5"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "react-scripts": "^5.0.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "typescript": "^5.2.2"
  }
}
``` 