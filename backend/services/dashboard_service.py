"""
Dashboard Service - Aggregate data for progress dashboard
"""
import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def calculate_jira_stats(issues: List[Dict]) -> Dict:
    """
    Calculate statistics from Jira issues.
    
    Args:
        issues: List of Jira issue dictionaries
        
    Returns:
        Dictionary with statistics
    """
    if not issues:
        return {
            "total_issues": 0,
            "by_status": {},
            "by_priority": {},
            "by_type": {},
            "by_department": {},
            "completion_rate": 0,
            "in_progress_count": 0,
            "done_count": 0,
            "todo_count": 0
        }
    
    # Count by status
    by_status = {}
    by_priority = {}
    by_type = {}
    by_department = {}
    
    done_count = 0
    in_progress_count = 0
    todo_count = 0
    
    for issue in issues:
        # Status counts
        status = issue.get("status", "Unknown")
        by_status[status] = by_status.get(status, 0) + 1
        
        if status.lower() in ["done", "completed", "closed", "resolved"]:
            done_count += 1
        elif status.lower() in ["in progress", "inprogress", "in_progress"]:
            in_progress_count += 1
        else:
            todo_count += 1
        
        # Priority counts
        priority = issue.get("priority", "Unknown")
        by_priority[priority] = by_priority.get(priority, 0) + 1
        
        # Type counts
        issue_type = issue.get("type", "Unknown")
        by_type[issue_type] = by_type.get(issue_type, 0) + 1
        
        # Department counts (from labels or summary)
        labels = issue.get("labels", [])
        summary = issue.get("summary", "")
        
        # Extract department from labels or summary
        department = None
        for label in labels:
            if label.lower() in ["engineering", "design", "qa", "marketing", "product"]:
                department = label
                break
        
        if not department and summary.startswith("["):
            # Extract from [Department] format
            end_bracket = summary.find("]")
            if end_bracket > 0:
                department = summary[1:end_bracket]
        
        if department:
            by_department[department] = by_department.get(department, 0) + 1
    
    total_issues = len(issues)
    completion_rate = (done_count / total_issues * 100) if total_issues > 0 else 0
    
    return {
        "total_issues": total_issues,
        "by_status": by_status,
        "by_priority": by_priority,
        "by_type": by_type,
        "by_department": by_department,
        "completion_rate": round(completion_rate, 1),
        "in_progress_count": in_progress_count,
        "done_count": done_count,
        "todo_count": todo_count
    }


def generate_ai_summary(stats: Dict, issues: List[Dict]) -> str:
    """
    Generate AI-powered summary of progress.
    
    Args:
        stats: Statistics dictionary
        issues: List of Jira issues
        
    Returns:
        AI-generated summary string
    """
    total = stats["total_issues"]
    done = stats["done_count"]
    in_progress = stats["in_progress_count"]
    todo = stats["todo_count"]
    completion_rate = stats["completion_rate"]
    
    summary_parts = []
    
    # Overall progress
    if total == 0:
        return "🎉 **Project Completed!** All issues have been completed and removed. You can clear this project and start a new one."
    
    summary_parts.append(f"📊 **Overall Progress**: {completion_rate}% complete ({done}/{total} issues done)")
    
    # Status breakdown
    if in_progress > 0:
        summary_parts.append(f"🔄 **In Progress**: {in_progress} issues actively being worked on")
    
    if todo > 0:
        summary_parts.append(f"📋 **To Do**: {todo} issues waiting to be started")
    
    # Department breakdown
    dept_stats = stats.get("by_department", {})
    if dept_stats:
        summary_parts.append(f"\n📁 **By Department**:")
        for dept, count in sorted(dept_stats.items(), key=lambda x: x[1], reverse=True):
            summary_parts.append(f"  - {dept}: {count} issues")
    
    # Priority breakdown
    priority_stats = stats.get("by_priority", {})
    if priority_stats:
        high_priority = priority_stats.get("High", 0)
        if high_priority > 0:
            summary_parts.append(f"\n⚠️ **High Priority**: {high_priority} high-priority issues need attention")
    
    # Insights
    if completion_rate >= 80:
        summary_parts.append(f"\n✅ **Great progress!** You're almost done.")
    elif completion_rate >= 50:
        summary_parts.append(f"\n💪 **Good progress!** Keep it up.")
    elif completion_rate > 0:
        summary_parts.append(f"\n🚀 **Getting started!** Focus on completing in-progress items.")
    else:
        summary_parts.append(f"\n🎯 **Ready to start!** Begin working on to-do items.")
    
    return "\n".join(summary_parts)


def get_dashboard_data(issues: List[Dict], project_key: str = "SCRUM") -> Dict:
    """
    Get aggregated dashboard data.
    Shows all backlog issues and reflects real-time status updates from Jira.
    
    Args:
        issues: List of Jira issues
        project_key: Jira project key
        
    Returns:
        Dictionary with dashboard data
    """
    stats = calculate_jira_stats(issues)
    ai_summary = generate_ai_summary(stats, issues)
    
    # Recent issues (last 10) - sort by updated time (most recently updated first)
    # This ensures real-time updates are reflected
    sorted_issues = sorted(
        issues,
        key=lambda x: x.get("updated", x.get("created", "")),
        reverse=True
    )
    recent_issues = sorted_issues[:10] if sorted_issues else []
    
    # Issues by status for charts
    status_chart_data = [
        {"name": status, "value": count}
        for status, count in stats["by_status"].items()
    ]
    
    # Department chart data
    dept_chart_data = [
        {"name": dept, "value": count}
        for dept, count in stats["by_department"].items()
    ]
    
    return {
        "project_key": project_key,
        "stats": stats,
        "ai_summary": ai_summary,
        "recent_issues": recent_issues,
        "chart_data": {
            "status": status_chart_data,
            "department": dept_chart_data,
            "priority": [
                {"name": priority, "value": count}
                for priority, count in stats["by_priority"].items()
            ]
        },
        "last_updated": datetime.now().isoformat()
    }

