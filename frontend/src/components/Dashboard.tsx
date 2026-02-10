"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface DashboardProps {
  apiBase?: string;
  projectKey?: string;
  onProjectCleared?: () => void;
}

export default function Dashboard({ apiBase = "http://localhost:8000", projectKey = "SCRUM", onProjectCleared }: DashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(`${apiBase}/api/dashboard?project_key=${projectKey}&search_all=true&_t=${Date.now()}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const dashboardData = await response.json();
      setData(dashboardData);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data && !error) return <div className="text-center p-10 text-cyan-400 animate-pulse">Initializing Neural Link...</div>;
  if (error && !data) return (
    <div className="text-center p-10 text-red-400">
      <div className="text-xl font-bold mb-2">Connection Error</div>
      <p className="mb-4">{error}</p>
      <button onClick={() => { setLoading(true); fetchDashboardData(); }} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
        Retry Connection
      </button>
    </div>
  );
  if (!data) return null;

  const { stats, ai_summary, recent_issues, chart_data } = data;

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="w-full flex flex-col gap-20">
      {/* Header Stats Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
      >
        <motion.div variants={item} className="glass p-8 rounded-2xl border border-white/5 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>
          </div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Total Issues</p>
          <div className="text-4xl font-bold text-white mt-1 drop-shadow-md">{stats.total_issues}</div>
        </motion.div>

        <motion.div variants={item} className="glass p-8 rounded-2xl border border-white/5 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 relative overflow-hidden group">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Completion Rate</p>
          <div className="text-4xl font-bold text-emerald-400 mt-1 drop-shadow-md">{stats.completion_rate}%</div>
          <div className="w-full bg-black/30 h-1.5 mt-4 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${stats.completion_rate}%` }} />
          </div>
        </motion.div>

        <motion.div variants={item} className="glass p-8 rounded-2xl border border-white/5 bg-gradient-to-br from-blue-500/10 to-cyan-500/5">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">In Progress</p>
          <div className="text-4xl font-bold text-blue-400 mt-1 drop-shadow-md">{stats.in_progress_count}</div>
        </motion.div>

        <motion.div variants={item} className="glass p-8 rounded-2xl border border-white/5 bg-gradient-to-br from-purple-500/10 to-pink-500/5">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Done</p>
          <div className="text-4xl font-bold text-purple-400 mt-1 drop-shadow-md">{stats.done_count}</div>
        </motion.div>
      </motion.div>

      {/* Main Content Split */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >

        {/* Left Col: AI Summary & Charts */}
        <div className="lg:col-span-2 space-y-8">
          <motion.div variants={item} className="glass p-8 rounded-2xl border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 bg-gradient-to-b from-cyan-500 to-blue-600 h-full" />
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">🧠</span> AI Project Analysis
            </h3>
            <p className="text-slate-300 leading-relaxed font-light">{ai_summary}</p>
          </motion.div>

          <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Status Breakdown */}
            <div className="glass p-8 rounded-2xl border border-white/5">
              <h4 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-6">Status Distribution</h4>
              <div className="space-y-4">
                {chart_data.status.map((item: any) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{item.name}</span>
                        <span className="text-slate-500">{item.value}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div style={{ width: `${(item.value / stats.total_issues) * 100}%` }} className="h-full bg-indigo-500 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Department Breakdown */}
            <div className="glass p-8 rounded-2xl border border-white/5">
              <h4 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-6">Department Load</h4>
              <div className="space-y-4">
                {chart_data.department.map((item: any) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{item.name}</span>
                        <span className="text-slate-500">{item.value}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div style={{ width: `${(item.value / stats.total_issues) * 100}%` }} className="h-full bg-cyan-500 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Col: Recent Issues Feed */}
        <motion.div variants={item} className="glass p-8 rounded-2xl border border-white/10 h-full">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center justify-between">
            <span>Live Feed</span>
            <span className="text-xs font-normal px-2 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse">● Live</span>
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
            {recent_issues.length === 0 ? (
              <div className="text-slate-500 text-center py-8">No recent activity detected.</div>
            ) : (
              recent_issues.map((issue: any) => (
                <div key={issue.key} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-cyan-400">{issue.key}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${issue.status === 'Done' ? 'bg-purple-500/20 text-purple-300' :
                      issue.status === 'In Progress' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-slate-500/20 text-slate-300'
                      }`}>{issue.status}</span>
                  </div>
                  <p className="text-sm text-slate-200 line-clamp-2 group-hover:text-white transition-colors">{issue.summary}</p>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Clear Project Button */}
      {data.has_active_project && (
        <div className="flex justify-center pt-8">
          <button
            onClick={async () => {
              if (window.confirm("Are you sure you want to clear this project?")) {
                await fetch(`${apiBase}/api/project/clear`, { method: "POST", body: JSON.stringify({ confirm: true }) });
                onProjectCleared?.();
              }
            }}
            className="text-slate-500 hover:text-red-400 text-sm transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Clear Workspace & Start New
          </button>
        </div>
      )}
    </div>
  );
}
