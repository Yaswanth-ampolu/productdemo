import { useState } from 'react';
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
        className={`flex items-center px-4 py-2 text-gray-300 hover:bg-grafana-secondary transition-colors ${
          isActive ? 'bg-grafana-secondary text-white' : ''
        }`}
        onClick={() => setIsSidebarOpen(false)}
      >
        <Icon className="w-5 h-5 mr-2" />
        {children}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-grafana-darker">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-grafana-dark border-r border-gray-800 transform transition-transform duration-200 ease-in-out z-30 lg:transform-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <button
            className="lg:hidden text-gray-300 hover:text-white"
            onClick={() => setIsSidebarOpen(false)}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <nav className="mt-4">
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
        <header className="h-16 bg-grafana-dark border-b border-gray-800">
          <div className="h-full px-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                className="text-gray-300 hover:text-white lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Bars3Icon className="w-6 h-6" />
              </button>
              <span className="text-gray-300 truncate">Welcome, {user?.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center text-gray-300 hover:text-white"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
} 