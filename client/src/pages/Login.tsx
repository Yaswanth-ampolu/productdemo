import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import { motion, AnimatePresence } from 'framer-motion';
// We'll use a simple span instead of the icon to avoid TypeScript issues

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, user, loading } = useAuth();
  // Using useTheme hook to access theme variables in the component
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) {
      const from = location.state?.from || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, location]);

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
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(to-b, var(--color-bg), var(--color-bg-dark))',
      }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, var(--color-primary) 1px, transparent 0)',
        backgroundSize: '40px 40px',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        <div
          className="rounded-xl shadow-2xl transition-all duration-300 hover:shadow-3xl"
          style={{
            background: 'linear-gradient(to-b, var(--color-surface), var(--color-surface-dark))',
            border: '1px solid var(--color-border)',
            padding: '2rem',
          }}
        >
          {/* Header Section */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-6"
            >
              <div className="text-4xl font-bold mb-2" style={{ color: 'var(--color-primary)' }}>
                Pinnacleflow Ai 
              </div>
              <div className="h-1 w-16 mx-auto rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)]"></div>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-3xl md:text-4xl font-extrabold"
              style={{ color: 'var(--color-text)' }}
            >
              Welcome Back
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-2 text-sm md:text-base"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Sign in to continue your journey
            </motion.p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 p-4 rounded-lg border"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'var(--color-error)',
                    color: 'var(--color-error)'
                  }}
                >
                  <span className="text-sm md:text-base">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Username Input */}
            <div className="relative">
              <input
                id="username"
                type="text"
                required
                autoComplete="username"
                className="peer w-full px-4 py-3 rounded-lg transition-all duration-300 focus:ring-2"
                style={{
                  backgroundColor: 'var(--color-surface-dark)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
              <label
                htmlFor="username"
                className="absolute left-4 -top-2.5 px-1 text-sm transition-all duration-300 peer-focus:-top-2.5 peer-focus:text-xs peer-placeholder-shown:top-3 peer-placeholder-shown:text-base"
                style={{
                  backgroundColor: 'var(--color-surface-dark)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Username
              </label>
            </div>

            {/* Password Input */}
            <div className="relative">
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="peer w-full px-4 py-3 rounded-lg transition-all duration-300 focus:ring-2"
                style={{
                  backgroundColor: 'var(--color-surface-dark)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <label
                htmlFor="password"
                className="absolute left-4 -top-2.5 px-1 text-sm transition-all duration-300 peer-focus:-top-2.5 peer-focus:text-xs peer-placeholder-shown:top-3 peer-placeholder-shown:text-base"
                style={{
                  backgroundColor: 'var(--color-surface-dark)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Password
              </label>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              className="w-full py-3 rounded-lg font-medium relative overflow-hidden"
              style={{
                background: 'linear-gradient(to-r, var(--color-primary), var(--color-primary-dark))',
                color: 'white',
              }}
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
                  />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}