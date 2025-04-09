import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import LoadingScreen from '../components/LoadingScreen';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, user, loading } = useAuth();
  const { currentTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) {
      const from = location.state?.from || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, location]);

  // Show loading screen only during initial auth check
  if (loading) {
    return <LoadingScreen />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Failed to login. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div 
        className="w-full max-w-md space-y-6 p-6 md:p-8 rounded-lg shadow-lg"
        style={{ 
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)'
        }}
      >
        <div>
          <h2 
            className="text-center text-2xl md:text-3xl font-extrabold"
            style={{ color: 'var(--color-text)' }}
          >
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div 
              className="border rounded p-3 text-sm md:text-base"
              style={{ 
                backgroundColor: 'var(--color-error)10',
                borderColor: 'var(--color-error)',
                color: 'var(--color-error)'
              }}
            >
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label 
                htmlFor="username" 
                className="block text-sm md:text-base font-medium"
                style={{ color: 'var(--color-text)' }}
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                className="w-full mt-1 px-4 py-2 rounded"
                style={{
                  backgroundColor: 'var(--color-surface-dark)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)'
                }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm md:text-base font-medium"
                style={{ color: 'var(--color-text)' }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className="w-full mt-1 px-4 py-2 rounded"
                style={{
                  backgroundColor: 'var(--color-surface-dark)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)'
                }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full relative py-3 rounded font-medium"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              opacity: isLoading ? 0.7 : 1
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></span>
                Signing in...
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>
    </div>
  );
} 