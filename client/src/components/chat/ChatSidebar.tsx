import React from 'react';
import { ChatSession } from '../../types';
import { format } from 'date-fns';
import { 
  PlusIcon, 
  TrashIcon, 
  ChevronDownIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';

interface TimeGroup {
  label: string;
  sessions: ChatSession[];
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  expandedGroups: Record<string, boolean>;
  loadingSessions: boolean;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string, event?: React.MouseEvent) => void;
  onToggleGroup: (groupLabel: string) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  sessions,
  activeSessionId,
  expandedGroups,
  loadingSessions,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onToggleGroup
}) => {
  // Group sessions by time
  const groupSessionsByTime = (sessions: ChatSession[]): TimeGroup[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    const lastMonthStart = new Date(today);
    lastMonthStart.setDate(lastMonthStart.getDate() - 30);
    
    const groups: TimeGroup[] = [
      { label: 'Today', sessions: [] },
      { label: 'Yesterday', sessions: [] },
      { label: 'Previous 7 Days', sessions: [] },
      { label: 'Previous 30 Days', sessions: [] },
      { label: 'Older', sessions: [] }
    ];
    
    sessions.forEach(session => {
      const lastMessageDate = new Date(session.last_message_timestamp);
      
      if (lastMessageDate >= today) {
        groups[0].sessions.push(session);
      } else if (lastMessageDate >= yesterday) {
        groups[1].sessions.push(session);
      } else if (lastMessageDate >= lastWeekStart) {
        groups[2].sessions.push(session);
      } else if (lastMessageDate >= lastMonthStart) {
        groups[3].sessions.push(session);
      } else {
        groups[4].sessions.push(session);
      }
    });
    
    // Remove empty groups
    return groups.filter(group => group.sessions.length > 0);
  };

  const groupedSessions = groupSessionsByTime(sessions);

  return (
    <div className="h-full w-full overflow-hidden">
      <div className="p-4">
        <button
          onClick={onCreateSession}
          className="w-full py-2 px-3 rounded-lg flex items-center justify-center transition-colors"
          style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
          }}
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          New Chat
        </button>
      </div>
      
      {loadingSessions ? (
        <div className="p-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
          Loading sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="p-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
          No chat history yet
        </div>
      ) : (
        <div className="overflow-y-auto h-[calc(100%-80px)]">
          {groupedSessions.map(group => (
            <div key={group.label} className="mb-2">
              {/* Group header */}
              <div 
                className="px-4 py-2 flex items-center justify-between cursor-pointer transition-colors hover:bg-opacity-50 hover:bg-gray-500 group"
                onClick={() => onToggleGroup(group.label)}
                style={{
                  backgroundColor: expandedGroups[group.label] ? 
                    'var(--color-surface)' : 'var(--color-surface-dark)',
                  color: 'var(--color-text-secondary)',
                  borderTop: '1px solid var(--color-border-subtle)',
                  borderBottom: expandedGroups[group.label] ? 
                    '1px solid var(--color-border-subtle)' : 'none'
                }}
              >
                <div className="flex items-center">
                  <CalendarDaysIcon className="w-4 h-4 mr-2 group-hover:text-primary-theme transition-colors" />
                  <span className="text-sm font-medium group-hover:text-primary-theme transition-colors">{group.label}</span>
                </div>
                <div className="transition-transform duration-200" style={{
                  transform: expandedGroups[group.label] ? 'rotate(0deg)' : 'rotate(-90deg)'
                }}>
                  <ChevronDownIcon className="w-4 h-4 group-hover:text-primary-theme transition-colors" />
                </div>
              </div>
              
              {/* Group sessions */}
              {expandedGroups[group.label] && group.sessions.map(session => (
                <div 
                  key={session.id} 
                  onClick={() => onSelectSession(session.id)}
                  className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-all duration-200 mb-1 rounded-lg mx-1 group hover:translate-x-1 ${
                    activeSessionId === session.id ? 'hover:translate-x-0' : ''
                  }`}
                  style={{
                    backgroundColor: activeSessionId === session.id ? 
                      'var(--color-primary-translucent)' : 'var(--color-surface-light)',
                    borderLeft: activeSessionId === session.id ? 
                      '3px solid var(--color-primary)' : '3px solid transparent',
                    color: 'var(--color-text)',
                    boxShadow: activeSessionId === session.id ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  <div className="truncate flex-1">
                    <div className={`text-sm font-medium truncate ${
                      activeSessionId === session.id ? '' : 'group-hover:text-primary-theme'
                    }`}>
                      {session.title}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(session.last_message_timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <button
                    onClick={(e) => onDeleteSession(session.id, e)}
                    className="p-1 rounded-full hover:bg-opacity-20 hover:bg-gray-500 opacity-0 group-hover:opacity-100 transition-all"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatSidebar; 