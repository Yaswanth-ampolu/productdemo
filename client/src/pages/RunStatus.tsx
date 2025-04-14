import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PauseIcon,
  TableCellsIcon,
  ChartPieIcon,
  DocumentTextIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import runService from '../services/runService';
import userService from '../services/userService';

// Types for our run data
interface RunStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'warning';
  startTime?: Date;
  endTime?: Date;
  logs?: string[];
  errorMessage?: string;
}

interface Run {
  id: string;
  name: string;
  userId: number;
  username: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  startTime: Date;
  endTime?: Date;
  steps: RunStep[];
  description?: string;
  type: string;
}

// Add user type
interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

export default function RunStatus() {
  const { user, isAdmin } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [selectedRunType, setSelectedRunType] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'flow' | 'waffle'>('list');

  // Fetch users if admin
  useEffect(() => {
    const fetchUsers = async () => {
      if (isAdmin()) {
        try {
          const fetchedUsers = await userService.getUsers();
          setUsers(fetchedUsers);
        } catch (error) {
          console.error('Error fetching users:', error);
        }
      }
    };
    
    fetchUsers();
  }, [isAdmin]);

  // Fetch runs data
  useEffect(() => {
    const fetchRuns = async () => {
      setLoading(true);
      try {
        let fetchedRuns: Run[] = [];
        
        if (isAdmin()) {
          if (selectedUserId) {
            fetchedRuns = await runService.getUserRuns(selectedUserId);
            const selectedUserData = users.find(u => u.id === selectedUserId) || null;
            setSelectedUser(selectedUserData);
          } else {
            fetchedRuns = await runService.getRuns();
            setSelectedUser(null);
          }
        } else if (user?.id) {
          fetchedRuns = await runService.getUserRuns(user.id);
        }
        
        setRuns(fetchedRuns);
      } catch (error) {
        console.error('Error fetching runs:', error);
        setRuns([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();
  }, [user, isAdmin, selectedUserId, users]);

  // Filter runs based on selected filters and search term
  const filteredRuns = runs.filter(run => {
    const matchesType = selectedRunType ? run.type === selectedRunType : true;
    const matchesStatus = selectedStatus ? run.status === selectedStatus : true;
    const matchesSearch = searchTerm 
      ? run.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.username.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    
    return matchesType && matchesStatus && matchesSearch;
  });

  const toggleRunExpansion = (runId: string) => {
    setExpandedRun(expandedRun === runId ? null : runId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5" style={{ color: 'var(--color-success)' }} />;
      case 'running':
        return <ArrowPathIcon className="w-5 h-5 animate-spin" style={{ color: 'var(--color-primary)' }} />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5" style={{ color: 'var(--color-error)' }} />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />;
      case 'paused':
        return <PauseIcon className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />;
      default:
        return <ClockIcon className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />;
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const calculateDuration = (start?: Date, end?: Date) => {
    if (!start) return 'N/A';
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    
    return `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl shadow-card" style={{ 
        background: 'linear-gradient(to right, var(--color-primary-dark)20, var(--color-secondary-dark)20)'
      }}>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          {selectedUser ? `${selectedUser.name}'s Run Status` : 'Physical Design Run Status'}
        </h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          {isAdmin() 
            ? selectedUser 
              ? `Viewing run status for ${selectedUser.name}`
              : 'Monitor and manage IC design runs across the platform' 
            : 'Track the status of your IC design runs'}
        </p>
      </div>

      {/* User selection for admins */}
      {isAdmin() && users.length > 0 && (
        <div className="p-4 rounded-xl shadow-card border" style={{ 
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)'
        }}>
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Select User</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div 
              onClick={() => setSelectedUserId(null)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedUserId === null 
                  ? 'border-primary-theme bg-platform-primary/10' 
                  : 'hover:bg-platform-surface-light'
              }`}
              style={{ 
                borderColor: selectedUserId === null ? 'var(--color-primary)' : 'var(--color-border)',
                backgroundColor: selectedUserId === null ? 'var(--color-primary)10' : 'var(--color-surface)',
              }}
            >
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{
                  backgroundColor: 'var(--color-primary)20',
                  color: 'var(--color-primary)'
                }}>
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="ml-3">
                  <div className="font-medium" style={{ color: 'var(--color-text)' }}>All Users</div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>View runs from all users</div>
                </div>
              </div>
            </div>
            
            {users.map(u => (
              <div 
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedUserId === u.id 
                    ? 'border-primary-theme bg-platform-primary/10' 
                    : 'hover:bg-platform-surface-light'
                }`}
                style={{ 
                  borderColor: selectedUserId === u.id ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: selectedUserId === u.id ? 'var(--color-primary)10' : 'var(--color-surface)',
                }}
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold" style={{
                    backgroundColor: 'var(--color-primary)20',
                    color: 'var(--color-primary)'
                  }}>
                    {u.name ? u.name.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <div className="font-medium" style={{ color: 'var(--color-text)' }}>{u.name || u.username}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{u.username}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters and view toggle */}
      <div className="p-4 rounded-xl shadow-card border" style={{ 
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)'
      }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {selectedUser ? `Runs for ${selectedUser.name}` : 'All Runs'}
          </h3>
          
          <div className="flex space-x-2 mt-2 md:mt-0">
            <button 
              onClick={() => setViewMode('list')}
              className="flex items-center px-3 py-1.5 rounded-lg transition-colors"
              style={{ 
                backgroundColor: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-surface-dark)',
                color: viewMode === 'list' ? 'white' : 'var(--color-text-muted)'
              }}
            >
              <TableCellsIcon className="w-4 h-4 mr-2" />
              List View
            </button>
            <button 
              onClick={() => setViewMode('flow')}
              className="flex items-center px-3 py-1.5 rounded-lg transition-colors"
              style={{ 
                backgroundColor: viewMode === 'flow' ? 'var(--color-primary)' : 'var(--color-surface-dark)',
                color: viewMode === 'flow' ? 'white' : 'var(--color-text-muted)'
              }}
            >
              <ChartPieIcon className="w-4 h-4 mr-2" />
              Flow View
            </button>
            <button 
              onClick={() => setViewMode('waffle')}
              className="flex items-center px-3 py-1.5 rounded-lg transition-colors"
              style={{ 
                backgroundColor: viewMode === 'waffle' ? 'var(--color-primary)' : 'var(--color-surface-dark)',
                color: viewMode === 'waffle' ? 'white' : 'var(--color-text-muted)'
              }}
            >
              <DocumentTextIcon className="w-4 h-4 mr-2" />
              Waffle View
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Search</label>
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search runs..."
              className="w-full rounded-lg px-3 py-2"
              style={{
                backgroundColor: 'var(--color-surface-dark)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)'
              }}
            />
          </div>
          <div>
            <label htmlFor="type" className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Run Type</label>
            <select
              id="type"
              value={selectedRunType || ''}
              onChange={(e) => setSelectedRunType(e.target.value || null)}
              className="w-full rounded-lg px-3 py-2"
              style={{
                backgroundColor: 'var(--color-surface-dark)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)'
              }}
            >
              <option value="">All Types</option>
              <option value="Timing">Timing</option>
              <option value="QoR">QoR</option>
              <option value="DRC">DRC</option>
            </select>
          </div>
          <div>
            <label htmlFor="status" className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Status</label>
            <select
              id="status"
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus(e.target.value || null)}
              className="w-full rounded-lg px-3 py-2"
              style={{
                backgroundColor: 'var(--color-surface-dark)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)'
              }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="paused">Paused</option>
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => {
                setSelectedRunType(null);
                setSelectedStatus(null);
                setSearchTerm('');
              }}
              className="px-4 py-2 rounded-lg transition-colors hover:bg-opacity-10 hover:bg-gray-500"
              style={{
                backgroundColor: 'var(--color-surface-dark)',
                color: 'var(--color-text)'
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Run list */}
      {loading ? (
        <div className="p-8 rounded-xl shadow-card border flex items-center justify-center" style={{ 
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)'
        }}>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full animate-spin" style={{
              borderWidth: '4px',
              borderStyle: 'solid',
              borderColor: 'var(--color-primary)30',
              borderTopColor: 'var(--color-primary)'
            }}></div>
            <p className="mt-4" style={{ color: 'var(--color-text)' }}>Loading runs...</p>
          </div>
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="p-8 rounded-xl shadow-card border text-center" style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-muted)'
        }}>
          <p>No runs found. The run feature will be available soon.</p>
        </div>
      ) : (
        <div className="p-8 rounded-xl shadow-card border text-center" style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-muted)'
        }}>
          <p>Run status feature is coming soon.</p>
        </div>
      )}
    </div>
  );
} 