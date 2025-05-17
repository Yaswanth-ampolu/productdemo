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
import { ragChatService, RagSource } from '../services/ragChatService';
import { getActiveOllamaModels } from '../services/ollamaService';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage, ChatSession } from '../types';
import { useSidebar } from '../contexts/SidebarContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useDocumentStatus } from '../hooks/useDocumentStatus';
import { useMCP } from '../contexts/MCPContext';
import { useMCPAgent } from '../contexts/MCPAgentContext';
import ChatInput from '../components/chat/ChatInput';
import ChatSidebar from '../components/chat/ChatSidebar';
import MessageList from '../components/chat/MessageList';
import ModelSelector from '../components/chat/ModelSelector';
import MCPServerSelector from '../components/chat/MCPServerSelector';

// Define a custom message type that includes all needed properties
interface ExtendedChatMessageType {
  id: string;
  role: 'user' | 'assistant' | 'system'; // Include 'system' role
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  fileAttachment?: {
    name: string;
    type: string;
    size: number;
    url?: string;
    documentId?: string;
    status?: string;
    processingError?: string;
  };
  isProcessingFile?: boolean;
  isProcessingOnly?: boolean; // Flag to indicate this is document processing, not message streaming
  isLoadingOnly?: boolean; // Flag to indicate this is just a loading indicator with no text
  documentId?: string;
  documentStatus?: string;
  sources?: RagSource[]; // Add sources for RAG responses
  useRag?: boolean; // Flag to indicate if RAG should be used for this message
}

