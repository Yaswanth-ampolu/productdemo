import React from 'react';
import { ChatMessage as ChatMessageType } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { UserIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';
import { messageBubbleStyles, markdownStyles } from './chatStyles';

interface ChatMessageProps {
  message: ChatMessageType;
  isAI?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isAI = false }) => {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  // Function to copy code to clipboard
  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000); // Reset after 2 seconds
  };

  // Render code blocks with syntax highlighting and copy button
  const components = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const code = String(children).replace(/\n$/, '');

      return !inline && match ? (
        <div style={messageBubbleStyles.ai.codeBlock}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.5rem 1rem',
            backgroundColor: '#2d2d2d',
            borderBottom: '1px solid #444',
            fontSize: '0.8rem',
            color: '#e6e6e6'
          }}>
            <span>{match[1]}</span>
            <button
              onClick={() => copyToClipboard(code)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: copiedCode === code ? '#10B981' : '#e6e6e6',
                padding: '0.25rem',
                borderRadius: '0.25rem',
                transition: 'all 0.2s ease'
              }}
              title="Copy code"
            >
              {copiedCode === code ?
                <><CheckIcon className="w-4 h-4 mr-1" /> Copied</> :
                <><ClipboardDocumentIcon className="w-4 h-4 mr-1" /> Copy</>
              }
            </button>
          </div>
          <SyntaxHighlighter
            style={atomDark}
            language={match[1]}
            PreTag="div"
            {...props}
            customStyle={{
              margin: 0,
              borderRadius: '0 0 0.5rem 0.5rem',
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code style={messageBubbleStyles.ai.inlineCode} {...props}>
          {children}
        </code>
      );
    }
  };

  return (
    <div style={isAI ? messageBubbleStyles.ai.container : messageBubbleStyles.user.container}>
      <div style={isAI ? messageBubbleStyles.ai.header : messageBubbleStyles.user.header}>
        {isAI ? (
          <div style={messageBubbleStyles.ai.avatar}>
            AI
          </div>
        ) : (
          <div style={messageBubbleStyles.user.avatar}>
            <UserIcon className="w-5 h-5" />
          </div>
        )}
        <div style={isAI ? messageBubbleStyles.ai.timestamp : messageBubbleStyles.user.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div style={isAI ? messageBubbleStyles.ai.content : messageBubbleStyles.user.content}>
        {isAI ? (
          <div style={markdownStyles.container}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={components}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;