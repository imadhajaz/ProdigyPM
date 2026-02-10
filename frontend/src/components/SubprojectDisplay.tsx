"use client";

import React from "react";
import { motion } from "framer-motion";

interface Subproject {
  subproject_id: string;
  department: string;
  title: string;
  description: string;
  effort_estimate: string;
  effort_days: number;
  dependencies: string[];
  priority: string;
  acceptance_criteria: string[];
  jira_id?: string;
}

interface SubprojectDisplayProps {
  subprojects: Subproject[];
  summary?: {
    total_subprojects: number;
    total_effort_days: number;
    department_summary: {
      [key: string]: {
        count: number;
        total_effort_days: number;
        subprojects: string[];
      };
    };
  };
}

export default function SubprojectDisplay({ subprojects, summary }: SubprojectDisplayProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return "bg-red-500/20 text-red-300 border-red-500/30";
      case 'medium': return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case 'low': return "bg-green-500/20 text-green-300 border-green-500/30";
      default: return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  const getEffortColor = (estimate: string) => {
    if (!estimate) return "text-slate-400";
    if (estimate.includes("High") || estimate.includes("Large")) return "text-red-400";
    if (estimate.includes("Medium")) return "text-yellow-400";
    return "text-green-400";
  };

  const groupedByDepartment: { [key: string]: Subproject[] } = {};
  subprojects?.forEach((sp) => {
    if (!groupedByDepartment[sp.department]) {
      groupedByDepartment[sp.department] = [];
    }
    groupedByDepartment[sp.department].push(sp);
  });

  if (!subprojects) return null;

  return (
    <div className="space-y-8">
      {/* Summary Stats */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-8 rounded-2xl border border-white/10"
        >
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-white">
            <span className="text-2xl">📊</span> Project Architecture Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-6 rounded-xl bg-white/5 border border-white/5">
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Total Modules</div>
              <div className="text-4xl font-bold text-white">{summary.total_subprojects}</div>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/5">
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Est. Effort</div>
              <div className="text-4xl font-bold text-cyan-400">{summary.total_effort_days} <span className="text-base text-slate-500 font-normal">Days</span></div>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/5">
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Departments</div>
              <div className="text-4xl font-bold text-purple-400">{Object.keys(summary.department_summary).length}</div>
            </div>
          </div>

          {/* Department Pills */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(summary.department_summary).map(([dept, stats]) => (
              <div key={dept} className="bg-white/5 rounded-lg border border-white/5 px-4 py-2 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-sm font-medium text-slate-200">{dept}</span>
                <span className="text-xs text-slate-500 bg-black/20 px-2 py-0.5 rounded">{stats.count} modules</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Detailed Cards */}
      <div className="space-y-12">
        {Object.entries(groupedByDepartment).map(([department, deptSubprojects], deptIndex) => (
          <motion.div
            key={department}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: deptIndex * 0.1 }}
            className="relative"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent flex-1 opacity-30" />
              <h3 className="text-2xl font-bold text-white text-center min-w-[200px] text-glow">{department}</h3>
              <div className="h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent flex-1 opacity-30" />
            </div>

            <div className="grid grid-cols-1 gap-6">
              {deptSubprojects.map((subproject, idx) => (
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  key={subproject.subproject_id || idx}
                  className="glass p-6 rounded-xl border border-white/5 hover:border-cyan-500/30 transition-colors group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                        <h4 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">{subproject.title}</h4>
                        {subproject.jira_id && (
                          <a href={`https://vivum-tech-team.atlassian.net/browse/${subproject.jira_id}`} target="_blank" className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-colors ml-2">
                            {subproject.jira_id} ↗
                          </a>
                        )}
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed mb-4">{subproject.description}</p>

                      {subproject.acceptance_criteria && subproject.acceptance_criteria.length > 0 && (
                        <div className="bg-black/20 p-4 rounded-lg border border-white/5 mt-4">
                          <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-semibold">Acceptance Criteria</div>
                          <ul className="space-y-1">
                            {subproject.acceptance_criteria.map((cr, i) => (
                              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                <span className="text-green-500 mt-1 flex-shrink-0">✓</span> <span>{cr}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 min-w-[200px]">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <span className="text-xs text-slate-400">Priority</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getPriorityColor(subproject.priority)}`}>{subproject.priority}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <span className="text-xs text-slate-400">Effort</span>
                        <div className="text-right">
                          <div className={`text-sm font-bold ${getEffortColor(subproject.effort_estimate)}`}>{subproject.effort_estimate}</div>
                          <div className="text-xs text-slate-500">{subproject.effort_days} Days</div>
                        </div>
                      </div>

                      {subproject.dependencies && subproject.dependencies.length > 0 && (
                        <div className="p-3 bg-white/5 rounded-lg">
                          <span className="text-xs text-slate-400 block mb-2">Dependencies</span>
                          <div className="flex flex-wrap gap-2">
                            {subproject.dependencies.map((d, i) => (
                              <span key={i} className="text-[10px] px-2 py-1 rounded bg-slate-700/50 text-slate-300 border border-slate-600/50 truncate max-w-full">{d}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
