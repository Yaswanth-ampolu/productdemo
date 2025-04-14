// User-related types
export interface User {
  id: string;
  username: string;
  name?: string;
  email?: string;
  role: 'admin' | 'user' | 'viewer';
}

// Chat-related types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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
  totalPdfs: number;
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