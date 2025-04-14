import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
  UsersIcon, 
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  KeyIcon,
  PlusIcon,
  UserGroupIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface DashboardMetrics {
  userStats: {
    totalUsers: number;
    adminUsers: number;
    regularUsers: number;
    recentUsers: number;
  };
  messageStats: {
    totalMessages: number;
    recentMessages: number;
    avgResponseTime: number;
    totalPdfs: number;
  };
  licenseUsage?: {
    totalLicenses: number;
    activeLicenses: number;
    expirationDate: string;
    daysRemaining: number;
  };
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect non-admin users
  useEffect(() => {
    console.log('Dashboard isAdmin check:', isAdmin());
    console.log('Current user:', user);
    
    if (!isAdmin()) {
      console.log('User is not admin, redirecting to chatbot');
      navigate('/chatbot');
    } else {
      console.log('User is admin, showing dashboard');
    }
  }, [isAdmin, navigate, user]);

  // Fetch dashboard metrics
  useEffect(() => {
    if (!isAdmin()) return;

    const fetchMetrics = async () => {
      setLoading(true);
      try {
        console.log('Fetching dashboard metrics...');
        const response = await api.get('/dashboard/metrics');
        console.log('Raw API Response:', response);
        console.log('API Response data:', response.data);
        
        // Check if response has the expected structure
        if (!response.data || typeof response.data !== 'object') {
          console.error('Unexpected API response format:', response.data);
          throw new Error('Invalid response format');
        }
        
        // Ensure the data has the expected shape or use fallback
        const metricsData = response.data || {};
        
        // Deep clone to avoid reference issues
        const normalizedData = {
          userStats: {
            totalUsers: Number(metricsData.userStats?.totalUsers ?? 0),
            adminUsers: Number(metricsData.userStats?.adminUsers ?? 0),
            regularUsers: Number(metricsData.userStats?.regularUsers ?? 0),
            recentUsers: Number(metricsData.userStats?.recentUsers ?? 0)
          },
          messageStats: {
            totalMessages: Number(metricsData.messageStats?.totalMessages ?? 0),
            recentMessages: Number(metricsData.messageStats?.recentMessages ?? 0),
            avgResponseTime: Number(metricsData.messageStats?.avgResponseTime ?? 0),
            totalPdfs: Number(metricsData.messageStats?.totalPdfs ?? 0)
          },
          // Mock license usage data (for demonstration)
          licenseUsage: metricsData.licenseUsage || {
            totalLicenses: 25,
            activeLicenses: 12,
            expirationDate: "2024-12-31",
            daysRemaining: 245
          }
        };
        
        console.log('Normalized metrics:', normalizedData);
        setMetrics(normalizedData);
        setError(null);
      } catch (err) {
        console.error('Error fetching dashboard metrics:', err);
        setError('Failed to load dashboard metrics');
        
        // Use mock data for demonstration if API fails
        setMetrics({
          userStats: {
            totalUsers: 0,
            adminUsers: 0,
            regularUsers: 0,
            recentUsers: 0
          },
          messageStats: {
            totalMessages: 0,
            recentMessages: 0,
            avgResponseTime: 0,
            totalPdfs: 0
          },
          licenseUsage: {
            totalLicenses: 25,
            activeLicenses: 0,
            expirationDate: "N/A",
            daysRemaining: 0
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [isAdmin, selectedPeriod]);

  // If not admin, don't render the dashboard content
  if (!isAdmin()) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Welcome section */}
      <div className="p-6 rounded-xl" style={{
        background: `linear-gradient(to right, var(--color-primary)20, var(--color-secondary)20)`,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          Welcome back, <span style={{ color: 'var(--color-primary)' }}>{user?.name || user?.username}</span>
        </h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Admin Dashboard - System Overview
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-12 h-12 rounded-full animate-spin" style={{
            borderWidth: '4px',
            borderStyle: 'solid',
            borderColor: 'var(--color-primary)30',
            borderTopColor: 'var(--color-primary)'
          }}></div>
          <p className="ml-4" style={{ color: 'var(--color-text)' }}>Loading dashboard metrics...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl text-center" style={{
          backgroundColor: 'var(--color-error)10',
          borderColor: 'var(--color-error)',
          color: 'var(--color-error)',
          border: '1px solid'
        }}>
          <p>{error}</p>
          <button
            className="mt-4 px-4 py-2 rounded-lg"
            style={{
              backgroundColor: 'var(--color-error)',
              color: 'white'
            }}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Stats grid - real data */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* User Statistics */}
            <div 
            className="p-6 rounded-xl transition-all duration-300 hover:shadow-lg"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderColor: 'var(--color-border)'
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                  <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm">Total Users</p>
                  <h3 className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>
                    {metrics?.userStats.totalUsers ?? 0}
                  </h3>
              </div>
              <div className="p-3 rounded-lg" style={{ 
                backgroundColor: `var(--color-primary)10`,
                color: 'var(--color-primary)'
              }}>
                  <UsersIcon className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <div>Admin Users: <span style={{ color: 'var(--color-text)' }}>{metrics?.userStats.adminUsers ?? 0}</span></div>
                <div>Regular Users: <span style={{ color: 'var(--color-text)' }}>{metrics?.userStats.regularUsers ?? 0}</span></div>
                <div className="col-span-2">New Users (Last 7 days): <span style={{ color: 'var(--color-success)' }}>{metrics?.userStats.recentUsers ?? 0}</span></div>
              </div>
              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <Link 
                  to="/users" 
                  className="text-sm flex items-center"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <span>Manage Users</span>
                  <ArrowRightIcon className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>

            {/* Message Statistics */}
            <div 
              className="p-6 rounded-xl transition-all duration-300 hover:shadow-lg"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderColor: 'var(--color-border)'
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm">Total Messages</p>
                  <h3 className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>
                    {metrics?.messageStats.totalMessages || 0}
                  </h3>
                </div>
                <div className="p-3 rounded-lg" style={{ 
                  backgroundColor: `var(--color-primary)10`,
                  color: 'var(--color-primary)'
                }}>
                  <ChatBubbleLeftRightIcon className="w-6 h-6" />
            </div>
          </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <div>Recent Messages: <span style={{ color: 'var(--color-text)' }}>{metrics?.messageStats.recentMessages || 0}</span></div>
                <div>Total PDFs: <span style={{ color: 'var(--color-text)' }}>{metrics?.messageStats.totalPdfs || 0}</span></div>
              </div>
              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <Link 
                  to="/chatbot" 
                  className="text-sm flex items-center"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <span>Go to Chatbot</span>
                  <ArrowRightIcon className="w-4 h-4 ml-1" />
                </Link>
              </div>
      </div>

            {/* License Usage (NEW) */}
        <div 
              className="p-6 rounded-xl transition-all duration-300 hover:shadow-lg relative overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderColor: 'var(--color-border)'
              }}
            >
              {/* "New" badge */}
              <div 
                className="absolute top-0 right-0 px-2 py-1 text-xs font-semibold transform translate-x-1/3 -translate-y-1/3 rotate-45"
                style={{
                  backgroundColor: 'var(--color-success)',
                  color: 'white',
                  borderRadius: '4px'
                }}
              >
                NEW
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm">License Usage</p>
                  <h3 className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>
                    {metrics?.licenseUsage?.activeLicenses || 0}/{metrics?.licenseUsage?.totalLicenses || 0}
                  </h3>
                </div>
                <div className="p-3 rounded-lg" style={{ 
                  backgroundColor: `var(--color-primary)10`,
                  color: 'var(--color-primary)'
                }}>
                  <KeyIcon className="w-6 h-6" />
                </div>
              </div>
              
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  <span>Usage</span>
                  <span>{Math.round((metrics?.licenseUsage?.activeLicenses || 0) / (metrics?.licenseUsage?.totalLicenses || 1) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full" 
                style={{
                      width: `${Math.round((metrics?.licenseUsage?.activeLicenses || 0) / (metrics?.licenseUsage?.totalLicenses || 1) * 100)}%`,
                      backgroundColor: 'var(--color-primary)' 
                    }}
                  ></div>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <div>Expiration: <span style={{ color: 'var(--color-text)' }}>{metrics?.licenseUsage?.expirationDate || 'N/A'}</span></div>
                <div>Days Left: <span style={{ color: 'var(--color-text)' }}>{metrics?.licenseUsage?.daysRemaining || 0}</span></div>
              </div>
              
              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <Link 
                  to="/settings" 
                  className="text-sm flex items-center"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <span>Manage Licenses</span>
                  <ArrowRightIcon className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>
          </div>
          
          {/* Quick Actions & User Management Tools */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Management Tools */}
            <div 
              className="lg:col-span-2 p-6 rounded-xl"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)'
              }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>User Management Tools</h3>
                <Link
                  to="/users" 
                  className="px-3 py-1 rounded-md text-sm flex items-center"
                  style={{ 
                    backgroundColor: 'var(--color-primary)',
                    color: 'white'
                  }}
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  <span>Add User</span>
                </Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center mb-3">
                    <div className="p-2 rounded-lg mr-3" style={{ 
                      backgroundColor: `var(--color-primary)10`,
                      color: 'var(--color-primary)'
                    }}>
                      <UserGroupIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-medium" style={{ color: 'var(--color-text)' }}>User Roles</h4>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Manage access permissions</p>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    <li className="flex items-center justify-between">
                      <span>Admin Users</span>
                      <span className="px-2 py-1 rounded-full text-xs" style={{ 
                        backgroundColor: 'var(--color-primary)20',
                        color: 'var(--color-primary)'
                      }}>{metrics?.userStats.adminUsers || 0}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Regular Users</span>
                      <span className="px-2 py-1 rounded-full text-xs" style={{ 
                        backgroundColor: 'var(--color-success)20',
                        color: 'var(--color-success)'
                      }}>{metrics?.userStats.regularUsers || 0}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Viewer Users</span>
                      <span className="px-2 py-1 rounded-full text-xs" style={{ 
                        backgroundColor: 'var(--color-warning)20',
                        color: 'var(--color-warning)'
                      }}>0</span>
                    </li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center mb-3">
                    <div className="p-2 rounded-lg mr-3" style={{ 
                      backgroundColor: `var(--color-primary)10`,
                      color: 'var(--color-primary)'
                    }}>
                      <DocumentTextIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-medium" style={{ color: 'var(--color-text)' }}>Recent Activity</h4>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Last 7 days</p>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    <li className="flex items-center justify-between">
                      <span>New Users</span>
                      <span className="px-2 py-1 rounded-full text-xs" style={{ 
                        backgroundColor: 'var(--color-success)20',
                        color: 'var(--color-success)'
                      }}>{metrics?.userStats.recentUsers || 0}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>New Messages</span>
                      <span className="px-2 py-1 rounded-full text-xs" style={{ 
                        backgroundColor: 'var(--color-primary)20',
                        color: 'var(--color-primary)'
                      }}>{metrics?.messageStats.recentMessages || 0}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Documents Added</span>
                      <span className="px-2 py-1 rounded-full text-xs" style={{ 
                        backgroundColor: 'var(--color-warning)20',
                        color: 'var(--color-warning)'
                      }}>{metrics?.messageStats.totalPdfs || 0}</span>
                    </li>
                  </ul>
          </div>
        </div>

              <div className="text-sm p-4 rounded-lg" style={{
                backgroundColor: 'var(--color-info)10',
                color: 'var(--color-info)'
              }}>
                <p><strong>Pro Tip:</strong> Regular review of user accounts helps maintain proper security access levels. You can modify user roles from the User Management page.</p>
              </div>
            </div>

            {/* Quick Links */}
        <div 
          className="p-6 rounded-xl"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)'
          }}
        >
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Quick Actions</h3>
              <div className="space-y-3">
                <Link 
                  to="/users"
                  className="p-3 rounded-lg flex items-center hover:bg-opacity-10 hover:bg-gray-400 transition-colors"
                  style={{ color: 'var(--color-text)' }}
                >
                  <div className="p-2 rounded-lg mr-3" style={{ 
                    backgroundColor: `var(--color-primary)10`,
                    color: 'var(--color-primary)'
                  }}>
                    <UsersIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium">Manage Users</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Add, edit, remove users</div>
                  </div>
                </Link>
                
                <Link 
                  to="/settings"
                  className="p-3 rounded-lg flex items-center hover:bg-opacity-10 hover:bg-gray-400 transition-colors"
                  style={{ color: 'var(--color-text)' }}
                >
                  <div className="p-2 rounded-lg mr-3" style={{ 
                    backgroundColor: `var(--color-primary)10`,
                    color: 'var(--color-primary)'
                  }}>
                    <KeyIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium">License Management</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Manage and assign licenses</div>
                  </div>
                </Link>
                
                <Link 
                  to="/chatbot"
                  className="p-3 rounded-lg flex items-center hover:bg-opacity-10 hover:bg-gray-400 transition-colors"
                  style={{ color: 'var(--color-text)' }}
                >
                  <div className="p-2 rounded-lg mr-3" style={{ 
                    backgroundColor: `var(--color-primary)10`,
                    color: 'var(--color-primary)'
                  }}>
                    <ChatBubbleLeftRightIcon className="w-5 h-5" />
                </div>
                <div>
                    <div className="font-medium">Chatbot Interface</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Access chat functionality</div>
                </div>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 