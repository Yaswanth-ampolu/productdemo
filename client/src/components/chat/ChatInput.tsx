import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { chatInputStyles } from './chatStyles';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isEmpty?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  isEmpty = false
}) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when component mounts or loading state changes
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

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
        <input
          ref={inputRef}
          type="text"
          placeholder={isEmpty ? "What can I help with?" : "Ask anything..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            ...chatInputStyles.input,
            padding: isEmpty ? '0.875rem 1rem' : '0.75rem 1rem',
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
        </div>
      </form>
    </div>
  );
};

export default ChatInput;