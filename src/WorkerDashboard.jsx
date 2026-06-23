import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function WorkerDashboard() {
  const [worker, setWorker] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logFormData, setLogFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    location: '', description: '', time_input: '', hours_count: ''
  });

  useEffect(() => {
    async function loadWorkerData() {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch this specific worker's profile
      const { data: workerData } = await supabase
        .from('workers')
        .select('*')
        .eq('email', user.email)
        .single();

      if (workerData) {
        setWorker(workerData);
        // Fetch only this worker's logs
        const { data: logData } = await supabase
          .from('hours_logs')
          .select('*')
          .eq('worker_id', workerData.id)
          .order('work_date', { ascending: false });
        
        setLogs(logData || []);
      }
    }
    loadWorkerData();
  }, []);

  async function handleAddLog(e) {
    e.preventDefault();
    const dbMilitaryTime = logFormData.time_input.replace(':', '');

    const { data, error } = await supabase
      .from('hours_logs')
      .insert([{
        worker_id: worker.id,
        work_date: logFormData.work_date,
        location: logFormData.location,
        description: logFormData.description,
        military_time: dbMilitaryTime,
        hours_count: parseFloat(logFormData.hours_count),
        is_verified: false,
        is_reported: false
      }])
      .select();

    if (!error) {
      setLogs([data[0], ...logs]);
      setLogFormData({ ...logFormData, description: '', time_input: '', hours_count: '' });
    }
  }

  if (!worker) return <div className="text-white p-8">Loading your profile...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <header className="max-w-4xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black">Welcome, {worker.first_name}</h1>
          <p className="text-gray-400 text-sm">Case #: {worker.case_number}</p>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="text-gray-500 hover:text-red-400 text-sm">Logout</button>
      </header>

      <main className="max-w-4xl mx-auto space-y-8">
        {/* Simple Progress Card */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
          <h2 className="text-sm font-bold uppercase text-gray-400">Target Progress</h2>
          <div className="text-3xl font-black mt-2">{logs.reduce((acc, l) => acc + Number(l.hours_count), 0)} / {worker.target_hours} hrs</div>
        </div>

        {/* Log Form */}
        <form onSubmit={handleAddLog} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl space-y-4">
          <h3 className="font-bold mb-4">New Entry</h3>
          <div className="grid grid-cols-2 gap-4">
            <input type="date" required value={logFormData.work_date} onChange={e => setLogFormData({...logFormData, work_date: e.target.value})} className="bg-gray-950 border border-gray-800 rounded p-2 text-sm" />
            <input type="time" required value={logFormData.time_input} onChange={e => setLogFormData({...logFormData, time_input: e.target.value})} className="bg-gray-950 border border-gray-800 rounded p-2 text-sm [color-scheme:dark]" />
          </div>
          <input type="number" placeholder="Hours" required value={logFormData.hours_count} onChange={e => setLogFormData({...logFormData, hours_count: e.target.value})} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm" />
          <input type="text" placeholder="Location" required value={logFormData.location} onChange={e => setLogFormData({...logFormData, location: e.target.value})} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm" />
          <input type="text" placeholder="Task Description" required value={logFormData.description} onChange={e => setLogFormData({...logFormData, description: e.target.value})} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm" />
          <button type="submit" className="w-full bg-purple-600 py-2 rounded font-bold hover:bg-purple-500">Submit Hours</button>
        </form>
      </main>
    </div>
  );
}