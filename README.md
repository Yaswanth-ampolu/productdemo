# Grafana-like Dashboard Application

A modern, responsive web application built with React, TypeScript, and Express that provides user management and monitoring capabilities similar to Grafana.

## 🚀 Features

- **Authentication System**
  - Secure login/logout functionality
  - Session-based authentication
  - Role-based access control (Admin/Viewer)

- **Responsive Design**
  - Mobile-first approach
  - Collapsible sidebar navigation
  - Adaptive layouts for all screen sizes
  - Touch-friendly interface

- **User Management**
  - User CRUD operations
  - Role management
  - Secure password handling
  - Responsive data tables

- **Modern UI**
  - Dark theme inspired by Grafana
  - Interactive components
  - Loading states and animations
  - Error handling and feedback

## 🛠️ Technology Stack

### Frontend
- React 18
- TypeScript
- Vite (Build tool)
- TailwindCSS (Styling)
- React Router v6 (Routing)
- Axios (API calls)
- Heroicons (Icons)

### Backend
- Node.js
- Express
- SQLite3 (Database)
- bcrypt (Password hashing)
- express-session (Session management)

## 📦 Project Structure

```
├── client/                 # Frontend application
│   ├── src/
│   │   ├── components/    # Reusable React components
│   │   ├── contexts/      # React context providers
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   └── config.ts      # Frontend configuration
│   ├── .env              # Environment variables
│   └── vite.config.ts    # Vite configuration
│
├── src/                   # Backend application
│   ├── routes/           # API routes
│   ├── database.js       # Database configuration
│   └── server.js         # Express server setup
│
├── data/                 # SQLite database files
├── config.ini           # Application configuration
└── package.json         # Project dependencies
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install backend dependencies:
```bash
npm install
```

3. Install frontend dependencies:
```bash
cd client
npm install
```

4. Configure the application:
   - Copy `config.ini.example` to `config.ini` (if exists)
   - Update configuration values as needed
   - Set up environment variables in `client/.env`

### Running the Application

1. Start the backend server:
```bash
# In the root directory
npm run dev
```

2. Start the frontend development server:
```bash
# In the client directory
cd client
npm run dev
```

3. Access the application:
   - Local: http://localhost:5173
   - Network: http://<your-ip>:5173

## 🔐 Authentication

### Default Credentials
- Username: admin
- Password: admin

### Authentication Flow
1. User submits login credentials
2. Backend validates and creates a session
3. Frontend stores authentication state in React context
4. Protected routes check authentication status
5. Session is maintained until logout

## 🔧 Configuration

### Backend Configuration (config.ini)
```ini
[server]
domain = 0.0.0.0
port = 5634
session_secret = your_secret_key

[database]
type = sqlite
path = ./data/app.db

[admin]
default_username = admin
default_password = admin

[security]
cookie_secure = false
cookie_max_age = 86400000
```

### Frontend Configuration (client/.env)
```env
VITE_BACKEND_URL=/api
```

## 📱 Responsive Design Breakpoints

- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## 🔒 Security Features

- Password hashing with bcrypt
- Session-based authentication
- CORS protection
- HTTP-only cookies
- Role-based access control
- Input validation
- Error handling

## 🛣️ API Routes

### Authentication
- POST /auth/login - User login
- POST /auth/logout - User logout
- GET /auth/me - Get current user

### User Management
- GET /users - List all users (Admin only)
- POST /users - Create new user (Admin only)
- DELETE /users/:id - Delete user (Admin only)

## 💻 Development

### Code Organization
- Components follow single responsibility principle
- Context API for state management
- TypeScript for type safety
- Modular CSS with Tailwind
- Responsive design patterns

### Best Practices
- Mobile-first approach
- Progressive enhancement
- Semantic HTML
- Accessibility considerations
- Error boundary implementation
- Loading state handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details. 