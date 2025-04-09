import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  XMarkIcon,
  PlayIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/outline';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  user: any;
  isAdmin: () => boolean;
}

interface NavLinkProps {
  to: string;
  icon: React.ElementType;
  children: React.ReactNode;
  onClick?: () => void;
  collapsed?: boolean;
}

const NavLink: React.FC<NavLinkProps> = ({ to, icon: Icon, children, onClick, collapsed }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center px-4 py-3 text-gray-300 rounded-lg transition-all duration-200 group
        ${isActive ? 'bg-blue-500/10 text-blue-400 font-medium' : 'hover:bg-gray-800/60'}
        ${collapsed ? 'justify-center' : ''}`}
      onClick={onClick}
    >
      <Icon className={`w-5 h-5 ${collapsed ? '' : 'mr-3'}`} />
      {!collapsed && <span>{children}</span>}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-gray-200 text-sm rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transform -translate-x-2 group-hover:translate-x-0 transition-all duration-200">
          {children}
        </div>
      )}
    </Link>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onToggle, user, isAdmin }) => {
  const isLargeScreen = window.innerWidth >= 1024;

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && !isLargeScreen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-y-0 left-0 bg-[#1a1f2d] border-r border-gray-800 transform transition-all duration-300 ease-in-out z-30 
          ${isOpen ? 'w-64' : 'w-0 lg:w-16'} overflow-hidden`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
          <div className={`flex items-center space-x-3 ${!isOpen && 'lg:hidden'}`}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xl">P</span>
            </div>
            <h1 className="text-xl font-bold text-white whitespace-nowrap">
              Pinnacleflow
            </h1>
          </div>
          {isLargeScreen && (
            <button
              type="button"
              className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-800"
              onClick={onToggle}
              aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isOpen ? (
                <ChevronDoubleLeftIcon className="w-5 h-5" />
              ) : (
                <ChevronDoubleRightIcon className="w-5 h-5" />
              )}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-2 space-y-1">
          <NavLink to="/dashboard" icon={HomeIcon} collapsed={!isOpen} onClick={() => !isLargeScreen && onClose()}>
            Dashboard
          </NavLink>
          <NavLink to="/runs" icon={PlayIcon} collapsed={!isOpen} onClick={() => !isLargeScreen && onClose()}>
            Run Status
          </NavLink>
          <NavLink to="/chatbot" icon={ChatBubbleLeftRightIcon} collapsed={!isOpen} onClick={() => !isLargeScreen && onClose()}>
            Chatbot
          </NavLink>
          {isAdmin && isAdmin() && (
            <NavLink to="/users" icon={UsersIcon} collapsed={!isOpen} onClick={() => !isLargeScreen && onClose()}>
              Users
            </NavLink>
          )}
          <div className="pt-4 mt-4 border-t border-gray-800">
            <NavLink to="/settings" icon={Cog6ToothIcon} collapsed={!isOpen} onClick={() => !isLargeScreen && onClose()}>
              Settings
            </NavLink>
          </div>
        </nav>

        {/* Version */}
        {isOpen && (
          <div className="absolute bottom-0 left-0 right-0 p-4 text-xs text-gray-500 text-center">
            Version 1.0.0
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar; 