const Chatbot: React.FC = () => {
  const { user, refreshUser } = useAuth();
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

  // MCP state
  const {
    isConnected: isMCPConnected,
    isMCPEnabled,
    toggleMCPEnabled,
    showServerSelector,
    setShowServerSelector,
    selectServer
  } = useMCP();

  // MCP Agent state
  const { isAgentEnabled, toggleAgent, processUserRequest } = useMCPAgent();

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
  useEffect(() => {
    if (activeSessionId) {
      fetchSessionMessages(activeSessionId);
    } else {
      setMessages([]);
    }
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

  const fetchSessionMessages = async (sessionId: string, append = false) => {
    try {
      setLoadingMessages(true);
      const offset = append ? messageOffset : 0;
      const response = await chatbotService.getSession(sessionId, 12, offset);

      const { messages: fetchedMessages, total } = response;
      setTotalMessages(total);
      setHasMoreMessages(offset + fetchedMessages.length < total);

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

    // If MCP Agent is enabled and there's no file, process the request with the agent
    if (isMCPEnabled && isAgentEnabled && !file && content.trim() !== '') {
      try {
        // Process the request with the MCP Agent
        await processUserRequest(content.trim());
        return; // Exit early as the agent will handle the request
      } catch (error) {
        console.error('Error processing request with MCP Agent:', error);
        // Continue with normal processing if agent fails
      }
    }

    // Handle file upload if a file is provided
    if (file) {
      setIsUploading(true);
      setUploadProgress(0);

      // Set flag in localStorage to indicate upload in progress
      // This will be used by WebSocketContext to increase heartbeat frequency
      localStorage.setItem('uploadInProgress', 'true');

      // Reset the RAG notification state for the new document
      setRagNotificationShown(false);

      // Reset loading and streaming states to ensure we start fresh
      setIsLoading(false);
      setIsStreaming(false);

      try {
        // First, remove any existing processing or error messages
        setMessages(prev => prev.filter(msg =>
          !msg.isProcessingFile &&
          !(msg.role === 'assistant' && msg.content.includes("Sorry, there was an error"))
        ));

        // Add a single loading animation with a friendly message
        const processingMessage: ExtendedChatMessageType = {
          id: `system-processing-${Date.now()}`,
          role: 'assistant',
          content: 'Please wait while we do the processing for your document.', // User-friendly message
          timestamp: new Date(),
          isProcessingFile: true, // Add a flag to identify processing messages
          isProcessingOnly: true, // Flag to indicate this is document processing, not message streaming
          isStreaming: false, // Don't mark as streaming to avoid affecting the chat icon
          isLoadingOnly: false // Not just a loading indicator, it has text
        };

        setMessages(prev => [...prev, processingMessage]);

        // Send message with file
        const response = await chatbotService.sendMessageWithFile(
          displayContent, // Use the display content
          file,
          activeSessionId || undefined,
          (progress) => setUploadProgress(progress)
        );

        // Update the user message with the server-generated ID
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempId
              ? {
                  ...msg,
                  id: response.id,
                  fileAttachment: {
                    ...msg.fileAttachment!,
                    url: `/api/documents/download/${response.fileAttachment?.documentId}`,
                    documentId: response.fileAttachment?.documentId,
                    status: 'UPLOADED'
                  }
                }
              : msg
          )
        );

        // Get the document ID from the response
        const documentId = response.fileAttachment?.documentId;

        // If we have a document ID, the document is being processed
        if (documentId) {
          // Find the processing message we just added
          const processingMessageId = messages.find(msg => msg.isProcessingFile)?.id;

          if (processingMessageId) {
            // Update the processing message with document ID but keep it simple - just the loading animation
            setMessages(prev =>
              prev.map(msg =>
                msg.id === processingMessageId
                  ? {
                      ...msg,
                      content: 'Please wait while we do the processing for your document.', // Keep the friendly message
                      isProcessingOnly: true, // Flag to indicate this is document processing
                      isStreaming: false, // Don't mark as streaming to avoid affecting the chat icon
                      documentId: documentId,
                      documentStatus: 'PROCESSING',
                      isLoadingOnly: false // Not just a loading indicator, it has text
                    }
                  : msg
              )
            );
          }

          setIsUploading(false);
          setIsLoading(true);

          // Clear the upload in progress flag
          localStorage.removeItem('uploadInProgress');

          // Keep track of the processing message ID
          const pollingMessageId = processingMessageId || `system-processing-${Date.now()}`;

          // Create a timeout for overall processing
          const processingTimeout = setTimeout(() => {
            // Check if we're still loading
            if (isLoading) {
              // Add a fallback message
              const timeoutMessage: ExtendedChatMessageType = {
                id: `system-timeout-${Date.now()}`,
                role: 'assistant',
                content: "I've received your file, but the processing is taking longer than expected. " +
                         "I'll continue processing it in the background, and you can ask questions about it later.",
                timestamp: new Date()
              };

              // Remove the processing message
              setMessages(prev => prev.filter(msg => msg.id !== pollingMessageId));

              // Add the timeout message
              setMessages(prev => [...prev, timeoutMessage]);
              setIsLoading(false);
            }
          }, 60000); // 1 minute timeout

          // Use the document status hook instead of polling
          const { status: documentStatus, usingWebSocket } = useDocumentStatus({
            documentId,
            initialStatus: {
              status: 'PROCESSING',
              progress: 0,
              message: 'Processing document...'
            },
            pollingInterval: 2000, // Fallback to polling every 2 seconds if WebSocket is not available
            enablePolling: true
          });


          // Watch for document status changes
          useEffect(() => {
            if (!documentStatus) return;

            console.log(`Document ${documentId} status update (${usingWebSocket ? 'WebSocket' : 'Polling'}):`, documentStatus);

            // Find the current processing message
            const currentProcessingMessageId = messages.find(msg => msg.isProcessingFile)?.id || pollingMessageId;

            // Update the processing message - keep it simple with just the loading animation
            setMessages(prev =>
              prev.map(msg =>
                msg.id === currentProcessingMessageId
                  ? {
                      ...msg,
                      documentStatus: documentStatus.status,
                      // Use processing flag instead of streaming
                      isProcessingOnly: documentStatus.status !== 'PROCESSED' && documentStatus.status !== 'ERROR',
                      // Don't mark as streaming to avoid affecting the chat icon
                      isStreaming: false,
                      // Keep the friendly message
                      content: 'Please wait while we do the processing for your document.'
                    }
                  : msg
              )
            );

            // Handle based on status
            if (documentStatus.status === 'PROCESSED' || documentStatus.status === 'processed') {
              // Clear the timeout since processing is complete
              clearTimeout(processingTimeout);

              // First, completely remove ALL error messages and loading indicators
              setMessages(prev => {
                // Filter out any error messages and loading indicators
                const filteredMessages = prev.filter(msg =>
                  // Remove error messages
                  !(msg.role === 'assistant' && msg.content.includes("Sorry, there was an error")) &&
                  // Remove loading indicators
                  !msg.isProcessingFile
                );

                // Check if we already have a success message
                const hasSuccessMessage = filteredMessages.some(msg =>
                  msg.role === 'assistant' &&
                  (msg.content.includes("Your document has been fully processed") ||
                   msg.content.includes("Your document has been processed"))
                );

                if (!hasSuccessMessage) {
                  // Add success message
                  const successMessage: ExtendedChatMessageType = {
                    id: `system-success-${Date.now()}`,
                    role: 'assistant',
                    content: "Your document has been fully processed and is ready for questions! You can now ask me anything about the content, and I'll use the document to provide accurate answers.",
                    timestamp: new Date()
                  };

                  // Return filtered messages plus success message
                  return [...filteredMessages, successMessage];
                }

                // Just return filtered messages if we already have a success message
                return filteredMessages;
              });

              // Mark that we've shown the notification to prevent duplicates
              setRagNotificationShown(true);

              // Check RAG availability immediately
              console.log('Document processed, checking RAG availability immediately');
              checkRagAvailability().then(immediateCheck => {
                if (!immediateCheck) {
                  console.log('First RAG check failed, scheduling a single follow-up check');
                  // Schedule just one follow-up check after 5 seconds
                  // This prevents excessive checks that can overload the system
                  setTimeout(async () => {
                    console.log('Performing follow-up RAG availability check');
                    await checkRagAvailability();
                  }, 5000);
                }
              });

              // Enable RAG mode automatically when a document is processed
              if (!isRagEnabled) {
                setIsRagEnabled(true);
                localStorage.setItem('ragEnabled', 'true');
              }

              // Reset both loading and streaming states
              setIsLoading(false);
              setIsStreaming(false);
            } else if (documentStatus.status === 'ERROR' || documentStatus.status === 'error') {
              // Clear the timeout on error
              clearTimeout(processingTimeout);

              // First check if we already have a success message
              // (in case the document was processed in the background)
              const hasSuccessMessage = messages.some(msg =>
                msg.role === 'assistant' &&
                msg.content.includes("Your document has been fully processed")
              );

              if (!hasSuccessMessage) {
                // Remove all processing messages
                setMessages(prev => prev.filter(msg => !msg.isProcessingFile));

                // Add error message
                const errorMessage: ExtendedChatMessageType = {
                  id: `system-error-${Date.now()}`,
                  role: 'assistant',
                  content: "I encountered an error processing your document. " +
                          (documentStatus.error || "Please try uploading it again."),
                  timestamp: new Date()
                };

                setMessages(prev => [...prev, errorMessage]);
              }

              // Reset loading states
              setIsLoading(false);
              setIsStreaming(false);
            }
          }, [documentStatus, documentId, pollingMessageId, processingTimeout, usingWebSocket, isRagEnabled, checkRagAvailability, messages]);

          // Clean up timeout when component unmounts
          useEffect(() => {
            return () => {
              clearTimeout(processingTimeout);
            };
          }, [processingTimeout]);

          return; // Return early, we'll handle the AI response after processing
        }

        // Process AI response as usual
        handleAIResponse(response.id, displayContent);

        return;
      } catch (error) {
        console.error('Error uploading file:', error);

        // Check if we got a document ID in the error response
        // If we did, the document is likely still being processed
        const documentId = error.response?.data?.document?.id;

        if (documentId) {
          console.log(`Document ID ${documentId} found in error response, document is being processed...`);

          // We have a document ID, so the file was uploaded and is being processed
          // First, remove any existing error messages
          setMessages(prev => prev.filter(msg =>
            !(msg.role === 'assistant' && msg.content.includes("Sorry, there was an error"))
          ));

          // Find or create a processing message with loading indicator
          const processingMessageId = messages.find(msg => msg.isProcessingFile)?.id;

          if (processingMessageId) {
            // Update existing processing message - keep it simple with just the loading animation
            setMessages(prev =>
              prev.map(msg =>
                msg.id === processingMessageId
                  ? {
                      ...msg,
                      content: 'Please wait while we do the processing for your document.',
                      documentId: documentId,
                      documentStatus: 'PROCESSING',
                      isProcessingOnly: true, // Flag to indicate this is document processing
                      isStreaming: false, // Don't mark as streaming to avoid affecting the chat icon
                      isLoadingOnly: false // Not just a loading indicator, it has text
                    }
                  : msg
              )
            );
          } else {
            // Create new processing message with loading indicator - keep it simple
            const loadingMessage: ExtendedChatMessageType = {
              id: `system-loading-${Date.now()}`,
              role: 'assistant',
              content: 'Please wait while we do the processing for your document.',
              timestamp: new Date(),
              isProcessingFile: true,
              isProcessingOnly: true, // Flag to indicate this is document processing
              isStreaming: false, // Don't mark as streaming to avoid affecting the chat icon
              documentId: documentId,
              documentStatus: 'PROCESSING',
              isLoadingOnly: false // Not just a loading indicator, it has text
            };

            setMessages(prev => [...prev.filter(msg => !msg.isProcessingFile), loadingMessage]);
          }

          // Use the document status hook instead of manual polling
          // This will leverage WebSockets when available
          const { status: documentStatus, usingWebSocket } = useDocumentStatus({
            documentId,
            initialStatus: {
              status: 'PROCESSING',
              progress: 0,
              message: 'Processing document...'
            },
            pollingInterval: 2000, // Fallback to polling every 2 seconds if WebSocket is not available
            enablePolling: true
          });

          // Keep track of the processing message ID
          const pollingMessageId = processingMessageId || messages.find(msg => msg.isProcessingFile)?.id || `system-loading-${Date.now()}`;

          // Watch for document status changes
          useEffect(() => {
            if (!documentStatus) return;

            console.log(`Document ${documentId} status update (${usingWebSocket ? 'WebSocket' : 'Polling'}):`, documentStatus);

            // Handle based on status
            if (documentStatus.status === 'PROCESSED' || documentStatus.status === 'processed') {
              // Document is processed, show success message and remove loading indicator

              // First, completely remove ALL error messages and loading indicators
              setMessages(prev => {
                // Filter out any error messages and loading indicators
                const filteredMessages = prev.filter(msg =>
                  // Remove error messages
                  !(msg.role === 'assistant' && msg.content.includes("Sorry, there was an error")) &&
                  // Remove loading indicators
                  !msg.isProcessingFile
                );

                // Check if we already have a success message
                const hasSuccessMessage = filteredMessages.some(msg =>
                  msg.role === 'assistant' &&
                  msg.content.includes("Your document has been fully processed")
                );

                if (!hasSuccessMessage) {
                  // Add success message
                  const successMessage: ExtendedChatMessageType = {
                    id: `system-success-${Date.now()}`,
                    role: 'assistant',
                    content: "Your document has been fully processed and is ready for questions! You can now ask me anything about the content, and I'll use the document to provide accurate answers.",
                    timestamp: new Date()
                  };

                  // Return filtered messages plus success message
                  return [...filteredMessages, successMessage];
                }

                // Just return filtered messages if we already have a success message
                return filteredMessages;
              });

              // Mark that we've shown the notification to prevent duplicates
              setRagNotificationShown(true);

              // Reset loading states
              setIsLoading(false);
              setIsStreaming(false);

              // Enable RAG mode automatically
              setIsRagEnabled(true);
              localStorage.setItem('ragEnabled', 'true');
            }
          }, [documentStatus, documentId, pollingMessageId, usingWebSocket]);
        } else {
          // No document ID, so the file wasn't uploaded at all
          // In this case, we should show an error

          // First, remove any existing processing messages
          setMessages(prev => prev.filter(msg => !msg.isProcessingFile));

          // Add error message
          setMessages(prev => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: 'assistant',
              content: 'Please wait while we do the processing for your document..',
              timestamp: new Date()
            }
          ]);
        }

        setIsUploading(false);
        setIsLoading(false);

        // Clear the upload in progress flag on error
        localStorage.removeItem('uploadInProgress');

        return;
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
        const conversationHistory = messages
          .filter(msg => msg.role !== 'system') // Filter out system messages
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          }));

        // Add the current message
        conversationHistory.push({ role: 'user', content: content.trim() });

        // Set isLoading and isStreaming to true to indicate we're waiting for a response
        // The MessageList component will not show a separate loading indicator
        // when there's already a message with isStreaming=true
        setIsStreaming(true);

        // Store the abort function so we can call it if the user clicks the stop button
        abortFunctionRef.current = await aiChatService.streamChatCompletion(
          {
            modelId: selectedModel.ollama_model_id,
            messages: conversationHistory,
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

  // Helper function to handle AI response generation
  const handleAIResponse = async (_messageId: string, content: string) => {
    try {
      if (selectedModelId) {
        const modelsResponse = await getActiveOllamaModels();
        const selectedModel = modelsResponse.find(model => model.id === selectedModelId);

        if (!selectedModel) {
          throw new Error('Selected model not found');
        }

        const conversationHistory = messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));
        conversationHistory.push({ role: 'user', content });

        // Create a temporary AI message for streaming
        const aiMessageId = `ai-${Date.now()}`;
        const aiMessage: ExtendedChatMessageType = {
          id: aiMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isStreaming: true, // Mark as streaming to show the loading indicator
        };

        setMessages(prev => [...prev, aiMessage]);
        setIsStreaming(true);

        // Initialize streaming content for this message
        streamedContentRef.current[aiMessageId] = '';

        // Set up abort function
        abortFunctionRef.current = () => {
          // This will be called when the user clicks the stop button
          console.log('Aborting generation');

          // Mark the message as no longer streaming
          setMessages(prev => prev.map(msg =>
            msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg
          ));

          setIsStreaming(false);
          setIsLoading(false);
          abortFunctionRef.current = null;
        };

        // Stream the response
        abortFunctionRef.current = await aiChatService.streamChatCompletion(
          {
            modelId: selectedModel.ollama_model_id,
            messages: conversationHistory,
            options: { stream: true }
          },
          (chunk: StreamChunk) => {
            const newContent = chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || '';
            if (newContent) {
              // Update the streamed content
              streamedContentRef.current[aiMessageId] = (streamedContentRef.current[aiMessageId] || '') + newContent;

              // Update the message in state
              setMessages(prev => prev.map(msg =>
                msg.id === aiMessageId ? {
                  ...msg,
                  content: streamedContentRef.current[aiMessageId]
                } : msg
              ));
            }
          },
          async () => {
            // This is called when streaming completes
            setIsStreaming(false);

            try {
              // Add a small delay to ensure all content is accumulated
              await new Promise(resolve => setTimeout(resolve, 500));

              // Get the final content after delay
              const finalContentAfterDelay = streamedContentRef.current[aiMessageId] || '';

              // Save to database
              const dbResponse = await chatbotService.sendMessage(
                content,
                activeSessionId || undefined,
                finalContentAfterDelay
              );

              // Update the message with the database ID
              setMessages(prev => {
                return prev.map(msg =>
                  msg.id === aiMessageId ? {
                    ...msg,
                    id: dbResponse.id,
                    isStreaming: false,
                    content: finalContentAfterDelay
                  } : msg
                );
              });

              // Clean up
              delete streamedContentRef.current[aiMessageId];
              setIsLoading(false);
              abortFunctionRef.current = null;
            } catch (error) {
              console.error('Error saving message to database:', error);

              // Still mark as not streaming
              setMessages(prev => prev.map(msg =>
                msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg
              ));

              // Clean up
              delete streamedContentRef.current[aiMessageId];
              setIsLoading(false);
              abortFunctionRef.current = null;
            }
          },
          (error) => {
            // This is called on error
            console.error('Streaming error:', error);

            // Show error message
            setMessages(prev => {
              const filteredMessages = prev.filter(msg => msg.id !== aiMessageId);
              return [
                ...filteredMessages,
                {
                  id: `error-${Date.now()}`,
                  role: 'assistant',
                  content: 'Sorry, there was an error generating a response. Please try again.',
                  timestamp: new Date(),
                }
              ];
            });

            // Clean up
            delete streamedContentRef.current[aiMessageId];
            setIsLoading(false);
            setIsStreaming(false);
            abortFunctionRef.current = null;
          }
        );
      } else {
        throw new Error('No model selected');
      }
    } catch (error) {
      console.error('Error in AI response:', error);

      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, there was an error generating a response. Please try again.',
          timestamp: new Date(),
        }
      ]);

      setIsLoading(false);
      setIsStreaming(false);
    }
  };

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

    // Toggle the AI agent to match MCP state
    if (!isMCPEnabled) {
      // If we're enabling MCP, enable the agent too
      if (!isAgentEnabled) {
        toggleAgent();
      }
    } else {
      // If we're disabling MCP, disable the agent too
      if (isAgentEnabled) {
        toggleAgent();
      }
    }
  };

  const isEmpty = messages.length === 0;

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
          <MessageList
            messages={messages.filter(msg => msg.role !== 'system') as any}
            isLoading={isLoading}
            hasMoreMessages={hasMoreMessages}
            loadMoreMessages={loadMoreMessages}
            loadingMessages={loadingMessages}
            isEmpty={isEmpty}
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