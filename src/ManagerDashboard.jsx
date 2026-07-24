import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import { jsPDF } from 'jspdf';
import { letterLogo, coltSignature } from './assets';



// --- HELPER FUNCTIONS ---
function formatTo12Hour(milTime) {
    if (!milTime || milTime.length !== 4) return milTime;
    let hours = parseInt(milTime.substring(0, 2), 10);
    let mins = milTime.substring(2, 4);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${mins} ${ampm}`;
}

function draftWorkerEmail(worker) {
    const subject = "Welcome to the Team! Access Your Hours Tracker";
    const body = `Hi ${worker.first_name},%0A%0AWelcome aboard! To start logging your hours, please visit: [YOUR_APP_URL]%0A%0AYour Case Number is: ${worker.case_number}.%0A%0APersonal Tip: Once you log in, tap the 'Share' icon on your phone and select 'Add to Home Screen' to save this as an app icon for quick access.%0A%0ALet me know if you have any questions!`;

    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${worker.email}&su=${subject}&body=${body}`);
}

// --- MAIN COMPONENT ---
export default function ManagerDashboard({ userProfile }) {
    // State
    const [session, setSession] = useState(null);
    const [workers, setWorkers] = useState([]);
    const [selectedWorkerId, setSelectedWorkerId] = useState(null);
    const [activeManagerId, setActiveManagerId] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [editingLog, setEditingLog] = useState(null);
    const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);

    const [workerFormData, setWorkerFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        case_number: '',
        judge_name: '',
        court_email: '',
        target_hours: ''
    });

    const [logFormData, setLogFormData] = useState({
        work_date: new Date().toISOString().split('T')[0],
        location: '',
        description: '',
        time_input: '',
        hours_count: ''
    });

    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
    const [managerFormData, setManagerFormData] = useState({ first_name: '', last_name: '', email: '' });
    const [managerInviteMessage, setManagerInviteMessage] = useState('');

    async function handleInviteManager(e) {
        e.preventDefault();
        const { data, error } = await supabase.functions.invoke('invite-manager', {
            body: {
                first_name: managerFormData.first_name,
                last_name: managerFormData.last_name,
                email: managerFormData.email
            }
        });
        if (error || data?.error) {
            setManagerInviteMessage("Error: " + (data?.error || error.message));
        } else {
            setManagerInviteMessage(`Invite sent to ${data.manager.email}! Check spam if they don't see it.`);
            setManagerFormData({ first_name: '', last_name: '', email: '' });
        }
    }

    // --- EFFECTS ---
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

useEffect(() => {
    if (!session) {
        setLoading(false);
        return;
    }

    async function fetchInitialData() {
        const { data: managerData } = await supabase
            .from('users')
            .select('id')
            .eq('email', session.user.email)
            .eq('role', 'manager')
            .single();

        let currentManagerId = null;

        if (managerData) {
            currentManagerId = managerData.id;
            setActiveManagerId(currentManagerId);
        }

        const { data: workerData } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'worker');

        if (workerData) {
            setWorkers(workerData);
            if (workerData.length > 0) setSelectedWorkerId(workerData[0].id);
        }

        setLoading(false);
    }

    fetchInitialData();
}, [session]);

// Hoisted fetchLogs so other functions can call it
async function fetchLogs() {
    if (!selectedWorkerId) return;
    setLoadingLogs(true);
    const { data, error } = await supabase
        .from('hours_logs')
        .select('*')
        .eq('worker_id', selectedWorkerId)
        .order('work_date', { ascending: false });

    if (!error && data) {
        setLogs(data);
    }
    setLoadingLogs(false);
}

useEffect(() => {
    fetchLogs();
}, [selectedWorkerId]);

