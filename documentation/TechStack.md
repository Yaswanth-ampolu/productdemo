# Technology Stack Documentation

This document provides a comprehensive overview of the technology stack used in the Product Demo application, covering both frontend and backend components, as well as infrastructure and development tools.

## Table of Contents

1. [Backend Technologies](#backend-technologies)
2. [Frontend Technologies](#frontend-technologies)
3. [Database](#database)
4. [AI and Machine Learning](#ai-and-machine-learning)
5. [Document Processing](#document-processing)
6. [Infrastructure](#infrastructure)
7. [Development Tools](#development-tools)
8. [Security Components](#security-components)
9. [Deployment and DevOps](#deployment-and-devops)

## Backend Technologies

### Core Framework and Runtime
- **Node.js**: JavaScript runtime for server-side execution
- **Express.js**: Web application framework for Node.js
- **REST API**: Architecture for API endpoints

### Authentication and Session Management
- **express-session**: Session management middleware
- **bcrypt**: Password hashing library
- **cookie-parser**: Cookie parsing middleware

### File Handling
- **multer**: Middleware for handling multipart/form-data (file uploads)
- **fs (File System)**: Node.js module for file operations
- **path**: Node.js module for path manipulations

### Configuration
- **ini**: Library for parsing .ini configuration files
- **dotenv**: Environment variable management (optional)

### Utilities
- **uuid**: Library for generating unique identifiers
- **yargs**: Command-line argument parsing

## Frontend Technologies

### Core Framework and Libraries
- **React**: JavaScript library for building user interfaces
- **React Router**: Routing library for React applications
- **TypeScript**: Typed superset of JavaScript

### State Management
- **React Context API**: For global state management
- **Custom hooks**: For component-specific state management

### UI Components and Styling
- **CSS Modules**: For component-scoped styling
- **Modern CSS**: Flexbox and Grid for layouts
- **Responsive Design**: Mobile-friendly UI components

### API Communication
- **Fetch API**: For making HTTP requests to the backend
- **Custom API service**: Wrapper around Fetch for consistent API calls

## Database

### Primary Database
- **PostgreSQL**: Relational database for structured data storage

### Database Access
- **pg (node-postgres)**: PostgreSQL client for Node.js
- **Connection pooling**: For efficient database connection management

### Schema
- **SQL migrations**: For database schema management
- **Relational model**: For data relationships

## AI and Machine Learning

### Embedding Generation
- **Ollama**: Local AI model serving
- **nomic-embed-text**: Text embedding model

### Vector Database
- **ChromaDB**: Vector database for similarity search, running in Docker container
- **Docker containerization**: For isolated ChromaDB deployment
- **File-based fallback**: For environments without ChromaDB

### RAG (Retrieval-Augmented Generation)
- **Custom RAG implementation**: For document-based question answering
- **Chunking strategies**: For breaking documents into manageable pieces

## Document Processing

### Text Extraction
- **pdf-parse**: For extracting text from PDF files
- **mammoth**: For extracting text from DOCX files
- **LangChain document loaders**: Alternative document processing

### Document Storage
- **File system**: For storing uploaded documents
- **Metadata storage**: In PostgreSQL database

### Document Processing Pipeline
- **Asynchronous processing**: Background processing of documents
- **Progress tracking**: For monitoring document processing status

## Infrastructure

### Server
- **Express.js server**: For handling HTTP requests
- **CORS support**: For cross-origin resource sharing

### File Storage
- **Local file system**: For document and embedding storage
- **Configurable paths**: Via config.ini
- **Docker volumes**: For persistent storage of ChromaDB data

### Containerization
- **Docker**: For running ChromaDB in an isolated container
- **docker-compose**: For defining and running the multi-container setup
- **Container networking**: For communication between application and ChromaDB

### Environment Configuration
- **config.ini**: For application configuration
- **Environment-specific settings**: Development vs. production
- **Docker environment variables**: For container configuration

## Development Tools

### Code Quality
- **ESLint**: For JavaScript/TypeScript linting
- **IDE integrations**: VS Code support

### Development Workflow
- **nodemon**: For automatic server restarts during development
- **npm scripts**: For common development tasks

### Version Control
- **Git**: For source code management
- **GitHub**: For repository hosting and collaboration

## Security Components

### Authentication
- **Session-based authentication**: Using express-session
- **Password hashing**: Using bcrypt

### API Security
- **Input validation**: For preventing injection attacks
- **CORS configuration**: For controlling API access

### File Security
- **File type validation**: For preventing malicious uploads
- **File size limits**: For preventing DoS attacks

## Deployment and DevOps

### Production Deployment
- **Docker**: For containerized deployment of ChromaDB and other services
- **docker-compose**: For orchestrating multi-container applications
- **Volume mapping**: For persistent data storage in containers
- **Container health checks**: For monitoring container status

### Process Management
- **PM2**: For Node.js process management in production (optional)

### Monitoring
- **Console logging**: For basic application monitoring
- **Custom logger**: For structured logging

---

## Technology Stack Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                         │
└───────────────────────────────┬─────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                      Frontend (React)                       │
│                                                             │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │ React Router│   │ Context API  │   │ UI Components    │  │
│  └─────────────┘   └──────────────┘   └──────────────────┘  │
│                                                             │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │ TypeScript  │   │ CSS Modules  │   │ API Service      │  │
│  └─────────────┘   └──────────────┘   └──────────────────┘  │
└───────────────────────────────┬─────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                     Backend (Node.js)                       │
│                                                             │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │ Express.js  │   │ Authentication│  │ File Handling    │  │
│  └─────────────┘   └──────────────┘   └──────────────────┘  │
│                                                             │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │ REST API    │   │ Document     │   │ RAG Implementation│ │
│  │             │   │ Processing   │   │                  │  │
│  └─────────────┘   └──────────────┘   └─────────┬────────┘  │
└───┬───────────────────────────────────────────┬─┼───────────┘
    │                                           │ │
    │                                           │ │
┌───▼───────────────────────┐   ┌───────────────▼─┘           ┐
│      PostgreSQL Database  │   │  ┌─────────────────────────┐│
│                           │   │  │  Docker Container       ││
│  ┌─────────────────────┐  │   │  │  ┌───────────────────┐  ││
│  │ User Data           │  │   │  │  │    ChromaDB       │  ││
│  └─────────────────────┘  │   │  │  │    Vector DB      │  ││
│                           │   │  │  └───────────────────┘  ││
│  ┌─────────────────────┐  │   │  └─────────────────────────┘│
│  │ Document Metadata   │  │   │                             │
│  └─────────────────────┘  │   │  ┌─────────────────────┐    │
│                           │   │  │ Uploaded Files      │    │
│  ┌─────────────────────┐  │   │  └─────────────────────┘    │
│  │ Chat History        │  │   │                             │
│  └─────────────────────┘  │   │  ┌─────────────────────┐    │
│                           │   │  │ Embeddings          │    │
└───────────────────────────┘   │  └─────────────────────┘    │
                                └─────────────────────────────┘
```

## Dependency Management

The application uses npm for dependency management. Key dependencies include:

- **express**: Web framework
- **pg**: PostgreSQL client
- **bcrypt**: Password hashing
- **multer**: File upload handling
- **react**: UI library
- **react-router-dom**: Routing
- **typescript**: Type checking
- **pdf-parse**: PDF text extraction
- **mammoth**: DOCX text extraction
- **docker**: Container platform for ChromaDB
- **docker-compose**: Multi-container Docker applications

For a complete list of dependencies, refer to the `package.json` files in the project root and client directory.

---

This document should be updated as the technology stack evolves. Last updated: May 2024.
