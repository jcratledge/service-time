import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email);
    });
  }, []);

  async function handleSetPassword(e) {
    e.preventDefault();

    if (password !== confirm) {
      setMessage("Passwords don't match.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
    } else {
      setDone(true);
    }

    setLoading(false);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
          <h1 className="text-2xl font-black text-white mb-4">You're all set!</h1>
          <p className="text-gray-400 text-sm">Your password has been saved. You can now sign in normally anytime.</p>
          <button
            onClick={() => window.location.replace('/')}
            className="mt-6 w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded shadow-lg transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white tracking-tight">Set Your Password</h1>
          <p className="text-gray-400 text-sm mt-1">Welcome! Create a password to get started.</p>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-gray-950 border border-red-800 text-sm text-center text-red-400 rounded">
            {message}
          </div>
        )}

        <form onSubmit={handleSetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">New Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Confirm Password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white font-bold py-2 px-4 rounded shadow-lg transition-colors mt-4"
          >
            {loading ? 'Saving...' : 'Set Password'}
          </button>
        </form>

      </div>
    </div>
  );
}
