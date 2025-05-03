import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from 'contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from 'services/api';
import MetricCard from 'components/MetricCard';
import QuickActionCard from 'components/QuickActionCard';

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
    totalDocuments: number;
  };
  licenseUsage?: {
    totalLicenses: number;
    activeLicenses: number;
    expirationDate: string;
    daysRemaining: number;
  };
}

// Components are imported at the top of the file

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  // Theme context is used for styling via CSS variables
  const navigate = useNavigate();
  // Time period for metrics, currently fixed to 'week'
  const [selectedPeriod] = useState('week');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/chatbot');
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin()) return;

    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const response = await api.get('/dashboard/metrics');
        const metricsData = response.data || {};

        const normalizedData: DashboardMetrics = {
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
            totalDocuments: Number(metricsData.messageStats?.totalDocuments ?? 0)
          },
          licenseUsage: metricsData.licenseUsage || {
            totalLicenses: 25,
            activeLicenses: 12,
            expirationDate: "2025-12-31",
            daysRemaining: 612
          }
        };

        setMetrics(normalizedData);
        setError(null);
      } catch (err) {
        setError('Failed to load dashboard metrics');
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
            totalDocuments: 0
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

  if (!isAdmin()) {
    return null;
  }

  return (
    <div
      className="min-h-screen p-4 md:p-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(to-b, var(--color-bg), var(--color-bg-dark))',
      }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, var(--color-primary) 1px, transparent 0)',
        backgroundSize: '40px 40px',
      }} />

      <div className="max-w-7xl mx-auto relative z-10 space-y-6">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="p-6 rounded-xl backdrop-blur-sm"
          style={{
            background: 'linear-gradient(to-r, var(--color-surface), var(--color-surface-dark))',
            border: '1px solid var(--color-border)',
          }}
        >
          <h2 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
            Welcome back, <span style={{ color: 'var(--color-primary)' }}>{user?.name || user?.username}</span>
          </h2>
          <p className="mt-2 text-sm md:text-base" style={{ color: 'var(--color-text-secondary)' }}>
            Admin Dashboard - System Overview
          </p>
        </motion.div>

        {/* Loading State */}
        <Suspense fallback={<div>Loading components...</div>}>
          {loading ? (
            <motion.div
              className="flex justify-center items-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full"
              />
              <p className="ml-4" style={{ color: 'var(--color-text)' }}>Loading dashboard metrics...</p>
            </motion.div>
          ) : error ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-xl backdrop-blur-sm text-center"
              style={{
                background: 'var(--color-error)10',
                border: '1px solid var(--color-error)',
                color: 'var(--color-error)',
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">⚠️</span>
                <p>{error}</p>
              </div>
              <button
                className="mt-4 px-4 py-2 rounded-lg transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(to-r, var(--color-primary), var(--color-primary-dark))',
                  color: 'white',
                }}
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </motion.div>
          ) : (
            <>
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <MetricCard
                  title="User Statistics"
                  primaryMetric={metrics?.userStats.totalUsers ?? 0}
                  primaryLabel="Total Users"
                  details={[
                    { label: 'Admin Users', value: metrics?.userStats.adminUsers ?? 0 },
                    { label: 'Regular Users', value: metrics?.userStats.regularUsers ?? 0 },
                    { label: 'New Users (7d)', value: metrics?.userStats.recentUsers ?? 0, highlight: true },
                  ]}
                  link={{ to: '/users', label: 'Manage Users' }}
                />

                <MetricCard
                  title="Message Statistics"
                  primaryMetric={metrics?.messageStats.totalMessages ?? 0}
                  primaryLabel="Total Messages"
                  details={[
                    { label: 'Recent Messages', value: metrics?.messageStats.recentMessages ?? 0 },
                    { label: 'Total Documents', value: metrics?.messageStats.totalDocuments ?? 0 },
                  ]}
                  link={{ to: '/chatbot', label: 'Go to Chatbot' }}
                />

                <MetricCard
                  title="License Usage"
                  primaryMetric={`${metrics?.licenseUsage?.activeLicenses ?? 0}/${metrics?.licenseUsage?.totalLicenses ?? 0}`}
                  primaryLabel="Active/Total"
                  details={[
                    { label: 'Expiration', value: metrics?.licenseUsage?.expirationDate ?? 'N/A' },
                    { label: 'Days Left', value: metrics?.licenseUsage?.daysRemaining ?? 0 },
                  ]}
                  progress={Math.round((metrics?.licenseUsage?.activeLicenses ?? 0) / (metrics?.licenseUsage?.totalLicenses ?? 1) * 100)}
                  link={{ to: '/settings', label: 'Manage Licenses' }}
                  badge="NEW"
                />
              </div>

              {/* Quick Actions & Management */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="lg:col-span-2 p-6 rounded-xl backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(to-r, var(--color-surface), var(--color-surface-dark))',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                      User Management Tools
                    </h3>
                    <Link
                      to="/users"
                      className="px-4 py-2 rounded-lg transition-all hover:scale-105"
                      style={{
                        background: 'linear-gradient(to-r, var(--color-primary), var(--color-primary-dark))',
                        color: 'white',
                      }}
                    >
                      Add User
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                      <h4 className="font-medium mb-3" style={{ color: 'var(--color-text)' }}>User Roles</h4>
                      <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <li className="flex justify-between">
                          <span>Admin Users</span>
                          <span className="px-2 py-1 rounded-full text-xs" style={{
                            backgroundColor: 'var(--color-primary)20',
                            color: 'var(--color-primary)',
                          }}>
                            {metrics?.userStats.adminUsers ?? 0}
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span>Regular Users</span>
                          <span className="px-2 py-1 rounded-full text-xs" style={{
                            backgroundColor: 'var(--color-success)20',
                            color: 'var(--color-success)',
                          }}>
                            {metrics?.userStats.regularUsers ?? 0}
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                      <h4 className="font-medium mb-3" style={{ color: 'var(--color-text)' }}>Recent Activity</h4>
                      <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <li className="flex justify-between">
                          <span>New Users</span>
                          <span className="px-2 py-1 rounded-full text-xs" style={{
                            backgroundColor: 'var(--color-success)20',
                            color: 'var(--color-success)',
                          }}>
                            {metrics?.userStats.recentUsers ?? 0}
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span>New Messages</span>
                          <span className="px-2 py-1 rounded-full text-xs" style={{
                            backgroundColor: 'var(--color-primary)20',
                            color: 'var(--color-primary)',
                          }}>
                            {metrics?.messageStats.recentMessages ?? 0}
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span>Documents Added</span>
                          <span className="px-2 py-1 rounded-full text-xs" style={{
                            backgroundColor: 'var(--color-warning)20',
                            color: 'var(--color-warning)',
                          }}>
                            {metrics?.messageStats.totalDocuments ?? 0}
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </motion.div>

                <QuickActionCard
                  actions={[
                    {
                      to: '/users',
                      label: 'Manage Users',
                      description: 'Add, edit, remove users',
                      color: 'var(--color-primary)',
                    },
                    {
                      to: '/settings',
                      label: 'License Management',
                      description: 'Manage and assign licenses',
                      color: 'var(--color-primary)',
                    },
                    {
                      to: '/chatbot',
                      label: 'Chatbot Interface',
                      description: 'Access chat functionality',
                      color: 'var(--color-primary)',
                    },
                  ]}
                />
              </div>
            </>
          )}
        </Suspense>
      </div>
    </div>
  );
}