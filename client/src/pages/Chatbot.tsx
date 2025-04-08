import React, { useState, useRef, useEffect } from 'react';
import { 
  PaperAirplaneIcon, 
  ArrowPathIcon,
  UserIcon,
  Cog6ToothIcon,
  XMarkIcon,
  BellIcon,
  LanguageIcon,
  ClockIcon,
  DocumentTextIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm Sierraedge AI Assistant, your AI agent for managing runs. I can help you execute or delete runs, retrieve run details, provide dashboard links, and assist with workflow management. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Settings options
  const [settings, setSettings] = useState({
    notifications: true,
    language: 'English',
    autoSuggest: true,
    darkMode: true,
    responseLength: 'Balanced'
  });

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    // Simulate AI response after a short delay
    setTimeout(() => {
      // Generate a contextual response based on input
      let responseContent = "";
      const userInput = userMessage.content.toLowerCase();
      
      if (userInput.includes("execute run") || userInput.includes("start run")) {
        responseContent = "I've initiated the run process for you. You can monitor its progress in the Run Status dashboard. Would you like me to show you the details?";
      } else if (userInput.includes("delete run") || userInput.includes("remove run")) {
        responseContent = "I can help you delete a run. Please confirm which run you'd like to remove, or I can show you a list of your recent runs.";
      } else if (userInput.includes("dashboard") || userInput.includes("analytics")) {
        responseContent = "Here's a link to the dashboard: [Dashboard](/dashboard). You can view all your analytics and metrics there.";
      } else if (userInput.includes("status") || userInput.includes("progress")) {
        responseContent = "The current run status shows 3 completed runs, 2 in progress, and 1 failed. Would you like to see details for any specific run?";
      } else {
        responseContent = "I'm here to help with your IC design workflow. I can assist with run management, provide status updates, or direct you to relevant dashboards. What specific information do you need?";
      }
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Hello! I'm RunFlow Assistant, your AI agent for managing IC design runs. I can help you execute or delete runs, retrieve run details, provide dashboard links, and assist with workflow management. How can I help you today?",
        timestamp: new Date(),
      },
    ]);
    inputRef.current?.focus();
  };

  const toggleSetting = (setting: string) => {
    setSettings(prev => ({
      ...prev,
      [setting]: typeof prev[setting] === 'boolean' ? !prev[setting] : prev[setting]
    }));
  };

  const updateSetting = (setting: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-platform-primary to-platform-secondary bg-clip-text text-transparent">
          RunFlow Assistant
        </h2>
        <div className="flex space-x-2">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center px-3 py-1.5 text-sm rounded-lg bg-platform-surface hover:bg-platform-surface-light transition-colors"
          >
            <Cog6ToothIcon className="w-4 h-4 mr-2" />
            Settings
          </button>
          <button 
            onClick={resetChat}
            className="flex items-center px-3 py-1.5 text-sm rounded-lg bg-platform-surface hover:bg-platform-surface-light transition-colors"
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            New Chat
          </button>
        </div>
      </div>
      
      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-platform-dark border border-platform-border rounded-lg p-4 mb-4 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-platform-light">Assistant Settings</h3>
            <button 
              onClick={() => setShowSettings(false)}
              className="text-platform-muted hover:text-platform-light transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Notification Settings */}
            <div className="p-3 bg-platform-surface rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <BellIcon className="w-5 h-5 text-platform-primary mr-2" />
                  <span className="text-platform-light">Notifications</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={settings.notifications}
                    onChange={() => toggleSetting('notifications')}
                  />
                  <div className="w-11 h-6 bg-platform-border rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-platform-primary"></div>
                </label>
              </div>
              <p className="text-xs text-platform-muted mt-2">Receive notifications about run status changes and completions</p>
            </div>
            
            {/* Language Settings */}
            <div className="p-3 bg-platform-surface rounded-lg">
              <div className="flex items-center mb-2">
                <LanguageIcon className="w-5 h-5 text-platform-primary mr-2" />
                <span className="text-platform-light">Language</span>
              </div>
              <select 
                value={settings.language}
                onChange={(e) => updateSetting('language', e.target.value)}
                className="w-full bg-platform-dark border border-platform-border rounded-lg px-3 py-2 text-platform-light text-sm"
              >
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="Chinese">Chinese</option>
                <option value="Japanese">Japanese</option>
              </select>
            </div>
            
            {/* Auto-suggest Settings */}
            <div className="p-3 bg-platform-surface rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <DocumentTextIcon className="w-5 h-5 text-platform-primary mr-2" />
                  <span className="text-platform-light">Auto-suggest Commands</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={settings.autoSuggest}
                    onChange={() => toggleSetting('autoSuggest')}
                  />
                  <div className="w-11 h-6 bg-platform-border rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-platform-primary"></div>
                </label>
              </div>
              <p className="text-xs text-platform-muted mt-2">Show command suggestions based on your workflow</p>
            </div>
            
            {/* Response Length Settings */}
            <div className="p-3 bg-platform-surface rounded-lg">
              <div className="flex items-center mb-2">
                <ChartBarIcon className="w-5 h-5 text-platform-primary mr-2" />
                <span className="text-platform-light">Response Length</span>
              </div>
              <div className="flex space-x-2">
                {['Concise', 'Balanced', 'Detailed'].map(option => (
                  <button
                    key={option}
                    onClick={() => updateSetting('responseLength', option)}
                    className={`px-3 py-1 text-xs rounded-lg ${
                      settings.responseLength === option 
                        ? 'bg-platform-primary text-white' 
                        : 'bg-platform-dark text-platform-muted hover:text-platform-light'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Chat messages container */}
      <div className="flex-1 overflow-y-auto bg-platform-dark rounded-lg p-4 mb-4 shadow-lg">
        <div className="space-y-4">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-platform-primary/20 flex items-center justify-center text-platform-primary mr-2">
                  RF
                </div>
              )}
              
              <div 
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  message.role === 'user' 
                    ? 'bg-platform-primary text-white' 
                    : 'bg-platform-surface text-platform-light'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-platform-secondary/20 flex items-center justify-center text-platform-secondary ml-2">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-platform-primary/20 flex items-center justify-center text-platform-primary mr-2">
                RF
              </div>
              <div className="bg-platform-surface text-platform-light max-w-[80%] rounded-lg px-4 py-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-platform-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-platform-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-platform-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Input form */}
      <div className="relative bg-platform-dark rounded-lg border border-platform-border shadow-lg">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about runs, status, or workflow management..."
          className="w-full bg-transparent border-none rounded-lg pl-4 pr-12 py-3 text-platform-light placeholder-platform-muted resize-none h-[60px] focus:outline-none focus:ring-2 focus:ring-platform-primary/30"
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-platform-primary hover:text-platform-primary/80 disabled:text-platform-muted disabled:cursor-not-allowed transition-colors"
        >
          <PaperAirplaneIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
} 