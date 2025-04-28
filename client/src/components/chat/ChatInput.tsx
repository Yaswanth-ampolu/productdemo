import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';
import { chatInputStyles } from './chatStyles';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isEmpty?: boolean;
  isStreaming?: boolean;
  onStopGeneration?: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  isEmpty = false,
  isStreaming = false,
  onStopGeneration
}) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus input when component mounts or loading state changes
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set the height to scrollHeight to fit the content
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      style={{
        ...chatInputStyles.container,
        maxWidth: isEmpty ? '650px' : '900px',
        width: isEmpty ? '90vw' : '100%',
        transform: isEmpty ? 'none' : 'translateY(-22px)',
        transition: 'all 0.3s ease',
      }}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
        <textarea
          ref={inputRef}
          placeholder={isEmpty ? "What can I help with?" : "Ask anything..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{
            ...chatInputStyles.input,
            padding: isEmpty ? '0.875rem 1rem' : '0.75rem 1rem',
            height: 'auto',
            minHeight: '44px',
            maxHeight: '150px',
            resize: 'none',
            overflow: 'auto'
          }}
          disabled={isLoading}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Optional voice input button - can be enabled later */}
          {/* <button
            type="button"
            className="p-2 rounded-full transition-colors"
            style={{
              backgroundColor: 'var(--color-surface-dark)',
              color: 'var(--color-text-muted)',
            }}
          >
            <MicrophoneIcon className="h-5 w-5" />
          </button> */}

          {isStreaming ? (
            <button
              type="button"
              onClick={onStopGeneration}
              style={{
                ...chatInputStyles.sendButton,
                backgroundColor: 'var(--color-error)',
                transform: 'scale(1.05)',
                transition: 'all 0.2s ease',
              }}
              aria-label="Stop generation"
              title="Stop generation"
            >
              <StopIcon className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              style={{
                ...chatInputStyles.sendButton,
                ...((!input.trim() || isLoading) && chatInputStyles.disabledSendButton),
                transform: input.trim() && !isLoading ? 'scale(1.05)' : 'scale(1)',
              }}
              aria-label="Send message"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ChatInput;