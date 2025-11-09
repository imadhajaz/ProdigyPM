import json
import os
from pathlib import Path
from typing import List, Dict, Optional
import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)

class MCPManager:
    def __init__(self):
        # Get the path to mock_data folder
        self.base_path = Path(__file__).parent.parent / "mock_data"
        self.issues_file = self.base_path / "jira_issues.json"
        
        # Check if we should use real Jira
        use_real_jira_env = os.getenv("USE_REAL_JIRA", "false").lower()
        self.use_real_jira = use_real_jira_env in ["true", "1", "yes"]
        self.jira_client = None
        
        # Get Jira project key from environment (default to SCRUM, since that's where issues are being created)
        # The user confirmed issues are going to backlog in SCRUM project
        self.default_project_key = os.getenv("JIRA_PROJECT_KEY", "SCRUM").upper()
        
        logger.info(f"USE_REAL_JIRA env value: {use_real_jira_env}, parsed as: {self.use_real_jira}")
        logger.info(f"Default Jira project key: {self.default_project_key}")
        
        if self.use_real_jira:
            self._initialize_jira_client()
        else:
            logger.info("Using mock Jira (storing in JSON file)")
            logger.info("To enable real Jira, set USE_REAL_JIRA=true in .env file")
    
    def _initialize_jira_client(self):
        """Initialize Jira client if using real Jira."""
        try:
            from jira import JIRA
            
            jira_url = os.getenv("JIRA_URL")
            jira_email = os.getenv("JIRA_EMAIL")
            jira_token = os.getenv("JIRA_API_TOKEN")
            
            if not all([jira_url, jira_email, jira_token]):
                logger.warning("Jira credentials not fully configured. Falling back to mock Jira.")
                self.use_real_jira = False
                return
            
            self.jira_client = JIRA(
                server=jira_url,
                basic_auth=(jira_email, jira_token)
            )
            logger.info(f"✅ Connected to real Jira: {jira_url}")
            
        except ImportError:
            logger.warning("Jira library not installed. Install with: pip install jira. Falling back to mock Jira.")
            self.use_real_jira = False
        except Exception as e:
            logger.error(f"Failed to connect to Jira: {e}. Falling back to mock Jira.")
            self.use_real_jira = False
    
    def create_or_get_jira_project(self, product_name: str, product_key: Optional[str] = None) -> Dict:
        """
        Create a new Jira project for a product, or return existing project if it exists.
        
        Args:
            product_name: Name of the product (e.g., "Multi-spectral Imaging Device")
            product_key: Optional project key (e.g., "MULTI-IMG"). If not provided, generates from product name.
            
        Returns:
            Dict with project_key, project_name, created (bool), message
        """
        if not self.use_real_jira or not self.jira_client:
            logger.warning("Real Jira not available, cannot create project")
            return {
                "project_key": "MOCK",
                "project_name": product_name,
                "created": False,
                "message": "Mock mode - project not created"
            }
        
        try:
            # Generate project key from product name if not provided
            if not product_key:
                # Take first 3-10 uppercase letters/numbers from product name
                # Remove special characters and spaces
                key_base = ''.join(c for c in product_name.upper() if c.isalnum())[:10]
                # Ensure it's at least 3 characters
                if len(key_base) < 3:
                    key_base = "PROD" + key_base
                # Jira project keys must be uppercase and 2-10 characters
                product_key = key_base[:10]
                logger.info(f"Generated project key '{product_key}' from product name '{product_name}'")
            
            # Check if project already exists
            try:
                existing_project = self.jira_client.project(product_key)
                logger.info(f"✅ Project '{product_key}' already exists: {existing_project.name}")
                return {
                    "project_key": product_key,
                    "project_name": existing_project.name,
                    "created": False,
                    "message": f"Project '{product_key}' already exists"
                }
            except Exception as e:
                # Project doesn't exist, create it
                logger.info(f"Project '{product_key}' does not exist, creating new project...")
                pass
            
            # Create new project
            try:
                # Try to create project with Scrum template
                project = self.jira_client.create_project(
                    key=product_key,
                    name=product_name,
                    project_type_key="software",
                    template_name="com.pyxis.greenhopper.jira:gh-scrum-template"  # Scrum template
                )
                logger.info(f"✅ Created new Jira project: {project.key} - {project.name}")
                return {
                    "project_key": project.key,
                    "project_name": project.name,
                    "created": True,
                    "message": f"Created new project '{project.key}' for '{product_name}'"
                }
            except Exception as create_error:
                # If Scrum template fails, try basic template
                try:
                    logger.warning(f"Scrum template failed, trying basic template: {create_error}")
                    project = self.jira_client.create_project(
                        key=product_key,
                        name=product_name,
                        project_type_key="software"
                    )
                    logger.info(f"✅ Created new Jira project (basic): {project.key} - {project.name}")
                    return {
                        "project_key": project.key,
                        "project_name": project.name,
                        "created": True,
                        "message": f"Created new project '{project.key}' for '{product_name}'"
                    }
                except Exception as basic_error:
                    logger.error(f"❌ Failed to create Jira project: {basic_error}")
                    # Return error but suggest manual creation
                    return {
                        "project_key": product_key,
                        "project_name": product_name,
                        "created": False,
                        "error": str(basic_error),
                        "message": f"Failed to create project. You may need to create it manually in Jira with key '{product_key}' and name '{product_name}'"
                    }
        except Exception as e:
            logger.error(f"❌ Error in create_or_get_jira_project: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                "project_key": product_key or "UNKNOWN",
                "project_name": product_name,
                "created": False,
                "error": str(e),
                "message": f"Error creating/getting project: {e}"
            }
    
    def _assign_issue_to_sprint(self, issue_key: str, sprint_name: str, project_key: str):
        """
        Assign a Jira issue to a sprint.
        
        Args:
            issue_key: Jira issue key (e.g., "PROD-1")
            sprint_name: Sprint name (e.g., "Sprint 1")
            project_key: Project key (e.g., "PROD")
        """
        try:
            # Try to find board and sprint using Jira API
            # Method 1: Try using boards() method
            try:
                boards = self.jira_client.boards(projectKeyOrID=project_key)
                if not boards:
                    logger.warning(f"No boards found for project {project_key}")
                    return
                
                board = boards[0]
                logger.info(f"Using board {board.id} ({board.name}) for project {project_key}")
                
                # Try to get sprints - method name may vary
                sprints = None
                try:
                    sprints = self.jira_client.sprints(board_id=board.id, state='active,future')
                except AttributeError:
                    # Try alternative method
                    try:
                        sprints = self.jira_client.get_sprints(board_id=board.id)
                    except:
                        pass
                
                if sprints:
                    # Find sprint by name
                    target_sprint = None
                    for sprint in sprints:
                        sprint_name_lower = getattr(sprint, 'name', '').lower()
                        if sprint_name.lower() in sprint_name_lower or sprint_name_lower in sprint_name.lower():
                            target_sprint = sprint
                            break
                    
                    if not target_sprint:
                        # Try to find any sprint with "1" in the name
                        for sprint in sprints:
                            sprint_name_attr = getattr(sprint, 'name', '')
                            if '1' in sprint_name_attr or 'sprint 1' in sprint_name_attr.lower():
                                target_sprint = sprint
                                logger.info(f"Found sprint: {sprint_name_attr} (ID: {getattr(sprint, 'id', 'unknown')})")
                                break
                    
                    if target_sprint:
                        sprint_id = getattr(target_sprint, 'id', None)
                        if sprint_id:
                            # Try to add issue to sprint
                            try:
                                self.jira_client.add_issues_to_sprint(sprint_id=sprint_id, issue_keys=[issue_key])
                                logger.info(f"✅ Added issue {issue_key} to sprint {getattr(target_sprint, 'name', sprint_name)}")
                                return
                            except AttributeError:
                                # Try alternative method using REST API
                                self._add_issue_to_sprint_rest(issue_key, sprint_id)
                                return
                    else:
                        logger.warning(f"Sprint '{sprint_name}' not found. Available sprints: {[getattr(s, 'name', 'unknown') for s in sprints]}")
                        # Use first available sprint
                        if sprints:
                            first_sprint = sprints[0]
                            sprint_id = getattr(first_sprint, 'id', None)
                            if sprint_id:
                                try:
                                    self.jira_client.add_issues_to_sprint(sprint_id=sprint_id, issue_keys=[issue_key])
                                    logger.info(f"✅ Added issue {issue_key} to sprint {getattr(first_sprint, 'name', 'first sprint')}")
                                    return
                                except:
                                    self._add_issue_to_sprint_rest(issue_key, sprint_id)
                                    return
            except Exception as e:
                logger.warning(f"Board/sprint lookup failed: {e}")
            
            # Method 2: Use REST API directly
            logger.info(f"Attempting to assign {issue_key} to {sprint_name} using REST API...")
            # Note: Sprint assignment via REST API requires board ID and sprint ID
            # This is a fallback - the issue will be created but may not be in sprint
            logger.warning(f"Could not automatically assign to sprint. Issue {issue_key} created but may need manual sprint assignment.")
            
        except Exception as e:
            logger.warning(f"Could not assign issue to sprint: {e}")
            import traceback
            logger.warning(traceback.format_exc())
    
    def _add_issue_to_sprint_rest(self, issue_key: str, sprint_id: int):
        """Add issue to sprint using REST API directly."""
        try:
            url = f"{self.jira_client._options['server']}/rest/agile/1.0/sprint/{sprint_id}/issue"
            data = {"issues": [issue_key]}
            response = self.jira_client._session.post(url, json=data)
            if response.status_code == 204:
                logger.info(f"✅ Added issue {issue_key} to sprint {sprint_id} via REST API")
            else:
                logger.warning(f"Failed to add issue to sprint via REST: {response.status_code} - {response.text}")
        except Exception as e:
            logger.warning(f"REST API sprint assignment failed: {e}")
    
    def fetch_jira_issues(self, project_key: str = "PROD") -> List[Dict]:
        """
        Fetch Jira issues from project.
        Uses real Jira API if configured, otherwise uses mock implementation.
        """
        if self.use_real_jira and self.jira_client:
            return self._fetch_jira_issues_real(project_key)
        else:
            return self._fetch_jira_issues_mock(project_key)
    
    def _fetch_jira_issues_real(self, project_key: str) -> List[Dict]:
        """Fetch real Jira issues using Jira API."""
        try:
            # Validate Jira client is working
            if not self.jira_client:
                logger.error("❌ Jira client is not initialized")
                return []
            
            # Test connection by trying to access projects (more reliable than current_user)
            try:
                # Test connection by accessing projects - this will fail if not connected
                test_projects = self.jira_client.projects()
                logger.info(f"✅ Jira connection verified - can access {len(test_projects)} projects")
            except Exception as e:
                logger.error(f"❌ Jira connection test failed: {e}")
                logger.error("   Cannot fetch issues - Jira authentication may be invalid")
                import traceback
                logger.error(traceback.format_exc())
                return []
            
            # Try multiple search strategies
            issues = []
            
            # Strategy 1: ALWAYS search for prodigypm-generated issues first (this is the primary strategy)
            # This ensures we find ALL issues created by ProdigyPM, regardless of project
            # Order by updated DESC to get most recently changed issues first (for real-time updates)
            try:
                logger.info("🔍 Strategy 1: Searching for ALL prodigypm-generated issues (primary strategy)...")
                jql = 'labels = prodigypm-generated ORDER BY updated DESC'
                all_issues = self.jira_client.search_issues(jql, maxResults=100, expand='changelog')
                logger.info(f"   ✅ Found {len(all_issues)} total issues with prodigypm-generated label")
                
                if len(all_issues) > 0:
                    # ALWAYS use ALL prodigypm-generated issues (show issues from any project)
                    # This ensures dashboard shows all created issues regardless of project key
                    # The user confirmed issues are in backlog, so we want to show ALL of them
                    issues = all_issues
                    project_counts = {}
                    for issue in all_issues:
                        proj_key = issue.fields.project.key
                        project_counts[proj_key] = project_counts.get(proj_key, 0) + 1
                    logger.info(f"   ✅ Found {len(issues)} prodigypm-generated issues total")
                    logger.info(f"   📋 Issues by project: {project_counts}")
                    logger.info(f"   💡 Configured project: {self.default_project_key}")
                    logger.info(f"   ✅ Dashboard showing ALL backlog issues (real-time updates enabled)")
                else:
                    logger.warning(f"   ⚠️ No prodigypm-generated issues found in any project")
            except Exception as e:
                logger.error(f"❌ Strategy 1 (prodigypm-generated search) failed: {e}")
                import traceback
                logger.error(f"   Full traceback:\n{traceback.format_exc()}")
                # Fall through to Strategy 2
            
            # Strategy 2: Fallback to project-specific search if Strategy 1 found nothing
            # This is a fallback in case labels aren't working
            if not issues:
                try:
                    search_project = self.default_project_key
                    jql = f'project = {search_project} ORDER BY updated DESC'
                    logger.info(f"🔍 Strategy 2 (fallback): Searching project {search_project} directly...")
                    logger.info(f"   Jira server: {self.jira_client._options.get('server', 'Unknown')}")
                    logger.info(f"   Using project key from .env: {search_project}")
                    
                    # Make the API call - this will raise an exception if it fails
                    issues = self.jira_client.search_issues(jql, maxResults=50, expand='changelog')
                    logger.info(f"✅ Jira API returned {len(issues)} issues in {search_project} project")
                    
                    # Debug: List what projects we can access if no issues found
                    if len(issues) == 0:
                        logger.warning(f"⚠️ No issues found in {search_project} project")
                        try:
                            # Try to list all projects to see what's available
                            projects = self.jira_client.projects()
                            project_keys = [p.key for p in projects]
                            logger.info(f"   📋 Available projects: {project_keys}")
                            
                            # Check if the configured project exists
                            if search_project not in project_keys:
                                logger.error(f"   ❌ Project '{search_project}' not found! Available projects: {project_keys}")
                                logger.error(f"   💡 Update JIRA_PROJECT_KEY in .env file to one of: {project_keys}")
                        except Exception as e:
                            logger.error(f"   ❌ Could not list projects: {e}")
                            import traceback
                            logger.error(traceback.format_exc())
                            
                except Exception as e:
                    logger.error(f"❌ Project key search failed: {e}")
                    import traceback
                    logger.error(f"   Full traceback:\n{traceback.format_exc()}")
            
            # Strategy 3 is now handled in Strategy 2 (searching by label)
            # Removed duplicate logic
            
            result = []
            for issue in issues:
                try:
                    # Get assignee details (name, email, display name)
                    assignee_info = None
                    if issue.fields.assignee:
                        assignee_info = {
                            "name": issue.fields.assignee.name if hasattr(issue.fields.assignee, 'name') else None,
                            "display_name": issue.fields.assignee.displayName if hasattr(issue.fields.assignee, 'displayName') else None,
                            "email": issue.fields.assignee.emailAddress if hasattr(issue.fields.assignee, 'emailAddress') else None,
                        }
                        # Use display_name as primary, fallback to name
                        assignee_name = assignee_info.get("display_name") or assignee_info.get("name") or "Unassigned"
                    else:
                        assignee_name = None
                    
                    # Get updated timestamp for real-time tracking
                    updated_time = None
                    if hasattr(issue.fields, 'updated'):
                        updated_time = str(issue.fields.updated)
                    
                    # Get created timestamp
                    created_time = None
                    if hasattr(issue.fields, 'created'):
                        created_time = str(issue.fields.created)
                    
                    result.append({
                        "id": issue.key,
                        "summary": issue.fields.summary,
                        "description": issue.fields.description or "",
                        "status": issue.fields.status.name,
                        "status_id": issue.fields.status.id if hasattr(issue.fields.status, 'id') else None,
                        "priority": issue.fields.priority.name if issue.fields.priority else "Medium",
                        "priority_id": issue.fields.priority.id if issue.fields.priority and hasattr(issue.fields.priority, 'id') else None,
                        "type": issue.fields.issuetype.name,
                        "assignee": assignee_name,
                        "assignee_info": assignee_info,
                        "labels": issue.fields.labels or [],
                        "url": issue.permalink(),
                        "project_key": issue.fields.project.key,
                        "updated": updated_time,
                        "created": created_time,
                        # Add status category for better filtering
                        "status_category": issue.fields.status.statusCategory.name if hasattr(issue.fields.status, 'statusCategory') and issue.fields.status.statusCategory else None,
                    })
                except Exception as e:
                    logger.error(f"Error processing issue {issue.key}: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    continue
            
            if len(result) == 0:
                logger.warning(f"⚠️ No issues returned after all search strategies")
                logger.warning(f"   This could mean:")
                logger.warning(f"   1. No issues exist in {self.default_project_key} project")
                logger.warning(f"   2. Jira API permissions issue")
                logger.warning(f"   3. Project key '{self.default_project_key}' doesn't exist")
                logger.warning(f"   💡 Check backend logs above for available projects and issue counts")
                logger.warning(f"   💡 Update JIRA_PROJECT_KEY in .env file if needed")
            else:
                logger.info(f"✅ Successfully fetched {len(result)} real Jira issues for project {project_key}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Critical error in _fetch_jira_issues_real: {e}")
            import traceback
            logger.error(f"   Full traceback:\n{traceback.format_exc()}")
            logger.error(f"   Returning empty list - check Jira connection and credentials")
            return []
    
    def _fetch_jira_issues_mock(self, project_key: str) -> List[Dict]:
        """Load Jira issues from mock JSON file"""
        try:
            # Read the JSON file
            with open(self.issues_file, 'r') as f:
                issues = json.load(f)
            
            # Filter by project key if needed
            filtered_issues = [issue for issue in issues if issue.get('id', '').startswith(project_key)]
            logger.info(f"✅ Loaded {len(filtered_issues)} mock Jira issues for project {project_key}")
            return filtered_issues
            
        except FileNotFoundError:
            logger.warning("❌ Mock data file not found!")
            return []
        except json.JSONDecodeError:
            logger.error("❌ Invalid JSON format!")
            return []
    
    def create_jira_issue(
        self,
        project_key: str,
        summary: str,
        description: str,
        issue_type: str = "Task",
        priority: str = "Medium",
        assignee: Optional[str] = None,
        labels: Optional[List[str]] = None,
        sprint_name: Optional[str] = None
    ) -> Dict:
        """
        Create a Jira issue.
        Uses real Jira API if configured, otherwise uses mock implementation.
        
        Args:
            project_key: Jira project key (e.g., "PROD")
            summary: Issue summary/title
            description: Issue description
            issue_type: Type of issue (Task, Story, Bug, etc.)
            priority: Priority level (High, Medium, Low)
            assignee: Assignee username (optional)
            labels: List of labels (optional)
            sprint_name: Sprint name to assign issue to (optional, e.g., "Sprint 1")
            
        Returns:
            Dictionary with created issue details
        """
        if self.use_real_jira and self.jira_client:
            return self._create_jira_issue_real(
                project_key, summary, description, issue_type, priority, assignee, labels, sprint_name
            )
        else:
            return self._create_jira_issue_mock(
                project_key, summary, description, issue_type, priority, assignee, labels
            )
    
    def verify_project_exists(self, project_key: str) -> bool:
        """
        Verify that a Jira project exists and is accessible.
        
        Args:
            project_key: Jira project key to verify
            
        Returns:
            True if project exists and is accessible, False otherwise
        """
        if not self.use_real_jira or not self.jira_client:
            logger.warning("Real Jira not available, cannot verify project")
            return False
        
        try:
            project = self.jira_client.project(project_key)
            logger.info(f"✅ Verified project '{project_key}' exists: {project.name}")
            return True
        except Exception as e:
            logger.error(f"❌ Project '{project_key}' does not exist or is not accessible: {e}")
            return False
    
    def _create_jira_issue_real(
        self,
        project_key: str,
        summary: str,
        description: str,
        issue_type: str,
        priority: str,
        assignee: Optional[str],
        labels: Optional[List[str]],
        sprint_name: Optional[str] = None
    ) -> Dict:
        """Create a real Jira issue using Jira API."""
        try:
            # Verify project exists before creating issue
            if not self.verify_project_exists(project_key):
                raise ValueError(f"Project '{project_key}' does not exist or is not accessible. Please create the project first or check permissions.")
            
            # Map priority names to Jira priority objects
            priority_map = {
                "High": "High",
                "Medium": "Medium",
                "Low": "Low"
            }
            
            # Build issue fields
            # Use simple text description format (more compatible)
            issue_dict = {
                'project': {'key': project_key},
                'summary': summary,
                'description': description,  # Simple text format
                'issuetype': {'name': issue_type},
            }
            
            # Add priority only if it's valid (some Jira instances may have different priority names)
            priority_value = priority_map.get(priority, "Medium")
            try:
                issue_dict['priority'] = {'name': priority_value}
            except Exception as e:
                logger.warning(f"Could not set priority: {e}")
            
            # Add labels if provided (ensure prodigypm-generated is always included)
            if labels:
                if 'prodigypm-generated' not in labels:
                    labels.append('prodigypm-generated')
                issue_dict['labels'] = labels
            else:
                issue_dict['labels'] = ['prodigypm-generated']
            
            # Don't set assignee for now (can cause issues if user doesn't exist)
            # if assignee:
            #     issue_dict['assignee'] = {'name': assignee}
            
            logger.info(f"Creating issue in project: {project_key}")
            logger.info(f"  Summary: {summary[:50]}...")
            logger.info(f"  Type: {issue_type}, Priority: {priority_value}")
            logger.info(f"  Labels: {issue_dict.get('labels', [])}")
            
            # Create issue
            try:
                new_issue = self.jira_client.create_issue(fields=issue_dict)
                logger.info(f"✅ Created real Jira issue: {new_issue.key} in project {new_issue.fields.project.key}")
            except Exception as create_error:
                logger.error(f"❌ Failed to create issue in Jira: {create_error}")
                logger.error(f"   Issue fields: {issue_dict}")
                import traceback
                logger.error(f"   Traceback:\n{traceback.format_exc()}")
                raise
            
            # Skip sprint assignment for now - issues will go to backlog by default
            # Sprint assignment can be added later if needed
            # if sprint_name:
            #     try:
            #         self._assign_issue_to_sprint(new_issue.key, sprint_name, project_key)
            #         logger.info(f"✅ Assigned issue {new_issue.key} to {sprint_name}")
            #     except Exception as e:
            #         logger.warning(f"Could not assign issue to sprint {sprint_name}: {e}")
            
            return {
                "id": new_issue.key,
                "summary": summary,
                "description": description,
                "status": new_issue.fields.status.name,
                "priority": priority,
                "type": issue_type,
                "assignee": assignee,
                "labels": labels or [],
                "created_by": "ProdigyPM",
                "url": new_issue.permalink(),
                "project_key": new_issue.fields.project.key,
                "sprint": sprint_name
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to create real Jira issue: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise
    
    def _create_jira_issue_mock(
        self,
        project_key: str,
        summary: str,
        description: str,
        issue_type: str,
        priority: str,
        assignee: Optional[str],
        labels: Optional[List[str]]
    ) -> Dict:
        """Create a mock Jira issue (stores in JSON file)."""
        try:
            # Load existing issues
            existing_issues = []
            if self.issues_file.exists():
                with open(self.issues_file, 'r') as f:
                    existing_issues = json.load(f)
            
            # Find next issue number
            max_num = 0
            for issue in existing_issues:
                if issue.get('id', '').startswith(project_key):
                    try:
                        num = int(issue['id'].split('-')[1])
                        max_num = max(max_num, num)
                    except (ValueError, IndexError):
                        pass
            
            # Create new issue
            issue_id = f"{project_key}-{max_num + 1}"
            new_issue = {
                "id": issue_id,
                "summary": summary,
                "description": description,
                "status": "To Do",
                "priority": priority,
                "type": issue_type,
                "assignee": assignee,
                "labels": labels or [],
                "created_by": "ProdigyPM",
                "created_at": "2024-01-01T00:00:00Z"  # Mock timestamp
            }
            
            # Add to existing issues
            existing_issues.append(new_issue)
            
            # Save back to file
            with open(self.issues_file, 'w') as f:
                json.dump(existing_issues, f, indent=2)
            
            logger.info(f"✅ Created Jira issue: {issue_id} - {summary}")
            return new_issue
            
        except Exception as e:
            logger.error(f"❌ Failed to create Jira issue: {e}")
            raise
    
    def create_jira_issues_batch(self, issues: List[Dict], project_key: Optional[str] = None, sprint_name: Optional[str] = None) -> List[Dict]:
        """
        Create multiple Jira issues in batch.
        
        Args:
            issues: List of issue dictionaries with keys: summary, description, priority, etc.
            project_key: Jira project key
            sprint_name: Sprint name to assign all issues to (optional, e.g., "Sprint 1")
            
        Returns:
            List of created issue dictionaries
        """
        if not issues:
            logger.error("❌ No issues provided to create_jira_issues_batch")
            return []
        
        # Use default project key if not provided
        if not project_key:
            project_key = self.default_project_key
        
        logger.info(f"🔄 Starting batch creation of {len(issues)} issues in project {project_key}")
        logger.info(f"Using real Jira: {self.use_real_jira}")
        logger.info(f"Project key from .env: {self.default_project_key}")
        
        if not self.use_real_jira:
            logger.warning("⚠️ Real Jira is not enabled - using mock implementation")
        
        created_issues = []
        for i, issue_data in enumerate(issues):
            try:
                logger.info(f"Creating issue {i+1}/{len(issues)}: {issue_data.get('summary', 'Unknown')[:50]}...")
                
                created_issue = self.create_jira_issue(
                    project_key=project_key,
                    summary=issue_data.get("summary", "Untitled"),
                    description=issue_data.get("description", ""),
                    issue_type=issue_data.get("type", "Task"),
                    priority=issue_data.get("priority", "Medium"),
                    assignee=issue_data.get("assignee"),
                    labels=issue_data.get("labels", []),
                    sprint_name=sprint_name or issue_data.get("sprint_name")
                )
                created_issues.append(created_issue)
                logger.info(f"✅ Successfully created issue {i+1}/{len(issues)}: {created_issue.get('id', 'Unknown')}")
            except Exception as e:
                error_msg = str(e)
                logger.error(f"❌ Failed to create issue {i+1}/{len(issues)}: {issue_data.get('summary', 'Unknown')}")
                logger.error(f"   Error: {error_msg}")
                logger.error(f"   Issue data: {issue_data}")
                import traceback
                logger.error(f"   Traceback:\n{traceback.format_exc()}")
                # Continue with other issues even if one fails
        
        logger.info(f"✅ Created {len(created_issues)}/{len(issues)} Jira issues")
        if len(created_issues) == 0:
            logger.error("❌ No issues were created! Check logs above for errors.")
        return created_issues