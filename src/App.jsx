import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import ManagerDashboard from './ManagerDashboard';
import WorkerDashboard from './WorkerDashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'manager' or 'worker' or null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkUserRole(session.user.email);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkUserRole(session.user.email);
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkUserRole(email) {
    // 1. Is this user a Manager?
    const { data: managerData } = await supabase.from('managers').select('id').eq('email', email).single();
    if (managerData) {
      setUserRole('manager');
    } else {
      // 2. Are they a Worker?
      const { data: workerData } = await supabase.from('workers').select('id').eq('email', email).single();
      if (workerData) setUserRole('worker');
      else setUserRole(null); // Unregistered user
    }
    setLoading(false);
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading...</div>;
  if (!session) return <Login />;

return (
    <>
      {userRole === 'manager' && <ManagerDashboard />}
      {userRole === 'worker' && <WorkerDashboard />}
      {!userRole && (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
          <h1 className="text-2xl font-bold">Role Check</h1>
          <p>Logged in as: {session?.user?.email}</p>
          <p>Detected Role: {userRole || 'None (Checking...)'}</p>
          <button onClick={() => supabase.auth.signOut()} className="mt-4 text-blue-400">Logout</button>
        </div>
      )}
    </>
  );
}