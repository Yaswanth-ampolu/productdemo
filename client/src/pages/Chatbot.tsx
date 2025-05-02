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
import ChatInput from '../components/chat/ChatInput';
import ChatSidebar from '../components/chat/ChatSidebar';
import MessageList from '../components/chat/MessageList';
import ModelSelector from '../components/chat/ModelSelector';

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

  const titleInputRef = useRef<HTMLInputElement>(null);
  const streamedContentRef = useRef<{[key: string]: string}>({}); // Store streamed content by message ID
  const abortFunctionRef = useRef<(() => void) | null>(null); // Store the abort function

  // Fetch sessions on component mount
  useEffect(() => {
    fetchSessions();
    checkRagAvailability();

    // Set up periodic RAG availability check (every 30 seconds)
    // This is a background check and doesn't need to run frequently
    const ragCheckInterval = setInterval(() => {
      // Only check if we haven't already shown the notification
      // This prevents unnecessary checks once RAG is known to be available
      if (!ragNotificationShown) {
        console.log('Performing periodic RAG availability check');
        checkRagAvailability();
      }
    }, 30000); // Increased from 10s to 30s to reduce unnecessary checks

    // Clean up interval on unmount
    return () => {
      clearInterval(ragCheckInterval);
    };
  }, [ragNotificationShown]); // Add dependency to re-setup interval when notification state changes

  // Fetch messages when active session changes
  useEffect(() => {
    if (activeSessionId) {
      fetchSessionMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  // Check if RAG is available
  const checkRagAvailability = async () => {
    try {
      const available = await ragChatService.isRagAvailable();
      console.log(`RAG availability checked: ${available ? 'Available' : 'Not available'} at ${new Date().toISOString()}`);

      // If RAG is now available but wasn't before, show a notification (only once)
      if (available && !isRagAvailable && !ragNotificationShown) {
        console.log('RAG is now available, showing notification (first time)');
        // Add a system message to notify the user
        const ragAvailableMessage: ExtendedChatMessageType = {
          id: `system-rag-available-${Date.now()}`,
          role: 'assistant',
          content: "Your document has been processed! You can now ask questions about it using the RAG feature.",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, ragAvailableMessage]);

        // Mark that we've shown the notification
        setRagNotificationShown(true);

        // Enable RAG mode automatically
        setIsRagEnabled(true);
        localStorage.setItem('ragEnabled', 'true');
      } else if (available && !isRagAvailable && ragNotificationShown) {
        console.log('RAG is now available, but notification already shown');
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

    // Handle file upload if a file is provided
    if (file) {
      setIsUploading(true);
      setUploadProgress(0);

      // Reset the RAG notification state for the new document
      setRagNotificationShown(false);

      try {
        // Add an immediate system message about processing
        const processingMessage: ExtendedChatMessageType = {
          id: `system-${Date.now()}`,
          role: 'assistant',
          content: 'I\'m processing your document. This may take a moment...',
          timestamp: new Date(),
          isProcessingFile: true // Add a flag to identify processing messages
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

        // Remove the temporary processing message
        setMessages(prev => prev.filter(msg => !msg.isProcessingFile));

        setIsUploading(false);
        setIsLoading(true);

        // Poll document status
        if (response.fileAttachment?.documentId) {
          const documentId = response.fileAttachment.documentId;

          // Add a status polling message
          const pollingMessage: ExtendedChatMessageType = {
            id: `system-polling-${Date.now()}`,
            role: 'assistant',
            content: 'Processing document...',
            timestamp: new Date(),
            isProcessingFile: true,
            documentId: documentId,
            documentStatus: 'PROCESSING'
          };

          setMessages(prev => [...prev, pollingMessage]);

          // Keep track of the polling message ID to update it later
          const pollingMessageId = pollingMessage.id;

          // Create a timeout for overall processing
          const processingTimeout = setTimeout(() => {
            clearInterval(statusInterval);

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

              setMessages(prev =>
                prev.map(msg =>
                  msg.id === pollingMessageId
                    ? { ...msg, documentStatus: 'TIMEOUT' }
                    : msg
                )
              );

              setMessages(prev => [...prev, timeoutMessage]);
              setIsLoading(false);
            }
          }, 60000); // 1 minute timeout

          // Start polling for document status
          const statusInterval = setInterval(async () => {
            try {
              // Check if component is still mounted (use a ref to track this)
              if (!document.body.contains(document.getElementById('chatbot-container'))) {
                clearInterval(statusInterval);
                clearTimeout(processingTimeout);
                return;
              }

              const statusResponse = await chatbotService.getDocumentStatus(documentId);
              console.log(`Document ${documentId} status:`, statusResponse);

              // Update the polling message
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === pollingMessageId
                    ? { ...msg, documentStatus: statusResponse.status }
                    : msg
                )
              );

              // Handle based on status
              if (statusResponse.status === 'PROCESSED') {
                // Clear the interval since processing is complete
                clearInterval(statusInterval);
                clearTimeout(processingTimeout);

                // Remove polling message
                setMessages(prev => prev.filter(msg => msg.id !== pollingMessageId));

                // Add the final success message
                const successMessage: ExtendedChatMessageType = {
                  id: `system-success-${Date.now()}`,
                  role: 'assistant',
                  content: "Your document has been processed! You can now ask questions about it using the RAG feature.",
                  timestamp: new Date()
                };

                // Mark that we've shown the notification to prevent duplicates
                setRagNotificationShown(true);

                // Check RAG availability multiple times with increasing delays
                // Sometimes the vector store needs a moment to be fully available after processing
                console.log('Document processed, checking RAG availability immediately');
                const immediateCheck = await checkRagAvailability();

                if (!immediateCheck) {
                  console.log('First RAG check failed, scheduling additional checks');
                  // Schedule additional checks with increasing delays and frequency
                  const checkIntervals = [1000, 2000, 3000, 5000, 8000, 13000];

                  for (const interval of checkIntervals) {
                    setTimeout(async () => {
                      console.log(`Checking RAG availability after ${interval}ms`);
                      const available = await checkRagAvailability();
                      if (available) {
                        console.log(`RAG became available after ${interval}ms delay`);
                      }
                    }, interval);
                  }
                }

                // Enable RAG mode automatically when a document is processed
                if (!isRagEnabled) {
                  setIsRagEnabled(true);
                  localStorage.setItem('ragEnabled', 'true');
                }

                setMessages(prev => [...prev, successMessage]);
                setIsLoading(false);
              } else if (statusResponse.status === 'ERROR') {
                // Clear the interval on error
                clearInterval(statusInterval);
                clearTimeout(processingTimeout);

                // Show error message
                const errorMessage: ExtendedChatMessageType = {
                  id: `system-error-${Date.now()}`,
                  role: 'assistant',
                  content: "I encountered an error processing your document. " +
                           (statusResponse.error || "Please try uploading it again."),
                  timestamp: new Date()
                };

                setMessages(prev => prev.filter(msg => msg.id !== pollingMessageId));
                setMessages(prev => [...prev, errorMessage]);
                setIsLoading(false);
              } else if (statusResponse.status === 'EMBEDDING') {
                // Update the polling message with embedding status
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === pollingMessageId
                    ? {
                        ...msg,
                          content: 'Generating embeddings for document... This may take a few minutes for large documents.',
                          documentStatus: 'EMBEDDING'
                      }
                    : msg
                )
              );

                // Don't clear interval yet, keep polling
              }
            } catch (error) {
              console.error('Error checking document status:', error);

              try {
                // Error could be due to auth issues, verify we're still logged in
                // This should refresh the auth token if needed
                await refreshUser();

                // If we get here, user is still authenticated
                console.log('Auth check successful during document processing');
              } catch (authError) {
                console.error('Authentication failure during document processing:', authError);

                // Clear intervals and timeouts
                clearInterval(statusInterval);
                clearTimeout(processingTimeout);

                // We won't redirect here, let the API interceptor handle it
                setIsLoading(false);
                return;
              }

              // If the error wasn't auth-related, reduce polling frequency but continue
              clearInterval(statusInterval);

              // New interval with longer delay (10 seconds instead of 2)
              const newInterval = setInterval(async () => {
                // Same code as above, but we won't nest another recovery mechanism
                try {
                  const statusResponse = await chatbotService.getDocumentStatus(documentId);
                  console.log(`Document ${documentId} status (recovery polling):`, statusResponse);

                  // Same status handling as above
                  if (statusResponse.status === 'PROCESSED' || statusResponse.status === 'ERROR') {
                    clearInterval(newInterval);
                    clearTimeout(processingTimeout);

                    const finalMessage: ExtendedChatMessageType = {
                      id: `system-${statusResponse.status.toLowerCase()}-${Date.now()}`,
                      role: 'assistant',
                      content: statusResponse.status === 'PROCESSED'
                        ? "Your document has been processed! You can now ask questions about it using the RAG feature."
                        : "There was an error processing your document. " + (statusResponse.error || "Please try again."),
                      timestamp: new Date()
                    };

                    // If processed successfully, mark notification as shown
                    if (statusResponse.status === 'PROCESSED') {
                      setRagNotificationShown(true);
                    }

                    setMessages(prev => prev.filter(msg => msg.id !== pollingMessageId));
                    setMessages(prev => [...prev, finalMessage]);
                    setIsLoading(false);

                    // If document was processed successfully, check RAG availability
                    if (statusResponse.status === 'PROCESSED') {
                      // Check RAG availability multiple times with increasing delays
                      console.log('Document processed (recovery path), checking RAG availability');
                      const immediateCheck = await checkRagAvailability();

                      if (!immediateCheck) {
                        console.log('First RAG check failed (recovery path), scheduling additional checks');
                        // Schedule additional checks with increasing delays and frequency
                        const checkIntervals = [1000, 2000, 3000, 5000, 8000, 13000];

                        for (const interval of checkIntervals) {
                          setTimeout(async () => {
                            console.log(`Checking RAG availability after ${interval}ms (recovery path)`);
                            const available = await checkRagAvailability();
                            if (available) {
                              console.log(`RAG became available after ${interval}ms delay (recovery path)`);
                            }
                          }, interval);
                        }
                      }

                      // Enable RAG mode automatically
                      setIsRagEnabled(true);
                      localStorage.setItem('ragEnabled', 'true');
                    }
                  }
                } catch (recoveryError) {
                  console.error('Error in recovery polling:', recoveryError);
                  // Just log the error but don't take further action
                }
              }, 10000); // Poll every 10 seconds in recovery mode
            }

          }, 2000); // Poll every 2 seconds

          // Clean up interval after 30 seconds (reduced from 5 minutes) to prevent waiting too long
          setTimeout(() => {
            clearInterval(statusInterval);

            // Only add a timeout message if we're still loading
            if (isLoading) {
              const timeoutMessage: ExtendedChatMessageType = {
                id: `system-timeout-${Date.now()}`,
                role: 'assistant',
                content: "I've received your file, but the processing is taking longer than expected. " +
                         "I'll continue processing it in the background, and you can ask questions about it later.",
                timestamp: new Date()
              };

              setMessages(prev => [...prev, timeoutMessage]);
              setIsLoading(false);
            }
          }, 30000);

          return; // Return early, we'll handle the AI response after processing
        }

        // Process AI response as usual
        handleAIResponse(response.id, displayContent);

        return;
      } catch (error) {
        console.error('Error uploading file:', error);
        setIsUploading(false);
        setIsLoading(false);

        // Show error message
        setMessages(prev => [
          ...prev.filter(msg => msg.id !== tempId && !msg.isProcessingFile),
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, there was an error uploading your file. Please try again.',
            timestamp: new Date()
          }
        ]);

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
            className={`${isEmpty ? "absolute left-1/2 bottom-[25%] transform -translate-x-1/2" : "absolute bottom-0 left-0 right-0"}
            ${!isEmpty && ""} py-4 px-4 md:px-8 lg:px-16 xl:px-24 input-area-blur`}
            style={{
              maxWidth: '100%',
              margin: '0 auto'
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
            />

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