import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// --- HELPER FUNCTIONS ---
function formatTo12Hour(milTime) {
    if (!milTime || milTime.length !== 4) return milTime;
    let hours = parseInt(milTime.substring(0, 2), 10);
    let mins = milTime.substring(2, 4);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${mins} ${ampm}`;
}

// --- SUB-COMPONENT: WORKER EXPANDABLE LEDGER ROW ---
function WorkerLogAccordionItem({ log, setEditingLog, supabase, setLogs, logs }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-950 mb-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 text-sm hover:bg-gray-800 transition-colors"
            >
                <div className="flex items-center gap-4 flex-1">
                    <span className="text-gray-500 font-mono w-24 text-left">{log.work_date}</span>
                    <span className="font-bold text-white w-16 text-left">{Number(log.hours_count).toFixed(1)} hrs</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${log.is_reported ? 'text-blue-400 border-blue-900' : log.is_verified ? 'text-green-400 border-green-900' : 'text-yellow-500 border-yellow-900'}`}>
                        {log.is_reported ? 'Reported' : log.is_verified ? 'Verified' : 'Pending'}
                    </span>
                </div>
                <span className="text-gray-500">{isOpen ? '−' : '+'}</span>
            </button>

            {isOpen && (
                <div className="p-4 border-t border-gray-800 bg-gray-900 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-white">{log.location}</span>
                        <span className="text-xs text-gray-400">{formatTo12Hour(log.military_time)}</span>
                    </div>
                    <p className="text-sm text-gray-300 mb-4">{log.description || "No description provided."}</p>

                    {!log.is_verified && !log.is_reported && (
                        <div className="flex gap-4">
                            <button onClick={() => setEditingLog(log)} className="text-blue-400 hover:text-blue-300 text-xs font-bold px-2">Edit</button>
                            <button onClick={async () => {
                                if (window.confirm("Delete this entry?")) {
                                    const { error } = await supabase.from('hours_logs').delete().eq('id', log.id);
                                    if (!error) setLogs(logs.filter(l => l.id !== log.id));
                                }
                            }} className="text-red-400 hover:text-red-300 text-xs font-bold px-2">Delete</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// --- MAIN COMPONENT ---
export default function WorkerDashboard({ workerData, onLogout }) {
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [editingLog, setEditingLog] = useState(null);

    const [logFormData, setLogFormData] = useState({
        work_date: new Date().toISOString().split('T')[0],
        location: '',
        description: '',
        time_input: '',
        hours_count: ''
    });

    useEffect(() => {
        async function fetchLogs() {
            if (!workerData) return;
            setLoadingLogs(true);
            const { data, error } = await supabase
                .from('hours_logs')
                .select('*')
                .eq('worker_id', workerData.id)
                .order('work_date', { ascending: false });

            if (!error && data) {
                setLogs(data);
            }
            setLoadingLogs(false);
        }
        fetchLogs();
    }, [workerData]);

    async function handleAddLog(e) {
        e.preventDefault();
        if (!workerData) return;

        const dbMilitaryTime = logFormData.time_input.replace(':', '');

        const { data, error } = await supabase
            .from('hours_logs')
            .insert([{
                worker_id: workerData.id,
                work_date: logFormData.work_date,
                location: logFormData.location,
                description: logFormData.description,
                military_time: dbMilitaryTime,
                hours_count: parseFloat(logFormData.hours_count),
                is_verified: false,
                is_reported: false
            }])
            .select();

        if (!error && data) {
            setLogs([data[0], ...logs]);
            setLogFormData({
                ...logFormData,
                time_input: '',
                hours_count: '',
                location: '',
                description: ''
            });
        } else {
            alert("Failed to save. Check that all fields are correct.");
            console.error(error);
        }
    }

    const totalLogged = logs.reduce((sum, log) => sum + Number(log.hours_count), 0);
    const totalVerified = logs.reduce((sum, log) => sum + (log.is_verified ? Number(log.hours_count) : 0), 0);
    const progressPercent = workerData && workerData.target_hours ? Math.min((totalVerified / workerData.target_hours) * 100, 100) : 0;

    const uniqueLocations = Array.from(new Set(logs.map(log => log.location).filter(Boolean)));
    const relevantLogs = logFormData.location
        ? logs.filter(log => log.location.toLowerCase() === logFormData.location.toLowerCase())
        : logs;
    const uniqueDescriptions = Array.from(new Set(relevantLogs.map(log => log.description).filter(Boolean)));

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-4 md:p-8">
            <header className="max-w-6xl mx-auto mb-8 flex items-center justify-between border-b border-gray-800 pb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white">SERVICE TIME</h1>
                    <p className="text-gray-400 text-sm">Welcome back, {workerData.first_name}</p>
                </div>

                <button
                    onClick={onLogout}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                    <span className="hidden md:block">Logout</span>
                    <span className="md:hidden text-lg">⏻</span>
                </button>
            </header>

            <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                        <h2 className="text-2xl font-black text-white mb-1">{workerData.first_name} {workerData.last_name}</h2>
                        <p className="text-gray-400 text-sm font-mono mb-4">Case: {workerData.case_number}</p>

                        <div className="space-y-2 mt-4">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                                <span className="text-gray-400">Verified Progress</span>
                                <span className="text-blue-400">{totalVerified.toFixed(1)} / {workerData.target_hours} hrs</span>
                            </div>
                            <div className="w-full bg-gray-950 rounded-full h-3 border border-gray-800 overflow-hidden">
                                <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 pt-1">
                                <span>Pending Approval: {(totalLogged - totalVerified).toFixed(1)} hrs</span>
                                <span>{progressPercent.toFixed(0)}% Completed</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-4">Log Service Time</h3>
                        <form onSubmit={handleAddLog} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Date</label>
                                <input required type="date" value={logFormData.work_date} onChange={(e) => setLogFormData({ ...logFormData, work_date: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer [color-scheme:dark]" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Time Started</label>
                                    <input required type="time" value={logFormData.time_input} onChange={(e) => setLogFormData({ ...logFormData, time_input: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm cursor-pointer focus:outline-none focus:border-blue-500 [color-scheme:dark]" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Hours Count</label>
                                    <input required type="number" step="0.25" placeholder="2.5" value={logFormData.hours_count} onChange={(e) => setLogFormData({ ...logFormData, hours_count: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Location</label>
                                <input
                                    required
                                    type="text"
                                    list="location-suggestions"
                                    placeholder="County Food Bank"
                                    value={logFormData.location}
                                    onChange={(e) => setLogFormData({ ...logFormData, location: e.target.value })}
                                    className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                />
                                <datalist id="location-suggestions">
                                    {uniqueLocations.map(loc => <option key={loc} value={loc} />)}
                                </datalist>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Task Description</label>
                                <input
                                    required
                                    type="text"
                                    list="description-suggestions"
                                    placeholder="Sorted goods..."
                                    value={logFormData.description}
                                    onChange={(e) => setLogFormData({ ...logFormData, description: e.target.value })}
                                    className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                />
                                <datalist id="description-suggestions">
                                    {uniqueDescriptions.map(desc => <option key={desc} value={desc} />)}
                                </datalist>
                            </div>

                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg text-sm shadow-md transition-colors mt-2">
                                Submit Log Entry
                            </button>
                        </form>
                    </div>
                </div>

                <div className="md:col-span-2">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl min-h-[400px]">
                        <h3 className="text-xl font-bold text-white mb-4">My Activity Ledger</h3>

                        {loadingLogs ? (
                            <div className="text-gray-400 text-sm py-8">Syncing entries...</div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-gray-800 rounded-xl">
                                No hours logged yet. Use the form to submit your first entry.
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {logs.map((log) => (
                                    <WorkerLogAccordionItem
                                        key={log.id}
                                        log={log}
                                        setEditingLog={setEditingLog}
                                        supabase={supabase}
                                        setLogs={setLogs}
                                        logs={logs}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <footer className="mt-12 text-center border-t border-gray-800 pt-6">
                <p className="text-gray-500 text-xs font-bold tracking-widest uppercase">Powered by <span className="text-blue-500">Leading Zero LLC</span></p>
            </footer>

            {/* Edit Modal */}
            {editingLog && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Edit Log Entry</h3>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const { error } = await supabase
                                .from('hours_logs')
                                .update({
                                    work_date: editingLog.work_date,
                                    location: editingLog.location,
                                    description: editingLog.description,
                                    military_time: editingLog.military_time,
                                    hours_count: parseFloat(editingLog.hours_count)
                                })
                                .eq('id', editingLog.id);

                            if (!error) {
                                setLogs(logs.map(l => l.id === editingLog.id ? editingLog : l));
                                setEditingLog(null);
                            }
                        }} className="space-y-4">
                            <input type="date" value={editingLog.work_date} onChange={(e) => setEditingLog({ ...editingLog, work_date: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white focus:outline-none focus:border-blue-500" />
                            <input type="text" value={editingLog.location} onChange={(e) => setEditingLog({ ...editingLog, location: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white focus:outline-none focus:border-blue-500" />
                            <input type="text" value={editingLog.description} onChange={(e) => setEditingLog({ ...editingLog, description: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white focus:outline-none focus:border-blue-500" />
                            <input type="number" step="0.25" value={editingLog.hours_count} onChange={(e) => setEditingLog({ ...editingLog, hours_count: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white focus:outline-none focus:border-blue-500" />

                            <div className="flex justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setEditingLog(null)} className="text-gray-400 hover:text-white transition-colors">Cancel</button>
                                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded transition-colors">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}