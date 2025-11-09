"use client";

import React from "react";

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
  jira_id?: string;  // Jira issue ID if synced
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
    // Minimal: Use only slate variations
    return "bg-slate-600/30 text-slate-300 border-slate-500/40";
  };
  
  const getEffortColor = (estimate: string) => {
    // Minimal: Use only slate variations
    return "bg-slate-600/30 text-slate-300";
  };
  
  const getDepartmentColor = (department: string) => {
    // Minimal: Use only slate with subtle accent
    return "bg-slate-700/60";
  };
  
  const getDepartmentBorderColor = (department: string) => {
    // Minimal: Use only slate borders
    return "border-slate-600/50";
  };
  
  // Group subprojects by department
  const groupedByDepartment: { [key: string]: Subproject[] } = {};
  subprojects.forEach((sp) => {
    if (!groupedByDepartment[sp.department]) {
      groupedByDepartment[sp.department] = [];
    }
    groupedByDepartment[sp.department].push(sp);
  });
  
  // Calculate global issue numbers across all departments
  let globalIssueNumber = 0;
  const departmentsWithNumbers: Array<[string, Array<Subproject & { globalNumber: number }>]> = [];
  
  Object.entries(groupedByDepartment).forEach(([department, deptSubprojects]) => {
    const numberedSubprojects = deptSubprojects.map((subproject) => {
      globalIssueNumber++;
      return { ...subproject, globalNumber: globalIssueNumber };
    });
    departmentsWithNumbers.push([department, numberedSubprojects]);
  });
  
  return (
    <div className="space-y-8">
      {/* Summary Card */}
      {summary && (
        <div className="bg-slate-800/70 backdrop-blur-sm rounded-xl shadow-xl p-8 text-white border border-slate-700/50">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-slate-300">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-700/30 backdrop-blur-sm rounded-lg p-5 border border-slate-700/30">
              <div className="text-xs font-medium text-slate-500 mb-2">Total Subprojects</div>
              <div className="text-3xl font-semibold text-slate-200">{summary.total_subprojects}</div>
            </div>
            <div className="bg-slate-700/30 backdrop-blur-sm rounded-lg p-5 border border-slate-700/30">
              <div className="text-xs font-medium text-slate-500 mb-2">Total Effort Days</div>
              <div className="text-3xl font-semibold text-slate-200">{summary.total_effort_days}</div>
            </div>
            <div className="bg-slate-700/30 backdrop-blur-sm rounded-lg p-5 border border-slate-700/30">
              <div className="text-xs font-medium text-slate-500 mb-2">Departments</div>
              <div className="text-3xl font-semibold text-slate-200">{Object.keys(summary.department_summary).length}</div>
            </div>
          </div>
          
          {/* Department Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(summary.department_summary).map(([dept, stats]) => (
              <div key={dept} className="bg-slate-700/20 backdrop-blur-sm rounded-lg p-3 border border-slate-700/20">
                <div className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">{dept}</div>
                <div className="text-lg font-semibold text-slate-300 mb-1">{stats.count} tasks</div>
                <div className="text-xs text-slate-500">{stats.total_effort_days} days</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Subprojects by Department */}
      <div className="space-y-8">
        {departmentsWithNumbers.map(([department, deptSubprojects], deptIndex) => (
          <div key={department} className="relative">
            {/* Visual Separator between Departments */}
            {deptIndex > 0 && (
              <div className="absolute -top-4 left-0 right-0 flex items-center justify-center mb-8">
                <div className="h-px w-full bg-slate-700"></div>
                <div className="absolute bg-slate-800 px-4">
                  <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                </div>
              </div>
            )}
            
            {/* Department Card */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/30 overflow-hidden transition-colors">
              {/* Department Header */}
              <div className="bg-slate-700/20 text-white p-6 border-b border-slate-700/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold mb-1 text-slate-300">{department}</h3>
                    <p className="text-xs text-slate-500">{deptSubprojects.length} subproject{deptSubprojects.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="bg-slate-800/60 backdrop-blur-sm rounded-lg px-4 py-2.5 border border-slate-700/30">
                    <div className="text-xs text-slate-500 mb-1 font-medium">Total Effort</div>
                    <div className="text-base font-semibold text-slate-300">
                      {deptSubprojects.reduce((sum, sp) => sum + (sp.effort_days || 0), 0)} days
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Subprojects List - Equispaced */}
              <div className="p-6">
                <div className="grid grid-cols-1 gap-6">
                  {deptSubprojects.map((subproject) => (
                    <div
                      key={subproject.subproject_id}
                      className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-6 hover:bg-slate-700/40 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-4 gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-700/40 border border-slate-600/30 flex items-center justify-center text-slate-300 font-semibold text-sm flex-shrink-0">
                              {subproject.globalNumber}
                            </div>
                            <h4 className="text-lg font-semibold text-slate-100">
                              {subproject.title}
                            </h4>
                          </div>
                          {subproject.jira_id && (
                            <div className="mt-3">
                              <a 
                                href={`https://vivum-tech-team.atlassian.net/browse/${subproject.jira_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-slate-700/40 text-slate-300 border border-slate-600/30 hover:bg-slate-700/50 transition-colors"
                              >
                                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                {subproject.jira_id}
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <span
                            className={`px-3 py-1.5 rounded-md text-xs font-medium border text-center ${getPriorityColor(
                              subproject.priority
                            )}`}
                          >
                            {subproject.priority}
                          </span>
                          <span
                            className={`px-3 py-1.5 rounded-md text-xs font-medium text-center ${getEffortColor(
                              subproject.effort_estimate
                            )}`}
                          >
                            {subproject.effort_estimate} ({subproject.effort_days}d)
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-300 mb-4 leading-relaxed">{subproject.description}</p>
                      
                      {/* Dependencies */}
                      {subproject.dependencies && subproject.dependencies.length > 0 && (
                        <div className="mb-4 p-4 bg-slate-700/40 rounded-lg border border-slate-600">
                          <span className="text-xs font-semibold text-slate-400 mb-2 block uppercase tracking-wide">Dependencies</span>
                          <span className="text-sm text-slate-300">
                            {subproject.dependencies.join(", ")}
                          </span>
                        </div>
                      )}
                      
                      {/* Acceptance Criteria */}
                      {subproject.acceptance_criteria && subproject.acceptance_criteria.length > 0 && (
                        <div className="pt-4 border-t border-slate-600">
                          <div className="text-sm font-semibold text-slate-200 mb-3 uppercase tracking-wide">
                            Acceptance Criteria:
                          </div>
                          <ul className="list-disc list-inside space-y-2.5 text-sm text-slate-300">
                            {subproject.acceptance_criteria.map((criterion, idx) => (
                              <li key={idx} className="leading-relaxed pl-2">{criterion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

