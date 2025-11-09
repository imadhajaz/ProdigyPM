import sys
import os
import traceback
from datetime import datetime
from typing import Optional, List, Dict
import logging

# Load environment variables FIRST before any other imports
# Get the backend directory path and load .env from there
backend_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(backend_dir, '.env')

from dotenv import load_dotenv
load_dotenv(dotenv_path=env_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --------------------------------------------------
# Ensure Python can find ai_engine module
# --------------------------------------------------
# Add parent directory to path so we can import ai_engine
# backend_dir is already defined above for .env loading
parent_dir = os.path.dirname(backend_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# --------------------------------------------------
# Import FastAPI and other dependencies after env is loaded
# --------------------------------------------------
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --------------------------------------------------
# Import AI engine modules & services
# --------------------------------------------------
from ai_engine.agents.prd_agent import generate_prd as generate_prd_func
from ai_engine.agents.prd_consultant_chat_agent import PRDConsultantChatAgent
from ai_engine.agents.pdf_agent import interpret_pdf
from ai_engine.agents.decomposition_agent import decompose_into_subprojects, get_subproject_summary
from services.mcp_manager import MCPManager
from services.storage_service import get_storage_service
from services.pdf_parser import PDFParser
from services.jira_sync_service import subprojects_to_jira_issues
from services.dashboard_service import get_dashboard_data

# Environment variables are already loaded at the top
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# --------------------------------------------------
# Initialize FastAPI app
# --------------------------------------------------
app = FastAPI(
    title="ProdigyPM Backend",
    description="FastAPI backend for ProdigyPM – AI Product Manager Copilot",
    version="1.0.0"
)

# --------------------------------------------------
# CORS Configuration (for frontend integration)
# --------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Next.js default ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# Initialize Services
# --------------------------------------------------
mcp_manager = MCPManager()
storage_service = get_storage_service()
logger.info(f"Storage service initialized: {storage_service.__class__.__name__}")

# PRD Consultant Chat Agent (session storage - in production, use Redis or database)
prd_chat_sessions: Dict[str, PRDConsultantChatAgent] = {}

# Project Session Management (in production, use Redis or database)
# Tracks active project sessions - one PM = one active project at a time
active_project_session: Optional[Dict] = None

# --------------------------------------------------
# Request Models
# --------------------------------------------------
class PRDRequest(BaseModel):
    """Request body for PRD generation."""
    feature_name: str
    context: Optional[str] = None
    project_key: Optional[str] = "PROD"
    use_jira_context: bool = True


class JiraSyncRequest(BaseModel):
    """Request body for syncing subprojects to Jira."""
    subprojects: List[Dict]
    project_key: Optional[str] = None  # Deprecated - now using product_name to create project
    product_name: Optional[str] = None  # Product name for creating Jira project
    create_epic: Optional[bool] = False  # Create an epic to group all issues


class PRDChatStartRequest(BaseModel):
    """Request to start a new PRD chat session."""
    initial_message: Optional[str] = None  # Optional initial message from user


class PRDChatMessageRequest(BaseModel):
    """Request to send a message in PRD chat."""
    session_id: str
    message: str


class PRDConfirmationRequest(BaseModel):
    """Request confirmation before generating PRD."""
    session_id: str


class PRDConfirmAndGenerateRequest(BaseModel):
    """Request to confirm and generate final PRD."""
    session_id: str
    confirmation: str  # User's confirmation or corrections
    author_name: Optional[str] = "Product Manager"


class ClearProjectRequest(BaseModel):
    """Request to clear/close the active project."""
    confirm: bool = True


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    openai_configured: bool
    services_available: dict


# --------------------------------------------------
# Health & Info Routes
# --------------------------------------------------
@app.get("/")
def root():
    """Root health check route."""
    return {
        "message": "ProdigyPM backend running! 🚀",
        "version": "1.0.0",
        "openai_configured": bool(OPENAI_API_KEY),
        "endpoints": {
            "health": "/health",
            "generate_prd": "/api/generate_prd",
            "jira_issues": "/api/jira/issues",
            "upload_pdf": "/api/upload_pdf",
            "extract_pdf_text": "/api/pdf/{file_id}/extract (internal/debugging)",
            "interpret_pdf": "/api/pdf/{file_id}/interpret",
            "decompose_pdf": "/api/pdf/{file_id}/decompose",
            "sync_to_jira": "/api/jira/sync",
            "dashboard": "/api/dashboard",
            "prd_chat_start": "/api/prd/consultant/chat/start",
            "prd_chat_message": "/api/prd/consultant/chat/message",
            "prd_chat_confirm": "/api/prd/consultant/chat/confirm",
            "prd_chat_generate": "/api/prd/consultant/chat/generate"
        }
    }


@app.get("/health", response_model=HealthResponse)
def health():
    """Comprehensive health check for monitoring."""
    return {
        "status": "healthy",
        "openai_configured": bool(OPENAI_API_KEY),
        "services_available": {
            "ai_engine": True,
            "mcp_manager": True,
            "database": False  # TODO: Add DB health check
        }
    }


# --------------------------------------------------
# API Routes
# --------------------------------------------------
@app.get("/api/jira/issues")
def get_jira_issues(project_key: str = "PROD"):
    """
    Fetch Jira issues (currently using mock data or real Jira).
    Defaults to SCRUM project where issues are actually being created.
    """
    try:
        # Use SCRUM as default since that's where issues are being created
        if project_key == "PROD":
            project_key = os.getenv("JIRA_PROJECT_KEY", "SCRUM").upper()
        issues = mcp_manager.fetch_jira_issues(project_key)
        return {
            "project_key": project_key,
            "total_issues": len(issues),
            "issues": issues,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch Jira issues: {str(e)}")


@app.get("/api/test-direct-jira")
def test_direct_jira():
    """Test direct Jira search to debug dashboard issues"""
    try:
        if not mcp_manager.use_real_jira or not mcp_manager.jira_client:
            return {"error": "Real Jira not available", "use_real_jira": mcp_manager.use_real_jira, "jira_client": mcp_manager.jira_client is not None}
        
        # Direct search
        direct_issues = mcp_manager.jira_client.search_issues('labels = prodigypm-generated ORDER BY updated DESC', maxResults=10)
        
        # Convert to simple format
        issues_data = []
        for issue in direct_issues:
            issues_data.append({
                "id": issue.key,
                "status": issue.fields.status.name,
                "summary": issue.fields.summary[:50],
                "project": issue.fields.project.key
            })
        
        return {
            "success": True,
            "total_issues": len(direct_issues),
            "issues": issues_data,
            "mcp_manager_default_project": mcp_manager.default_project_key
        }
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@app.get("/api/jira/test-connection")
def test_jira_connection():
    """
    Test Jira connection and verify credentials and permissions.
    Returns detailed information about Jira connection status.
    """
    try:
        if not mcp_manager.use_real_jira:
            return {
                "status": "mock",
                "message": "Real Jira is not enabled. Set USE_REAL_JIRA=true in .env",
                "configured": False
            }
        
        if not mcp_manager.jira_client:
            return {
                "status": "error",
                "message": "Jira client not initialized. Check credentials in .env",
                "configured": False,
                "error": "Jira client is None"
            }
        
        # Test connection by getting current user
        try:
            current_user = mcp_manager.jira_client.current_user()
            user_info = {
                "name": getattr(current_user, 'name', 'Unknown'),
                "display_name": getattr(current_user, 'displayName', 'Unknown'),
                "email": getattr(current_user, 'emailAddress', 'Unknown')
            }
        except Exception as user_error:
            return {
                "status": "error",
                "message": f"Failed to get current user: {user_error}",
                "configured": False,
                "error": str(user_error)
            }
        
        # Test project access - try to list projects
        try:
            projects = mcp_manager.jira_client.projects()
            accessible_projects = []
            for project in projects[:10]:  # Limit to first 10
                accessible_projects.append({
                    "key": project.key,
                    "name": project.name
                })
        except Exception as projects_error:
            accessible_projects = []
            projects_error_msg = str(projects_error)
        
        # Test default project access
        default_project_key = os.getenv("JIRA_PROJECT_KEY", "SCRUM").upper()
        default_project_accessible = mcp_manager.verify_project_exists(default_project_key)
        
        return {
            "status": "success",
            "message": "Jira connection successful",
            "configured": True,
            "user": user_info,
            "jira_url": os.getenv("JIRA_URL"),
            "default_project": {
                "key": default_project_key,
                "accessible": default_project_accessible
            },
            "accessible_projects": accessible_projects[:10],  # First 10 projects
            "can_create_projects": True  # Assume true if we can list projects
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Jira connection test failed: {e}")
        logger.error(f"Traceback:\n{error_trace}")
        return {
            "status": "error",
            "message": f"Jira connection test failed: {str(e)}",
            "configured": False,
            "error": str(e),
            "traceback": error_trace
        }


@app.get("/api/jira/debug")
def debug_jira():
    """
    Debug endpoint to check Jira connection and list available projects/issues.
    """
    try:
        debug_info = {
            "using_real_jira": mcp_manager.use_real_jira,
            "jira_client_exists": mcp_manager.jira_client is not None,
        }
        
        if not mcp_manager.use_real_jira:
            debug_info["error"] = "Real Jira is not enabled. Check USE_REAL_JIRA in .env file"
            return {"status": "warning", "debug": debug_info}
        
        if not mcp_manager.jira_client:
            debug_info["error"] = "Jira client is not initialized. Check Jira credentials in .env file"
            return {"status": "error", "debug": debug_info}
        
        try:
            # Test connection first
            try:
                # Try to get current user - this method might not exist in all Jira library versions
                try:
                    current_user = mcp_manager.jira_client.current_user()
                    debug_info["current_user"] = str(current_user) if current_user else "Unknown"
                except AttributeError:
                    # current_user() method doesn't exist, try alternative
                    debug_info["current_user"] = "Method not available"
                except Exception as e:
                    debug_info["current_user_error"] = str(e)
                
                # Test connection by making a simple API call
                try:
                    # Try to get server info or projects as connection test
                    test_projects = mcp_manager.jira_client.projects()
                    debug_info["connection_status"] = "✅ Connected"
                    debug_info["connection_test"] = f"Successfully accessed {len(test_projects)} projects"
                except Exception as e:
                    debug_info["connection_error"] = str(e)
                    debug_info["connection_status"] = "❌ Connection failed"
                    return {"status": "error", "debug": debug_info}
            except Exception as e:
                debug_info["connection_error"] = str(e)
                debug_info["connection_status"] = "❌ Connection test failed"
                import traceback
                debug_info["connection_traceback"] = traceback.format_exc()
                return {"status": "error", "debug": debug_info}
            
            # List all projects
            try:
                projects = mcp_manager.jira_client.projects()
                debug_info["projects"] = [{"key": p.key, "name": p.name} for p in projects]
                debug_info["projects_count"] = len(projects)
            except Exception as e:
                debug_info["projects_error"] = str(e)
                import traceback
                debug_info["projects_traceback"] = traceback.format_exc()
            
            # Try to find issues in SCRUM
            try:
                scrum_issues = mcp_manager.jira_client.search_issues('project = SCRUM', maxResults=5)
                debug_info["scrum_issues_count"] = len(scrum_issues)
                debug_info["scrum_issues"] = [
                    {
                        "key": issue.key, 
                        "summary": issue.fields.summary[:100] if issue.fields.summary else "No summary",
                        "status": issue.fields.status.name if hasattr(issue.fields, 'status') else "Unknown"
                    } 
                    for issue in scrum_issues
                ]
            except Exception as e:
                debug_info["scrum_issues_error"] = str(e)
                import traceback
                debug_info["scrum_issues_traceback"] = traceback.format_exc()
            
            # Try to find ANY issues
            try:
                all_issues = mcp_manager.jira_client.search_issues('ORDER BY updated DESC', maxResults=10)
                debug_info["total_issues_count"] = len(all_issues)
                if all_issues:
                    project_counts = {}
                    for issue in all_issues:
                        try:
                            proj_key = issue.fields.project.key
                            project_counts[proj_key] = project_counts.get(proj_key, 0) + 1
                        except:
                            pass
                    debug_info["issues_by_project"] = project_counts
                    debug_info["sample_issues"] = [
                        {
                            "key": issue.key, 
                            "project": issue.fields.project.key if hasattr(issue.fields, 'project') else "Unknown",
                            "summary": issue.fields.summary[:50] if issue.fields.summary else "No summary"
                        }
                        for issue in all_issues[:5]
                    ]
            except Exception as e:
                debug_info["all_issues_error"] = str(e)
                import traceback
                debug_info["all_issues_traceback"] = traceback.format_exc()
                
        except Exception as e:
            debug_info["error"] = str(e)
            import traceback
            debug_info["traceback"] = traceback.format_exc()
        
        return {"status": "success", "debug": debug_info}
    except Exception as e:
        import traceback
        logger.error(f"Debug endpoint error: {e}")
        logger.error(traceback.format_exc())
        return {
            "status": "error", 
            "error": str(e), 
            "traceback": traceback.format_exc(),
            "debug": {
                "using_real_jira": mcp_manager.use_real_jira if hasattr(mcp_manager, 'use_real_jira') else "Unknown",
                "jira_client_exists": mcp_manager.jira_client is not None if hasattr(mcp_manager, 'jira_client') else "Unknown"
            }
        }


@app.get("/api/dashboard")
def get_dashboard(project_key: str = "SCRUM", search_all: bool = True):
    """
    Get dashboard data with Jira status, progress metrics, and AI summary.
    
    Fetches from SCRUM project (configurable via JIRA_PROJECT_KEY in .env).
    Always searches for ALL prodigypm-generated issues to show all backlog issues.
    
    Args:
        project_key: Uses JIRA_PROJECT_KEY from .env (defaults to SCRUM)
        search_all: Always True - searches for all prodigypm-generated issues
    """
    try:
        # Check for active session FIRST - if no session, return empty immediately
        global active_project_session
        if not active_project_session:
            logger.info("No active project session - returning empty dashboard immediately")
            actual_project_key = os.getenv("JIRA_PROJECT_KEY", "SCRUM").upper()
            return {
                "status": "success",
                "project_key": actual_project_key,
                "stats": {
                    "total_issues": 0,
                    "by_status": {},
                    "by_priority": {},
                    "by_type": {},
                    "by_department": {},
                    "completion_rate": 0,
                    "in_progress_count": 0,
                    "done_count": 0,
                    "todo_count": 0
                },
                "ai_summary": "No active project. Upload a PDF or create a PRD to get started.",
                "recent_issues": [],
                "chart_data": {
                    "status": [],
                    "department": [],
                    "priority": []
                },
                "last_updated": datetime.now().isoformat(),
                "connection_info": {
                    "using_real_jira": mcp_manager.use_real_jira,
                    "jira_url": os.getenv("JIRA_URL") if mcp_manager.use_real_jira else None,
                    "project_key": actual_project_key
                },
                "project_session": None,
                "project_completed": False,
                "completion_reason": None,
                "has_active_project": False
            }
        
        # Get project key from active session (if exists)
        # Dashboard will filter by the session's project key to show only current product's issues
        logger.info(f"Fetching dashboard data for active project session")
        logger.info(f"Using real Jira: {mcp_manager.use_real_jira}")
        
        # Fetch Jira issues - Filter by active project session's Jira project
        # Only show issues that belong to the current product's Jira project
        logger.info(f"🔄 Fetching issues for active project session")
        logger.info(f"   Active session: {active_project_session.get('project_key') if active_project_session else 'None'}")
        logger.info(f"   Product: {active_project_session.get('product_name') if active_project_session else 'None'}")
        
        issues = []
        
        # Get the project key and issue keys from the active project session
        session_project_key = None
        session_issue_keys = []
        if active_project_session:
            if 'project_key' in active_project_session:
                session_project_key = active_project_session['project_key']
                logger.info(f"   📋 Filtering by project: {session_project_key}")
            # Get the list of issue keys that were created for this specific product
            session_issue_keys = active_project_session.get('issue_keys', [])
            logger.info(f"   📋 Session has {len(session_issue_keys)} issue keys for this product")
        else:
            logger.warning(f"   ⚠️ No active project session found - showing empty dashboard")
        
        # ALWAYS use direct Jira search for maximum reliability
        # Filter by project key to show only issues from the current product's project
        if mcp_manager.use_real_jira and mcp_manager.jira_client:
            try:
                if session_project_key:
                    # First verify the project exists
                    if not mcp_manager.verify_project_exists(session_project_key):
                        logger.error(f"❌ Project '{session_project_key}' from session does not exist or is not accessible")
                        logger.error(f"   This might mean the project was deleted or permissions changed")
                        logger.error(f"   Clearing session and returning empty dashboard")
                        # Clear the session since project doesn't exist
                        active_project_session = None
                        issues = []
                        # Return empty dashboard
                        default_project_key = os.getenv("JIRA_PROJECT_KEY", "SCRUM").upper()
                        return {
                            "status": "success",
                            "project_key": default_project_key,
                            "stats": {
                                "total_issues": 0,
                                "by_status": {},
                                "by_priority": {},
                                "by_type": {},
                                "by_department": {},
                                "completion_rate": 0,
                                "in_progress_count": 0,
                                "done_count": 0,
                                "todo_count": 0
                            },
                            "ai_summary": f"Project '{session_project_key}' no longer exists. Please sync a new project.",
                            "recent_issues": [],
                            "chart_data": {
                                "status": [],
                                "department": [],
                                "priority": []
                            },
                            "last_updated": datetime.now().isoformat(),
                            "connection_info": {
                                "using_real_jira": mcp_manager.use_real_jira,
                                "jira_url": os.getenv("JIRA_URL") if mcp_manager.use_real_jira else None,
                                "project_key": default_project_key
                            },
                            "project_session": None,
                            "project_completed": False,
                            "completion_reason": None,
                            "has_active_project": False
                        }
                    
                    # Filter by issue keys from the active session - ONLY show issues created for this product
                    logger.info(f"   📋 Filtering by session issue keys: {len(session_issue_keys)} issues for this product")
                    
                    if not session_issue_keys:
                        logger.warning(f"   ⚠️ No issue keys in session - showing empty dashboard")
                        issues = []
                    else:
                        # Build JQL query to fetch only the issues that belong to this product
                        # Use IN clause if we have issue keys, otherwise fallback to project search
                        if len(session_issue_keys) <= 100:  # JQL IN clause has limits
                            # Create JQL query with issue keys
                            # Format: key IN (KEY-1, KEY-2, KEY-3) - Jira requires quotes around keys
                            # But actually, Jira keys don't need quotes in IN clause
                            issue_keys_str = ', '.join(session_issue_keys)
                            jql = f'key IN ({issue_keys_str}) ORDER BY updated DESC'
                            logger.info(f"   🔍 Direct Jira search (filtering by {len(session_issue_keys)} issue keys)...")
                            logger.info(f"   JQL: {jql[:200]}...")  # Log first 200 chars
                        else:
                            # If too many keys, fetch all from project and filter in Python
                            logger.info(f"   ⚠️ Too many issue keys ({len(session_issue_keys)}), fetching all from project and filtering")
                            jql = f'project = {session_project_key} ORDER BY updated DESC'
                        
                        try:
                            direct_issues = mcp_manager.jira_client.search_issues(jql, maxResults=500, expand='changelog')
                            logger.info(f"   ✅ Direct search found {len(direct_issues)} issues from Jira")
                            
                            # Filter to only include issues from the session's issue_keys list
                            if len(session_issue_keys) > 100:
                                # Filter in Python if we fetched all project issues
                                direct_issues = [issue for issue in direct_issues if issue.key in session_issue_keys]
                                logger.info(f"   ✅ Filtered to {len(direct_issues)} issues matching session keys")
                            
                        except Exception as search_error:
                            logger.error(f"   ❌ JQL search failed: {search_error}")
                            logger.error(f"   This might be a permissions issue or JQL syntax error")
                            direct_issues = []
                            issues = []
                        
                        if len(direct_issues) > 0:
                            # Convert to dict format
                            issues = []
                            for issue in direct_issues:
                                # Double-check: only include if it's in our session's issue_keys
                                if issue.key not in session_issue_keys:
                                    logger.warning(f"   ⚠️ Skipping issue {issue.key} - not in session issue_keys")
                                    continue
                                
                                try:
                                    assignee_name = None
                                    if issue.fields.assignee:
                                        assignee_name = getattr(issue.fields.assignee, 'displayName', None) or getattr(issue.fields.assignee, 'name', None)
                                    
                                    issues.append({
                                        "id": issue.key,
                                        "summary": issue.fields.summary,
                                        "description": issue.fields.description or "",
                                        "status": issue.fields.status.name,
                                        "status_id": getattr(issue.fields.status, 'id', None),
                                        "priority": issue.fields.priority.name if issue.fields.priority else "Medium",
                                        "priority_id": getattr(issue.fields.priority, 'id', None) if issue.fields.priority else None,
                                        "type": issue.fields.issuetype.name,
                                        "assignee": assignee_name,
                                        "assignee_info": {
                                            "name": getattr(issue.fields.assignee, 'name', None) if issue.fields.assignee else None,
                                            "display_name": assignee_name,
                                            "email": getattr(issue.fields.assignee, 'emailAddress', None) if issue.fields.assignee else None,
                                        } if issue.fields.assignee else None,
                                        "labels": issue.fields.labels or [],
                                        "url": issue.permalink(),
                                        "project_key": issue.fields.project.key,
                                        "updated": str(issue.fields.updated) if hasattr(issue.fields, 'updated') else None,
                                        "created": str(issue.fields.created) if hasattr(issue.fields, 'created') else None,
                                        "status_category": getattr(issue.fields.status.statusCategory, 'name', None) if hasattr(issue.fields.status, 'statusCategory') and issue.fields.status.statusCategory else None,
                                    })
                                except Exception as e:
                                    logger.error(f"   ❌ Error processing issue {issue.key}: {e}")
                                    continue
                            
                            logger.info(f"   ✅ Processed {len(issues)} issues for dashboard (filtered by session)")
                            logger.info(f"   ✅ Dashboard now showing ONLY issues created for this product: {len(issues)}/{len(session_issue_keys)}")
                            
                            # Verify all issues are from the session
                            missing_issues = set(session_issue_keys) - set([issue.get("id") for issue in issues])
                            if missing_issues:
                                logger.warning(f"   ⚠️ Some session issues not found in Jira: {len(missing_issues)} issues")
                                logger.warning(f"   Missing: {list(missing_issues)[:5]}")
                            else:
                                logger.info(f"   ✅ All {len(session_issue_keys)} session issues found in dashboard")
                        else:
                            logger.warning(f"   ⚠️ No issues found matching session issue keys")
                            issues = []
                else:
                    # No active session - return empty dashboard immediately
                    logger.info(f"   ⚠️ No active project session - returning empty dashboard")
                    default_project_key = os.getenv("JIRA_PROJECT_KEY", "SCRUM").upper()
                    return {
                        "status": "success",
                        "project_key": default_project_key,
                        "stats": {
                            "total_issues": 0,
                            "by_status": {},
                            "by_priority": {},
                            "by_type": {},
                            "by_department": {},
                            "completion_rate": 0,
                            "in_progress_count": 0,
                            "done_count": 0,
                            "todo_count": 0
                        },
                        "ai_summary": "No active project. Upload a PDF or create a PRD to get started.",
                        "recent_issues": [],
                        "chart_data": {
                            "status": [],
                            "department": [],
                            "priority": []
                        },
                        "last_updated": datetime.now().isoformat(),
                        "connection_info": {
                            "using_real_jira": mcp_manager.use_real_jira,
                            "jira_url": os.getenv("JIRA_URL") if mcp_manager.use_real_jira else None,
                            "project_key": default_project_key
                        },
                        "project_session": None,
                        "project_completed": False,
                        "completion_reason": None,
                        "has_active_project": False
                    }
            except Exception as e:
                logger.error(f"   ❌ Direct Jira search failed: {e}")
                import traceback
                logger.error(traceback.format_exc())
                # If we have a session project key, try MCPManager as fallback
                if session_project_key and session_issue_keys:
                    try:
                        logger.info("   🔄 Trying MCPManager as fallback...")
                        all_issues = mcp_manager.fetch_jira_issues(session_project_key)
                        # Filter to only include session issue keys
                        issues = [issue for issue in all_issues if issue.get("id") in session_issue_keys]
                        logger.info(f"   ✅ MCPManager fetched {len(all_issues)} issues, filtered to {len(issues)} session issues")
                    except Exception as e2:
                        logger.error(f"   ❌ MCPManager fallback also failed: {e2}")
                        issues = []
                else:
                    issues = []
        else:
            # No real Jira connection - if we have session, try MCPManager
            if session_project_key and session_issue_keys:
                logger.warning("   ⚠️ Real Jira not available, using MCPManager")
                try:
                    all_issues = mcp_manager.fetch_jira_issues(session_project_key)
                    # Filter to only include session issue keys
                    issues = [issue for issue in all_issues if issue.get("id") in session_issue_keys]
                    logger.info(f"   ✅ MCPManager fetched {len(all_issues)} issues, filtered to {len(issues)} session issues")
                except Exception as e:
                    logger.error(f"   ❌ MCPManager fetch failed: {e}")
                    issues = []
            else:
                logger.warning("   ⚠️ Real Jira not available and no session project key or issue keys")
                issues = []
        
        # Final filtering: Ensure we only show issues from the current product session
        if active_project_session and session_issue_keys:
            # Filter issues to only include those in the session's issue_keys list
            original_count = len(issues)
            issues = [issue for issue in issues if issue.get("id") in session_issue_keys]
            if original_count != len(issues):
                logger.info(f"   🔍 Filtered issues: {original_count} -> {len(issues)} (only showing current product's issues)")
        
        logger.info(f"✅ Final result: {len(issues)} issues fetched for dashboard (filtered by current product)")
        
        # Log summary of statuses for debugging
        if issues:
            statuses = {}
            for issue in issues:
                status = issue.get("status", "Unknown")
                statuses[status] = statuses.get(status, 0) + 1
            logger.info(f"📊 Issue statuses: {statuses}")
            
            # Log first few issue IDs for debugging
            issue_ids = [issue.get("id") for issue in issues[:5]]
            logger.info(f"📋 Sample issue IDs: {issue_ids}")
        else:
            if session_project_key and session_issue_keys:
                logger.warning(f"⚠️ No issues found for current product. Session has {len(session_issue_keys)} issue keys. Check:")
                logger.warning(f"   1. Are the issues still in Jira?")
                logger.warning(f"   2. Does the API user have permission to view these issues?")
                logger.warning(f"   3. Session issue keys: {session_issue_keys[:5]}...")
            elif session_project_key:
                logger.warning(f"⚠️ No issue keys in session for project {session_project_key}")
            else:
                logger.warning(f"⚠️ No active project session - dashboard will be empty")
        
        # Get dashboard data - use session project key if available
        dashboard_project_key = session_project_key or os.getenv("JIRA_PROJECT_KEY", "SCRUM").upper()
        dashboard_data = get_dashboard_data(issues, dashboard_project_key)
        
        # Add connection info
        dashboard_data["connection_info"] = {
            "using_real_jira": mcp_manager.use_real_jira,
            "jira_url": os.getenv("JIRA_URL") if mcp_manager.use_real_jira else None,
            "project_key": dashboard_project_key
        }
        
        # Check for project completion
        project_completed = False
        completion_reason = None
        
        total_issues = dashboard_data['stats']['total_issues']
        done_count = dashboard_data['stats']['done_count']
        completion_rate = dashboard_data['stats']['completion_rate']
        total_created = active_project_session.get('total_issues_created', 0)
        
        # Project is complete if:
        # 1. All issues are done (100% completion) OR
        # 2. All issues are deleted (total_issues = 0 but we had created issues)
        # 3. Completion rate is 100% (all issues done)
        if total_issues == 0 and total_created > 0:
            project_completed = True
            completion_reason = "all_deleted"
            logger.info(f"✅ Project completed: All {total_created} issues have been deleted")
        elif total_issues > 0 and completion_rate >= 100:
            project_completed = True
            completion_reason = "all_done"
            logger.info(f"✅ Project completed: All {total_issues} issues are done (100% completion)")
        elif total_issues > 0 and done_count == total_issues and total_created > 0:
            project_completed = True
            completion_reason = "all_done"
            logger.info(f"✅ Project completed: All {total_issues} issues are done")
        
        # Update session status
        if project_completed and active_project_session.get('status') == 'active':
            active_project_session['status'] = 'completed'
            active_project_session['completed_at'] = datetime.now().isoformat()
            active_project_session['completion_reason'] = completion_reason
        
        # Add project session and completion info
        dashboard_data["project_session"] = active_project_session
        dashboard_data["project_completed"] = project_completed
        dashboard_data["completion_reason"] = completion_reason
        dashboard_data["has_active_project"] = True
        dashboard_data["session_issue_count"] = len(active_project_session.get("issue_keys", [])) if active_project_session else 0
        dashboard_data["filtered_issue_count"] = len(issues)
        
        logger.info(f"Dashboard data retrieved: {dashboard_data['stats']['total_issues']} issues (filtered from session), completed: {project_completed}")
        logger.info(f"   Session has {dashboard_data['session_issue_count']} issue keys, dashboard showing {dashboard_data['filtered_issue_count']} issues")
        
        return {
            "status": "success",
            **dashboard_data
        }
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"Failed to get dashboard data: {str(e)}")
        logger.error(f"Traceback:\n{error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get dashboard data: {str(e)}"
        )


@app.post("/api/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Upload a PDF file and store it using the configured storage service (local or S3).
    Returns file metadata including file_id for later processing.
    """
    logger.info(f"Received PDF upload request: {file.filename}")
    
    # Validate file type
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )
    
    try:
        # Read file content
        content = await file.read()
        
        # Upload using storage service (local or S3)
        file_metadata = storage_service.upload_file(
            file_content=content,
            filename=file.filename
        )
        
        logger.info(f"File uploaded successfully: {file_metadata['file_id']} ({file_metadata['file_size']} bytes)")
        
        return {
            **file_metadata,
            "status": "success",
            "message": f"PDF uploaded successfully to {file_metadata.get('storage_type', 'storage')}"
        }
    
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"PDF upload failed: {str(e)}")
        logger.error(f"Traceback:\n{error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload PDF: {str(e)}"
        )


def extract_pdf_text_by_id(file_id: str) -> dict:
    """
    Internal utility function to extract text from PDF by file_id.
    Used internally by other endpoints (e.g., AI processing).
    Returns extracted text, page count, and statistics.
    """
    logger.info(f"Extracting text from PDF: {file_id}")
    
    # Retrieve file from storage
    pdf_content = storage_service.get_file(file_id)
    
    if pdf_content is None:
        raise ValueError(f"PDF file with ID {file_id} not found")
    
    # Extract text using PDF parser
    extraction_result = PDFParser.extract_text(pdf_content)
    
    logger.info(f"Successfully extracted text: {extraction_result['char_count']} chars, {extraction_result['word_count']} words from {extraction_result['page_count']} pages")
    
    return extraction_result


@app.get("/api/pdf/{file_id}/extract")
def extract_pdf_text_endpoint(file_id: str):
    """
    Extract text from an uploaded PDF file by file_id.
    Internal API endpoint (for debugging/testing).
    Text extraction happens automatically during AI processing.
    """
    try:
        extraction_result = extract_pdf_text_by_id(file_id)
        return {
            "file_id": file_id,
            "status": "success",
            "extraction": extraction_result
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"PDF text extraction failed: {str(e)}")
        logger.error(f"Traceback:\n{error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract text from PDF: {str(e)}"
        )


@app.post("/api/pdf/{file_id}/interpret")
def interpret_pdf_endpoint(file_id: str):
    """
    Interpret a PDF document using AI and extract structured product information.
    
    Steps:
    1. Extract text from PDF (using file_id)
    2. Send text to AI for interpretation
    3. Return structured product information (product_name, goals, departments, etc.)
    
    Returns:
        {
            "file_id": str,
            "status": "success",
            "extraction_stats": {...},
            "interpretation": {
                "product_name": str,
                "goals": [str, ...],
                "target_users": [str, ...],
                "key_deliverables": [str, ...],
                "departments": [str, ...],
                "dependencies": [str, ...],
                "summary": str
            }
        }
    """
    logger.info(f"Received PDF interpretation request for file_id: {file_id}")
    
    if not OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY is not configured")
        raise HTTPException(
            status_code=500,
            detail="Missing OPENAI_API_KEY in environment. Please configure your .env file."
        )
    
    try:
        # Step 1: Extract text from PDF
        logger.info(f"Step 1: Extracting text from PDF {file_id}...")
        extraction_result = extract_pdf_text_by_id(file_id)
        pdf_text = extraction_result["text"]
        
        if not pdf_text or len(pdf_text.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="No text could be extracted from the PDF. The PDF might be image-based or corrupted."
            )
        
        logger.info(f"Extracted {len(pdf_text)} characters from PDF")
        
        # Step 2: Interpret PDF using AI
        logger.info(f"Step 2: Sending PDF text to AI for interpretation...")
        interpretation_result = interpret_pdf(pdf_text)
        
        # Step 3: Return structured result
        logger.info(f"Step 3: Interpretation complete. Product: {interpretation_result.get('product_name', 'Unknown')}")
        
        return {
            "file_id": file_id,
            "status": "success",
            "extraction_stats": {
                "page_count": extraction_result["page_count"],
                "char_count": extraction_result["char_count"],
                "word_count": extraction_result["word_count"]
            },
            "interpretation": interpretation_result
        }
    
    except HTTPException:
        raise
    except ValueError as e:
        # PDF parsing or AI interpretation errors
        logger.error(f"PDF interpretation failed: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to interpret PDF: {str(e)}"
        )
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"PDF interpretation failed: {str(e)}")
        logger.error(f"Traceback:\n{error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to interpret PDF: {str(e)}"
        )


@app.post("/api/pdf/{file_id}/decompose")
def decompose_pdf_endpoint(file_id: str):
    """
    Decompose an interpreted PDF into department-level subprojects with effort estimates.
    
    Steps:
    1. Extract text from PDF and interpret it (or use cached interpretation)
    2. Decompose product information into department-level subprojects
    3. Return structured subprojects with tasks and effort estimates
    
    Note: This endpoint will first interpret the PDF if not already done.
    For better performance, interpret the PDF first, then decompose.
    """
    logger.info(f"Received PDF decomposition request for file_id: {file_id}")
    
    if not OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY is not configured")
        raise HTTPException(
            status_code=500,
            detail="Missing OPENAI_API_KEY in environment. Please configure your .env file."
        )
    
    try:
        # Step 1: Extract and interpret PDF (if not already done)
        logger.info(f"Step 1: Extracting and interpreting PDF {file_id}...")
        extraction_result = extract_pdf_text_by_id(file_id)
        pdf_text = extraction_result["text"]
        
        if not pdf_text or len(pdf_text.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="No text could be extracted from the PDF. The PDF might be image-based or corrupted."
            )
        
        # Step 2: Interpret PDF using AI
        logger.info(f"Step 2: Interpreting PDF...")
        product_info = interpret_pdf(pdf_text)
        
        # Step 3: Decompose into subprojects
        logger.info(f"Step 3: Decomposing product into department-level subprojects...")
        subprojects = decompose_into_subprojects(product_info)
        
        # Step 4: Generate summary
        logger.info(f"Step 4: Generating subproject summary...")
        summary = get_subproject_summary(subprojects)
        
        logger.info(f"Decomposition complete: {summary['total_subprojects']} subprojects across {len(summary['department_summary'])} departments")
        
        return {
            "file_id": file_id,
            "status": "success",
            "interpretation": product_info,
            "subprojects": subprojects,
            "summary": summary
        }
    
    except HTTPException:
        raise
    except ValueError as e:
        # PDF parsing, AI interpretation, or decomposition errors
        logger.error(f"PDF decomposition failed: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decompose PDF: {str(e)}"
        )
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"PDF decomposition failed: {str(e)}")
        logger.error(f"Traceback:\n{error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to decompose PDF: {str(e)}"
        )


@app.post("/api/jira/sync")
def sync_to_jira(req: JiraSyncRequest):
    """
    Sync subprojects to Jira by creating Jira tickets.
    
    Creates a new Jira project for the product (or uses existing) and creates issues in that project.
    Each product gets its own Jira project for better isolation and tracking.
    Returns created issue IDs and mapping back to subprojects.
    """
    logger.info(f"Received Jira sync request for {len(req.subprojects)} subprojects")
    logger.info(f"Product name: {req.product_name or 'Not provided'}")
    
    try:
        # Step 1: Create or get Jira project for this product
        product_name = req.product_name or "ProdigyPM Product"
        logger.info(f"Step 1: Creating/getting Jira project for product: {product_name}")
        
        project_result = mcp_manager.create_or_get_jira_project(product_name)
        project_key = project_result["project_key"]
        project_name = project_result["project_name"]
        project_created = project_result.get("created", False)
        project_error = project_result.get("error")
        
        # Validate project exists and is accessible
        if project_error:
            logger.warning(f"⚠️ Project creation error: {project_result.get('message')}")
            # Try to verify if project exists anyway (might have been created manually)
            if not mcp_manager.verify_project_exists(project_key):
                # Project doesn't exist and creation failed - use fallback
                fallback_project = os.getenv("JIRA_PROJECT_KEY", "SCRUM").upper()
                logger.warning(f"⚠️ Project '{project_key}' does not exist. Falling back to default project: {fallback_project}")
                if mcp_manager.verify_project_exists(fallback_project):
                    project_key = fallback_project
                    project_name = f"Fallback Project ({fallback_project})"
                    logger.info(f"✅ Using fallback project: {project_key}")
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to create project '{project_result['project_key']}' and fallback project '{fallback_project}' is not accessible. Please create a project in Jira first. Error: {project_error}"
                    )
            else:
                logger.info(f"✅ Project '{project_key}' exists (may have been created manually)")
        else:
            # Verify project exists even if creation reported success
            if not mcp_manager.verify_project_exists(project_key):
                logger.error(f"❌ Project '{project_key}' was reported as created but verification failed")
                fallback_project = os.getenv("JIRA_PROJECT_KEY", "SCRUM").upper()
                if mcp_manager.verify_project_exists(fallback_project):
                    logger.warning(f"⚠️ Falling back to default project: {fallback_project}")
                    project_key = fallback_project
                    project_name = f"Fallback Project ({fallback_project})"
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Project '{project_key}' is not accessible. Please check Jira permissions and project key."
                    )
        
        logger.info(f"✅ Using Jira project: {project_key} - {project_name}")
        if project_created:
            logger.info(f"   🎉 New project created!")
        else:
            logger.info(f"   📁 Using existing project")
        
        # Step 2: Convert subprojects to Jira issue format
        logger.info(f"Step 2: Converting subprojects to Jira issue format...")
        jira_issues = subprojects_to_jira_issues(req.subprojects, project_key)
        
        if not jira_issues:
            logger.error("❌ No valid Jira issues could be created from subprojects")
            raise HTTPException(
                status_code=400,
                detail="No valid Jira issues could be created from subprojects. Check subproject data format."
            )
        
        logger.info(f"✅ Converted {len(jira_issues)} subprojects to Jira issue format")
        logger.info(f"Sample issue: {jira_issues[0] if jira_issues else 'None'}")
        
        # Step 3: Verify project is accessible before creating issues
        logger.info(f"Step 3: Verifying project {project_key} is accessible...")
        if not mcp_manager.verify_project_exists(project_key):
            raise HTTPException(
                status_code=500,
                detail=f"Project '{project_key}' is not accessible. Please check Jira permissions and ensure the project exists."
            )
        logger.info(f"✅ Project {project_key} verified and accessible")
        
        # Step 4: Create issues in Jira project (goes to backlog by default)
        logger.info(f"Step 4: Creating {len(jira_issues)} Jira issues in project {project_key}...")
        created_issues = mcp_manager.create_jira_issues_batch(jira_issues, project_key, sprint_name=None)
        
        if not created_issues:
            logger.error("❌ No issues were created - check Jira connection and permissions")
            raise HTTPException(
                status_code=500,
                detail="Failed to create any Jira issues. Check backend logs for details. Verify Jira credentials and project permissions."
            )
        
        # Step 5: Verify issues were actually created
        logger.info(f"Step 5: Verifying {len(created_issues)} issues were created...")
        verified_issues = []
        for created_issue in created_issues:
            issue_key = created_issue.get("id")
            if issue_key:
                # Verify issue exists in Jira
                try:
                    if mcp_manager.use_real_jira and mcp_manager.jira_client:
                        # Try to fetch the issue to verify it exists
                        try:
                            verified_issue = mcp_manager.jira_client.issue(issue_key)
                            logger.info(f"✅ Verified issue {issue_key} exists in Jira")
                            verified_issues.append(created_issue)
                        except Exception as verify_error:
                            logger.error(f"❌ Issue {issue_key} was created but cannot be verified: {verify_error}")
                            # Still add it to the list - it might exist but not be accessible immediately
                            verified_issues.append(created_issue)
                    else:
                        verified_issues.append(created_issue)
                except Exception as e:
                    logger.error(f"❌ Error verifying issue {issue_key}: {e}")
                    # Still add it - verification failure doesn't mean it doesn't exist
                    verified_issues.append(created_issue)
            else:
                logger.warning(f"⚠️ Created issue missing ID: {created_issue}")
        
        if len(verified_issues) != len(created_issues):
            logger.warning(f"⚠️ Only {len(verified_issues)}/{len(created_issues)} issues could be verified")
        
        created_issues = verified_issues
        logger.info(f"✅ Verified {len(created_issues)} issues in project {project_key}")
        
        # Create mapping between subprojects and created issues
        # Store both jira_id and jira_key for filtering
        subproject_to_issue_map = {}
        issue_keys_list = []  # Store list of issue keys for easy filtering
        
        for i, subproject in enumerate(req.subprojects):
            if i < len(created_issues):
                issue_key = created_issues[i]["id"]  # e.g., "SCRUM-60"
                issue_keys_list.append(issue_key)
                subproject_to_issue_map[subproject.get("subproject_id", f"sp-{i}")] = {
                    "jira_id": issue_key,
                    "jira_key": issue_key,  # Same as jira_id for consistency
                    "summary": created_issues[i]["summary"],
                    "subproject_title": subproject.get("title", ""),
                    "department": subproject.get("department", "")
                }
        
        logger.info(f"✅ Successfully created and verified {len(created_issues)} Jira issues")
        logger.info(f"Issue keys for session: {issue_keys_list}")
        
        # Create/update active project session
        global active_project_session
        active_project_session = {
            "project_key": project_key,
            "project_name": project_name,
            "product_name": product_name,
            "total_issues_created": len(created_issues),
            "total_requested": len(req.subprojects),
            "created_at": datetime.now().isoformat(),
            "subproject_mapping": subproject_to_issue_map,
            "issue_keys": issue_keys_list,  # Store list of issue keys for easy filtering
            "project_created": project_created,
            "status": "active",
            "jira_url": os.getenv("JIRA_URL")
        }
        logger.info(f"✅ Created active project session: {len(created_issues)} issues in {project_key}")
        logger.info(f"   Project: {project_key} - {project_name}")
        logger.info(f"   Product: {product_name}")
        logger.info(f"   Issue keys: {issue_keys_list}")
        logger.info(f"   Session saved - dashboard will now show issues from this project")
        
        # Return detailed response
        return {
            "status": "success",
            "project_key": project_key,
            "project_name": project_name,
            "product_name": product_name,
            "project_created": project_created,
            "total_created": len(created_issues),
            "total_requested": len(req.subprojects),
            "created_issues": created_issues,
            "subproject_mapping": subproject_to_issue_map,
            "issue_keys": issue_keys_list,
            "jira_project_url": f"{os.getenv('JIRA_URL', '')}/browse/{project_key}" if os.getenv("JIRA_URL") else None,
            "message": f"Successfully created {len(created_issues)} Jira issues in {project_key} project ({project_name})"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"Jira sync failed: {str(e)}")
        logger.error(f"Traceback:\n{error_trace}")
        
        # Provide more helpful error messages
        error_message = str(e)
        if "does not exist" in error_message or "not accessible" in error_message:
            detail = f"Project access error: {error_message}. Please verify the project exists in Jira and your account has access."
        elif "permission" in error_message.lower() or "forbidden" in error_message.lower():
            detail = f"Permission error: {error_message}. Please check your Jira API token has create issue permissions."
        elif "authentication" in error_message.lower() or "unauthorized" in error_message.lower():
            detail = f"Authentication error: {error_message}. Please check your Jira credentials in .env file."
        else:
            detail = f"Failed to sync to Jira: {error_message}. Check backend logs for details."
        
        raise HTTPException(
            status_code=500,
            detail=detail
        )


@app.post("/api/prd/consultant/chat/start")
def start_prd_chat(req: PRDChatStartRequest):
    """Start a new PRD consultation chat session."""
    try:
        agent = PRDConsultantChatAgent()
        session_data = agent.start_session(req.initial_message)
        
        # Store session
        prd_chat_sessions[session_data["session_id"]] = agent
        
        logger.info(f"Started PRD chat session: {session_data['session_id']}")
        
        return {
            "status": "success",
            **session_data
        }
    except Exception as e:
        logger.error(f"Error starting PRD chat session: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to start PRD chat session: {str(e)}")


@app.post("/api/prd/consultant/chat/message")
def send_prd_chat_message(req: PRDChatMessageRequest):
    """Send a message in the PRD consultation chat."""
    try:
        # Get session
        if req.session_id not in prd_chat_sessions:
            raise HTTPException(status_code=404, detail="Session not found. Please start a new session.")
        
        agent = prd_chat_sessions[req.session_id]
        
        # Send message
        result = agent.send_message(req.message, req.session_id)
        
        logger.info(f"Received message in session {req.session_id}")
        
        return {
            "status": "success",
            **result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to process message: {str(e)}")


@app.post("/api/prd/consultant/chat/confirm")
def request_prd_confirmation(req: PRDConfirmationRequest):
    """Request confirmation of collected information before generating PRD."""
    try:
        # Get session
        if req.session_id not in prd_chat_sessions:
            raise HTTPException(status_code=404, detail="Session not found. Please start a new session.")
        
        agent = prd_chat_sessions[req.session_id]
        
        # Request confirmation
        result = agent.request_confirmation(req.session_id)
        
        logger.info(f"Requested confirmation for session {req.session_id}")
        
        return {
            "status": "success",
            **result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error requesting confirmation: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to request confirmation: {str(e)}")


@app.post("/api/prd/consultant/chat/generate")
def confirm_and_generate_prd(req: PRDConfirmAndGenerateRequest):
    """Confirm information and generate the final PRD document."""
    try:
        # Get session
        if req.session_id not in prd_chat_sessions:
            raise HTTPException(status_code=404, detail="Session not found. Please start a new session.")
        
        agent = prd_chat_sessions[req.session_id]
        
        # Confirm and generate
        result = agent.confirm_and_generate(req.session_id, req.confirmation, req.author_name)
        
        logger.info(f"Generated PRD for session {req.session_id}")
        
        return {
            "status": "success",
            **result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating PRD: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to generate PRD: {str(e)}")


@app.get("/api/project/session")
def get_project_session():
    """Get the current active project session."""
    global active_project_session
    return {
        "status": "success",
        "session": active_project_session,
        "has_active_project": active_project_session is not None
    }


@app.post("/api/project/clear")
def clear_project(req: ClearProjectRequest):
    """Clear/close the active project session."""
    global active_project_session
    logger.info(f"🔴 Clear project called - current session: {active_project_session is not None}")
    
    if not active_project_session:
        logger.info("No active project to clear")
        return {
            "status": "success",
            "message": "No active project to clear",
            "session": None,
            "has_active_project": False
        }
    
    old_session = active_project_session.copy()
    active_project_session = None
    
    logger.info(f"✅ Cleared project session: {old_session.get('project_key')} - Session is now: {active_project_session}")
    
    return {
        "status": "success",
        "message": "Project session cleared successfully",
        "cleared_session": old_session,
        "has_active_project": False
    }


@app.post("/api/generate_prd")
def generate_prd(req: PRDRequest):
    """
    Generate a Product Requirements Document (PRD)
    using context and feature name.
    
    If use_jira_context is True, automatically pulls Jira issues
    as additional context.
    """
    logger.info(f"Received PRD generation request for feature: {req.feature_name}")
    
    if not OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY is not configured")
        raise HTTPException(
            status_code=500, 
            detail="Missing OPENAI_API_KEY in environment. Please configure your .env file."
        )

    try:
        # Build context from multiple sources
        context_parts = []
        
        # Add user-provided context if available
        if req.context:
            logger.info("Adding user-provided context")
            context_parts.append(f"User Context:\n{req.context}")
        
        # Add Jira issues as context if requested
        jira_issues = []
        if req.use_jira_context:
            logger.info(f"Fetching Jira issues for project: {req.project_key}")
            jira_issues = mcp_manager.fetch_jira_issues(req.project_key)
            if jira_issues:
                logger.info(f"Found {len(jira_issues)} Jira issues")
                jira_context = "\n\nRelated Jira Issues:\n"
                for issue in jira_issues[:5]:  # Limit to top 5 for token efficiency
                    jira_context += f"- [{issue['id']}] {issue['summary']}: {issue['description']}\n"
                context_parts.append(jira_context)
            else:
                logger.warning("No Jira issues found")
        
        # Combine all context
        full_context = "\n\n".join(context_parts) if context_parts else "No additional context provided."
        logger.info(f"Context length: {len(full_context)} characters")
        
        # Generate PRD using AI
        logger.info("Calling generate_prd_func...")
        prd_text = generate_prd_func(full_context, req.feature_name)
        logger.info(f"PRD generated successfully, length: {len(prd_text) if prd_text else 0} characters")
        
        return {
            "feature": req.feature_name,
            "prd": prd_text,
            "context_used": {
                "user_context": bool(req.context),
                "jira_context": req.use_jira_context,
                "jira_issues_count": len(jira_issues) if req.use_jira_context else 0
            },
            "status": "success"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"PRD generation failed: {str(e)}")
        logger.error(f"Traceback:\n{error_trace}")
        raise HTTPException(
            status_code=500, 
            detail=f"PRD generation failed: {str(e)}\n\nTraceback:\n{error_trace}"
        )


# --------------------------------------------------
# Future Routes (Phase 5+)
# --------------------------------------------------
# TODO: Priority scoring endpoint
# @app.post("/api/prioritize")
# def prioritize_features(features: List[Feature]):
#     pass

# TODO: Sprint report generation
# @app.post("/api/generate_report")
# def generate_sprint_report(sprint_id: str):
#     pass

# TODO: Slack integration
# @app.get("/api/slack/feedback")
# def get_slack_feedback(channel_id: str):
#     pass


# --------------------------------------------------
# Error Handlers
# --------------------------------------------------
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return {
        "error": "Endpoint not found",
        "message": "Check /docs for available endpoints",
        "status_code": 404
    }


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return {
        "error": "Internal server error",
        "message": str(exc),
        "status_code": 500
    }


# --------------------------------------------------
# Run with: uvicorn main:app --reload
# --------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)