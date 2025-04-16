# Platform Dashboard

A modern, responsive web application built with React, TypeScript, and Express that provides user management and monitoring capabilities with a beautiful, intuitive interface.

## 🚀 Features

- **Modern Design**
  - Beautiful, intuitive interface
  - Dark mode by default
  - Smooth animations and transitions
  - Responsive and mobile-friendly

- **Authentication System**
  - Secure login/logout functionality
  - Session-based authentication
  - Role-based access control (Admin/Viewer)

- **User Management**
  - User CRUD operations
  - Role management
  - Secure password handling
  - Responsive data tables

- **Performance**
  - Fast page loads
  - Optimized bundle size
  - Efficient state management
  - Real-time updates

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
- PostgreSQL (Database)
- bcrypt (Password hashing)
- express-session (Session management)

## 📦 Project Structure

```
├── client/                    # Frontend application
│   ├── src/
│   │   ├── components/        # Reusable React components
│   │   ├── contexts/          # React context providers
│   │   ├── pages/             # Page components
│   │   ├── services/          # API services
│   │   └── config.ts          # Frontend configuration
│   ├── .env                   # Environment variables
│   └── vite.config.ts         # Vite configuration
│
├── src/                       # Backend application
│   ├── routes/                # API routes
│   ├── services/              # Backend services
│   ├── scripts/               # Utility scripts
│   │   └── sql/               # SQL schema files
│   ├── database.js            # Database configuration
│   └── server.js              # Express server setup
│
├── conf/                      # Configuration files
│   └── config.ini             # Application configuration
│
├── documentation/             # Project documentation
│
├── memory-bank/               # Internal project knowledge
│
├── assets/                    # Static assets and data files
└── package.json               # Project dependencies
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL database

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

### Backend Configuration (conf/config.ini)
```ini
[server]
domain = 0.0.0.0
port = 5634
session_secret = your_secret_key

[database]
type = postgresql
host = localhost
port = 5432
name = copilot
user = postgres
password = your_password

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

### Chat Interface
- POST /chatbot/sessions - Create new chat session
- GET /chatbot/sessions - List all chat sessions
- GET /chatbot/sessions/:id - Get specific chat session
- PUT /chatbot/sessions/:id - Update chat session
- DELETE /chatbot/sessions/:id - Delete chat session

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