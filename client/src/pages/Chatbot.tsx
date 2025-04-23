import React, { useState, useRef, useEffect } from 'react';
import { animations } from '../components/chat/chatStyles';
import {
  ArrowPathIcon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  PencilIcon,
  CheckIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../contexts/ThemeContext';
import { chatbotService, ChatMessageResponse } from '../services/chatbotService';
import { aiChatService } from '../services/aiChatService';
import { getActiveOllamaModels } from '../services/ollamaService';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage as ChatMessageType, ChatSession } from '../types';
import { useSidebar } from '../contexts/SidebarContext';

// Import new modular components
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import ChatSidebar from '../components/chat/ChatSidebar';
import MessageList from '../components/chat/MessageList';
import ModelSelector from '../components/chat/ModelSelector';

const Chatbot: React.FC = () => {
  const { user } = useAuth();
  const { isExpanded: isMainSidebarExpanded } = useSidebar();

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);

  // Message state
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);

  // UI state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Today': true,
    'Yesterday': true,
    'Previous 7 Days': true,
    'Previous 30 Days': false,
    'Older': false
  });
  const [showSidebar, setShowSidebar] = useState(true);

  // Model selection state
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(() => {
    return localStorage.getItem('selectedModelId') || undefined;
  });

  const titleInputRef = useRef<HTMLInputElement>(null);

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

  // Focus title input when editing
  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
    }
  }, [editingTitle]);

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

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Create a unique ID for this message
    const tempId = `temp-${Date.now()}`;

    // Add user message to local state immediately
    const userMessage: ChatMessageType = {
      id: tempId,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    // Add message to UI immediately
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // If using Ollama AI and a model is selected
      if (selectedModelId) {
        // Get the model data to retrieve the actual Ollama model ID (ollama_model_id)
        const modelsResponse = await getActiveOllamaModels();
        const selectedModel = modelsResponse.find(model => model.id === selectedModelId);

        if (!selectedModel) {
          throw new Error('Selected model not found, please select another model');
        }

        const conversationHistory = messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));

        // Add the new message to history
        conversationHistory.push({
          role: 'user',
          content: content.trim()
        });

        // Call Ollama API with the correct model ID from the database
        const response = await aiChatService.sendChatCompletion({
          modelId: selectedModel.ollama_model_id, // Use the Ollama model ID from the database
          messages: conversationHistory
        });

        // If this creates a new session, update our session info
        if (!activeSessionId) {
          await createNewSession();
        }

        // Save the message and response to the database
        const aiResponseContent = response.choices[0].message.content;
        const dbResponse = await chatbotService.sendMessage(
          content.trim(),
          activeSessionId || undefined,
          aiResponseContent // Pass the AI response to be saved in the database
        );

        // If this creates a new session or updates the session ID, update our session info
        if (!activeSessionId || activeSessionId !== dbResponse.sessionId) {
          setActiveSessionId(dbResponse.sessionId);
          await fetchSessions(); // Refresh sessions to get the new one
        }

        // Add AI response to messages using the response from Ollama
        const aiResponse: ChatMessageType = {
          id: dbResponse.id, // Use the database ID
          role: 'assistant',
          content: response.choices[0].message.content,
          timestamp: new Date(),
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
      } else {
        // Fall back to regular chatbot service
        const response = await chatbotService.sendMessage(userMessage.content, activeSessionId || undefined);

        // If this creates a new session, update our session info
        if (!activeSessionId || activeSessionId !== response.sessionId) {
          setActiveSessionId(response.sessionId);
          await fetchSessions(); // Refresh sessions to get the new one
        }

        // Add AI response to messages
        const aiResponse: ChatMessageType = {
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
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temporary message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    if (confirm('Are you sure you want to clear the current chat?')) {
      setMessages([]);
    }
  };

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupLabel]: !prev[groupLabel]
    }));
  };

  // Determine if chat is empty (for positioning the input)
  const isEmpty = messages.length === 0;

  // Add animation styles to the document head
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      ${animations.bounce}
      ${animations.fadeIn}
      ${animations.slideIn}
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

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
            left: '0' // Adjusted to match the new container position
          }}>
          <ChatSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            expandedGroups={expandedGroups}
            loadingSessions={loadingSessions}
            onCreateSession={createNewSession}
            onSelectSession={setActiveSessionId}
            onDeleteSession={deleteSession}
            onToggleGroup={toggleGroup}
          />
        </div>

        {/* Chat area - Adjusted to work with both sidebars */}
        <div className={`absolute inset-0 ${showSidebar ? 'ml-0 md:ml-64' : ''} flex flex-col`}
          style={{
            backgroundColor: 'var(--color-bg)'
          }}>
          {/* AI Model Selector */}
          <div className="px-4 py-2">
            <ModelSelector
              onSelectModel={setSelectedModelId}
              selectedModelId={selectedModelId}
            />
          </div>

          {/* Messages List */}
          <MessageList
            messages={messages}
            isLoading={isLoading}
            hasMoreMessages={hasMoreMessages}
            loadMoreMessages={loadMoreMessages}
            loadingMessages={loadingMessages}
            isEmpty={isEmpty}
          />

          {/* Input area - Fixed positioning but with responsive width */}
          <div
            className={`${isEmpty ? "absolute left-1/2 bottom-[25%] transform -translate-x-1/2" : "absolute bottom-0 left-0 right-0"}
            ${!isEmpty && ""} py-4 px-4 md:px-8 lg:px-16 xl:px-24`}
            style={{
              backgroundColor: isEmpty ? 'transparent' : 'var(--color-bg)',
              borderColor: 'transparent',
              maxWidth: '100%',
              margin: '0 auto',
              boxShadow: isEmpty ? 'none' : '0 -8px 20px rgba(0,0,0,0.05)'
            }}
          >
            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              isEmpty={isEmpty}
            />

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