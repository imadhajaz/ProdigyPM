from openai import OpenAI
import os
import sys
from dotenv import load_dotenv

# Load .env file from backend directory
# Find the backend directory (parent of ai_engine)
current_dir = os.path.dirname(os.path.abspath(__file__))
ai_engine_dir = os.path.dirname(current_dir)
project_root = os.path.dirname(ai_engine_dir)
backend_dir = os.path.join(project_root, 'backend')
env_path = os.path.join(backend_dir, '.env')

# Load .env file
load_dotenv(dotenv_path=env_path)

# Get API key
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY not found in environment. Please check your .env file in the backend directory.")

client = OpenAI(api_key=api_key)

def generate_prd(context: str, feature_name: str):
    prompt = f"""You are a product manager. 
    Write a clear, structured PRD for the feature: '{feature_name}'. 
    Use this context:\n{context}\n
    Format:
    - Overview
    - Goals
    - Requirements
    - User Stories
    - Acceptance Criteria
    """
    response = client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[{"role": "user", "content": prompt}]
    )
    message = response.choices[0].message
    # Handle both dict and object access patterns
    if hasattr(message, 'content'):
        return message.content
    elif isinstance(message, dict):
        return message.get('content', '')
    else:
        return str(message)
