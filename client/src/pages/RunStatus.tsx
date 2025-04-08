import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserIcon,
  CalendarIcon,
  DocumentTextIcon,
  ChartPieIcon,
  TableCellsIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import runService, { Run, RunStep } from '../services/runService';
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

// Mock data for demonstration
const mockRuns: Run[] = [
  {
    id: '1',
    name: 'Data Processing Pipeline',
    userId: 1,
    username: 'admin',
    status: 'completed',
    progress: 100,
    startTime: new Date(Date.now() - 3600000 * 5),
    endTime: new Date(Date.now() - 3600000 * 3),
    type: 'Timing',
    description: 'Monthly data processing for analytics dashboard',
    steps: [
      {
        id: 's1',
        name: 'Data Extraction',
        status: 'completed',
        startTime: new Date(Date.now() - 3600000 * 5),
        endTime: new Date(Date.now() - 3600000 * 4.5),
      },
      {
        id: 's2',
        name: 'Data Transformation',
        status: 'completed',
        startTime: new Date(Date.now() - 3600000 * 4.5),
        endTime: new Date(Date.now() - 3600000 * 3.8),
      },
      {
        id: 's3',
        name: 'Data Loading',
        status: 'completed',
        startTime: new Date(Date.now() - 3600000 * 3.8),
        endTime: new Date(Date.now() - 3600000 * 3),
      }
    ]
  },
  {
    id: '2',
    name: 'Machine Learning Model Training',
    userId: 1,
    username: 'admin',
    status: 'running',
    progress: 65,
    startTime: new Date(Date.now() - 3600000 * 2),
    type: 'QoR',
    description: 'Training new recommendation model',
    steps: [
      {
        id: 's1',
        name: 'Data Preparation',
        status: 'completed',
        startTime: new Date(Date.now() - 3600000 * 2),
        endTime: new Date(Date.now() - 3600000 * 1.5),
      },
      {
        id: 's2',
        name: 'Feature Engineering',
        status: 'completed',
        startTime: new Date(Date.now() - 3600000 * 1.5),
        endTime: new Date(Date.now() - 3600000 * 1),
      },
      {
        id: 's3',
        name: 'Model Training',
        status: 'running',
        startTime: new Date(Date.now() - 3600000 * 1),
      },
      {
        id: 's4',
        name: 'Model Evaluation',
        status: 'pending',
      },
      {
        id: 's5',
        name: 'Model Deployment',
        status: 'pending',
      }
    ]
  },
  {
    id: '3',
    name: 'Data Backup Process',
    userId: 2,
    username: 'user1',
    status: 'failed',
    progress: 33,
    startTime: new Date(Date.now() - 3600000 * 8),
    endTime: new Date(Date.now() - 3600000 * 7.5),
    type: 'DRC',
    description: 'Weekly database backup',
    steps: [
      {
        id: 's1',
        name: 'Database Dump',
        status: 'completed',
        startTime: new Date(Date.now() - 3600000 * 8),
        endTime: new Date(Date.now() - 3600000 * 7.8),
      },
      {
        id: 's2',
        name: 'Compression',
        status: 'failed',
        startTime: new Date(Date.now() - 3600000 * 7.8),
        endTime: new Date(Date.now() - 3600000 * 7.5),
        errorMessage: 'Insufficient disk space for compression operation',
      },
      {
        id: 's3',
        name: 'Upload to Cloud Storage',
        status: 'pending',
      }
    ]
  },
  {
    id: '4',
    name: 'Report Generation',
    userId: 3,
    username: 'user2',
    status: 'paused',
    progress: 50,
    startTime: new Date(Date.now() - 3600000 * 4),
    type: 'Timing',
    description: 'Monthly financial reports',
    steps: [
      {
        id: 's1',
        name: 'Data Collection',
        status: 'completed',
        startTime: new Date(Date.now() - 3600000 * 4),
        endTime: new Date(Date.now() - 3600000 * 3.5),
      },
      {
        id: 's2',
        name: 'Data Analysis',
        status: 'warning',
        startTime: new Date(Date.now() - 3600000 * 3.5),
        endTime: new Date(Date.now() - 3600000 * 3),
        errorMessage: 'Some data points are missing, but process continued',
      },
      {
        id: 's3',
        name: 'Report Generation',
        status: 'pending',
      }
    ]
  }
];

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

  // Actual users instead of mock data
  const actualUsers: User[] = [
    { id: 1, username: 'yaswanth', name: 'Yaswanth', role: 'admin' },
    { id: 2, username: 'rohan', name: 'Rohan', role: 'user' },
  ];

  // Fetch users if admin
  useEffect(() => {
    if (isAdmin()) {
      // In a real app, this would be an API call
      // For now, use our actual users list
      setUsers(actualUsers);
    }
  }, [isAdmin]);

  // Fetch runs data
  useEffect(() => {
    const fetchRuns = async () => {
      setLoading(true);
      try {
        let fetchedRuns;
        if (isAdmin()) {
          if (selectedUserId) {
            fetchedRuns = await runService.getUserRuns(selectedUserId);
            const selectedUserData = actualUsers.find(u => u.id === selectedUserId) || null;
            setSelectedUser(selectedUserData);
          } else {
            fetchedRuns = await runService.getRuns();
            setSelectedUser(null);
          }
        } else if (user?.id) {
          fetchedRuns = await runService.getUserRuns(user.id);
        } else {
          fetchedRuns = [];
        }
        
        // Update username in runs to match our actual users
        fetchedRuns = fetchedRuns.map(run => {
          const actualUser = actualUsers.find(u => u.id === run.userId);
          return {
            ...run,
            username: actualUser ? actualUser.username : run.username
          };
        });
        
        setRuns(fetchedRuns);
      } catch (error) {
        console.error('Error fetching runs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();
  }, [user, isAdmin, selectedUserId]);

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
        return <CheckCircleIcon className="w-5 h-5 text-platform-success" />;
      case 'running':
        return <ArrowPathIcon className="w-5 h-5 text-platform-primary animate-spin" />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5 text-platform-error" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-platform-warning" />;
      case 'paused':
        return <PauseIcon className="w-5 h-5 text-platform-warning" />;
      default:
        return <ClockIcon className="w-5 h-5 text-platform-muted" />;
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return date.toLocaleString();
  };

  const calculateDuration = (start?: Date, end?: Date) => {
    if (!start) return 'N/A';
    const endTime = end || new Date();
    const durationMs = endTime.getTime() - start.getTime();
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    
    return `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;
  };

  // Flow Chart Component
  const FlowChartView = ({ runs }: { runs: Run[] }) => {
    // Group runs by user
    const runsByUser: Record<string, Run[]> = {};
    runs.forEach(run => {
      if (!runsByUser[run.username]) {
        runsByUser[run.username] = [];
      }
      runsByUser[run.username].push(run);
    });

    return (
      <div className="space-y-8">
        {Object.entries(runsByUser).map(([username, userRuns]) => (
          <div key={username} className="bg-platform-dark p-4 rounded-xl shadow-card border border-platform-border">
            <h3 className="text-lg font-semibold text-platform-light mb-4">
              Runs for {username}
            </h3>
            
            <div className="relative">
              {/* Flow chart for each user */}
              {userRuns.map((run, index) => (
                <div key={run.id} className="mb-6 last:mb-0">
                  <div className="flex items-center mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      run.status === 'completed' ? 'bg-platform-success/20 text-platform-success' :
                      run.status === 'running' ? 'bg-platform-primary/20 text-platform-primary' :
                      run.status === 'failed' ? 'bg-platform-error/20 text-platform-error' :
                      run.status === 'paused' ? 'bg-platform-warning/20 text-platform-warning' :
                      'bg-platform-surface text-platform-muted'
                    }`}>
                      {getStatusIcon(run.status)}
                    </div>
                    <div className="ml-3">
                      <h4 className="font-medium text-platform-light">{run.name}</h4>
                      <div className="text-xs text-platform-muted">
                        Started: {formatDate(run.startTime)}
                      </div>
                    </div>
                    <div className="ml-auto">
                      <button 
                        onClick={() => toggleRunExpansion(run.id)}
                        className="text-platform-primary hover:text-platform-secondary transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                  
                  {/* Flow chart of steps */}
                  {expandedRun === run.id && (
                    <div className="ml-4 pl-8 border-l-2 border-platform-border">
                      {run.steps.map((step, stepIndex) => (
                        <div key={step.id} className="relative mb-4 last:mb-0">
                          <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-platform-border"></div>
                          <div className="flex items-center">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              step.status === 'completed' ? 'bg-platform-success/20 text-platform-success' :
                              step.status === 'running' ? 'bg-platform-primary/20 text-platform-primary' :
                              step.status === 'failed' ? 'bg-platform-error/20 text-platform-error' :
                              step.status === 'warning' ? 'bg-platform-warning/20 text-platform-warning' :
                              'bg-platform-surface text-platform-muted'
                            }`}>
                              {getStatusIcon(step.status)}
                            </div>
                            <div className="ml-3 bg-platform-surface p-2 rounded-lg flex-1">
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-platform-light">{step.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  step.status === 'completed' ? 'bg-platform-success/20 text-platform-success' :
                                  step.status === 'running' ? 'bg-platform-primary/20 text-platform-primary' :
                                  step.status === 'failed' ? 'bg-platform-error/20 text-platform-error' :
                                  step.status === 'warning' ? 'bg-platform-warning/20 text-platform-warning' :
                                  'bg-platform-surface-light text-platform-muted'
                                }`}>
                                  {step.status}
                                </span>
                              </div>
                              {step.startTime && (
                                <div className="text-xs text-platform-muted mt-1">
                                  Duration: {calculateDuration(step.startTime, step.endTime)}
                                </div>
                              )}
                              {step.errorMessage && (
                                <div className="mt-1 text-xs text-platform-error">
                                  {step.errorMessage}
                                </div>
                              )}
                            </div>
                          </div>
                          {stepIndex < run.steps.length - 1 && (
                            <div className="absolute left-3 top-6 bottom-0 w-0.5 h-4 bg-platform-border"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Waffle Diagram Component
  const WaffleDiagramView = ({ runs }: { runs: Run[] }) => {
    // Group runs by user and status
    const runsByUserAndStatus: Record<string, Record<string, number>> = {};
    
    runs.forEach(run => {
      if (!runsByUserAndStatus[run.username]) {
        runsByUserAndStatus[run.username] = {
          completed: 0,
          running: 0,
          failed: 0,
          paused: 0,
          pending: 0
        };
      }
      runsByUserAndStatus[run.username][run.status]++;
    });

    return (
      <div className="space-y-8">
        {Object.entries(runsByUserAndStatus).map(([username, statuses]) => (
          <div key={username} className="bg-platform-dark p-4 rounded-xl shadow-card border border-platform-border">
            <h3 className="text-lg font-semibold text-platform-light mb-4">
              {username}'s Run Status
            </h3>
            
            <div className="grid grid-cols-5 gap-4">
              {Object.entries(statuses).map(([status, count]) => (
                count > 0 && (
                  <div key={status} className="text-center">
                    <div className="relative">
                      <div className={`w-full aspect-square rounded-lg flex items-center justify-center text-2xl font-bold ${
                        status === 'completed' ? 'bg-platform-success/20 text-platform-success' :
                        status === 'running' ? 'bg-platform-primary/20 text-platform-primary' :
                        status === 'failed' ? 'bg-platform-error/20 text-platform-error' :
                        status === 'paused' ? 'bg-platform-warning/20 text-platform-warning' :
                        'bg-platform-surface text-platform-muted'
                      }`}>
                        {count}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-platform-light capitalize">{status}</div>
                  </div>
                )
              ))}
            </div>
            
            <div className="mt-4 grid grid-cols-3 gap-3">
              {runs.filter(run => run.username === username).map(run => (
                <div 
                  key={run.id}
                  className={`p-3 rounded-lg border ${
                    run.status === 'completed' ? 'border-platform-success/30 bg-platform-success/10' :
                    run.status === 'running' ? 'border-platform-primary/30 bg-platform-primary/10' :
                    run.status === 'failed' ? 'border-platform-error/30 bg-platform-error/10' :
                    run.status === 'paused' ? 'border-platform-warning/30 bg-platform-warning/10' :
                    'border-platform-border bg-platform-surface'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      run.status === 'completed' ? 'bg-platform-success/20 text-platform-success' :
                      run.status === 'running' ? 'bg-platform-primary/20 text-platform-primary' :
                      run.status === 'failed' ? 'bg-platform-error/20 text-platform-error' :
                      run.status === 'paused' ? 'bg-platform-warning/20 text-platform-warning' :
                      'bg-platform-surface text-platform-muted'
                    }`}>
                      {getStatusIcon(run.status)}
                    </div>
                    <div className="ml-3">
                      <div className="text-platform-light font-medium">{run.name}</div>
                      <div className="text-platform-muted text-xs">{run.type}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-platform-muted">
                    Started: {formatDate(run.startTime)}
                  </div>
                  <div className="mt-1 flex justify-between items-center">
                    <div className="text-xs text-platform-muted">
                      Progress: {run.progress}%
                    </div>
                    <button 
                      onClick={() => toggleRunExpansion(run.id)}
                      className="text-xs text-platform-primary hover:text-platform-secondary transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-platform-primary/20 to-platform-secondary/20 p-6 rounded-xl shadow-card">
        <h2 className="text-2xl font-bold text-platform-light mb-2">
          {selectedUser ? `${selectedUser.name}'s Run Status` : 'Physical Design Run Status'}
        </h2>
        <p className="text-platform-muted">
          {isAdmin() 
            ? selectedUser 
              ? `Viewing run status for ${selectedUser.name}`
              : 'Monitor and manage IC design runs across the platform' 
            : 'Track the status of your IC design runs'}
        </p>
      </div>

      {/* User selection for admins */}
      {isAdmin() && (
        <div className="bg-platform-dark p-4 rounded-xl shadow-card border border-platform-border">
          <h3 className="text-lg font-semibold text-platform-light mb-3">Select User</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div 
              onClick={() => setSelectedUserId(null)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedUserId === null 
                  ? 'border-platform-primary bg-platform-primary/10' 
                  : 'border-platform-border bg-platform-surface hover:bg-platform-surface-light'
              }`}
            >
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-platform-primary/20 flex items-center justify-center text-platform-primary">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="ml-3">
                  <div className="text-platform-light font-medium">All Users</div>
                  <div className="text-platform-muted text-xs">View runs from all users</div>
                </div>
              </div>
            </div>
            
            {actualUsers.map(u => (
              <div 
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedUserId === u.id 
                    ? 'border-platform-primary bg-platform-primary/10' 
                    : 'border-platform-border bg-platform-surface hover:bg-platform-surface-light'
                }`}
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-platform-primary/20 flex items-center justify-center text-platform-primary font-semibold">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <div className="text-platform-light font-medium">{u.name}</div>
                    <div className="text-platform-muted text-xs">{u.username}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters and view toggle */}
      <div className="bg-platform-dark p-4 rounded-xl shadow-card border border-platform-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-platform-light">
            {selectedUser ? `Runs for ${selectedUser.name}` : 'All Runs'}
          </h3>
          
          <div className="flex space-x-2 mt-2 md:mt-0">
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === 'list' 
                  ? 'bg-platform-primary text-white' 
                  : 'bg-platform-surface text-platform-muted hover:text-platform-light'
              }`}
            >
              <TableCellsIcon className="w-4 h-4 mr-2" />
              List View
            </button>
            <button 
              onClick={() => setViewMode('flow')}
              className={`flex items-center px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === 'flow' 
                  ? 'bg-platform-primary text-white' 
                  : 'bg-platform-surface text-platform-muted hover:text-platform-light'
              }`}
            >
              <ChartPieIcon className="w-4 h-4 mr-2" />
              Flow View
            </button>
            <button 
              onClick={() => setViewMode('waffle')}
              className={`flex items-center px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === 'waffle' 
                  ? 'bg-platform-primary text-white' 
                  : 'bg-platform-surface text-platform-muted hover:text-platform-light'
              }`}
            >
              <DocumentTextIcon className="w-4 h-4 mr-2" />
              Waffle View
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm text-platform-muted mb-1">Search</label>
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search runs..."
              className="w-full bg-platform-surface border border-platform-border rounded-lg px-3 py-2 text-platform-light placeholder-platform-muted"
            />
          </div>
          <div>
            <label htmlFor="type" className="block text-sm text-platform-muted mb-1">Run Type</label>
            <select
              id="type"
              value={selectedRunType || ''}
              onChange={(e) => setSelectedRunType(e.target.value || null)}
              className="w-full bg-platform-surface border border-platform-border rounded-lg px-3 py-2 text-platform-light"
            >
              <option value="">All Types</option>
              <option value="Timing">Timing</option>
              <option value="QoR">QoR</option>
              <option value="DRC">DRC</option>
            </select>
          </div>
          <div>
            <label htmlFor="status" className="block text-sm text-platform-muted mb-1">Status</label>
            <select
              id="status"
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus(e.target.value || null)}
              className="w-full bg-platform-surface border border-platform-border rounded-lg px-3 py-2 text-platform-light"
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
              className="px-4 py-2 bg-platform-surface hover:bg-platform-surface-light text-platform-light rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Run list or flow view */}
      {loading ? (
        <div className="bg-platform-dark p-8 rounded-xl shadow-card border border-platform-border flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-platform-primary/30 border-t-platform-primary rounded-full animate-spin"></div>
            <p className="mt-4 text-platform-light">Loading runs...</p>
          </div>
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="bg-platform-dark p-8 rounded-xl shadow-card border border-platform-border text-center">
          <p className="text-platform-muted">No runs found matching your criteria</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-4">
          {/* List view */}
          {filteredRuns.map(run => (
            <div key={run.id} className="bg-platform-dark rounded-xl shadow-card border border-platform-border overflow-hidden">
              {/* Run header */}
              <div 
                className="p-4 cursor-pointer hover:bg-platform-surface-light transition-colors"
                onClick={() => toggleRunExpansion(run.id)}
              >
                {/* Run header content */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      run.status === 'completed' ? 'bg-platform-success/20 text-platform-success' :
                      run.status === 'running' ? 'bg-platform-primary/20 text-platform-primary' :
                      run.status === 'failed' ? 'bg-platform-error/20 text-platform-error' :
                      run.status === 'paused' ? 'bg-platform-warning/20 text-platform-warning' :
                      'bg-platform-surface text-platform-muted'
                    }`}>
                      {getStatusIcon(run.status)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-platform-light">{run.name}</h3>
                      <div className="flex items-center text-sm text-platform-muted">
                        <UserIcon className="w-4 h-4 mr-1" />
                        <span>{run.username}</span>
                        <span className="mx-2">•</span>
                        <span>{run.type}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div>
                      <div className="text-right text-sm text-platform-muted mb-1">Progress</div>
                      <div className="w-32 h-2 bg-platform-border rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            run.status === 'completed' ? 'bg-platform-success' :
                            run.status === 'failed' ? 'bg-platform-error' :
                            run.status === 'paused' ? 'bg-platform-warning' :
                            'bg-platform-primary'
                          }`}
                          style={{ width: `${run.progress}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <button className="p-2 rounded-full hover:bg-platform-surface text-platform-muted hover:text-platform-light transition-colors">
                      {expandedRun === run.id ? (
                        <ChevronUpIcon className="w-5 h-5" />
                      ) : (
                        <ChevronDownIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Expanded run details */}
              {expandedRun === run.id && (
                <div className="p-4 border-t border-platform-border bg-platform-surface">
                  {/* Run details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <h4 className="text-sm text-platform-muted mb-1">Description</h4>
                      <p className="text-platform-light">{run.description || 'No description provided'}</p>
                    </div>
                    <div>
                      <h4 className="text-sm text-platform-muted mb-1">Duration</h4>
                      <p className="text-platform-light">{calculateDuration(run.startTime, run.endTime)}</p>
                    </div>
                    <div>
                      <h4 className="text-sm text-platform-muted mb-1">Status</h4>
                      <div className="flex items-center">
                        {getStatusIcon(run.status)}
                        <span className="ml-2 text-platform-light capitalize">{run.status}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Flow chart of steps */}
                  <h4 className="text-sm font-medium text-platform-light mb-3">Process Flow</h4>
                  <div className="relative pb-6">
                    {/* Connecting line */}
                    <div className="absolute left-6 top-6 bottom-0 w-0.5 bg-platform-border"></div>
                    
                    {/* Steps */}
                    <div className="space-y-4">
                      {run.steps.map((step, index) => (
                        <div key={step.id} className="relative flex items-start">
                          <div className={`z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                            step.status === 'completed' ? 'bg-platform-success/20 text-platform-success' :
                            step.status === 'running' ? 'bg-platform-primary/20 text-platform-primary' :
                            step.status === 'failed' ? 'bg-platform-error/20 text-platform-error' :
                            step.status === 'warning' ? 'bg-platform-warning/20 text-platform-warning' :
                            'bg-platform-surface text-platform-muted'
                          }`}>
                            {getStatusIcon(step.status)}
                          </div>
                          <div className="ml-4 flex-1">
                            <div className="bg-platform-surface-light p-3 rounded-lg">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h5 className="font-medium text-platform-light">{step.name}</h5>
                                  <div className="text-xs text-platform-muted mt-1">
                                    {step.startTime && (
                                      <div className="flex items-center">
                                        <ClockIcon className="w-3 h-3 mr-1" />
                                        <span>Started: {formatDate(step.startTime)}</span>
                                      </div>
                                    )}
                                    {step.endTime && (
                                      <div className="flex items-center mt-0.5">
                                        <ClockIcon className="w-3 h-3 mr-1" />
                                        <span>Completed: {formatDate(step.endTime)}</span>
                                      </div>
                                    )}
                                    {step.startTime && (
                                      <div className="flex items-center mt-0.5">
                                        <ClockIcon className="w-3 h-3 mr-1" />
                                        <span>Duration: {calculateDuration(step.startTime, step.endTime)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    step.status === 'completed' ? 'bg-platform-success/20 text-platform-success' :
                                    step.status === 'running' ? 'bg-platform-primary/20 text-platform-primary' :
                                    step.status === 'failed' ? 'bg-platform-error/20 text-platform-error' :
                                    step.status === 'warning' ? 'bg-platform-warning/20 text-platform-warning' :
                                    'bg-platform-surface-light text-platform-muted'
                                  }`}>
                                    {step.status}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Error message if any */}
                              {step.errorMessage && (
                                <div className="mt-2 p-2 bg-platform-error/10 border border-platform-error/20 rounded text-sm text-platform-error">
                                  {step.errorMessage}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex justify-end space-x-3 mt-4 border-t border-platform-border pt-4">
                    {run.status === 'running' && (
                      <button className="flex items-center px-3 py-1.5 bg-platform-surface hover:bg-platform-surface-light text-platform-light rounded-lg transition-colors">
                        <PauseIcon className="w-4 h-4 mr-2" />
                        Pause
                      </button>
                    )}
                    {run.status === 'paused' && (
                      <button className="flex items-center px-3 py-1.5 bg-platform-surface hover:bg-platform-surface-light text-platform-light rounded-lg transition-colors">
                        <PlayIcon className="w-4 h-4 mr-2" />
                        Resume
                      </button>
                    )}
                    {(run.status === 'running' || run.status === 'paused') && (
                      <button className="flex items-center px-3 py-1.5 bg-platform-error/20 hover:bg-platform-error/30 text-platform-error rounded-lg transition-colors">
                        <StopIcon className="w-4 h-4 mr-2" />
                        Stop
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : viewMode === 'flow' ? (
        <FlowChartView runs={filteredRuns} />
      ) : (
        <WaffleDiagramView runs={filteredRuns} />
      )}
    </div>
  );
} 