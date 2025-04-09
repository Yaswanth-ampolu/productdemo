import React, { useState, useRef, useEffect } from 'react';
import { 
  PaperAirplaneIcon, 
  ArrowPathIcon,
  UserIcon,
  CpuChipIcon,
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  MicrophoneIcon
} from '@heroicons/react/24/outline';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Mcp {
  id: number;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMcpSelector, setShowMcpSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mcpSelectorRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    setMessages([]);
    inputRef.current?.focus();
  };

  const toggleMcp = (mcpId: number) => {
    setMcps(prev => prev.map(mcp => 
      mcp.id === mcpId ? { ...mcp, isActive: !mcp.isActive } : mcp
    ));
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
              <div key={index} className="bg-[#0D1117] rounded-md my-2 overflow-x-auto">
                <div className="flex items-center justify-between bg-[#161B22] px-4 py-1 text-xs text-zinc-400 border-b border-zinc-800">
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
    const groups: { role: string; messages: Message[] }[] = [];
    
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

  return (
    <div className="fixed inset-0 bg-[#030712] flex flex-col">
      {/* Chat Header - Only shown when not empty */}
      {!isEmpty && (
        <div className="bg-[#030712] border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex justify-end">
              <button
                onClick={resetChat}
                className="text-zinc-400 hover:text-white transition-colors p-1 rounded-md hover:bg-zinc-800"
                title="Reset chat"
              >
                <ArrowPathIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Main layout */}
      <div className="flex-1 relative overflow-hidden">
        {/* Messages area - only this should scroll */}
        <div className="absolute inset-0 overflow-y-auto scrollbar-hide">
          {isEmpty ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-6 max-w-lg">
                <h2 className="text-3xl font-semibold mb-3 text-white">
                  What can I help with?
                </h2>
              </div>
            </div>
          ) : (
            <div className="w-full mx-auto pt-4 px-8 pb-0 md:px-20 lg:px-40">
              {/* Message groups */}
              {groupedMessages.map((group, groupIndex) => (
                <div key={groupIndex} className="message-group mb-6">
                  {group.role === "user" ? (
                    group.messages.map((message, msgIdx) => (
                      <div key={msgIdx} className="mb-1.5 flex justify-end">
                        <div className="max-w-[70%] rounded-2xl px-4 py-3 bg-indigo-600 text-white">
                          <div className="whitespace-pre-wrap">{formatMessageContent(message.content)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="mb-1.5 pb-4 border-b border-zinc-800">
                      {group.messages.map((message, msgIdx) => (
                        <div key={msgIdx} className="flex mb-1">
                          {msgIdx === 0 && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-white mr-3 shrink-0 mt-1">
                              SE
                            </div>
                          )}
                          <div className={`max-w-[80%] ${msgIdx === 0 ? "" : "ml-11"}`}>
                            <div className="text-white">
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
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-white mr-3 shrink-0 mt-1">
                    SE
                  </div>
                  <div className="text-white">
                    <div className="flex space-x-2 items-center">
                      <div className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
        
        {/* Input area - always fixed */}
        <div className={`${isEmpty ? "absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/4" : "absolute bottom-0 left-0 right-0"} bg-[#030712] ${!isEmpty && "border-t border-zinc-800"} py-4 px-8 md:px-20 lg:px-40`}>
          {/* MCP selector dropdown */}
          {showMcpSelector && (
            <div 
              ref={mcpSelectorRef}
              className="absolute bottom-full mb-2 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-[#030712] rounded-xl shadow-2xl border border-zinc-800 p-3 z-20"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-medium text-white">Model Context Protocols</div>
                <button 
                  type="button" 
                  onClick={() => setShowMcpSelector(false)}
                  className="text-zinc-400 hover:text-white p-1"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              {mcps.length === 0 ? (
                <div className="text-center py-4 text-zinc-400 text-sm">
                  No MCPs available.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {mcps.map(mcp => (
                    <div 
                      key={mcp.id}
                      className="p-2 rounded-md hover:bg-[#0f172a] transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-md flex items-center justify-center mr-2 bg-[#0f172a] text-indigo-400">
                          <i className={`${mcp.icon || 'ri-cpu-line'} text-base`}></i>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{mcp.name}</div>
                          <div className="text-xs text-zinc-400 truncate max-w-[15rem]">{mcp.description}</div>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={mcp.isActive}
                          onChange={() => toggleMcp(mcp.id)}
                          className="sr-only peer" 
                        />
                        <div className="w-9 h-5 bg-[#0f172a] rounded-full peer
                                       peer-checked:after:translate-x-full after:content-[''] after:absolute 
                                       after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full 
                                       after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-900/30 
                                       peer-checked:after:bg-indigo-500">
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Input form */}
          <div className={`flex items-center relative rounded-xl border ${isEmpty ? "border-zinc-700" : "border-zinc-800"} shadow-lg ${
            isEmpty ? "max-w-3xl w-[90vw] md:w-[650px]" : "w-full"
          } bg-[#030712]`}>
            <button
              type="button"
              onClick={() => setShowMcpSelector(!showMcpSelector)}
              className={`p-3 text-zinc-400 hover:text-white transition-colors`}
              aria-label="Toggle MCP selector"
              title="Select Model Context Protocols"
            >
              <CpuChipIcon className="h-5 w-5" />
            </button>

            {/* Active MCP indicators */}
            {activeMcps.length > 0 && (
              <div className="flex items-center gap-1">
                {activeMcps.map(mcp => (
                  <div
                    key={mcp.id}
                    className="w-6 h-6 rounded-md bg-indigo-900/20 flex items-center justify-center text-indigo-400"
                    title={mcp.name}
                  >
                    <i className={`${mcp.icon || 'ri-cpu-line'} text-xs`}></i>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 flex items-center">
              <input
                ref={inputRef}
                type="text"
                placeholder={isEmpty ? "What can I help with?" : "Ask anything..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-3.5 bg-transparent border-none outline-none text-white placeholder-zinc-400"
                disabled={isLoading}
              />
              
              <div className="flex items-center">
                <button
                  type="button"
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <MicrophoneIcon className="h-5 w-5" />
                </button>
                
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2 mr-1 rounded-md text-zinc-400 disabled:opacity-50 disabled:text-zinc-600 hover:text-white transition-colors"
                  aria-label="Send message"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
            </form>
          </div>

          {/* Action buttons shown only in empty state */}
          {isEmpty && (
            <div className="flex justify-center mt-5">
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={resetChat}
                  className="px-3 py-1.5 bg-[#0f172a] rounded-md text-sm text-zinc-300 hover:text-white hover:bg-[#1e293b] transition-colors flex items-center"
                >
                  <PlusIcon className="h-4 w-4 mr-1.5" />
                  <span>New Chat</span>
                </button>
                {activeMcps.length === 0 ? (
                  <button
                    onClick={() => setShowMcpSelector(true)}
                    className="px-3 py-1.5 bg-[#0f172a] rounded-md text-sm text-zinc-300 hover:text-white hover:bg-[#1e293b] transition-colors flex items-center"
                  >
                    <CpuChipIcon className="h-4 w-4 mr-1.5" />
                    <span>Enable MCPs</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowMcpSelector(true)}
                    className="px-3 py-1.5 bg-[#0f172a] rounded-md text-sm text-zinc-300 hover:text-white hover:bg-[#1e293b] transition-colors flex items-center"
                  >
                    <CheckIcon className="h-4 w-4 mr-1.5" />
                    <span>{activeMcps.length} MCPs Active</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 