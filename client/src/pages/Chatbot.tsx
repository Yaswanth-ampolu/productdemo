import React, { useState, useRef, useEffect } from 'react';
import { 
  PaperAirplaneIcon, 
  ArrowPathIcon,
  UserIcon,
  CpuChipIcon,
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CalendarDaysIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/solid';
import { format } from 'date-fns';
import { useCallback, useLayoutEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { chatbotService, ChatMessageResponse } from '../services/chatbotService';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage, ChatSession } from '../types';
import { useSidebar } from '../contexts/SidebarContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Mcp {
  id: number;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
}

interface TimeGroup {
  label: string;
  sessions: ChatSession[];
}

const Chatbot: React.FC = () => {
  const { user } = useAuth();
  const { isExpanded: isMainSidebarExpanded } = useSidebar();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Today': true,
    'Yesterday': true,
    'Previous 7 Days': true,
    'Previous 30 Days': false,
    'Older': false
  });
  const [showMcpSelector, setShowMcpSelector] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const mcpSelectorRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Dummy MCPs for demo purposes
  const [mcps, setMcps] = useState<Mcp[]>([
    {
      id: 1,
      name: "Run Manager",
      description: "Execute and manage IC design runs",
      icon: "ri-cpu-line",
      isActive: true
    },
    {
      id: 2,
      name: "Dashboard",
      description: "Access analytics and dashboard information",
      icon: "ri-bar-chart-line",
      isActive: false
    }
  ]);

  // Get active MCPs
  const activeMcps = mcps.filter(mcp => mcp.isActive);

  // Fetch sessions on component mount
  useEffect(() => {
    fetchSessions();
  }, []);

  // Fetch messages when active session changes
  useEffect(() => {
    if (activeSessionId) {
      fetchSessionMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  // Auto-scroll to bottom of messages when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on session change or component mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  // Focus title input when editing
  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
    }
  }, [editingTitle]);

  // Close MCP selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mcpSelectorRef.current && !mcpSelectorRef.current.contains(event.target as Node)) {
        setShowMcpSelector(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mcpSelectorRef]);

  // Setup infinite scrolling for messages
  useEffect(() => {
    const messagesContainer = messagesContainerRef.current;
    if (!messagesContainer) return;

    const handleScroll = () => {
      if (messagesContainer.scrollTop === 0 && hasMoreMessages && !loadingMessages) {
        loadMoreMessages();
      }
    };

    messagesContainer.addEventListener('scroll', handleScroll);
    return () => messagesContainer.removeEventListener('scroll', handleScroll);
  }, [messagesContainerRef, hasMoreMessages, loadingMessages, activeSessionId, messageOffset]);

  const fetchSessions = async () => {
    try {
      setLoadingSessions(true);
      const fetchedSessions = await chatbotService.getSessions();
      setSessions(fetchedSessions);
      
      // If we have sessions but no active session, select the most recent one
      if (fetchedSessions.length > 0 && !activeSessionId) {
        setActiveSessionId(fetchedSessions[0].id);
        setSessionTitle(fetchedSessions[0].title);
      }
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchSessionMessages = async (sessionId: string, append = false) => {
    try {
      setLoadingMessages(true);
      const offset = append ? messageOffset : 0;
      const response = await chatbotService.getSession(sessionId, 12, offset);
      
      const { messages: fetchedMessages, total } = response;
      setTotalMessages(total);
      setHasMoreMessages(offset + fetchedMessages.length < total);
      
      if (append) {
        // Prepend new messages to existing ones
        setMessages(prev => [...fetchedMessages, ...prev]);
        setMessageOffset(prev => prev + fetchedMessages.length);
      } else {
        // Replace messages
        setMessages(fetchedMessages);
        setMessageOffset(fetchedMessages.length);
      }
      
      // Update session title
      setSessionTitle(response.session.title);
    } catch (error) {
      console.error('Error fetching session messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!activeSessionId || !hasMoreMessages || loadingMessages) return;
    await fetchSessionMessages(activeSessionId, true);
  };

  const createNewSession = async () => {
    try {
      const newSession = await chatbotService.createSession('New Chat');
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setSessionTitle(newSession.title);
      setMessages([]);
      setMessageOffset(0);
      setHasMoreMessages(false);
      setTotalMessages(0);
    } catch (error) {
      console.error('Error creating new session:', error);
    }
  };

  const deleteSession = async (sessionId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    
    if (!confirm('Are you sure you want to delete this chat?')) return;
    
    try {
      await chatbotService.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      // If the deleted session was active, select another one or clear
      if (activeSessionId === sessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          setActiveSessionId(remainingSessions[0].id);
          setSessionTitle(remainingSessions[0].title);
        } else {
          setActiveSessionId(null);
          setSessionTitle('');
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const updateSessionTitle = async () => {
    if (!activeSessionId || !sessionTitle.trim()) return;
    
    try {
      await chatbotService.updateSession(activeSessionId, { title: sessionTitle });
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, title: sessionTitle } : s
      ));
      setEditingTitle(false);
    } catch (error) {
      console.error('Error updating session title:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    // Create a unique ID for this message
    const tempId = `temp-${Date.now()}`;
    
    // Add user message to local state immediately
    const userMessage: ChatMessage = {
      id: tempId,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    
    // Add message to UI immediately
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Send message to backend
      const response = await chatbotService.sendMessage(userMessage.content, activeSessionId || undefined);
      
      // If this creates a new session, update our session info
      if (!activeSessionId || activeSessionId !== response.sessionId) {
        setActiveSessionId(response.sessionId);
        await fetchSessions(); // Refresh sessions to get the new one
      }
      
      // Add AI response to messages
      const aiResponse: ChatMessage = {
        id: response.id,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(response.timestamp),
      };
      
      // Replace the temporary message with a permanent one and add the AI response
      setMessages(prev => {
        // Filter out the temporary message
        const filteredMessages = prev.filter(m => m.id !== tempId);
        // Add the confirmed user message and AI response
        return [...filteredMessages, 
          {...userMessage, id: `user-${Date.now()}`}, 
          aiResponse
        ];
      });
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temporary message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const resetChat = () => {
    if (confirm('Are you sure you want to clear the current chat?')) {
      setMessages([]);
      inputRef.current?.focus();
    }
  };

  const toggleMcp = (mcpId: number) => {
    setMcps(prev => prev.map(mcp => 
      mcp.id === mcpId ? { ...mcp, isActive: !mcp.isActive } : mcp
    ));
  };

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupLabel]: !prev[groupLabel]
    }));
  };

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

  // Determine if chat is empty (for positioning the input)
  const isEmpty = messages.length === 0; 

  // Format message content with code blocks and paragraphs
  const formatMessageContent = (content: string) => {
    if (!content) return null;
    
    const segments = content.split(/(```[\s\S]*?```)/g);

    return (
      <div className="prose prose-sm max-w-none">
        {segments.map((segment, index) => {
          if (segment.startsWith('```') && segment.endsWith('```')) {
            // Extract language and code
            const match = segment.match(/```(?:(\w+))?\n([\s\S]*?)```/);
            const language = match?.[1] || '';
            const code = match?.[2] || '';
            
            return (
              <div key={index} className="rounded-md my-2 overflow-x-auto" style={{ backgroundColor: 'var(--color-surface-dark)' }}>
                <div className="flex items-center justify-between px-4 py-1 text-xs border-b" style={{ 
                  backgroundColor: 'var(--color-surface)', 
                  color: 'var(--color-text-muted)',
                  borderColor: 'var(--color-border)'
                }}>
                  <span>{language || 'Code'}</span>
                  <button className="hover:text-white transition-colors">
                    <i className="ri-clipboard-line"></i>
                  </button>
                </div>
                <pre className="p-4 text-sm overflow-x-auto">
                  <code>{code}</code>
                </pre>
              </div>
            );
          } else {
            // Regular text - split by newlines
            const paragraphs = segment.split('\n').filter(p => p.trim());
            return (
              <div key={index} className="text-content">
                {paragraphs.map((paragraph, pIndex) => {
                  // Check if it's a list item
                  if (paragraph.match(/^\d+\.\s/)) {
                    return <p key={pIndex} className="mb-1">{paragraph}</p>;
                  }
                  // Check if it's a heading
                  if (paragraph.startsWith('# ')) {
                    return <h3 key={pIndex} className="text-lg font-medium mb-2">{paragraph.substring(2)}</h3>;
                  }
                  // Regular paragraph
                  return paragraph ? <p key={pIndex} className="mb-1">{paragraph}</p> : null;
                })}
              </div>
            );
          }
        })}
      </div>
    );
  };

  // Group messages by role
  const groupedMessages = React.useMemo(() => {
    const groups: { role: string; messages: ChatMessage[] }[] = [];
    
    messages.forEach(message => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.role === message.role) {
        lastGroup.messages.push(message);
      } else {
        groups.push({ role: message.role, messages: [message] });
      }
    });
    
    return groups;
  }, [messages]);

  const groupedSessions = React.useMemo(() => {
    return groupSessionsByTime(sessions);
  }, [sessions]);

  return (
    <div className="fixed inset-0 flex flex-col" 
      style={{ 
        backgroundColor: 'var(--color-bg)',
        left: isMainSidebarExpanded ? '64px' : '63px',
        width: isMainSidebarExpanded ? 'calc(100% - 64px)' : 'calc(100% - 50px)'
      }}>
      {/* Chat Header with responsive design */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ 
        backgroundColor: 'var(--color-bg)',
        borderColor: 'transparent',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div className="flex items-center space-x-2">
          {/* Mobile sidebar toggle - Only visible on small screens */}
          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="md:hidden p-1 rounded-md"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {showSidebar ? <XMarkIcon className="w-5 h-5" /> : <ChatBubbleLeftRightIcon className="w-5 h-5" />}
          </button>
          
          {/* Session title or editing field */}
          {editingTitle ? (
            <div className="flex items-center">
              <input
                ref={titleInputRef}
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                onBlur={updateSessionTitle}
                onKeyDown={(e) => e.key === 'Enter' && updateSessionTitle()}
                className="px-2 py-1 rounded-md"
                style={{
                  backgroundColor: 'var(--color-surface-dark)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)'
                }}
              />
              <button
                onClick={updateSessionTitle}
                className="ml-2 p-1 rounded-md"
                style={{ color: 'var(--color-primary)' }}
              >
                <CheckIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <h2 className="text-base md:text-lg font-semibold truncate max-w-[200px] md:max-w-none" style={{ color: 'var(--color-text)' }}>
                {activeSessionId ? sessionTitle : 'New Chat'}
              </h2>
              {activeSessionId && (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="ml-2 p-1 rounded-md hover:bg-opacity-10 hover:bg-gray-500"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {!isEmpty && (
            <button
              onClick={resetChat}
              className="p-1 rounded-md hover:bg-opacity-10 hover:bg-gray-500 transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              title="Clear current chat"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Redesigned main layout - Fixed position to work with main app layout */}
      <div className="flex-1 relative overflow-hidden">
        {/* Chat sessions sidebar - Positioned to not overlap with app sidebar */}
        <div className={`absolute md:relative h-full transition-all ${showSidebar ? 'z-20 md:z-0 w-64 md:w-64' : 'w-0'}`} 
          style={{
            backgroundColor: 'var(--color-surface-light)',
            borderRight: '1px solid var(--color-border-subtle)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            left: '0' // Adjusted to match the new container position
          }}>
          <div className="h-full w-full overflow-hidden">
            <div className="p-4">
              <button
                onClick={createNewSession}
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
                      onClick={() => toggleGroup(group.label)}
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
                        onClick={() => setActiveSessionId(session.id)}
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
                          onClick={(e) => deleteSession(session.id, e)}
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
        </div>
        
        {/* Chat area - Adjusted to work with both sidebars */}
        <div className={`absolute inset-0 ${showSidebar ? 'ml-0 md:ml-64' : ''} flex flex-col`}
          style={{
            backgroundColor: 'var(--color-bg)'
          }}>
          {/* Messages area with proper padding */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto scrollbar-hide"
          >
            {/* Load more messages indicator */}
            {hasMoreMessages && (
              <div className="flex justify-center mt-4">
                <button 
                  onClick={loadMoreMessages}
                  className="px-3 py-1 rounded-md flex items-center text-sm"
                  style={{
                    backgroundColor: 'var(--color-surface-dark)',
                    color: 'var(--color-text-muted)'
                  }}
                  disabled={loadingMessages}
                >
                  {loadingMessages ? (
                    <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 rounded-full" style={{ borderColor: 'var(--color-primary)' }}></div>
                  ) : (
                    <ArrowDownIcon className="w-4 h-4 mr-2" />
                  )}
                  {loadingMessages ? 'Loading...' : 'Load more messages'}
                </button>
              </div>
            )}
            
            {isEmpty ? (
              <div className="h-full flex flex-col items-center justify-center px-4">
                <div className="w-16 h-16 mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)20' }}>
                  <ChatBubbleLeftRightIcon className="w-8 h-8" style={{ color: 'var(--color-primary)' }} />
                </div>
                <h3 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--color-text)' }}>Chat Assistant</h3>
                <p className="mb-8 text-center max-w-md" style={{ color: 'var(--color-text-muted)' }}>
                  I'm here to help with your tasks. You can ask me questions, request assistance, or get information about the platform.
                </p>
              </div>
            ) : (
              <div className="w-full mx-auto pt-4 px-4 md:px-8 lg:px-16 xl:px-24 pb-0">
                {/* Grouped messages */}
                {groupedMessages.map((group, groupIndex) => (
                  <div key={groupIndex} className="message-group mb-6">
                    {group.role === "user" ? (
                      group.messages.map((message, msgIdx) => (
                        <div key={msgIdx} className="mb-1.5 flex justify-end">
                          <div className="max-w-[70%] rounded-2xl px-4 py-3 text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                            <div className="whitespace-pre-wrap">{formatMessageContent(message.content)}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="mb-1.5 pb-4" style={{ borderColor: 'transparent' }}>
                        {group.messages.map((message, msgIdx) => (
                          <div key={msgIdx} className="flex mb-1">
                            {msgIdx === 0 && (
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white mr-3 shrink-0 mt-1"
                                   style={{ background: 'linear-gradient(to right, var(--color-primary), var(--color-secondary))' }}>
                                AI
                              </div>
                            )}
                            <div className={`max-w-[80%] ${msgIdx === 0 ? "" : "ml-11"}`}>
                              <div style={{ color: 'var(--color-text)' }}>
                                {formatMessageContent(message.content)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex mb-1 pb-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white mr-3 shrink-0 mt-1"
                         style={{ background: 'linear-gradient(to right, var(--color-primary), var(--color-secondary))' }}>
                      AI
                    </div>
                    <div style={{ color: 'var(--color-text)' }}>
                      <div className="flex space-x-2 items-center">
                        <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-muted)', animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-muted)', animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-muted)', animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Extra space at the bottom to ensure messages aren't hidden behind input */}
                <div className="h-40"></div>
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          {/* Input area - Fixed positioning but with responsive width */}
          <div 
            className={`${isEmpty ? "absolute left-1/2 bottom-[25%] transform -translate-x-1/2" : "absolute bottom-0 left-0 right-0"} 
            ${!isEmpty && ""} py-4 px-4 md:px-8 lg:px-16 xl:px-24`}
            style={{ 
              backgroundColor: isEmpty ? 'transparent' : 'var(--color-bg)88', /* Semi-transparent background */
              borderColor: 'transparent',
              backdropFilter: isEmpty ? 'none' : 'blur(10px)',
              WebkitBackdropFilter: isEmpty ? 'none' : 'blur(10px)', /* For Safari support */
              maxWidth: '100%',
              margin: '0 auto',
              boxShadow: isEmpty ? 'none' : '0 -8px 20px rgba(0,0,0,0.05)'
            }}
          >
            {/* Input form */}
            <div 
              className={`flex items-center relative rounded-xl ${
                isEmpty ? "max-w-3xl w-[90vw] md:w-[650px]" : "max-w-5xl w-full mx-auto"
              }`}
              style={{ 
                backgroundColor: 'var(--color-surface)',
                borderColor: 'transparent',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                padding: isEmpty ? '0' : '8px 12px',
                transform: isEmpty ? 'none' : 'translateY(-22px)'
              }}
            >
              <form onSubmit={handleSubmit} className="flex-1 flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={isEmpty ? "What can I help with?" : "Ask anything..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`w-full px-4 ${isEmpty ? 'py-3.5' : 'py-4'} bg-transparent border-none outline-none placeholder-zinc-400 rounded-xl`}
                  style={{ 
                    color: 'var(--color-text)',
                    backgroundColor: 'transparent'
                  }}
                  disabled={isLoading}
                />
                
                <div className="flex items-center">
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="p-2 mr-1 rounded-md transition-colors disabled:opacity-50"
                    aria-label="Send message"
                    style={{ 
                      color: input.trim() && !isLoading ? 'var(--color-primary)' : 'var(--color-text-muted)'
                    }}
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </div>

            {/* Action buttons shown only in empty state */}
            {isEmpty && (
              <div className="flex justify-center mt-8">
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={createNewSession}
                    className="px-4 py-2 rounded-md text-sm flex items-center hover:bg-opacity-10 hover:bg-gray-500"
                    style={{ 
                      backgroundColor: 'var(--color-surface-dark)',
                      color: 'var(--color-text)'
                    }}
                  >
                    <PlusIcon className="h-4 w-4 mr-1.5" />
                    <span>New Chat</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot; 