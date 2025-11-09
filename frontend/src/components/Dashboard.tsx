"use client";

import React, { useEffect, useState, useCallback } from "react";

interface DashboardData {
  project_key: string;
  stats: {
    total_issues: number;
    by_status: { [key: string]: number };
    by_priority: { [key: string]: number };
    by_type: { [key: string]: number };
    by_department: { [key: string]: number };
    completion_rate: number;
    in_progress_count: number;
    done_count: number;
    todo_count: number;
  };
  ai_summary: string;
  recent_issues: Array<{
    id: string;
    summary: string;
    status: string;
    priority: string;
    url?: string;
    assignee?: string;
    updated?: string;
  }>;
  chart_data: {
    status: Array<{ name: string; value: number }>;
    department: Array<{ name: string; value: number }>;
    priority: Array<{ name: string; value: number }>;
  };
  last_updated: string;
  connection_info?: {
    using_real_jira: boolean;
    jira_url?: string;
    project_key: string;
  };
  project_completed?: boolean;
  completion_reason?: string;
  project_session?: any;
  has_active_project?: boolean;
}

interface DashboardProps {
  apiBase?: string;
  projectKey?: string;
  onProjectCleared?: () => void;
}

export default function Dashboard({ apiBase = "http://localhost:8000", projectKey = "SCRUM", onProjectCleared }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [clearingProject, setClearingProject] = useState(false);
  const [projectCleared, setProjectCleared] = useState(false);

  const fetchDashboardData = React.useCallback(async (showLoading = false, forceRefresh = false) => {
    // Don't fetch if project is cleared (unless forced)
    if (projectCleared && !forceRefresh) {
      console.log("⏭️ Skipping fetch - project is cleared");
      return;
    }
    
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      
      const response = await fetch(`${apiBase}/api/dashboard?project_key=${projectKey}&search_all=true&_t=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const dashboardData = await response.json();
      
      // If project is cleared, stop auto-refresh and ensure zeros
      if (dashboardData.has_active_project === false) {
        setProjectCleared(true);
        console.log("✅ Project is cleared - stopping auto-refresh");
        // Don't update data if we're already showing zeros (unless forced)
        if (!forceRefresh && data && data.stats?.total_issues === 0) {
          console.log("⏭️ Already showing zeros, skipping update");
          return;
        }
      } else if (dashboardData.has_active_project === true) {
        // If there's an active project, re-enable auto-refresh
        setProjectCleared(false);
      }
      
      setData(dashboardData);
      setLastRefreshTime(new Date());
      console.log("Dashboard data updated:", new Date().toLocaleTimeString(), "Total issues:", dashboardData.stats?.total_issues || 0, "Has active project:", dashboardData.has_active_project);
      
      // Show completion modal if project is completed
      if (dashboardData.project_completed && !showCompletionModal) {
        setShowCompletionModal(true);
      }
    } catch (err: any) {
      setError(err.message);
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [apiBase, projectKey, projectCleared, data]);

  useEffect(() => {
    // Fetch initial data only if not cleared
    if (!projectCleared) {
      fetchDashboardData(true);
    }
    
    // Set up auto-refresh interval - COMPLETELY STOP if project is cleared
    let interval: NodeJS.Timeout | null = null;
    
    if (!projectCleared) {
      interval = setInterval(() => {
        // Double-check projectCleared state
        if (projectCleared) {
          console.log("🛑 Auto-refresh stopped - project cleared");
          if (interval) clearInterval(interval);
          return;
        }
        
        // Only auto-refresh if we have data AND there's an active project
        if (data && data.has_active_project !== false && !projectCleared) {
          console.log("🔄 Auto-refreshing dashboard for real-time updates...");
          fetchDashboardData(false);
        } else {
          console.log("⏭️ Skipping auto-refresh - no active project or cleared");
        }
      }, 2000);
    } else {
      console.log("🛑 Auto-refresh disabled - project is cleared");
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchDashboardData, projectCleared, data]);

  useEffect(() => {
    (window as any).refreshDashboard = () => {
      console.log("Dashboard refresh triggered externally");
      fetchDashboardData(true);
    };
    return () => {
      delete (window as any).refreshDashboard;
    };
  }, [fetchDashboardData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[400px]">
        <div className="text-slate-400 flex items-center gap-3">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 m-6">
        <p className="text-red-400 mb-4">Error loading dashboard: {error}</p>
        <button
          onClick={() => fetchDashboardData(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Always extract data - if cleared, backend will return empty/zero values
  const { stats, ai_summary, recent_issues, chart_data, project_completed, completion_reason, project_session } = data;
  const hasActiveProject = data.has_active_project !== false;

  const clearProject = async () => {
    try {
      setClearingProject(true);
      setProjectCleared(true); // Stop auto-refresh immediately
      console.log("🔄 Clearing project...");
      
      // First, clear the backend session
      const clearResponse = await fetch(`${apiBase}/api/project/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      
      if (!clearResponse.ok) {
        throw new Error(`HTTP ${clearResponse.status}: ${clearResponse.statusText}`);
      }
      
      const clearResult = await clearResponse.json();
      console.log("✅ Project cleared:", clearResult);
      
      // IMMEDIATELY set data to empty/zero state - don't wait for fetch
      const clearedData = {
        project_key: projectKey,
        stats: {
          total_issues: 0,
          by_status: {},
          by_priority: {},
          by_type: {},
          by_department: {},
          completion_rate: 0,
          in_progress_count: 0,
          done_count: 0,
          todo_count: 0
        },
        ai_summary: "No active project. Upload a PDF or create a PRD to get started.",
        recent_issues: [],
        chart_data: {
          status: [],
          department: [],
          priority: []
        },
        last_updated: new Date().toISOString(),
        connection_info: {
          using_real_jira: false,
          project_key: projectKey
        },
        project_completed: false,
        completion_reason: null,
        project_session: null,
        has_active_project: false
      };
      
      // Set the cleared data immediately
      setData(clearedData);
      setShowCompletionModal(false);
      setError(null);
      setLoading(false);
      setIsRefreshing(false);
      setLastRefreshTime(new Date());
      
      // Verify with backend ONCE (force refresh to confirm)
      try {
        const timestamp = Date.now();
        const dashboardResponse = await fetch(`${apiBase}/api/dashboard?project_key=${projectKey}&search_all=true&_t=${timestamp}&nocache=${timestamp}`, {
          method: "GET",
          headers: { 
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
          },
        });
        
        if (dashboardResponse.ok) {
          const dashboardData = await dashboardResponse.json();
          console.log("📊 Backend confirmed cleared state:", dashboardData);
          // Only update if backend confirms it's cleared (has zeros)
          if (dashboardData.has_active_project === false && dashboardData.stats?.total_issues === 0) {
            setData(dashboardData);
            console.log("✅ Backend confirmed - dashboard cleared with zeros");
          } else {
            console.warn("⚠️ Backend didn't confirm cleared state, but local state is zeros");
          }
        }
      } catch (fetchErr) {
        console.warn("Could not verify cleared state with backend, but local state is cleared:", fetchErr);
      }
      
      console.log("✅ Dashboard cleared and set to zero values - auto-refresh stopped");
    } catch (err: any) {
      console.error("❌ Failed to clear project:", err);
      alert(`❌ Failed to clear project: ${err.message}`);
      setProjectCleared(false); // Re-enable refresh on error
      setClearingProject(false);
    } finally {
      setClearingProject(false);
    }
  };

  // Status color mapping - minimal slate only
  const getStatusColor = (status: string) => {
    return "bg-slate-600/30 text-slate-300 border-slate-500/40";
  };

  // Priority color mapping - minimal slate only
  const getPriorityColor = (priority: string) => {
    return "bg-slate-600/30 text-slate-300 border-slate-500/40";
  };

  return (
    <div className="w-full px-6 py-8 space-y-6">
      {/* Project Completion Modal */}
      {showCompletionModal && project_completed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl shadow-2xl border-2 border-slate-700/50 p-8 max-w-2xl mx-4">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-slate-200 mb-2">Project Completed!</h2>
              <p className="text-slate-300 text-lg">
                {completion_reason === "all_deleted" 
                  ? "All issues have been completed and removed from Jira."
                  : "All issues have been marked as done!"}
              </p>
            </div>
            
            {project_session && (
              <div className="bg-slate-700/50 rounded-lg p-4 mb-6 border border-slate-600">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-400 mb-1">Project Key</div>
                    <div className="text-slate-100 font-semibold">{project_session.project_key}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 mb-1">Total Issues</div>
                    <div className="text-slate-100 font-semibold">{project_session.total_issues_created}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 mb-1">Created</div>
                    <div className="text-slate-100 font-semibold">
                      {new Date(project_session.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 mb-1">Completed</div>
                    <div className="text-slate-100 font-semibold">
                      {project_session.completed_at 
                        ? new Date(project_session.completed_at).toLocaleDateString()
                        : "Just now"}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={clearProject}
                disabled={clearingProject}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                {clearingProject ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Clearing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear Project & Start New
                  </>
                )}
              </button>
              <button
                onClick={() => setShowCompletionModal(false)}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg transition-all duration-200"
              >
                Keep Viewing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Banner - Only show if there's an active project and it's completed */}
      {hasActiveProject && project_completed && (
        <div className="bg-slate-800/50 border-2 border-slate-700/30 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-700/50 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-1">Project Completed!</h3>
                <p className="text-slate-400 text-sm">
                  {stats.total_issues === 0 
                    ? "All issues have been completed and removed."
                    : "All issues have been marked as done!"}
                </p>
              </div>
            </div>
            <button
              onClick={clearProject}
              disabled={clearingProject}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {clearingProject ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Clearing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear Project
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-200 mb-2 flex items-center gap-3">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Progress Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Project: <span className="text-slate-200 font-medium">{data.project_key || "N/A"}</span></p>
          <p className="text-xs text-slate-500 mt-1">
            {isRefreshing ? (
              <span className="text-slate-400">🔄 Updating...</span>
            ) : (
              <span>Last updated: {lastRefreshTime.toLocaleTimeString()}</span>
            )}
            {hasActiveProject && <span className="ml-2 text-slate-400">● Live</span>}
            {!hasActiveProject && <span className="ml-2 text-slate-500">● No Active Project</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasActiveProject && (
            <button
              onClick={clearProject}
              disabled={clearingProject}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-500/20"
            >
              {clearingProject ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Clearing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear Project
                </>
              )}
            </button>
          )}
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all duration-200 shadow-lg shadow-blue-500/20"
          >
            {isRefreshing ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards - Always show, but with zero values when cleared */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/30 p-6">
          <div className="text-sm text-slate-500 mb-1">Total Issues</div>
          <div className="text-3xl font-semibold text-slate-200">{stats.total_issues}</div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/30 p-6">
          <div className="text-sm text-slate-500 mb-1">Completion Rate</div>
          <div className="text-3xl font-semibold text-slate-200">{stats.completion_rate}%</div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/30 p-6">
          <div className="text-sm text-slate-500 mb-1">In Progress</div>
          <div className="text-3xl font-semibold text-slate-200">{stats.in_progress_count}</div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/30 p-6">
          <div className="text-sm text-slate-500 mb-1">Done</div>
          <div className="text-3xl font-semibold text-slate-200">{stats.done_count}</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/30 p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-400">Overall Progress</span>
          <span className="text-sm font-medium text-slate-300">{stats.completion_rate}%</span>
        </div>
        <div className="w-full bg-slate-700/30 rounded-full h-3 overflow-hidden">
          <div
            className="bg-slate-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${stats.completion_rate}%` }}
          ></div>
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-slate-800/50 rounded-xl shadow-xl border border-slate-700/30 p-6">
        <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          AI Summary
        </h2>
        <div className="text-slate-400 whitespace-pre-line leading-relaxed text-sm">{ai_summary}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Chart */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/30 p-6">
          <h2 className="text-lg font-semibold text-slate-300 mb-4">Status Breakdown</h2>
          <div className="space-y-3">
            {chart_data.status.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${getStatusColor(item.name)}`}>
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-slate-700/30 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-slate-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${stats.total_issues > 0 ? (item.value / stats.total_issues) * 100 : 0}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-slate-300 w-8 text-right">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Department Chart */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/30 p-6">
          <h2 className="text-lg font-semibold text-slate-300 mb-4">By Department</h2>
          {chart_data.department.length > 0 ? (
            <div className="space-y-3">
              {chart_data.department.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-700/30 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-slate-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${stats.total_issues > 0 ? (item.value / stats.total_issues) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-slate-300 w-8 text-right">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-500 text-sm">No department data available</div>
          )}
        </div>
      </div>

      {/* Recent Issues */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-300 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recent Issues
          </h2>
            {isRefreshing && (
            <span className="text-xs text-slate-400 animate-pulse flex items-center gap-1">
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating...
            </span>
          )}
        </div>
        {recent_issues.length > 0 ? (
          <div className="space-y-3">
            {recent_issues.map((issue: any, index: number) => (
              <div
                key={issue.id}
                className="flex items-center justify-between p-4 border border-slate-700 rounded-lg hover:bg-slate-700/30 transition-all duration-200"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-200 bg-slate-700/60 px-3 py-1 rounded-lg border border-slate-600/40">
                      #{index + 1}
                    </span>
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(issue.status)}`}>
                      {issue.status}
                    </span>
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getPriorityColor(issue.priority)}`}>
                      {issue.priority}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {issue.id}
                    </span>
                    {issue.assignee && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        👤 {issue.assignee}
                      </span>
                    )}
                    {!issue.assignee && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-600/30 text-slate-400 border border-slate-500/40">
                        👤 Unassigned
                      </span>
                    )}
                    {issue.updated && (
                      <span className="text-xs text-slate-500">
                        Updated: {new Date(issue.updated).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-300 font-medium">{issue.summary}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {issue.url && (
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-700/50 text-slate-200 rounded-lg text-sm hover:bg-slate-700/70 transition-all duration-200 font-medium border border-slate-600/30"
                    >
                      View in Jira
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-sm">No recent issues</div>
        )}
      </div>

      {/* Connection Status & Footer */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap text-xs">
            {data.connection_info && (
              <div className="flex items-center gap-2">
                {data.connection_info.using_real_jira ? (
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Real Jira: {data.connection_info.jira_url || "Connected"}
                  </span>
                ) : (
                  <span className="text-slate-500 font-medium">
                    ⚠️ Mock Jira (using local data)
                  </span>
                )}
              </div>
            )}
            {data.stats.total_issues === 0 ? (
              <span className="text-slate-500">
                ⚠️ No issues found in project "{data.project_key}"
              </span>
            ) : (
              <span className="text-slate-400">
                📊 {data.stats.total_issues} issues loaded
              </span>
            )}
            <span className="text-slate-500">
              🔄 Auto-refreshing every 2 seconds
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Last updated: {lastRefreshTime.toLocaleTimeString()}</span>
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={isRefreshing || loading}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg shadow-purple-500/50 flex items-center gap-2"
            >
              {isRefreshing || loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Now
                </>
              )}
            </button>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>Real-Time Updates:</strong> The dashboard automatically refreshes every 2 seconds to show the latest changes from Jira. 
              When you update an issue's status, priority, or assignee in Jira, it will appear here within 2 seconds.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