// --- HANDLERS ---
async function createLetter(targetWorker) {
    const { data: verifiedLogs, error } = await supabase
        .from('hours_logs').select('*')
        .eq('worker_id', targetWorker.id).eq('is_verified', true).eq('is_reported', false)
        .order('work_date', { ascending: true });

    if (error || !verifiedLogs || verifiedLogs.length === 0) return alert("No verified hours to report.");

    const totalHours = verifiedLogs.reduce((acc, log) => acc + Number(log.hours_count), 0);

    const formatDate = (dateString) => {
        const d = new Date(dateString);
        const yy = d.getFullYear().toString().slice(-2);
        return `${d.getMonth() + 1}/${d.getDate()}/${yy}`;
    };

    const todayDate = formatDate(new Date());
    const startDate = formatDate(verifiedLogs[0].work_date);
    const endDate = formatDate(verifiedLogs[verifiedLogs.length - 1].work_date);

    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const textWidth = pageWidth - (margin * 2);
    let cursorY = 20;

    const logoWidth = 90;
    const logoHeight = 30;
    const logoX = (pageWidth - logoWidth) / 2;

    doc.addImage(letterLogo, 'PNG', logoX, cursorY, logoWidth, logoHeight);
    cursorY += 45;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);

    doc.text(todayDate, margin, cursorY);
    cursorY += 12;

    doc.text("To Whom It May Concern:", margin, cursorY);
    cursorY += 15;

    const p1 = `Between ${startDate} and ${endDate} ${targetWorker.first_name} ${targetWorker.last_name} completed ${totalHours} hours of community service, by Fit to Recover-Utah County at 184 W. 400 N. Provo, UT 84601.`;
    doc.text(p1, margin, cursorY, { maxWidth: textWidth });
    cursorY += 20;

    const p2 = `At Fit to Recover (FTR), our volunteers are important to our mission. Since our services are primarily developed and run by volunteers whose lives have been affected by substance use disorders in one way or another, volunteers are vital to our success and mission. FTR volunteers are primarily interested in giving back, enhancing their life skills, and connecting with recovery community members.`;
    doc.text(p2, margin, cursorY, { maxWidth: textWidth });
    cursorY += 35;

    const p3 = `If you have any questions, please feel free to reach out to me at the numbers listed below.`;
    doc.text(p3, margin, cursorY, { maxWidth: textWidth });
    cursorY += 15;

    doc.text("Sincerely,", margin, cursorY);
    cursorY += 5;

    doc.addImage(coltSignature, 'PNG', margin, cursorY, 40, 15);
    cursorY += 18;

    doc.text("Colt Farr", margin, cursorY);
    cursorY += 8;

    const signOffDetails = `Utah County Fit to Recover General Manager\n184 W. 400 N. Provo, UT 84601\nPersonal: (801) 381-8833\nOffice: (801) 875-0603`;
    doc.text(signOffDetails, margin, cursorY);

    const fileName = `${targetWorker.first_name}_${targetWorker.last_name}_Completion_Letter.pdf`;
    doc.save(fileName);

    const logIds = verifiedLogs.map(log => log.id);
    await supabase.from('hours_logs').update({ is_reported: true }).in('id', logIds);

    fetchLogs();
    alert(`Letter created! ${totalHours} hours have been successfully reported.`);
}

async function handleAddWorker(e) {
    e.preventDefault();

    const { data, error } = await supabase.functions.invoke('invite-worker', {
        body: {
            manager_id: activeManagerId,
            first_name: workerFormData.first_name,
            last_name: workerFormData.last_name,
            email: workerFormData.email,
            judge_name: workerFormData.judge_name,
            court_email: workerFormData.court_email,
            case_number: workerFormData.case_number,
            target_hours: workerFormData.target_hours
        }
    });

    if (error || data?.error) {
        console.error("Invite error:", error || data.error);
        alert("Save Failed: " + (data?.error || error.message));
    } else {
        const newWorker = data.worker;
        setWorkers([...workers, newWorker]);
        setSelectedWorkerId(newWorker.id);
        setIsWorkerModalOpen(false);
        setWorkerFormData({ first_name: '', last_name: '', email: '', case_number: '', target_hours: '' });
        alert(`Invite sent to ${newWorker.email}. They'll get an email to set their password.`);
    }
}

