// User-related types
export interface User {
  id: string;
  username: string;
  name?: string;
  email?: string;
  role: 'admin' | 'user' | 'viewer';
}

// Chat-related types
export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  url?: string;
  documentId?: string;
  status?: string;
  processingError?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean; // Added to support streaming messages
  fileAttachment?: FileAttachment; // Added to support file attachments
  isProcessingFile?: boolean; // Added to identify document processing messages
  conversationId?: string; // Added to identify the conversation this message belongs to
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: Date;
  last_message_timestamp: Date;
  is_active: boolean;
}

export interface ChatSessionResponse {
  session: ChatSession;
  messages: ChatMessage[];
  total: number;
}

// Dashboard metrics types
export interface UserStats {
  totalUsers: number;
  adminUsers: number;
  regularUsers: number;
  recentUsers: number;
}

export interface MessageStats {
  totalMessages: number;
  recentMessages: number;
  avgResponseTime: number;
  totalDocuments: number;
}

export interface LicenseUsage {
  totalLicenses: number;
  activeLicenses: number;
  expirationDate: string;
  daysRemaining: number;
}

export interface DashboardMetrics {
  userStats: UserStats;
  messageStats: MessageStats;
  licenseUsage: LicenseUsage;
}