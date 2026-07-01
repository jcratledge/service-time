import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import ManagerDashboard from './ManagerDashboard';
import WorkerDashboard from './WorkerDashboard';
import SetPassword from './SetPassword';

/**
 * Main application entry point.
 * Manages authentication state and role-based routing.
 */
export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [needsPasswordSet, setNeedsPasswordSet] = useState(false);

  useEffect(() => {
    // Check if this is a password recovery link click
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('type=invite')) {
      setNeedsPasswordSet(true);
    }

    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        fetchProfile(session.user.id);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // If Supabase fires a PASSWORD_RECOVERY event, show the set password screen
      if (_event === 'PASSWORD_RECOVERY') {
        setNeedsPasswordSet(true);
      }
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setUserProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      if (error) throw error;
      setUserProfile(data);
    } catch (err) {
      console.error("Profile fetch error:", err);
      setUserProfile(null);
    }
  }

  // If coming from an invite or reset link, show password setup first
  if (needsPasswordSet && session) return <SetPassword />;

  // --- PRODUCTION ROUTING ---
  if (!session) return <Login />;
  
  // If the profile is still loading, show a neutral state
  if (!userProfile) return <div className="min-h-screen bg-gray-950"></div>;
  
  // Route based on role
  if (userProfile.role === 'manager') {
    return <ManagerDashboard />;
  }
  
  if (userProfile.role === 'worker') {
    return <WorkerDashboard workerData={userProfile} onLogout={() => supabase.auth.signOut()} />;
  }

  // Fallback for unexpected roles
  return <div className="text-white p-10">Role not assigned. Please contact support.</div>;
}
