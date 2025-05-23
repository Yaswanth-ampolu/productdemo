import React, { useState, useRef, useEffect } from 'react';
import { animations } from '../components/chat/chatStyles';
import {
  ArrowPathIcon,
  PencilIcon,
  CheckIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { chatbotService } from '../services/chatbotService';
import { aiChatService, StreamChunk } from '../services/aiChatService';
import { ragChatService } from '../services/ragChatService';
import { getActiveOllamaModels } from '../services/ollamaService';
import { ChatSession } from '../types';
import { useSidebar } from '../contexts/SidebarContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useToolExecution } from '../hooks/useToolExecution';
import { containsReadContextToolCall } from '../utils/toolParser';
import { applyContextToPrompt, hasContextMessage } from '../utils/contextUtils';
import ChatInput from '../components/chat/ChatInput';
import ChatSidebar from '../components/chat/ChatSidebar';
import MessageList from '../components/chat/MessageList';
import ModelSelector from '../components/chat/ModelSelector';
import MCPServerSelector from '../components/chat/MCPServerSelector';
import ContextReadingIndicator from '../components/chat/ContextReadingIndicator';
import MCPNotifications from '../components/mcp/MCPNotifications';
import { useMCPChat, MCPExtendedChatMessageType } from '../components/mcp/MCPChatComponents';

// Use the MCPExtendedChatMessageType from our new component
type ExtendedChatMessageType = MCPExtendedChatMessageType;

const Chatbot: React.FC = () => {
  const { isExpanded: isMainSidebarExpanded } = useSidebar();

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);

  // Message state
  const [messages, setMessages] = useState<ExtendedChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
  const [showSidebar, setShowSidebar] = useState(() => {
    const savedPreference = localStorage.getItem('chatSidebarExpanded');
    return savedPreference !== null ? savedPreference === 'true' : true;
  });

  // Model selection state
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(() => {
    return localStorage.getItem('selectedModelId') || undefined;
  });

  // RAG state
  const [isRagAvailable, setIsRagAvailable] = useState<boolean>(false);
  const [isRagEnabled, setIsRagEnabled] = useState<boolean>(() => {
    // Get from localStorage or default to true
    const savedPreference = localStorage.getItem('ragEnabled');
    return savedPreference !== null ? savedPreference === 'true' : true;
  });
  // Track if we've already shown a RAG notification for the current document
  const [ragNotificationShown, setRagNotificationShown] = useState<boolean>(false);

  // Get MCP chat functionality from our custom hook
  const {
    isMCPConnected,
    isMCPEnabled,
    toggleMCPEnabled,
    showServerSelector,
    setShowServerSelector,
    selectServer,
    createContextToolMessage,
    handleMCPChatMessage
  } = useMCPChat();

  // Tool execution state
  const { isExecutingTool, currentTool, executeTool } = useToolExecution();

  const titleInputRef = useRef<HTMLInputElement>(null);
  const streamedContentRef = useRef<{[key: string]: string}>({}); // Store streamed content by message ID
  const abortFunctionRef = useRef<(() => void) | null>(null); // Store the abort function

  // Function to force check document status and update UI
  const forceCheckDocumentStatus = async () => {
    // Find any processing messages
    const processingMessages = messages.filter(msg => msg.isProcessingFile && msg.documentId);

    if (processingMessages.length > 0) {
      console.log('Found processing messages, checking status:', processingMessages.length);

      // Check each document status
      for (const msg of processingMessages) {
        if (msg.documentId) {
          try {
            const statusResponse = await chatbotService.getDocumentStatus(msg.documentId);
            console.log(`Force checking document ${msg.documentId} status:`, statusResponse);

            // If document is processed, update UI
            if (statusResponse.status === 'PROCESSED') {
              console.log('Document is processed, updating UI');

              // Remove processing message
              setMessages(prev => prev.filter(m => m.id !== msg.id));

              // Use a more comprehensive check for success messages
              const checkForSuccessMessages = (msgs: ExtendedChatMessageType[]) => {
                return msgs.some(msg =>
                  msg.role === 'assistant' &&
                  (msg.content.includes("Your document has been fully processed") ||
                   msg.content.includes("Your document has been processed"))
                );
              };

              // Check if we already have a success message before adding a new one
              setMessages(prev => {
                // Check if we already have a success message to avoid duplicates
                if (checkForSuccessMessages(prev)) {
                  console.log('Success message already exists, not adding another one');
                  return prev;
                }

                // Add success message
                const successMessage: ExtendedChatMessageType = {
                  id: `system-success-${Date.now()}`,
                  role: 'assistant',
                  content: "Your document has been fully processed and is ready for questions! You can now ask me anything about the content, and I'll use the document to provide accurate answers.",
                  timestamp: new Date()
                };

                return [...prev, successMessage];
              });

              // Mark notification as shown
              setRagNotificationShown(true);

              // Check RAG availability
              await checkRagAvailability();

              // Reset loading states
              setIsLoading(false);
              setIsStreaming(false);

              // Enable RAG mode automatically
              setIsRagEnabled(true);
              localStorage.setItem('ragEnabled', 'true');
            } else if (statusResponse.status === 'ERROR') {
              // Handle error
              console.log('Document processing error, updating UI');

              // Remove processing message
              setMessages(prev => prev.filter(m => m.id !== msg.id));

              // Add error message
              const errorMessage: ExtendedChatMessageType = {
                id: `system-error-${Date.now()}`,
                role: 'assistant',
                content: "I encountered an error processing your document. " +
                         (statusResponse.error || "Please try uploading it again."),
                timestamp: new Date()
              };
              setMessages(prev => [...prev, errorMessage]);

              // Reset loading states
              setIsLoading(false);
              setIsStreaming(false);
            } else {
              // Check how long the message has been processing
              const messageTime = new Date(msg.timestamp).getTime();
              const currentTime = new Date().getTime();
              const processingTime = currentTime - messageTime;

              // If processing for more than 2 minutes, force reset UI
              if (processingTime > 120000) { // 2 minutes
                console.log('Document processing timeout, force resetting UI');

                // Remove processing message
                setMessages(prev => prev.filter(m => m.id !== msg.id));

                // Add timeout message
                const timeoutMessage: ExtendedChatMessageType = {
                  id: `system-timeout-${Date.now()}`,
                  role: 'assistant',
                  content: "I've received your file, but the processing is taking longer than expected. " +
                           "I'll continue processing it in the background, and you can ask questions about it later.",
                  timestamp: new Date()
                };
                setMessages(prev => [...prev, timeoutMessage]);

                // Reset loading states
                setIsLoading(false);
                setIsStreaming(false);
              }
            }
          } catch (error) {
            console.error('Error force checking document status:', error);
          }
        }
      }
    } else if (isLoading || isStreaming) {
      // If no processing messages but still loading, check if we should reset
      const loadingStartTime = messages.find(msg => msg.isStreaming)?.timestamp;

      if (loadingStartTime) {
        const messageTime = new Date(loadingStartTime).getTime();
        const currentTime = new Date().getTime();
        const loadingTime = currentTime - messageTime;

        // If loading for more than 1 minute, force reset UI
        if (loadingTime > 60000) { // 1 minute
          console.log('Loading timeout, force resetting UI');

          // Reset loading states
          setIsLoading(false);
          setIsStreaming(false);
        }
      }
    }
  };

  // Get WebSocket context
  const { connected: wsConnected, reconnect: wsReconnect } = useWebSocket();

  // Fetch sessions on component mount and ensure WebSocket connection
  useEffect(() => {
    fetchSessions();

    // Initial RAG availability check
    checkRagAvailability();

    // Force check document status on mount
    forceCheckDocumentStatus();

    // Ensure WebSocket connection is established
    if (!wsConnected) {
      console.log('WebSocket not connected, attempting to reconnect...');
      wsReconnect();
    }

    // Set up periodic checks with a reasonable interval (30 seconds)
    const periodicCheckInterval = setInterval(() => {
      // Only check RAG if we haven't already shown the notification
      // This prevents unnecessary checks once RAG is known to be available
      if (!ragNotificationShown) {
        console.log('Performing periodic document status check');

        // Check document status first
        forceCheckDocumentStatus();

        // Then check RAG availability (the debounce in checkRagAvailability will prevent excessive checks)
        checkRagAvailability();
      }

      // Always check WebSocket connection
      if (!wsConnected) {
        console.log('WebSocket not connected during periodic check, attempting to reconnect...');
        wsReconnect();
      }
    }, 30000); // Increased to 30s to reduce server load

    // Clean up interval on unmount
    return () => {
      clearInterval(periodicCheckInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsConnected, wsReconnect]); // Intentionally omitting ragNotificationShown and other dependencies to prevent re-creating the interval

  // Fetch messages when active session changes
  // Check for context in localStorage
  const checkForStoredContext = (sessionId: string) => {
    try {
      const storedContext = localStorage.getItem(`context_${sessionId}`);
      if (storedContext) {
        const parsedContext = JSON.parse(storedContext);
        if (parsedContext.hasContext) {
          console.log('Found stored context for conversation:', sessionId);
          return parsedContext;
        }
      }
    } catch (error) {
      console.error('Error checking for stored context:', error);
    }
    return null;
  };

  useEffect(() => {
    if (activeSessionId) {
      fetchSessionMessages(activeSessionId);

      // Check for context in localStorage
      const storedContext = checkForStoredContext(activeSessionId);
      if (storedContext) {
        console.log('Using stored context from localStorage:', storedContext);

        // We don't need to do anything here as the context will be loaded
        // from the database when fetchSessionMessages is called
        // This is just for debugging purposes
      }
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  // Listen for refreshMessages events - but we're disabling this for context tool
  // to prevent duplicate messages and empty user messages
  useEffect(() => {
    const handleRefreshMessages = (event: CustomEvent<{ conversationId: string; source?: string }>) => {
      const { conversationId, source } = event.detail;

      // Skip refreshing if the source is the context tool
      // This prevents the issues with empty messages and duplicated context tools
      if (source === 'context_tool') {
        console.log('Skipping refresh from context tool to prevent UI issues');
        return;
      }

      if (conversationId && conversationId === activeSessionId) {
        console.log('Refreshing messages for conversation:', conversationId);
        fetchSessionMessages(conversationId);
      }
    };

    // Add event listener
    window.addEventListener('refreshMessages', handleRefreshMessages as EventListener);

    // Clean up
    return () => {
      window.removeEventListener('refreshMessages', handleRefreshMessages as EventListener);
    };
  }, [activeSessionId]);

  // Store the last time we checked RAG availability
  const lastRagCheckRef = useRef<number>(0);

  // Check if RAG is available with debounce to prevent excessive checks
  const checkRagAvailability = async () => {
    // Implement debounce - only check if it's been at least 5 seconds since the last check
    const now = Date.now();
    if (now - lastRagCheckRef.current < 5000) {
      console.log(`Skipping RAG availability check - last check was ${(now - lastRagCheckRef.current) / 1000}s ago`);
      return isRagAvailable; // Return current state without checking
    }

    // Update the last check timestamp
    lastRagCheckRef.current = now;

    try {
      const available = await ragChatService.isRagAvailable();
      console.log(`RAG availability checked: ${available ? 'Available' : 'Not available'} at ${new Date().toISOString()}`);

      // If RAG is now available but wasn't before, show a notification (only once)
      if (available && !isRagAvailable && !ragNotificationShown) {
        console.log('RAG is now available, showing notification (first time)');

        // Find and remove any processing messages
        setMessages(prev => {
          // Check if we already have a success message to avoid duplicates
          const hasSuccessMessage = prev.some(msg =>
            msg.role === 'assistant' &&
            msg.content.includes("Your document has been processed")
          );

          if (hasSuccessMessage) {
            console.log('Success message already exists, not adding another one');
            return prev;
          }

          const processingMessages = prev.filter(msg => msg.isProcessingFile);
          if (processingMessages.length > 0) {
            console.log('Removing processing messages:', processingMessages.length);
            return prev.filter(msg => !msg.isProcessingFile);
          }
          return prev;
        });

        // Use a function to check for success messages to ensure we have the latest state
        const checkForSuccessMessages = (msgs: ExtendedChatMessageType[]) => {
          return msgs.some(msg =>
            msg.role === 'assistant' &&
            (msg.content.includes("Your document has been fully processed") ||
             msg.content.includes("Your document has been processed"))
          );
        };

        // Get the current messages directly from state to ensure we have the latest
        setMessages(prev => {
          // First, completely remove ALL error messages and loading indicators
          const filteredMessages = prev.filter(msg =>
            // Remove error messages
            !(msg.role === 'assistant' && msg.content.includes("Sorry, there was an error")) &&
            // Remove loading indicators
            !msg.isProcessingFile
          );

          // Check if we already have a success message
          if (checkForSuccessMessages(filteredMessages)) {
            console.log('Success message already exists, not adding another one');
            return filteredMessages;
          }

          // Add a system message to notify the user
          const ragAvailableMessage: ExtendedChatMessageType = {
            id: `system-rag-available-${Date.now()}`,
            role: 'assistant',
            content: "Your document has been fully processed and is ready for questions! You can now ask me anything about the content, and I'll use the document to provide accurate answers.",
            timestamp: new Date()
          };

          // Add the success message to the filtered messages
          return [...filteredMessages, ragAvailableMessage];
        });

        // Mark that we've shown the notification
        setRagNotificationShown(true);

        // Reset loading and streaming states
        setIsLoading(false);
        setIsStreaming(false);

        // Enable RAG mode automatically
        setIsRagEnabled(true);
        localStorage.setItem('ragEnabled', 'true');
      } else if (available && !isRagAvailable && ragNotificationShown) {
        console.log('RAG is now available, but notification already shown');

        // Still make sure loading states are reset
        setIsLoading(false);
        setIsStreaming(false);
      }

      // Update the state after checking for changes
      setIsRagAvailable(available);

      return available;
    } catch (error) {
      console.error('Error checking RAG availability:', error);
      setIsRagAvailable(false);
      return false;
    }
  };

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

  // Using hasContextMessage from contextUtils.ts

  const fetchSessionMessages = async (sessionId: string, append = false) => {
    try {
      setLoadingMessages(true);
      const offset = append ? messageOffset : 0;
      const response = await chatbotService.getSession(sessionId, 12, offset);

      const { messages: fetchedMessages, total } = response;
      setTotalMessages(total);
      setHasMoreMessages(offset + fetchedMessages.length < total);

      // Check if any of the fetched messages contain context information
      const contextFound = hasContextMessage(fetchedMessages);
      console.log('Context found in conversation:', contextFound);

      if (append) {
        setMessages(prev => [...fetchedMessages, ...prev]);
        setMessageOffset(prev => prev + fetchedMessages.length);
      } else {
        setMessages(fetchedMessages);
        setMessageOffset(fetchedMessages.length);
      }

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
      // Delete the chat session from the database
      await chatbotService.deleteSession(sessionId);

      // Also clear any RAG data associated with this session
      try {
        await ragChatService.clearRagData(sessionId);
        console.log('RAG data cleared for session:', sessionId);
      } catch (ragError) {
        console.error('Error clearing RAG data:', ragError);
        // Continue with session deletion even if RAG data clearing fails
      }

      // Update the UI
      setSessions(prev => prev.filter(s => s.id !== sessionId));

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

  const handleSendMessage = async (content: string, file?: File) => {
    // Allow sending if there's text or a file
    if ((content.trim() === '' && !file) || isLoading || isUploading) return;

    // Special handling for read_context command
    if (content.trim().toLowerCase() === 'read_context') {
      console.log('Detected read_context command, triggering context tool directly');

      // Create a temporary AI message that will contain the context tool
      const aiMessage = createContextToolMessage();

      // Add only the AI message to the UI (no user message)
      setMessages(prev => [...prev, aiMessage]);

      // No need to continue with regular message handling
      return;
    }

    const tempId = `temp-${Date.now()}`;

    // For file uploads, create a descriptive message if content is empty
    const displayContent = (file && content.trim() === '')
      ? `I'm uploading ${file.name} for analysis.`
      : content.trim();

    const userMessage: ExtendedChatMessageType = {
      id: tempId,
      role: 'user',
      content: displayContent,
      timestamp: new Date(),
      // Add file metadata if a file is provided
      fileAttachment: file ? {
        name: file.name,
        type: file.type,
        size: file.size
      } : undefined
    };

    setMessages(prev => [...prev, userMessage]);

    // If MCP is enabled, use MCP chat service
    if (isMCPEnabled && !file && content.trim() !== '') {
      try {
        // Use our new MCP chat handler
        await handleMCPChatMessage(
          content,
          messages,
          activeSessionId,
          await getSelectedModelDetails(),
          streamedContentRef,
          abortFunctionRef,
          setMessages,
          setIsStreaming,
          setIsLoading,
          executeTool,
          chatbotService,
          fetchSessions
        );
        return;
      } catch (error: any) {
        console.error('Error using MCP chat mode:', error);

        // Add an error message to the chat
        const errorMessage: ExtendedChatMessageType = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${error.message}. Falling back to normal chat.`,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, errorMessage]);

        // Fall through to regular chat handling below
      }
    }

    // Helper function to get the selected model details
    async function getSelectedModelDetails() {
      try {
        if (!selectedModelId) {
          console.warn('No model selected, using default');

          // Try to get active models to find a default
          const modelsResponse = await getActiveOllamaModels();
          if (modelsResponse && modelsResponse.length > 0) {
            // Find the first active model
            const firstActiveModel = modelsResponse.find(model => model.is_active);
            if (firstActiveModel) {
              console.log('Using first active model as default:', firstActiveModel.name);
              return firstActiveModel;
            }
          }

          // If we couldn't find a model, create a placeholder with a default ID
          return {
            id: 'default',
            name: 'Default Model',
            model_id: 'default',
            ollama_model_id: process.env.DEFAULT_OLLAMA_MODEL || 'llama3',
            is_active: true,
            description: 'Default Model'
          };
        }

        const modelsResponse = await getActiveOllamaModels();
        const selectedModel = modelsResponse.find(model => model.id === selectedModelId);

        if (!selectedModel) {
          console.warn('Selected model not found, using default');

          // If the selected model is not found, use the first active model
          const firstActiveModel = modelsResponse.find(model => model.is_active);
          if (firstActiveModel) {
            return firstActiveModel;
          }

          // If no active models, create a placeholder
          return {
            id: 'default',
            name: 'Default Model',
            model_id: 'default',
            ollama_model_id: process.env.DEFAULT_OLLAMA_MODEL || 'llama3',
            is_active: true,
            description: 'Default Model'
          };
        }

        return selectedModel;
      } catch (error) {
        console.error('Error getting model details:', error);

        // Return a fallback model in case of error
        return {
          id: 'fallback',
          name: 'Fallback Model',
          model_id: 'fallback',
          ollama_model_id: process.env.DEFAULT_OLLAMA_MODEL || 'llama3',
          is_active: true,
          description: 'Fallback Model'
        };
      }
    }

    // Regular message without file
    setIsLoading(true);

    try {
      if (selectedModelId) {
        const modelsResponse = await getActiveOllamaModels();
        const selectedModel = modelsResponse.find(model => model.id === selectedModelId);

        if (!selectedModel) {
          throw new Error('Selected model not found');
        }

        // Check if we should use RAG for this message
        // Only use RAG if it's available, enabled, and there are documents to search
        const shouldUseRag = isRagAvailable && isRagEnabled;

        // Create a temporary AI message for streaming
        const aiMessageId = `ai-${Date.now()}`;
        const aiMessage: ExtendedChatMessageType = {
          id: aiMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isStreaming: true, // Mark as streaming to show the loading indicator
          useRag: shouldUseRag // Mark if we're using RAG
        };

        // Add the message to the UI immediately to show streaming
        setMessages(prev => [...prev, aiMessage]);
        setIsStreaming(true);

        // If RAG is available and enabled, use it
        if (shouldUseRag) {
          try {
            console.log('Using RAG for this message');

            // Call the RAG service
            const ragResponse = await ragChatService.sendRagChatMessage({
              model: selectedModel.ollama_model_id,
              message: content.trim(),
              sessionId: activeSessionId || undefined
            });

            // Update the message with the RAG response
            setMessages(prev => prev.map(msg =>
              msg.id === aiMessageId ? {
                ...msg,
                content: ragResponse.content,
                sources: ragResponse.sources,
                isStreaming: false
              } : msg
            ));

            // Save the message to the database
            const dbResponse = await chatbotService.sendMessage(
              content.trim(),
              activeSessionId || undefined,
              ragResponse.content
            );

            if (!activeSessionId || activeSessionId !== dbResponse.sessionId) {
              setActiveSessionId(dbResponse.sessionId);
              await fetchSessions();
            }

            setIsLoading(false);
            setIsStreaming(false);
            return;
          } catch (ragError) {
            console.error('Error using RAG:', ragError);
            // Fall back to regular chat if RAG fails
            console.log('Falling back to regular chat');

            // Update the message to indicate RAG failed
            setMessages(prev => prev.map(msg =>
              msg.id === aiMessageId ? {
                ...msg,
                content: 'RAG processing failed, falling back to regular chat...',
                useRag: false
              } : msg
            ));
          }
        }

        // If we get here, either RAG is not available/enabled or it failed
        // Use regular chat with conversation history

        // Base system prompt
        let systemPromptContent = 'You are a helpful AI assistant. Answer the user\'s questions accurately and concisely.';

        // Apply context to the system prompt using our utility function
        systemPromptContent = applyContextToPrompt(systemPromptContent, messages);

        // Create conversation history with user and assistant messages
        const conversationHistory = messages
          .filter(msg => msg.role !== 'system' && !msg.content.startsWith('Context Loaded')) // Filter out system messages and context messages
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          }));

        // Add the current message to conversation history
        conversationHistory.push({ role: 'user', content: content.trim() });

        // Create the full conversation with system message
        const fullConversation = [
          { role: 'system' as 'user' | 'assistant' | 'system', content: systemPromptContent },
          ...conversationHistory
        ];

        // Set isLoading and isStreaming to true to indicate we're waiting for a response
        // The MessageList component will not show a separate loading indicator
        // when there's already a message with isStreaming=true
        setIsStreaming(true);

        // Store the abort function so we can call it if the user clicks the stop button
        abortFunctionRef.current = await aiChatService.streamChatCompletion(
          {
            modelId: selectedModel.ollama_model_id,
            messages: fullConversation,
            options: { stream: true }
          },
          (chunk: StreamChunk) => {
            const newContent = chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || '';
            if (newContent) {
              // Update the ref with the accumulated content
              streamedContentRef.current[aiMessageId] = (streamedContentRef.current[aiMessageId] || '') + newContent;

              // Update the UI
              setMessages(prev => prev.map(msg =>
                msg.id === aiMessageId ? { ...msg, content: streamedContentRef.current[aiMessageId] } : msg
              ));
            }
          },
          async () => {
            console.log('Preparing to get final AI message content');
            console.log('Checking content length');

            // Add a small delay to ensure all content is accumulated
            // This helps with race conditions in state updates
            await new Promise(resolve => setTimeout(resolve, 500));

            try {
              // Double-check the final content after the delay
              const finalContentAfterDelay = streamedContentRef.current[aiMessageId] || '';
              console.log('Final content after delay:', finalContentAfterDelay.length);

              // Save the message to the database
              const dbResponse = await chatbotService.sendMessage(
                content.trim(),
                activeSessionId || undefined,
                finalContentAfterDelay
              );
              console.log('Database response:', dbResponse); // Debug: Log response

              if (!activeSessionId || activeSessionId !== dbResponse.sessionId) {
                setActiveSessionId(dbResponse.sessionId);
                await fetchSessions();
              }

              // Update the existing message with the database ID instead of adding a new one
              setMessages(prev => {
                console.log('Updating message with DB ID:', dbResponse.id);
                return prev.map(msg =>
                  msg.id === aiMessageId ? {
                    ...msg,
                    id: dbResponse.id,
                    isStreaming: false,
                    // Ensure the content is the final content
                    content: finalContentAfterDelay
                  } : msg
                );
              });

              // Clean up the ref
              delete streamedContentRef.current[aiMessageId];
            } catch (error) {
              console.error('Error saving message to database:', error);
              // Still mark the message as not streaming even if saving fails
              setMessages(prev => prev.map(msg =>
                msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg
              ));

              // Clean up the ref even on error
              delete streamedContentRef.current[aiMessageId];
            }

            setIsLoading(false);
            setIsStreaming(false);
            abortFunctionRef.current = null;
          },
          (error) => {
            console.error('Streaming error:', error);
            setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
            // Clean up the ref on error
            delete streamedContentRef.current[aiMessageId];
            setIsLoading(false);
            setIsStreaming(false);
            abortFunctionRef.current = null;
          }
        );
      } else {
        const response = await chatbotService.sendMessage(userMessage.content, activeSessionId || undefined);
        setActiveSessionId(response.sessionId);
        setMessages(prev => {
          const filteredMessages = prev.filter(m => m.id !== tempId);
          return [
            ...filteredMessages,
            { ...userMessage, id: `user-${Date.now()}` },
            { id: response.id, role: 'assistant', content: response.content, timestamp: new Date() }
          ];
        });
        await fetchSessions();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    if (confirm('Are you sure you want to clear the current chat?')) {
      setMessages([]);
    }
  };

  const handleStopGeneration = () => {
    if (abortFunctionRef.current) {
      abortFunctionRef.current();
      // The abort function will call onComplete which will reset isStreaming and abortFunctionRef
    }
  };

  // Function removed as it's no longer needed

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupLabel]: !prev[groupLabel]
    }));
  };

  const toggleSidebar = () => {
    setShowSidebar(prev => {
      const newValue = !prev;
      localStorage.setItem('chatSidebarExpanded', String(newValue));
      return newValue;
    });
  };

  // Toggle RAG mode
  const toggleRagMode = () => {
    setIsRagEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem('ragEnabled', String(newValue));
      return newValue;
    });
  };

  // Toggle MCP mode - uses the context's toggle function
  const handleToggleMCP = () => {
    // Toggle MCP in MCPContext
    toggleMCPEnabled();

    // Do not automatically toggle the agent - let them be independent
    // This way we can have MCP enabled but agent disabled
  };

  const isEmpty = messages.length === 0;

  // Add event listener for refreshMessages event
  useEffect(() => {
    const handleRefreshMessages = (event: CustomEvent) => {
      const { conversationId } = event.detail;
      if (conversationId && conversationId === activeSessionId) {
        console.log('Refreshing messages for conversation:', conversationId);
        fetchSessionMessages(conversationId);
      }
    };

    // Add event listener
    window.addEventListener('refreshMessages', handleRefreshMessages as EventListener);

    // Clean up
    return () => {
      window.removeEventListener('refreshMessages', handleRefreshMessages as EventListener);
    };
  }, [activeSessionId]);

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      ${animations.bounce}
      ${animations.fadeIn}
      ${animations.slideIn}

      .input-area-blur {
        background-color: transparent !important;
        -webkit-backdrop-filter: blur(5px) !important;
        backdrop-filter: blur(5px) !important;
        border: none !important;
        box-shadow: none !important;
        isolation: isolate !important;
        opacity: 1 !important;
      }

      .input-area-blur > * {
        isolation: isolate !important;
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        backgroundColor: 'var(--color-bg)',
        left: isMainSidebarExpanded ? '64px' : '63px',
        width: isMainSidebarExpanded ? 'calc(100% - 64px)' : 'calc(100% - 50px)'
      }}
    >
      {/* MCP Server Selector */}
      <MCPServerSelector
        isOpen={showServerSelector}
        onClose={() => setShowServerSelector(false)}
        onServerSelect={selectServer}
      />
      <div
        className="px-4 py-3 flex items-center justify-between z-10 relative"
        style={{
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderRadius: '0 0 12px 12px'
        }}
      >
        <div className="flex items-center space-x-4">
          {editingTitle ? (
            <div className="flex items-center">
              <input
                ref={titleInputRef}
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                onBlur={updateSessionTitle}
                onKeyDown={(e) => e.key === 'Enter' && updateSessionTitle()}
                className="px-3 py-1 rounded-full"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--color-text)',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }}
              />
              <button
                onClick={updateSessionTitle}
                className="ml-2 p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-500 transition-all hover:scale-105"
                style={{
                  color: 'var(--color-primary)',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }}
              >
                <CheckIcon className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <h2
                className="text-base md:text-lg font-semibold truncate max-w-[200px] md:max-w-none"
                style={{ color: 'var(--color-text)' }}
              >
                {activeSessionId ? sessionTitle : 'New Chat'}
              </h2>
              {activeSessionId && (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="ml-2 p-1 rounded-full hover:bg-opacity-20 hover:bg-gray-500 transition-all hover:scale-105"
                  style={{
                    color: 'var(--color-text-muted)',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)'
                  }}
                >
                  <PencilIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {isMCPEnabled && (
            <MCPNotifications />
          )}
          <ModelSelector
            onSelectModel={setSelectedModelId}
            selectedModelId={selectedModelId}
          />
          {!isEmpty && (
            <button
              onClick={resetChat}
              className="p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-500 transition-all hover:scale-105"
              style={{
                color: 'var(--color-text-muted)',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}
              title="Clear current chat"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {showSidebar && (
          <div
            className="absolute md:relative h-full transition-all duration-300 ease-in-out z-20 md:z-0"
            style={{
              left: '0',
              width: window.innerWidth < 768 ? '100%' : '260px'
            }}
          >
            <ChatSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              expandedGroups={expandedGroups}
              loadingSessions={loadingSessions}
              isCollapsed={false}
              onCreateSession={createNewSession}
              onSelectSession={setActiveSessionId}
              onDeleteSession={deleteSession}
              onToggleGroup={toggleGroup}
              onToggleCollapse={toggleSidebar}
            />
          </div>
        )}

        {!showSidebar && (
          <ChatSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            expandedGroups={expandedGroups}
            loadingSessions={loadingSessions}
            isCollapsed={true}
            onCreateSession={createNewSession}
            onSelectSession={setActiveSessionId}
            onDeleteSession={deleteSession}
            onToggleGroup={toggleGroup}
            onToggleCollapse={toggleSidebar}
          />
        )}

        <div
          className={`absolute inset-0 transition-all duration-300 ease-in-out flex flex-col`}
          style={{
            backgroundColor: 'var(--color-bg)',
            marginLeft: showSidebar ? (window.innerWidth < 768 ? '0' : '260px') : '0'
          }}
        >
          {/* Context reading indicator - only show when not already displayed in a message */}
          {isExecutingTool && currentTool === 'read_context' && !messages.some(msg =>
            msg.role === 'assistant' && containsReadContextToolCall(msg.content)
          ) && (
            <div className="px-4 pt-2">
              <ContextReadingIndicator isReading={true} />
            </div>
          )}

          <MessageList
            messages={messages.filter(msg => msg.role !== 'system') as any}
            isLoading={isLoading}
            hasMoreMessages={hasMoreMessages}
            loadMoreMessages={loadMoreMessages}
            loadingMessages={loadingMessages}
            isEmpty={isEmpty}
            conversationId={activeSessionId || undefined}
          />

          <div
            className={`${isEmpty ? "absolute left-1/2 bottom-[10%] transform -translate-x-1/2" : "absolute bottom-0 left-0 right-0"}
            ${!isEmpty && ""} py-4 px-4 md:px-8 lg:px-16 xl:px-24 input-area-blur`}
            style={{
              maxWidth: '100%',
              margin: '0 auto',
              zIndex: 10,
              boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)',
              backgroundColor: isEmpty ? 'transparent' : 'var(--color-bg-translucent)'
            }}
          >
            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              isEmpty={isEmpty}
              isStreaming={isStreaming}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              onStopGeneration={handleStopGeneration}
              isRagAvailable={isRagAvailable}
              isRagEnabled={isRagEnabled}
              onToggleRag={toggleRagMode}
              isMCPAvailable={isMCPConnected}
              isMCPEnabled={isMCPEnabled}
              onToggleMCP={handleToggleMCP}
            />

            {isEmpty && (
              <div className="flex justify-center mt-12">
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={createNewSession}
                    className="px-4 py-2 rounded-md text-sm flex items-center hover:bg-opacity-10 hover:bg-gray-500"
                    style={{
                      backgroundColor: 'var(--color-surface-dark)',
                      color: 'var(--color-text)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
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