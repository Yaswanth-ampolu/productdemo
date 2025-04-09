import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import Sidebar from './Sidebar';

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  
  // Initialize sidebar state from localStorage or default to true for desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : window.innerWidth >= 1024;
  });
  
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Welcome to the Pinnacleflow Ai!', read: false },
    { id: 2, text: 'New features available', read: false },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="flex h-screen bg-[#0f1117]">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onToggle={toggleSidebar}
        user={user}
        isAdmin={isAdmin}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-[#1a1f2d] border-b border-gray-800">
          <div className="h-full px-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Only show menu button on mobile */}
              <button
                type="button"
                className="lg:hidden p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors focus:outline-none"
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
              >
                <Bars3Icon className="w-6 h-6" />
              </button>
              <span className="text-gray-200 font-medium hidden md:inline">
                Welcome, <span className="text-blue-400">{user?.username || 'User'}</span>
              </span>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Theme toggle */}
              <button 
                type="button"
                onClick={toggleDarkMode}
                className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              </button>
              
              {/* Notifications */}
              <div className="relative">
                <button 
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                >
                  <BellIcon className="w-5 h-5" />
                  {notifications.some(n => !n.read) && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
                  )}
                </button>
                
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-[#1a1f2d] border border-gray-800 rounded-lg shadow-lg z-50">
                    <div className="p-3 border-b border-gray-800 flex justify-between items-center">
                      <h3 className="font-medium text-gray-200">Notifications</h3>
                      <button 
                        type="button"
                        onClick={markAllAsRead}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Mark all as read
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map(notification => (
                          <div 
                            key={notification.id} 
                            className={`p-3 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                              notification.read ? 'opacity-60' : ''
                            }`}
                          >
                            <p className="text-sm text-gray-200">{notification.text}</p>
                            <p className="text-xs text-gray-400 mt-1">Just now</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-gray-400">
                          No notifications
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center px-4 py-2 rounded-lg text-gray-200 hover:bg-gray-800 transition-all duration-200"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-[#0f1117] p-6">
          <div className="max-w-6xl mx-auto px-4">
            <div className="bg-[#1a1f2d] rounded-lg border border-gray-800">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 