async function handleAddLog(e) {
    e.preventDefault();
    if (!selectedWorkerId) return;

    const dbMilitaryTime = logFormData.time_input.replace(':', '');

    const { data, error } = await supabase
        .from('hours_logs')
        .insert([{
            worker_id: selectedWorkerId,
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
        alert("Failed to save: " + error.message);
        console.error(error);
    }
}

async function toggleStatus(log) {
    let newVerified = log.is_verified;
    let newReported = log.is_reported;

    if (log.is_reported) {
        newReported = false;
        newVerified = true;
    } else if (log.is_verified) {
        newVerified = false;
    } else {
        newVerified = true;
    }

    const { error } = await supabase
        .from('hours_logs')
        .update({ is_verified: newVerified, is_reported: newReported })
        .eq('id', log.id);

    if (!error) {
        setLogs(logs.map(l => l.id === log.id ? { ...l, is_verified: newVerified, is_reported: newReported } : l));
    }
}

// --- CALCULATIONS ---
const activeWorker = workers.find(w => w.id === selectedWorkerId);
const totalLogged = logs.reduce((sum, log) => sum + Number(log.hours_count), 0);
const totalVerified = logs.reduce((sum, log) => sum + (log.is_verified ? Number(log.hours_count) : 0), 0);
const progressPercent = activeWorker ? Math.min((totalVerified / activeWorker.target_hours) * 100, 100) : 0;

const uniqueLocations = Array.from(new Set(logs.map(log => log.location).filter(Boolean)));
const relevantLogs = logFormData.location
    ? logs.filter(log => log.location.toLowerCase() === logFormData.location.toLowerCase())
    : logs;
const uniqueDescriptions = Array.from(new Set(relevantLogs.map(log => log.description).filter(Boolean)));

// --- RENDER EARLY RETURNS ---
if (!session) {
    return <Login />;
}

if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white font-bold">Connecting to cloud database...</div>;
}

// --- MAIN UI RENDER ---
return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-4 md:p-8">
        <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-800 pb-6 gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-white">SERVICE TIME</h1>
                <p className="text-gray-400 text-sm">Manager Portal</p>
                <p className="text-gray-400 text-sm">Welcome back, {userProfile?.first_name}</p>
            </div>

            <div className="flex items-center gap-4">
                {workers.length > 0 && (
                    <select
                        value={selectedWorkerId || ''}
                        onChange={(e) => setSelectedWorkerId(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white font-bold focus:outline-none focus:border-sky-500"
                    >
                        {workers.map(w => (
                            <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>
                        ))}
                    </select>
                )}

                <button
                    onClick={() => setIsWorkerModalOpen(true)}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg shadow-sky-900/40 transition-all active:scale-95 text-sm"
                >
                    + Add Worker
                </button>
                <button
                    onClick={() => setIsManagerModalOpen(true)}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm"
                >
                    + Invite Manager
                </button>
                <button
                    onClick={() => supabase.auth.signOut()}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                    Logout
                </button>
            </div>
        </header>

        <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            {activeWorker ? (
                <>
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                            <h2 className="text-2xl font-black text-white mb-1">{activeWorker.first_name} {activeWorker.last_name}</h2>
                            <p className="text-gray-400 text-sm font-mono mb-4">Case: {activeWorker.case_number}</p>

                            <div className="space-y-2 mt-4">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                                    <span className="text-gray-400">Verified Progress</span>
                                    <span className="text-sky-400">{totalVerified.toFixed(1)} / {activeWorker.target_hours} hrs</span>
                                </div>
                                <div className="w-full bg-gray-950 rounded-full h-3 border border-gray-800 overflow-hidden">
                                    <div className="bg-sky-500 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 pt-1">
                                    <span>Unverified Logged: {(totalLogged - totalVerified).toFixed(1)} hrs</span>
                                    <span>{progressPercent.toFixed(0)}% Completed</span>
                                </div>
                                <button
                                    onClick={() => createLetter(activeWorker)}
                                    className="w-full mt-4 bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded shadow transition-colors"
                                >
                                    Create Letter
                                </button>
                            </div>
                        </div>

                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                            <h3 className="text-lg font-bold text-white mb-4">Log Service Time</h3>
                            <form onSubmit={handleAddLog} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Date</label>
                                    <input required type="date" value={logFormData.work_date} onChange={(e) => setLogFormData({ ...logFormData, work_date: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:outline-none focus:border-sky-500 cursor-pointer [color-scheme:dark]" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Time Started</label>
                                        <input required type="time" value={logFormData.time_input} onChange={(e) => setLogFormData({ ...logFormData, time_input: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm cursor-pointer focus:outline-none focus:border-sky-500 [color-scheme:dark]" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Hours Count</label>
                                        <input required type="number" step="0.25" placeholder="2.5" value={logFormData.hours_count} onChange={(e) => setLogFormData({ ...logFormData, hours_count: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:outline-none focus:border-sky-500" />
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
                                        className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:outline-none focus:border-sky-500"
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
                                        className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white text-sm focus:outline-none focus:border-sky-500"
                                    />
                                    <datalist id="description-suggestions">
                                        {uniqueDescriptions.map(desc => <option key={desc} value={desc} />)}
                                    </datalist>
                                </div>

                                <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-lg text-sm shadow-md transition-colors mt-2">
                                    Submit Log Entry
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl min-h-[400px]">
                            <h3 className="text-xl font-bold text-white mb-4">Activity Timeline Ledger</h3>

                            {loadingLogs ? (
                                <div className="text-gray-400 text-sm py-8">Syncing entries...</div>
                            ) : logs.length === 0 ? (
                                <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-gray-800 rounded-xl">
                                    No hours logged yet for this worker. Use the left panel to submit the first entry.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase font-bold">
                                                <th className="pb-3 pr-2">Date</th>
                                                <th className="pb-3 px-2">Location / Task</th>
                                                <th className="pb-3 px-2 text-center">Time</th>
                                                <th className="pb-3 px-2 text-center">Hours</th>
                                                <th className="pb-3 pl-2 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800/40 text-sm">
                                            {logs.map((log) => (
                                                <tr key={log.id} className="hover:bg-gray-800/20 group">
                                                    <td className="py-4 pr-2 font-mono whitespace-nowrap text-xs text-gray-300">{log.work_date}</td>
                                                    <td className="py-4 px-2">
                                                        <div className="font-semibold text-white">{log.location}</div>
                                                        <div className="text-xs text-gray-400 line-clamp-1">{log.description}</div>
                                                    </td>
                                                    <td className="py-4 px-2 text-center font-bold text-gray-300 whitespace-nowrap">{formatTo12Hour(log.military_time)}</td>
                                                    <td className="py-4 px-2 text-center font-bold text-white">{Number(log.hours_count).toFixed(1)}</td>
                                                    <td className="py-4 pl-2 text-right whitespace-nowrap flex items-center justify-end gap-3">
                                                        <button
                                                            onClick={() => toggleStatus(log)}
                                                            className={`text-xs font-bold px-2 py-0.5 rounded border transition-colors shadow-sm ${log.is_reported ? 'text-sky-400 bg-sky-950/50 border-sky-900 hover:bg-sky-900/50' :
                                                                log.is_verified ? 'text-green-400 bg-green-950/50 border-green-900 hover:bg-green-900/50' :
                                                                    'text-yellow-500 bg-yellow-950/50 border-yellow-900 hover:bg-yellow-900/50'
                                                                }`}
                                                        >
                                                            {log.is_reported ? 'Reported ↺' : log.is_verified ? 'Verified ✓' : 'Pending'}
                                                        </button>

                                                        {!log.is_verified && !log.is_reported && (
                                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => setEditingLog(log)}
                                                                    className="text-sky-400 hover:text-sky-300 transition-colors"
                                                                >
                                                                    ✎
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        if (confirm("Delete this entry?")) {
                                                                            const { error } = await supabase.from('hours_logs').delete().eq('id', log.id);
                                                                            if (!error) setLogs(logs.filter(l => l.id !== log.id));
                                                                        }
                                                                    }}
                                                                    className="text-red-400 hover:text-red-300 transition-colors"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>

                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="col-span-3 text-center py-20 border-2 border-dashed border-gray-800 rounded-2xl">
                    <p className="text-gray-500 text-lg">No workers found. Click the button above to add one.</p>
                </div>
            )}
        </main>

        {/* Edit Modal */}
        {isWorkerModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-4">Add New Worker</h3>
                    <form onSubmit={handleAddWorker} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">First Name</label>
                                <input required type="text" value={workerFormData.first_name} onChange={(e) => setWorkerFormData({ ...workerFormData, first_name: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Last Name</label>
                                <input required type="text" value={workerFormData.last_name} onChange={(e) => setWorkerFormData({ ...workerFormData, last_name: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email Address</label>
                            <input required type="email" value={workerFormData.email} onChange={(e) => setWorkerFormData({ ...workerFormData, email: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Case Number</label>
                            <input required type="text" value={workerFormData.case_number} onChange={(e) => setWorkerFormData({ ...workerFormData, case_number: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Judge</label>
                            <input
                                type="text"
                                value={workerFormData.judge_name}
                                onChange={(e) => setWorkerFormData({ ...workerFormData, judge_name: e.target.value })}
                                className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Court Email</label>
                            <input
                                type="email"
                                value={workerFormData.court_email}
                                onChange={(e) => setWorkerFormData({ ...workerFormData, court_email: e.target.value })}
                                className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Target Hours</label>
                            <input required type="number" step="0.5" value={workerFormData.target_hours} onChange={(e) => setWorkerFormData({ ...workerFormData, target_hours: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500" />
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button type="button" onClick={() => setIsWorkerModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
                            <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-6 rounded shadow-lg transition-colors">Save Worker</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

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
                        <input type="date" value={editingLog.work_date} onChange={(e) => setEditingLog({ ...editingLog, work_date: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white focus:outline-none focus:border-sky-500" />
                        <input type="text" value={editingLog.location} onChange={(e) => setEditingLog({ ...editingLog, location: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white focus:outline-none focus:border-sky-500" />
                        <input type="text" value={editingLog.description} onChange={(e) => setEditingLog({ ...editingLog, description: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white focus:outline-none focus:border-sky-500" />
                        <input type="number" step="0.25" value={editingLog.hours_count} onChange={(e) => setEditingLog({ ...editingLog, hours_count: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-white focus:outline-none focus:border-sky-500" />

                        <div className="flex justify-end gap-3 mt-8">
                            <button type="button" onClick={() => setEditingLog(null)} className="text-gray-400 hover:text-white transition-colors">Cancel</button>
                            <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-6 rounded transition-colors">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
        <footer className="max-w-6xl mx-auto mt-12 pt-4 border-t border-gray-900 text-center">
            <p className="text-xs text-gray-700">Powered by <span className="text-gray-600 font-bold">Leading Zero LLC</span></p>
        </footer>

        {isManagerModalOpen && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                    <h2 className="text-xl font-black text-white mb-4">Invite a Manager</h2>

                    {managerInviteMessage && (
                        <div className="mb-4 p-3 bg-gray-950 border border-gray-800 text-sm text-center text-sky-400 rounded">
                            {managerInviteMessage}
                        </div>
                    )}

                    <form onSubmit={handleInviteManager} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">First Name</label>
                                <input
                                    type="text"
                                    required
                                    value={managerFormData.first_name}
                                    onChange={(e) => setManagerFormData({ ...managerFormData, first_name: e.target.value })}
                                    className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Last Name</label>
                                <input
                                    type="text"
                                    required
                                    value={managerFormData.last_name}
                                    onChange={(e) => setManagerFormData({ ...managerFormData, last_name: e.target.value })}
                                    className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email Address</label>
                            <input
                                type="email"
                                required
                                value={managerFormData.email}
                                onChange={(e) => setManagerFormData({ ...managerFormData, email: e.target.value })}
                                className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                            />
                        </div>
                        <div className="flex justify-end gap-3 mt-2">
                            <button type="button" onClick={() => setIsManagerModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">Cancel</button>
                            <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-6 rounded transition-colors">Send Invite</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
);
}