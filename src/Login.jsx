import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false); // Toggles the view

  async function handleStandardLogin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) setMessage(error.message);
    setLoading(false);
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Check your email for a password reset link. Check spam if you don\'t see it!');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">

        {/* Rebranded Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white tracking-tight">Time Tracker Portal</h1>
          <p className="text-gray-400 text-sm mt-1">
            {isFirstTime ? "Enter your email to receive a link to reset your password." : "Enter your credentials to access your dashboard."}
          </p>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-gray-950 border border-gray-800 text-sm text-center text-blue-400 rounded">
            {message}
          </div>
        )}

        {/* Dynamic Form based on state */}
        <form onSubmit={isFirstTime ? handleForgotPassword : handleStandardLogin}>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {!isFirstTime && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-2 px-4 rounded shadow-lg transition-colors mt-4"
          >
            {loading ? 'Processing...' : (isFirstTime ? 'Send Password Reset Link' : 'Sign In')}
          </button>
        </form>

        {/* The Toggle Switch */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsFirstTime(!isFirstTime);
              setMessage('');
            }}
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            {isFirstTime ? "← Back to standard sign in" : "Forgot your password?"}
          </button>
        </div>

      </div>
    </div>
  );
}