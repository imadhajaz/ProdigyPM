"""
Decomposition Agent - Break down product interpretation into department-level subprojects
"""
from openai import OpenAI
import os
import json
import sys
from dotenv import load_dotenv
import logging
from typing import List, Dict

# Load .env file from backend directory
# Find the backend directory (parent of ai_engine)
current_dir = os.path.dirname(os.path.abspath(__file__))
ai_engine_dir = os.path.dirname(current_dir)
project_root = os.path.dirname(ai_engine_dir)
backend_dir = os.path.join(project_root, 'backend')
env_path = os.path.join(backend_dir, '.env')

# Load .env file
load_dotenv(dotenv_path=env_path)
logger = logging.getLogger(__name__)

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY not found in environment. Please check your .env file in the backend directory.")

client = OpenAI(api_key=api_key)


def decompose_into_subprojects(interpretation: Dict) -> List[Dict]:
    """
    Decompose product interpretation into department-level subprojects with effort estimates.
    
    Args:
        interpretation: Dictionary with product interpretation (from pdf_agent)
        
    Returns:
        List of subproject dictionaries:
        [
        {
                "subproject_id": str,
                    "department": str,
                    "title": str,
                    "description": str,
                "effort_estimate": str,  # "Small", "Medium", "Large", "X-Large"
                "effort_days": int,  # Estimated days
                "dependencies": [str, ...],  # IDs of dependent subprojects
                            "priority": str,  # "High", "Medium", "Low"
                "acceptance_criteria": [str, ...]
                        },
                        ...
        ]
    """
    product_name = interpretation.get("product_name", "Product")
    goals = interpretation.get("goals", [])
    departments = interpretation.get("departments", [])
    key_deliverables = interpretation.get("key_deliverables", [])
    dependencies = interpretation.get("dependencies", [])
    summary = interpretation.get("summary", "")
    
    prompt = f"""You are a product manager breaking down a product into actionable subprojects.

Product Information:
- Name: {product_name}
- Goals: {json.dumps(goals)}
- Departments: {json.dumps(departments)}
- Key Deliverables: {json.dumps(key_deliverables)}
- Dependencies: {json.dumps(dependencies)}
- Summary: {summary}

Create actionable subprojects for each department. Each subproject should be:
1. Specific and actionable (e.g., "Design mobile onboarding flow", "Implement GraphQL API", "Write unit tests for payment gateway")
2. Assigned to a department
3. Have an effort estimate (Small: 1-3 days, Medium: 4-7 days, Large: 8-14 days, X-Large: 15+ days)
4. Have clear acceptance criteria
5. Include dependencies if needed

Generate subprojects for ALL departments mentioned. Make sure each subproject is actionable and specific.

Return a JSON object with this structure:
{{
    "subprojects": [
        {{
            "subproject_id": "unique-id-1",
            "department": "Design",
            "title": "Subproject title",
            "description": "Detailed description of what needs to be done",
            "effort_estimate": "Small|Medium|Large|X-Large",
            "effort_days": 5,
            "dependencies": ["subproject-id-2"],
            "priority": "High|Medium|Low",
            "acceptance_criteria": ["Criterion 1", "Criterion 2"]
        }},
        ...
    ]
}}

Return ONLY valid JSON object, no additional text.
"""

    try:
        logger.info(f"Decomposing product '{product_name}' into subprojects for {len(departments)} departments...")
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert product manager. Break down products into actionable, department-level subprojects with clear effort estimates and acceptance criteria. Return only valid JSON arrays."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        result_text = response.choices[0].message.content
        logger.info("Received AI response for decomposition, parsing JSON...")
        
        # Parse JSON - expect an object with "subprojects" key
        result = json.loads(result_text)
        
        # Extract subprojects array from response
        if isinstance(result, dict):
            if "subprojects" in result:
                subprojects = result["subprojects"]
            elif "items" in result:
                subprojects = result["items"]
            else:
                # Try to find the first array value
                array_values = [v for v in result.values() if isinstance(v, list)]
                if array_values:
                    subprojects = array_values[0]
                else:
                    raise ValueError("No subprojects array found in AI response")
        elif isinstance(result, list):
            # If response is directly an array (shouldn't happen with json_object format, but handle it)
            subprojects = result
        else:
            raise ValueError("Unexpected response format from AI")
        
        if not isinstance(subprojects, list):
            raise ValueError("Subprojects must be an array")
        
        # Validate and enhance subprojects
        validated_subprojects = []
        for idx, subproject in enumerate(subprojects):
            # Ensure all required fields exist
            validated = {
                "subproject_id": subproject.get("subproject_id", f"subproject-{idx + 1}"),
                "department": subproject.get("department", "Unknown"),
                "title": subproject.get("title", "Untitled Subproject"),
                "description": subproject.get("description", ""),
                "effort_estimate": subproject.get("effort_estimate", "Medium"),
                "effort_days": subproject.get("effort_days", 5),
                "dependencies": subproject.get("dependencies", []),
                "priority": subproject.get("priority", "Medium"),
                "acceptance_criteria": subproject.get("acceptance_criteria", [])
            }
            validated_subprojects.append(validated)
        
        logger.info(f"Successfully decomposed into {len(validated_subprojects)} subprojects")
        
        # Log department breakdown
        dept_counts = {}
        for sp in validated_subprojects:
            dept = sp["department"]
            dept_counts[dept] = dept_counts.get(dept, 0) + 1
        logger.info(f"Department breakdown: {dept_counts}")
        
        return validated_subprojects
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {e}")
        logger.error(f"Response was: {result_text[:500]}")
        raise ValueError(f"AI returned invalid JSON: {str(e)}")
    except Exception as e:
        logger.error(f"Failed to decompose into subprojects: {e}")
        raise


def get_subproject_summary(subprojects: List[Dict]) -> Dict:
    """
    Generate a summary of subprojects by department.
    
    Args:
        subprojects: List of subproject dictionaries
        
    Returns:
        Dictionary with summary statistics
    """
    dept_summary = {}
    total_effort_days = 0
    
    for sp in subprojects:
        dept = sp["department"]
        if dept not in dept_summary:
            dept_summary[dept] = {
                "count": 0,
                "total_effort_days": 0,
                "subprojects": []
            }
        
        dept_summary[dept]["count"] += 1
        dept_summary[dept]["total_effort_days"] += sp["effort_days"]
        dept_summary[dept]["subprojects"].append(sp["subproject_id"])
        total_effort_days += sp["effort_days"]
    
    return {
        "total_subprojects": len(subprojects),
        "total_effort_days": total_effort_days,
        "department_summary": dept_summary
    }
