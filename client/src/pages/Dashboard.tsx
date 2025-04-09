import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  ChartBarIcon, 
  UsersIcon, 
  ChatBubbleLeftRightIcon,
  ServerIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

// Mock data for charts
const activityData = [65, 59, 80, 81, 56, 55, 40, 45, 60, 75, 85, 90];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  // Mock stats
  const stats = [
    { 
      id: 1, 
      name: 'Active Users', 
      value: '1,234', 
      change: '+12%', 
      trend: 'up',
      icon: UsersIcon 
    },
    { 
      id: 2, 
      name: 'Chat Sessions', 
      value: '856', 
      change: '+24%', 
      trend: 'up',
      icon: ChatBubbleLeftRightIcon 
    },
    { 
      id: 3, 
      name: 'Server Load', 
      value: '42%', 
      change: '-5%', 
      trend: 'down',
      icon: ServerIcon 
    },
    { 
      id: 4, 
      name: 'Response Time', 
      value: '120ms', 
      change: '-8%', 
      trend: 'down',
      icon: ClockIcon 
    }
  ];

  // Mock recent activities
  const activities = [
    { id: 1, user: 'John Doe', action: 'logged in', time: '5 minutes ago' },
    { id: 2, user: 'Jane Smith', action: 'updated profile', time: '10 minutes ago' },
    { id: 3, user: 'Admin', action: 'added new user', time: '1 hour ago' },
    { id: 4, user: 'System', action: 'performed backup', time: '3 hours ago' },
    { id: 5, user: 'Alice Johnson', action: 'sent message', time: '5 hours ago' },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Welcome section */}
      <div className="p-6 rounded-xl" style={{
        background: `linear-gradient(to right, var(--color-primary)20, var(--color-secondary)20)`,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          Welcome back, <span style={{ color: 'var(--color-primary)' }}>{user?.username}</span>
        </h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Here's what's happening with your platform today
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div 
            key={stat.id} 
            className="p-6 rounded-xl transition-all duration-300 hover:shadow-lg"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderColor: 'var(--color-border)'
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm">{stat.name}</p>
                <h3 className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>{stat.value}</h3>
              </div>
              <div className="p-3 rounded-lg" style={{ 
                backgroundColor: `var(--color-primary)10`,
                color: 'var(--color-primary)'
              }}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {stat.trend === 'up' ? (
                <ArrowUpIcon className="w-4 h-4 mr-1" style={{ color: 'var(--color-success)' }} />
              ) : (
                <ArrowDownIcon className="w-4 h-4 mr-1" style={{ color: 'var(--color-error)' }} />
              )}
              <span className="text-sm" style={{ 
                color: stat.trend === 'up' ? 'var(--color-success)' : 'var(--color-error)'
              }}>
                {stat.change} from last period
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div 
          className="lg:col-span-2 p-6 rounded-xl"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)'
          }}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Activity Overview</h3>
            <div className="flex space-x-2">
              <button 
                onClick={() => setSelectedPeriod('week')}
                className={`px-3 py-1 text-sm rounded-md transition-colors`}
                style={{
                  backgroundColor: selectedPeriod === 'week' ? 'var(--color-primary)' : 'var(--color-surface-dark)',
                  color: selectedPeriod === 'week' ? 'white' : 'var(--color-text-muted)'
                }}
              >
                Week
              </button>
              <button 
                onClick={() => setSelectedPeriod('month')}
                className={`px-3 py-1 text-sm rounded-md transition-colors`}
                style={{
                  backgroundColor: selectedPeriod === 'month' ? 'var(--color-primary)' : 'var(--color-surface-dark)',
                  color: selectedPeriod === 'month' ? 'white' : 'var(--color-text-muted)'
                }}
              >
                Month
              </button>
              <button 
                onClick={() => setSelectedPeriod('year')}
                className={`px-3 py-1 text-sm rounded-md transition-colors`}
                style={{
                  backgroundColor: selectedPeriod === 'year' ? 'var(--color-primary)' : 'var(--color-surface-dark)',
                  color: selectedPeriod === 'year' ? 'white' : 'var(--color-text-muted)'
                }}
              >
                Year
              </button>
            </div>
          </div>
          
          {/* Simple chart visualization */}
          <div className="h-64 flex items-end space-x-2">
            {activityData.map((value, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full rounded-t transition-all duration-200"
                  style={{ 
                    height: `${value}%`,
                    backgroundColor: 'var(--color-primary)',
                    opacity: 0.8
                  }}
                ></div>
                <div className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>{months[index]}</div>
              </div>
            ))}
          </div>
        </div>

        <div 
          className="p-6 rounded-xl"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)'
          }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Recent Activity</h3>
          <div className="space-y-4">
            {activities.map((activity) => (
              <div 
                key={activity.id} 
                className="flex items-start space-x-3 pb-3 last:border-0"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--color-primary)20',
                    color: 'var(--color-primary)'
                  }}
                >
                  {activity.user.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                    <span className="font-medium">{activity.user}</span> {activity.action}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button 
            className="w-full mt-4 py-2 text-sm transition-colors"
            style={{
              color: 'var(--color-primary)'
            }}
          >
            View All Activity
          </button>
        </div>
      </div>
    </div>
  );
} 