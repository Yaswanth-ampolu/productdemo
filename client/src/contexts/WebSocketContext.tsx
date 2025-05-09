// Singleton pattern for WebSocket connections using global variables
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { useAuth } from './AuthContext';

/**
 * WebSocket message type
 */
interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

/**
 * WebSocket context type
 */
interface WebSocketContextType {
  connected: boolean;
  send: (data: any) => void;
  lastMessage: WebSocketMessage | null;
  // Add a listener for specific message types
  addMessageListener: (type: string, callback: (message: WebSocketMessage) => void) => () => void;
  // Force reconnection of the WebSocket
  reconnect: () => void;
}

// Create the context with default values
const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Global WebSocket instance to ensure only one connection is created
// This prevents multiple connections when components mount/unmount
let globalWebSocket: WebSocket | null = null;
let globalConnected = false;
let globalMessageListeners = new Map<string, Set<(message: WebSocketMessage) => void>>();
let globalLastMessage: WebSocketMessage | null = null;

// Expose the global WebSocket instance to the window object for debugging
(window as any).globalWebSocket = globalWebSocket;

/**
 * WebSocket Provider Props
 */
interface WebSocketProviderProps {
  children: ReactNode;
}

/**
 * WebSocket Provider Component
 *
 * Manages WebSocket connection and provides context for components to interact with WebSockets
 */
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  // Use state to track the global WebSocket instance
  const [socket, setSocket] = useState<WebSocket | null>(globalWebSocket);
  const [connected, setConnected] = useState<boolean>(globalConnected);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(globalLastMessage);
  const [messageListeners, setMessageListeners] = useState<Map<string, Set<(message: WebSocketMessage) => void>>>(
    globalMessageListeners
  );
  const { user } = useAuth();

  // Reconnection settings
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const maxReconnectAttempts = 15; // Increased to 15 for more persistent reconnection
  const reconnectDelay = 1000; // Start with 1 second

  // Heartbeat settings
  const heartbeatInterval = 15000; // Reduced to 15 seconds for more responsive connection monitoring

  // Connection throttling to prevent excessive connections
  const connectionThrottleRef = useRef<number>(0);
  const connectionThrottleDelay = 5000; // 5 seconds between connection attempts

  // Debug counter to track component mounts
  const [mountCount] = useState(() => {
    console.log('WebSocketProvider mounted');
    return Math.random();
  });

  // Track if this is the primary WebSocketProvider instance
  // We'll use this to prevent multiple instances from creating connections
  const isPrimaryProvider = useRef<boolean>(false);

  // Check if we're the primary provider on mount
  useEffect(() => {
    if (!(window as any).__websocketProviderMounted) {
      console.log('This is the primary WebSocketProvider instance');
      (window as any).__websocketProviderMounted = true;
      isPrimaryProvider.current = true;
    } else {
      console.log('Secondary WebSocketProvider instance detected, will not create new connections');
    }

    return () => {
      // Only clear the flag if we're the primary provider
      if (isPrimaryProvider.current) {
        console.log('Primary WebSocketProvider unmounting, clearing global flag');
        (window as any).__websocketProviderMounted = false;
      }
    };
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (!user) {
      console.log('Not connecting WebSocket: User not authenticated');
      return; // Don't connect if not authenticated
    }

    // Implement connection throttling to prevent excessive connections
    const now = Date.now();
    if (now - connectionThrottleRef.current < connectionThrottleDelay) {
      console.log(`Connection throttled: Last attempt was ${(now - connectionThrottleRef.current) / 1000}s ago, waiting...`);
      return;
    }

    // Update the throttle timestamp
    connectionThrottleRef.current = now;

    // Only allow the primary provider to create connections
    if (!isPrimaryProvider.current) {
      console.log('Not connecting WebSocket: Not the primary provider');

      // Still update local state to reflect global state
      if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
        setSocket(globalWebSocket);
        setConnected(globalConnected);
        setLastMessage(globalLastMessage);
        setMessageListeners(globalMessageListeners);
      }

      return;
    }

    // If we already have a global connection, check if it's actually working
    if (globalWebSocket) {
      if (globalWebSocket.readyState === WebSocket.OPEN) {
        console.log('Using existing global WebSocket connection');
        setSocket(globalWebSocket);
        setConnected(true);
        globalConnected = true;
        setLastMessage(globalLastMessage);
        setMessageListeners(globalMessageListeners);

        // Send a ping to verify the connection is truly working
        try {
          globalWebSocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          console.log('Sent verification ping to existing WebSocket connection');
        } catch (error) {
          console.error('Error sending ping to existing connection, will reconnect:', error);
          globalWebSocket.close();
          globalWebSocket = null;
          // Continue to create a new connection below
        }

        return;
      } else if (globalWebSocket.readyState === WebSocket.CONNECTING) {
        console.log('WebSocket connection is already in progress');
        setSocket(globalWebSocket);
        return;
      } else {
        // Connection is closing or closed, clean it up
        console.log('Cleaning up non-open WebSocket connection');
        globalWebSocket.close();
        globalWebSocket = null;
      }
    }

    // Determine WebSocket protocol based on current page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log(`Creating new global WebSocket connection to ${wsUrl}`);

    try {
      // Set a flag in localStorage to indicate we're trying to connect
      localStorage.setItem('websocketConnecting', 'true');

      console.log(`Attempting to connect to WebSocket at ${wsUrl}`);

      // Add more detailed debugging
      console.log('Current user:', user);
      console.log('Cookie available:', document.cookie ? 'Yes' : 'No');

      const newSocket = new WebSocket(wsUrl);
      console.log('WebSocket object created, readyState:', newSocket.readyState);

      // Store the socket in the global variable
      globalWebSocket = newSocket;

      // Update the window reference for debugging
      (window as any).globalWebSocket = globalWebSocket;

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (newSocket.readyState !== WebSocket.OPEN) {
          console.log('WebSocket connection timeout, closing and retrying');
          console.log('Final readyState before timeout:', newSocket.readyState);
          newSocket.close();
          // This will trigger the onclose handler which will attempt to reconnect
        }
      }, 10000); // 10 second timeout

      newSocket.onopen = () => {
        console.log('WebSocket connection established');
        clearTimeout(connectionTimeout);
        localStorage.removeItem('websocketConnecting');
        localStorage.setItem('websocketConnected', 'true');
        globalConnected = true;
        setConnected(true);
        setReconnectAttempts(0); // Reset reconnect attempts on successful connection

        // Send an initial ping to verify the connection
        try {
          newSocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (error) {
          console.error('Error sending initial ping:', error);
        }
      };

      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;

          // Only log non-ping messages to reduce console noise
          if (data.type !== 'ping' && data.type !== 'pong') {
            console.log('WebSocket message received:', data);
          }

          // Update last message
          globalLastMessage = data;
          setLastMessage(data);

          // Notify listeners for this message type
          if (data.type && globalMessageListeners.has(data.type)) {
            const listeners = globalMessageListeners.get(data.type);
            if (listeners) {
              listeners.forEach(callback => callback(data));
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      newSocket.onclose = (event) => {
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
        localStorage.removeItem('websocketConnected');
        localStorage.removeItem('websocketConnecting');
        globalConnected = false;
        setConnected(false);

        // Only attempt to reconnect if:
        // 1. It wasn't a clean close (or was closed due to error)
        // 2. We haven't exceeded max attempts
        // 3. The user is still authenticated
        if ((event.code !== 1000 || !event.wasClean) && reconnectAttempts < maxReconnectAttempts && user) {
          const nextAttempt = reconnectAttempts + 1;
          // Use a more aggressive reconnection strategy for the first few attempts
          let delay: number;
          if (nextAttempt <= 3) {
            delay = reconnectDelay * nextAttempt; // Linear backoff for first 3 attempts (1s, 2s, 3s)
          } else {
            delay = reconnectDelay * Math.pow(1.3, nextAttempt - 3); // Exponential backoff after that
          }

          console.log(`Attempting to reconnect (${nextAttempt}/${maxReconnectAttempts}) in ${delay}ms...`);
          localStorage.setItem('websocketReconnecting', 'true');
          setReconnectAttempts(nextAttempt);

          // Store the timeout ID so we can clear it if needed
          const timeoutId = setTimeout(() => {
            // Double-check that user is still authenticated before reconnecting
            if (user) {
              // Reset the global WebSocket to ensure a fresh connection
              if (globalWebSocket) {
                globalWebSocket.close();
                globalWebSocket = null;
              }
              localStorage.removeItem('websocketReconnecting');
              connect();
            } else {
              console.log('User no longer authenticated, canceling reconnection attempt');
              localStorage.removeItem('websocketReconnecting');
            }
          }, delay);

          // Return a cleanup function that will be called if the component unmounts
          // before the timeout completes
          return () => {
            console.log('Cleaning up reconnection timeout');
            clearTimeout(timeoutId);
            localStorage.removeItem('websocketReconnecting');
          };
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.log('Maximum reconnection attempts reached. Will try again when user navigates or refreshes.');
          localStorage.removeItem('websocketReconnecting');
          // Reset reconnect attempts after a shorter delay to allow future reconnection attempts
          setTimeout(() => {
            setReconnectAttempts(0);
            // Try one more time after the reset
            if (user) {
              console.log('Attempting one final reconnection after reset');
              connect();
            }
          }, 30000); // Wait 30 seconds before allowing reconnection attempts again (reduced from 60s)
        }
      };

      newSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Don't close the connection here, let the onclose handler deal with reconnection
      };

      setSocket(newSocket);
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  }, [user, reconnectAttempts]);

  /**
   * Connect/disconnect based on authentication state
   */
  useEffect(() => {
    if (user) {
      connect();
    } else if (socket) {
      // Close connection if user logs out
      console.log('Closing WebSocket connection due to user logout');
      socket.close();
      setSocket(null);
      setConnected(false);
    }

    // Cleanup on unmount
    return () => {
      if (socket) {
        console.log('Closing WebSocket connection on component unmount');
        socket.close();
        setSocket(null);
      }
    };
  }, [user, connect, socket]);

  /**
   * Handle page navigation and browser close events
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socket) {
        console.log('Closing WebSocket connection before page unload');
        // Use synchronous close for beforeunload event
        socket.close();
      }
    };

    // Add event listeners for page unload
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [socket]);

  /**
   * Implement heartbeat mechanism to keep connection alive
   * This uses the global WebSocket instance to ensure only one heartbeat is active
   */
  useEffect(() => {
    // Only set up heartbeat if we have a global connection and we're the primary provider
    if (!isPrimaryProvider.current) return;

    // Check if heartbeat is already active
    if ((window as any).__websocketHeartbeatActive) {
      console.log('Heartbeat already active, not setting up another one');
      return;
    }

    console.log('Setting up WebSocket heartbeat');

    // Track last successful pong response time
    let lastPongTime = Date.now();

    // Track if we're waiting for a pong response
    let waitingForPong = false;

    // Set up a handler for pong responses
    const handlePongResponse = (message: WebSocketMessage) => {
      if (message.type === 'pong') {
        waitingForPong = false;
        lastPongTime = Date.now();
        // console.log('Received pong response, connection is alive');
      }
    };

    // Add the pong message listener
    const removeListener = addMessageListener('pong', handlePongResponse);

    // More frequent heartbeat during file uploads or document processing
    const getHeartbeatInterval = () => {
      const uploadInProgress = localStorage.getItem('uploadInProgress') === 'true';
      const documentProcessing = localStorage.getItem('documentProcessing') === 'true';

      if (uploadInProgress || documentProcessing) {
        console.log(`${uploadInProgress ? 'Upload' : 'Document processing'} in progress, using more frequent heartbeat interval`);
        return 5000; // Use a fixed 5-second interval during active operations for more reliable connection
      }

      return heartbeatInterval;
    };

    // Send ping every heartbeatInterval
    const pingTimer = setInterval(() => {
      // Check if we're waiting too long for a pong response (connection might be dead)
      const currentTime = Date.now();
      const timeSinceLastPong = currentTime - lastPongTime;

      // If we've been waiting for a pong for too long (3x the heartbeat interval), force reconnect
      if (waitingForPong && timeSinceLastPong > heartbeatInterval * 3) {
        console.log(`No pong response received for ${timeSinceLastPong}ms, forcing reconnection`);
        if (globalWebSocket) {
          globalWebSocket.close();
          globalWebSocket = null;
        }
        globalConnected = false;
        setConnected(false);
        waitingForPong = false;
        connect();
        return;
      }

      // Normal heartbeat logic
      if (globalWebSocket) {
        if (globalWebSocket.readyState === WebSocket.OPEN) {
          try {
            // Mark that we're waiting for a pong response
            waitingForPong = true;
            globalWebSocket.send(JSON.stringify({
              type: 'ping',
              timestamp: currentTime
            }));
          } catch (error) {
            console.error('Error sending heartbeat ping:', error);
            // If we can't send a ping, the connection might be dead
            // Force a reconnection
            if (globalWebSocket) {
              globalWebSocket.close();
              globalWebSocket = null;
              globalConnected = false;
              setConnected(false);
              // Trigger reconnect
              connect();
            }
          }
        } else if (globalWebSocket.readyState === WebSocket.CLOSED || globalWebSocket.readyState === WebSocket.CLOSING) {
          // If the connection is closed or closing, try to reconnect
          console.log('Heartbeat detected closed connection, attempting to reconnect');
          globalWebSocket = null;
          globalConnected = false;
          setConnected(false);
          connect();
        }
      } else if (user) {
        // If we have a user but no WebSocket, try to connect
        console.log('Heartbeat detected missing WebSocket connection, attempting to connect');
        connect();
      }
    }, getHeartbeatInterval());

    // Set up a global variable to track if heartbeat is already set up
    // This prevents multiple heartbeats if multiple WebSocketProvider components are mounted
    (window as any).__websocketHeartbeatActive = true;

    return () => {
      // Only clean up if this is the last WebSocketProvider being unmounted
      console.log('Cleaning up WebSocket heartbeat');
      clearInterval(pingTimer);
      removeListener(); // Remove the pong message listener
      (window as any).__websocketHeartbeatActive = false;
    };
  }, [connect, heartbeatInterval, user]);

  /**
   * Send data through the WebSocket connection
   * Uses the global WebSocket instance to ensure messages are sent through the single connection
   */
  const send = useCallback((data: any) => {
    if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
      globalWebSocket.send(JSON.stringify(data));
    } else if (socket && connected) {
      // Fallback to local socket if global is not available
      socket.send(JSON.stringify(data));
    } else {
      console.warn('Cannot send message: WebSocket is not connected');
    }
  }, [socket, connected]);

  /**
   * Add a listener for a specific message type
   */
  const addMessageListener = useCallback((type: string, callback: (message: WebSocketMessage) => void) => {
    // Update the global message listeners
    if (!globalMessageListeners.has(type)) {
      globalMessageListeners.set(type, new Set());
    }

    globalMessageListeners.get(type)?.add(callback);

    // Update the local state to trigger re-renders
    setMessageListeners(new Map(globalMessageListeners));

    // Return a function to remove this listener
    return () => {
      if (globalMessageListeners.has(type)) {
        const listeners = globalMessageListeners.get(type);
        if (listeners) {
          listeners.delete(callback);

          if (listeners.size === 0) {
            globalMessageListeners.delete(type);
          }

          // Update the local state to trigger re-renders
          setMessageListeners(new Map(globalMessageListeners));
        }
      }
    };
  }, []);

  /**
   * Force a reconnection of the WebSocket
   */
  const reconnect = useCallback(() => {
    console.log('Manually reconnecting WebSocket...');

    // Only allow the primary provider to reconnect
    if (!isPrimaryProvider.current) {
      console.log('Not reconnecting WebSocket: Not the primary provider');
      return;
    }

    // Implement connection throttling to prevent excessive reconnections
    const now = Date.now();
    if (now - connectionThrottleRef.current < connectionThrottleDelay) {
      console.log(`Reconnection throttled: Last attempt was ${(now - connectionThrottleRef.current) / 1000}s ago, waiting...`);

      // Schedule a reconnection after the throttle delay
      setTimeout(() => {
        console.log('Executing delayed reconnection after throttle period');
        reconnect();
      }, connectionThrottleDelay);

      return;
    }

    // Update the throttle timestamp
    connectionThrottleRef.current = now;

    // Close existing connection if any
    if (globalWebSocket) {
      console.log('Closing existing WebSocket connection for manual reconnect');
      globalWebSocket.close();
      globalWebSocket = null;
    }

    // Reset connection state
    globalConnected = false;
    setConnected(false);

    // Reset reconnect attempts
    setReconnectAttempts(0);

    // Trigger reconnect
    connect();
  }, [connect, connectionThrottleDelay]);

  return (
    <WebSocketContext.Provider value={{ connected, send, lastMessage, addMessageListener, reconnect }}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Hook to use the WebSocket context
 */
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);

  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }

  return context;
};

export default WebSocketContext;
