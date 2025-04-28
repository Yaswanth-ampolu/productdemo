import React from 'react';
import { ChatMessage as ChatMessageType } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { UserIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';
import { messageBubbleStyles, markdownStyles } from './chatStyles';
import { useTheme } from '../../contexts/ThemeContext';

interface ChatMessageProps {
  message: ChatMessageType;
  isAI?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isAI = false }) => {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
  const { currentTheme } = useTheme();
  const isDarkTheme = currentTheme !== 'light';

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
            backgroundColor: isDarkTheme ? '#252526' : '#f0f4f8',
            borderBottom: `1px solid ${isDarkTheme ? '#3E3E42' : '#e2e8f0'}`,
            fontSize: '0.8rem',
            color: isDarkTheme ? '#e6e6e6' : '#334155',
            borderRadius: '0.5rem 0.5rem 0 0'
          }}>
            <span style={{
              fontWeight: 600,
              color: isDarkTheme ? 'var(--color-primary-light)' : 'var(--color-primary)'
            }}>
              {match[1]}
            </span>
            <button
              onClick={() => copyToClipboard(code)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: copiedCode === code ? 'var(--color-success)' : isDarkTheme ? '#e6e6e6' : '#64748b',
                padding: '0.25rem',
                borderRadius: '0.25rem',
                transition: 'all 0.2s ease'
              }}
              title="Copy code"
            >
              {copiedCode === code ? (
                <>
                  <CheckIcon className="w-4 h-4 mr-1" /> Copied
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="w-4 h-4 mr-1" /> Copy
                </>
              )}
            </button>
          </div>
          <SyntaxHighlighter
            style={isDarkTheme ? vscDarkPlus : oneLight}
            language={match[1]}
            PreTag="div"
            {...props}
            customStyle={{
              margin: 0,
              borderRadius: '0 0 0.5rem 0.5rem',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              padding: '1rem',
              backgroundColor: isDarkTheme ? '#1E1E1E' : '#f8fafc'
            }}
            codeTagProps={{
              style: {
                fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
              }
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code style={{
          ...messageBubbleStyles.ai.inlineCode,
          backgroundColor: isDarkTheme ? 'var(--color-surface-dark)' : '#f1f5f9',
          color: isDarkTheme ? 'var(--color-primary-light)' : 'var(--color-primary)',
          padding: '0.1rem 0.3rem',
          borderRadius: '0.25rem',
          fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
          fontSize: '0.9em',
        }} {...props}>
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
          <div style={{
            ...markdownStyles.container,
            fontSize: '0.95rem',
            lineHeight: '1.6',
          }}>
            {message.isStreaming && message.content === '' ? (
              // Show an animated loading indicator when streaming just started
              <div style={{ color: 'var(--color-text-muted)' }}>
                <div className="typing-animation">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  ...components,
                  // Add styling for other markdown elements
                  p: ({node, children, ...props}) => (
                    <p style={{marginTop: '0.75rem', marginBottom: '0.75rem'}} {...props}>
                      {children}
                    </p>
                  ),
                  h1: ({node, children, ...props}) => (
                    <h1 style={{
                      fontSize: '1.5rem',
                      fontWeight: 600,
                      marginTop: '1.5rem',
                      marginBottom: '0.75rem',
                      color: isDarkTheme ? 'var(--color-primary-light)' : 'var(--color-primary)'
                    }} {...props}>
                      {children}
                    </h1>
                  ),
                  h2: ({node, children, ...props}) => (
                    <h2 style={{
                      fontSize: '1.3rem',
                      fontWeight: 600,
                      marginTop: '1.25rem',
                      marginBottom: '0.75rem',
                      color: isDarkTheme ? 'var(--color-primary-light)' : 'var(--color-primary)'
                    }} {...props}>
                      {children}
                    </h2>
                  ),
                  h3: ({node, children, ...props}) => (
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      marginTop: '1rem',
                      marginBottom: '0.5rem',
                      color: isDarkTheme ? 'var(--color-primary-light)' : 'var(--color-primary)'
                    }} {...props}>
                      {children}
                    </h3>
                  ),
                  ul: ({node, children, ...props}) => (
                    <ul style={{
                      paddingLeft: '1.5rem',
                      marginTop: '0.5rem',
                      marginBottom: '0.5rem',
                      listStyleType: 'disc'
                    }} {...props}>
                      {children}
                    </ul>
                  ),
                  ol: ({node, children, ...props}) => (
                    <ol style={{
                      paddingLeft: '1.5rem',
                      marginTop: '0.5rem',
                      marginBottom: '0.5rem',
                      listStyleType: 'decimal'
                    }} {...props}>
                      {children}
                    </ol>
                  ),
                  li: ({node, children, ...props}) => (
                    <li style={{
                      marginTop: '0.25rem',
                      marginBottom: '0.25rem'
                    }} {...props}>
                      {children}
                    </li>
                  ),
                  a: ({node, children, ...props}) => (
                    <a style={{
                      color: 'var(--color-primary)',
                      textDecoration: 'underline',
                      fontWeight: 500
                    }} {...props} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  blockquote: ({node, children, ...props}) => (
                    <blockquote style={{
                      borderLeft: `4px solid ${isDarkTheme ? 'var(--color-primary)' : 'var(--color-primary-light)'}`,
                      paddingLeft: '1rem',
                      margin: '1rem 0',
                      color: 'var(--color-text-muted)',
                      fontStyle: 'italic'
                    }} {...props}>
                      {children}
                    </blockquote>
                  ),
                  table: ({node, children, ...props}) => (
                    <div style={{ overflowX: 'auto', marginTop: '1rem', marginBottom: '1rem' }}>
                      <table style={{
                        borderCollapse: 'collapse',
                        width: '100%',
                        fontSize: '0.9rem',
                      }} {...props}>
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({node, children, ...props}) => (
                    <thead style={{
                      backgroundColor: isDarkTheme ? 'var(--color-surface-dark)' : 'var(--color-surface-light)',
                      borderBottom: `2px solid ${isDarkTheme ? '#444' : '#e2e8f0'}`,
                    }} {...props}>
                      {children}
                    </thead>
                  ),
                  tbody: ({node, children, ...props}) => (
                    <tbody {...props}>
                      {children}
                    </tbody>
                  ),
                  tr: ({node, children, ...props}) => (
                    <tr style={{
                      borderBottom: `1px solid ${isDarkTheme ? '#333' : '#e2e8f0'}`,
                    }} {...props}>
                      {children}
                    </tr>
                  ),
                  th: ({node, children, ...props}) => (
                    <th style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: isDarkTheme ? 'var(--color-primary-light)' : 'var(--color-primary)',
                    }} {...props}>
                      {children}
                    </th>
                  ),
                  td: ({node, children, ...props}) => (
                    <td style={{
                      padding: '0.75rem',
                      borderRight: `1px solid ${isDarkTheme ? '#333' : '#e2e8f0'}`,
                    }} {...props}>
                      {children}
                    </td>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.content}
          </div>
        )}
      </div>

      {/* Add CSS for animations */}
      <style>
        {`
          .animate-pulse {
            animation: pulse 1.5s infinite;
          }

          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.3; }
            100% { opacity: 1; }
          }

          .animate-pulse span {
            animation: pulse 1.5s infinite;
            display: inline-block;
          }

          .animate-pulse span:nth-child(1) {
            animation-delay: 0s;
          }

          .animate-pulse span:nth-child(2) {
            animation-delay: 0.3s;
          }

          .animate-pulse span:nth-child(3) {
            animation-delay: 0.6s;
          }

          /* Code block styling */
          pre {
            position: relative;
            overflow-x: auto;
            border-radius: 0 0 0.5rem 0.5rem !important;
          }

          code {
            font-family: Menlo, Monaco, Consolas, "Courier New", monospace !important;
          }

          /* Improve table styling */
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
          }

          /* Improve link styling */
          a {
            transition: color 0.2s ease;
          }

          a:hover {
            text-decoration: underline;
            opacity: 0.9;
          }

          /* Typing animation */
          .typing-animation {
            display: inline-flex;
            align-items: center;
            height: 24px;
          }

          .typing-animation .dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 6px;
            background-color: var(--color-primary);
            animation: typing-dot 1.4s infinite ease-in-out both;
          }

          .typing-animation .dot:nth-child(1) {
            animation-delay: -0.32s;
          }

          .typing-animation .dot:nth-child(2) {
            animation-delay: -0.16s;
          }

          @keyframes typing-dot {
            0%, 80%, 100% {
              transform: scale(0.6);
              opacity: 0.6;
            }
            40% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
};

export default ChatMessage;