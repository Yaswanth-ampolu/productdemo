import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import {
  UserIcon,
  PaintBrushIcon,
  ServerIcon,
  CpuChipIcon,
  BugAntIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import OllamaSettings from '../components/settings/OllamaSettings';
import MCPSettings from '../components/settings/MCPSettings';
import DebuggingSettings from '../components/settings/DebuggingSettings';
import AIRulesSettings from '../components/settings/AIRulesSettings';

// Import ThemeType from the ThemeContext
type ThemeType = 'dark' | 'light' | 'midnight';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { currentTheme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState(() => {
    // Try to restore the last active tab from localStorage
    const savedTab = localStorage.getItem('settings_active_tab');
    return savedTab || 'profile';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('settings_active_tab', activeTab);
  }, [activeTab]);

  // Define available themes
  const themes = [
    { id: 'dark' as ThemeType, name: 'Dark Theme', description: 'Dark blue interface for low-light environments' },
    { id: 'light' as ThemeType, name: 'Light Theme', description: 'Bright and clean interface for daytime use' },
    { id: 'midnight' as ThemeType, name: 'Midnight Theme', description: 'Deep black theme with purple accents' }
  ];

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    username: user?.username || '',
    name: user?.name || '',
    email: user?.email || ''
  });



  // Load user data
  useEffect(() => {
    if (user) {
      setProfileForm(prevForm => ({
        username: user.username || prevForm.username || '',
        name: user.name || prevForm.name || '',
        email: user.email || prevForm.email || ''
      }));
    }
  }, [user]);

  // Handle profile form changes
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileForm({
      ...profileForm,
      [e.target.name]: e.target.value
    });
  };

  // Handle theme selection
  const handleThemeChange = (themeId: ThemeType) => {
    try {
      setTheme(themeId);
      showSuccess('Theme updated successfully');
    } catch (error) {
      console.error('Error changing theme:', error);
      showError('Failed to save theme preferences');
    }
  };

  // Handle profile save
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profileForm.username || !profileForm.email) {
      return showError('Username and email are required');
    }

    setIsLoading(true);
    try {
      // Update user profile
      await axios.put('/api/users/profile', {
        username: profileForm.username,
        name: profileForm.name,
        email: profileForm.email
      });

      await refreshUser();
      showSuccess('Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showError(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };



  // Show success message
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Show error message
  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  // Settings tabs data structure
  const tabs = [
    { id: 'profile', name: 'Profile', icon: UserIcon },
    { id: 'appearance', name: 'Appearance', icon: PaintBrushIcon },
    { id: 'ai_rules', name: 'AI Rules', icon: ChatBubbleLeftRightIcon },
    { id: 'ollama', name: 'LLM Integration', icon: ServerIcon },
    { id: 'mcp', name: 'MCP Integration', icon: CpuChipIcon },
    { id: 'debugging', name: 'Debugging', icon: BugAntIcon },
  ];

  return (
    <div className="py-6 px-4 md:px-8 overflow-hidden max-w-[1400px] mx-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text)' }}>Settings</h1>

      {/* Success/Error messages */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-800 rounded-md text-green-400">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md text-red-400">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {/* Settings tabs */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="rounded-lg overflow-hidden sticky md:top-4" style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)'
          }}>
            <ul>
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-4 py-3 transition-colors ${
                      activeTab === tab.id ? 'font-medium' : ''
                    }`}
                    style={{
                      color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text)',
                      backgroundColor: activeTab === tab.id ? 'var(--color-surface-light)' : 'transparent',
                      borderLeft: activeTab === tab.id ? `3px solid var(--color-primary)` : '3px solid transparent'
                    }}
                  >
                    <tab.icon className="w-5 h-5 mr-3" />
                    <span>{tab.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Settings content */}
        <div className="flex-1 rounded-lg p-5 overflow-auto" style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          maxHeight: 'calc(100vh - 150px)'
        }}>
          {activeTab === 'profile' && (
            <div>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Profile Settings</h2>
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4 pb-6" style={{
                  borderBottom: `1px solid var(--color-border)`
                }}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
                    style={{
                      backgroundColor: `var(--color-primary-light)20`,
                      color: 'var(--color-primary)'
                    }}
                  >
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p style={{ color: 'var(--color-text)' }}>{user?.username || 'User'}</p>
                    <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm">
                      Role: {user?.role === 'admin' ? 'Administrator' : 'User'}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleProfileSave} className="space-y-4">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Username</label>
                    <input
                      type="text"
                      name="username"
                      value={profileForm.username}
                      onChange={handleProfileChange}
                      className="w-full rounded px-3 py-2 focus:outline-none focus:ring-1"
                      style={{
                        backgroundColor: 'var(--color-surface-dark)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={profileForm.name}
                      onChange={handleProfileChange}
                      className="w-full rounded px-3 py-2 focus:outline-none focus:ring-1"
                      style={{
                        backgroundColor: 'var(--color-surface-dark)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={profileForm.email}
                      onChange={handleProfileChange}
                      className="w-full rounded px-3 py-2 focus:outline-none focus:ring-1"
                      style={{
                        backgroundColor: 'var(--color-surface-dark)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 rounded mt-4 transition-colors"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'white',
                      opacity: isLoading ? 0.7 : 1
                    }}
                  >
                    {isLoading ? 'Saving...' : 'Save Profile'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Appearance Settings</h2>
              <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>Choose your preferred theme for the application.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {themes.map((theme) => (
                  <div
                    key={theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    className={`relative rounded-lg p-4 cursor-pointer transition-all duration-200`}
                    style={{
                      backgroundColor: 'var(--color-surface-dark)',
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      borderColor: currentTheme === theme.id ? 'var(--color-primary)' : 'var(--color-border)',
                      transform: currentTheme === theme.id ? 'scale(1.02)' : 'scale(1)'
                    }}
                  >
                    <div className="flex items-center mb-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                        style={{
                          backgroundColor: theme.id === 'dark' ? '#1a1f2d' :
                                           theme.id === 'light' ? '#ffffff' :
                                           '#111827',
                          border: '1px solid var(--color-border)'
                        }}
                      >
                        <div
                          className="w-5 h-5 rounded-full"
                          style={{
                            backgroundColor: theme.id === 'dark' ? '#3b82f6' :
                                             theme.id === 'light' ? '#3b82f6' :
                                             '#8b5cf6'
                          }}
                        ></div>
                      </div>
                      <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>{theme.name}</h3>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{theme.description}</p>

                    {currentTheme === theme.id && (
                      <div
                        className="absolute top-2 right-2 w-4 h-4 rounded-full"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      ></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'ai_rules' && (
            <div>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>AI Rules Settings</h2>
              <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                Define rules and preferences for the AI to follow during your conversations.
              </p>
              <AIRulesSettings />
            </div>
          )}

          {activeTab === 'ollama' && (
            <div>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>LLM Integration Settings</h2>
              <OllamaSettings isAdmin={user?.role === 'admin'} />
            </div>
          )}

          {activeTab === 'mcp' && (
            <div>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                MCP Integration Settings
              </h2>
              <MCPSettings isAdmin={user?.role === 'admin'} />
            </div>
          )}

          {activeTab === 'debugging' && (
            <div>
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                Debugging Tools
              </h2>
              <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                These tools are for debugging purposes only. Enable them only when needed as they may affect performance.
              </p>
              <DebuggingSettings />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}