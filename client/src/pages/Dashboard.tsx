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
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="bg-gradient-to-r from-platform-primary/20 to-platform-secondary/20 p-6 rounded-xl shadow-card">
        <h2 className="text-2xl font-bold text-platform-light mb-2">
          Welcome back, <span className="text-platform-primary">{user?.username}</span>
        </h2>
        <p className="text-platform-muted">
          Here's what's happening with your platform today
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.id} className="bg-platform-dark p-6 rounded-xl shadow-card border border-platform-border hover:border-platform-primary/50 transition-all duration-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-platform-muted text-sm">{stat.name}</p>
                <h3 className="text-2xl font-bold text-platform-light mt-1">{stat.value}</h3>
              </div>
              <div className="p-3 bg-platform-primary/10 rounded-lg text-platform-primary">
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {stat.trend === 'up' ? (
                <ArrowUpIcon className="w-4 h-4 text-platform-success mr-1" />
              ) : (
                <ArrowDownIcon className="w-4 h-4 text-platform-error mr-1" />
              )}
              <span className={`text-sm ${
                stat.trend === 'up' ? 'text-platform-success' : 'text-platform-error'
              }`}>
                {stat.change} from last period
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-platform-dark p-6 rounded-xl shadow-card border border-platform-border">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-platform-light">Activity Overview</h3>
            <div className="flex space-x-2">
              <button 
                onClick={() => setSelectedPeriod('week')}
                className={`px-3 py-1 text-sm rounded-md ${
                  selectedPeriod === 'week' 
                    ? 'bg-platform-primary text-white' 
                    : 'bg-platform-surface text-platform-muted hover:text-platform-light'
                }`}
              >
                Week
              </button>
              <button 
                onClick={() => setSelectedPeriod('month')}
                className={`px-3 py-1 text-sm rounded-md ${
                  selectedPeriod === 'month' 
                    ? 'bg-platform-primary text-white' 
                    : 'bg-platform-surface text-platform-muted hover:text-platform-light'
                }`}
              >
                Month
              </button>
              <button 
                onClick={() => setSelectedPeriod('year')}
                className={`px-3 py-1 text-sm rounded-md ${
                  selectedPeriod === 'year' 
                    ? 'bg-platform-primary text-white' 
                    : 'bg-platform-surface text-platform-muted hover:text-platform-light'
                }`}
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
                  className="w-full bg-platform-primary/80 hover:bg-platform-primary rounded-t transition-all duration-200"
                  style={{ height: `${value}%` }}
                ></div>
                <div className="text-xs text-platform-muted mt-2">{months[index]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-platform-dark p-6 rounded-xl shadow-card border border-platform-border">
          <h3 className="text-lg font-semibold text-platform-light mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3 pb-3 border-b border-platform-border last:border-0">
                <div className="w-8 h-8 rounded-full bg-platform-primary/20 flex items-center justify-center text-platform-primary">
                  {activity.user.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm text-platform-light">
                    <span className="font-medium">{activity.user}</span> {activity.action}
                  </p>
                  <p className="text-xs text-platform-muted mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2 text-sm text-platform-primary hover:text-platform-secondary transition-colors">
            View All Activity
          </button>
        </div>
      </div>

      {/* System status */}
    </div>
  );
} 