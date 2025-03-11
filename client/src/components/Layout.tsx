import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  HomeIcon,
  UsersIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
            <div className="w-8 h-8 rounded-lg bg-platform-primary flex items-center justify-center">
              <span className="text-white font-bold text-xl">P</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-platform-primary to-platform-secondary bg-clip-text text-transparent">
              Platform
            </h1>
          </div>
          <button
            className="lg:hidden text-platform-muted hover:text-platform-light transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <nav className="mt-6 px-3 space-y-1">
          <NavLink to="/dashboard" icon={HomeIcon}>
            Dashboard
          </NavLink>
          {isAdmin() && (
            <NavLink to="/users" icon={UsersIcon}>
              Users
            </NavLink>
          )}
        </nav>
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
              <span className="text-platform-light font-medium">
                Welcome, <span className="text-platform-primary">{user?.username}</span>
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 rounded-lg text-platform-light hover:bg-platform-surface-light transition-all duration-200"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </button>
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