"""
PDF Agent - AI interpretation of PDF documents
Extracts structured product information from PDF text
"""
from openai import OpenAI
import os
import json
import sys
from dotenv import load_dotenv
import logging

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


def interpret_pdf(pdf_text: str) -> dict:
    """
    Interpret PDF text using AI and extract structured product information.
    
    Args:
        pdf_text: Extracted text from PDF document
        
    Returns:
        Dictionary with structured product information:
        {
            "product_name": str,
            "goals": [str, ...],
            "target_users": [str, ...],
            "key_deliverables": [str, ...],
            "departments": [str, ...],
            "dependencies": [str, ...],
            "summary": str
        }
    """
    # Limit to first 10k chars to avoid token limits
    truncated_text = pdf_text[:10000] if len(pdf_text) > 10000 else pdf_text
    
    prompt = f"""You are a product manager analyzing a product document. 
Extract and structure the following information from the document text below:

Document Text:
{truncated_text}

Please extract and return a JSON object with the following structure:
{{
    "product_name": "Name of the product or project",
    "goals": ["Goal 1", "Goal 2", ...],
    "target_users": ["User type 1", "User type 2", ...],
    "key_deliverables": ["Deliverable 1", "Deliverable 2", ...],
    "departments": ["Engineering", "Design", "QA", "Marketing", ...],
    "dependencies": ["Dependency 1", "Dependency 2", ...],
    "summary": "Brief summary of the product (2-3 sentences)"
}}

If information is not available in the document, use null or empty arrays.
Return ONLY valid JSON, no additional text or explanation.
"""

    try:
        logger.info("Sending PDF text to AI for interpretation...")
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a product manager expert. Extract structured information from product documents and return only valid JSON."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,  # Lower temperature for more consistent extraction
            response_format={"type": "json_object"}  # Force JSON response
        )
        
        # Parse JSON response
        result_text = response.choices[0].message.content
        logger.info("Received AI response, parsing JSON...")
        
        # Parse JSON
        result = json.loads(result_text)
        
        # Validate structure
        required_fields = ["product_name", "goals", "target_users", "key_deliverables", "departments", "dependencies", "summary"]
        for field in required_fields:
            if field not in result:
                result[field] = [] if field in ["goals", "target_users", "key_deliverables", "departments", "dependencies"] else ""
        
        logger.info(f"Successfully interpreted PDF: Product '{result.get('product_name', 'Unknown')}' with {len(result.get('departments', []))} departments")
        
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {e}")
        logger.error(f"Response was: {result_text[:500]}")
        raise ValueError(f"AI returned invalid JSON: {str(e)}")
    except Exception as e:
        logger.error(f"Failed to interpret PDF: {e}")
        raise


def interpret_pdf_summary(pdf_text: str, max_chars: int = 5000) -> dict:
    """
    Interpret PDF text with a summary approach (for very long documents).
    First summarizes, then extracts structure.
    
    Args:
        pdf_text: Extracted text from PDF document
        max_chars: Maximum characters to process (default: 5000)
        
    Returns:
        Dictionary with structured product information
    """
    # Truncate text if too long
    if len(pdf_text) > max_chars:
        logger.info(f"PDF text is {len(pdf_text)} chars, truncating to {max_chars} for processing")
        pdf_text = pdf_text[:max_chars] + "\n\n[Document truncated...]"
    
    return interpret_pdf(pdf_text)

