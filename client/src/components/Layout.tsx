import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  HomeIcon,
  UsersIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  BellIcon,
  MoonIcon,
  SunIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Welcome to the Pinnacleflow Ai!', read: false },
    { id: 2, text: 'New features available', read: false },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    // In a real app, you would persist this preference
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const NavLink = ({ to, icon: Icon, children }: { to: string; icon: any; children: React.ReactNode }) => {
    const isActive = location.pathname === to;
    return (
      <Link
        to={to}
        className={`flex items-center px-4 py-3 text-platform-light rounded-lg transition-all duration-200 ${
          isActive 
            ? 'bg-platform-primary/10 text-platform-primary font-medium' 
            : 'hover:bg-platform-surface-light hover:text-platform-secondary'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      >
        <Icon className="w-5 h-5 mr-3" />
        {children}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-platform-darker">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-y-0 left-0 w-72 bg-platform-dark border-r border-platform-border transform transition-all duration-300 ease-in-out z-30 lg:transform-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-platform-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-platform-primary to-platform-secondary flex items-center justify-center shadow-glow">
              <span className="text-white font-bold text-xl">P</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-platform-primary to-platform-secondary bg-clip-text text-transparent">
              Pinnacleflow Ai
            </h1>
          </div>
          <button
            className="lg:hidden text-platform-muted hover:text-platform-light transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        {/* User profile in sidebar */}
        <div className="px-6 py-4 border-b border-platform-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-platform-primary/20 flex items-center justify-center text-platform-primary font-semibold">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-platform-light font-medium">{user?.username}</div>
              <div className="text-platform-muted text-sm">{user?.role}</div>
            </div>
          </div>
        </div>
        
        <nav className="mt-6 px-3 space-y-1">
          <NavLink to="/dashboard" icon={HomeIcon}>
            Dashboard
          </NavLink>
          <NavLink to="/runs" icon={PlayIcon}>
            Run Status
          </NavLink>
          <NavLink to="/chatbot" icon={ChatBubbleLeftRightIcon}>
            Chatbot
          </NavLink>
          {isAdmin() && (
            <NavLink to="/users" icon={UsersIcon}>
              Users
            </NavLink>
          )}
          <div className="pt-4 mt-4 border-t border-platform-border">
            <NavLink to="/settings" icon={Cog6ToothIcon}>
              Settings
            </NavLink>
          </div>
        </nav>
        
        {/* Version info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-xs text-platform-muted text-center">
          Version 1.0.0
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-platform-dark border-b border-platform-border">
          <div className="h-full px-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                className="text-platform-muted hover:text-platform-light transition-colors lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Bars3Icon className="w-6 h-6" />
              </button>
              <span className="text-platform-light font-medium hidden md:inline">
                Welcome, <span className="text-platform-primary">{user?.username}</span>
              </span>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Theme toggle */}
              <button 
                onClick={toggleDarkMode}
                className="p-2 rounded-full hover:bg-platform-surface-light text-platform-muted hover:text-platform-light transition-colors"
              >
                {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              </button>
              
              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-full hover:bg-platform-surface-light text-platform-muted hover:text-platform-light transition-colors"
                >
                  <BellIcon className="w-5 h-5" />
                  {notifications.some(n => !n.read) && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-platform-accent rounded-full"></span>
                  )}
                </button>
                
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-platform-dark border border-platform-border rounded-lg shadow-lg z-50">
                    <div className="p-3 border-b border-platform-border flex justify-between items-center">
                      <h3 className="font-medium text-platform-light">Notifications</h3>
                      <button 
                        onClick={markAllAsRead}
                        className="text-xs text-platform-primary hover:text-platform-secondary"
                      >
                        Mark all as read
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map(notification => (
                          <div 
                            key={notification.id} 
                            className={`p-3 border-b border-platform-border hover:bg-platform-surface-light transition-colors ${
                              notification.read ? 'opacity-60' : ''
                            }`}
                          >
                            <p className="text-sm text-platform-light">{notification.text}</p>
                            <p className="text-xs text-platform-muted mt-1">Just now</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-platform-muted">
                          No notifications
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 rounded-lg text-platform-light hover:bg-platform-surface-light transition-all duration-200"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-platform-darker p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
} 