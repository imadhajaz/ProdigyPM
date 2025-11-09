"""
PRD Consultant Chat Agent - Conversational AI consultant for generating PRDs.

This agent engages in natural conversation, deduces information from user responses,
and acts as a confident consultant before finalizing the PRD.
"""
import os
import json
import sys
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import logging
from dotenv import load_dotenv

from openai import OpenAI

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

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY not found in environment. Please check your .env file in the backend directory.")

client = OpenAI(api_key=api_key)

# PRD information structure we need to collect
PRD_INFO_STRUCTURE = {
    "product_name": None,
    "purpose": None,
    "problem_statement": None,
    "business_goals": None,
    "user_goals": None,
    "non_goals": None,
    "background": None,
    "target_users": None,
    "use_cases": None,
    "functional_requirements": None,
    "performance_requirements": None,
    "security_requirements": None,
    "tech_stack": None,
    "integrations": None,
    "deployment": None,
    "success_metrics": None,
    "timeline": None,
    "risks": None,
}

REQUIRED_FIELDS = [
    "product_name",
    "purpose",
    "problem_statement",
    "business_goals",
    "user_goals",
    "target_users",
    "use_cases",
    "functional_requirements",
    "success_metrics",
]


class PRDConsultantChatAgent:
    """Conversational AI consultant for PRD generation."""
    
    def __init__(self):
        self.session_id = None
        self.conversation_history: List[Dict[str, str]] = []
        self.extracted_info: Dict = PRD_INFO_STRUCTURE.copy()
        self.confirmation_needed: Dict = {}
        self.consultant_persona = """You are a confident, experienced Product Management consultant. 
You help product managers and entrepreneurs create comprehensive Product Requirements Documents (PRDs).

Your style:
- Confident and knowledgeable
- Ask thoughtful, engaging questions
- Deduce information from what users say
- Reaffirm and confirm before finalizing
- Natural, conversational tone
- Proactive in extracting insights
- Helpful and encouraging

You engage in conversation to understand the product, then generate a comprehensive PRD."""
        
    def start_session(self, initial_message: Optional[str] = None) -> Dict:
        """
        Start a new PRD consultation session.
        
        Args:
            initial_message: Optional initial message from user
            
        Returns:
            Dictionary with consultant's opening message and session info
        """
        self.session_id = f"prd_chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.conversation_history = []
        self.extracted_info = PRD_INFO_STRUCTURE.copy()
        self.confirmation_needed = {}
        
        # Opening message from consultant
        opening_message = self._generate_opening_message(initial_message)
        
        # Add to conversation history
        self.conversation_history.append({
            "role": "assistant",
            "content": opening_message
        })
        
        if initial_message:
            self.conversation_history.append({
                "role": "user",
                "content": initial_message
            })
            # Extract info from initial message
            self._extract_info_from_message(initial_message)
            # Get consultant's response
            response = self._get_consultant_response()
            self.conversation_history.append({
                "role": "assistant",
                "content": response
            })
            opening_message = response
        
        return {
            "session_id": self.session_id,
            "message": opening_message,
            "conversation": self.conversation_history,
            "info_collected": self._get_info_summary()
        }
    
    def send_message(self, user_message: str, session_id: str) -> Dict:
        """
        Send a user message and get consultant's response.
        
        Args:
            user_message: User's message
            session_id: Session ID
            
        Returns:
            Dictionary with consultant's response and status
        """
        if session_id != self.session_id:
            raise ValueError("Invalid session ID")
        
        # Add user message to history
        self.conversation_history.append({
            "role": "user",
            "content": user_message
        })
        
        # Extract information from user's message
        extracted = self._extract_info_from_message(user_message)
        
        # Get consultant's response
        consultant_response = self._get_consultant_response()
        
        # Add consultant response to history
        self.conversation_history.append({
            "role": "assistant",
            "content": consultant_response
        })
        
        # Check if we have enough information
        missing_required = self._get_missing_required_fields()
        info_completeness = self._calculate_info_completeness()
        
        # Check if ready for confirmation
        # Need all required fields and at least 80% completeness, with meaningful conversation
        ready_for_confirmation = (
            len(missing_required) == 0 and 
            info_completeness >= 0.75 and
            len(self.conversation_history) >= 4  # At least some back-and-forth conversation
        )
        
        return {
            "session_id": self.session_id,
            "message": consultant_response,
            "conversation": self.conversation_history,
            "info_collected": self._get_info_summary(),
            "extracted_info": extracted,
            "missing_required": missing_required,
            "info_completeness": info_completeness,
            "ready_for_confirmation": ready_for_confirmation
        }
    
    def request_confirmation(self, session_id: str) -> Dict:
        """
        Request confirmation of collected information before generating PRD.
        
        Args:
            session_id: Session ID
            
        Returns:
            Dictionary with confirmation summary
        """
        if session_id != self.session_id:
            raise ValueError("Invalid session ID")
        
        # Generate confirmation summary
        confirmation_summary = self._generate_confirmation_summary()
        
        # Add confirmation request to conversation
        confirmation_message = f"""Perfect! I've gathered comprehensive information about your product. Let me summarize what I understand:

{confirmation_summary}

Does this accurately capture your vision? Feel free to correct anything or add any additional details before I generate your final PRD."""
        
        self.conversation_history.append({
            "role": "assistant",
            "content": confirmation_message
        })
        
        return {
            "session_id": self.session_id,
            "message": confirmation_message,
            "conversation": self.conversation_history,
            "summary": confirmation_summary,
            "extracted_info": self.extracted_info
        }
    
    def confirm_and_generate(self, session_id: str, user_confirmation: str, author_name: str = "Product Manager") -> Dict:
        """
        Confirm information and generate PRD.
        
        Args:
            session_id: Session ID
            user_confirmation: User's confirmation or corrections
            author_name: Name of the PRD author
            
        Returns:
            Complete PRD document
        """
        if session_id != self.session_id:
            raise ValueError("Invalid session ID")
        
        # Process any corrections from user
        if user_confirmation.lower() not in ["yes", "y", "correct", "looks good", "proceed"]:
            # User might have corrections
            self._extract_info_from_message(user_confirmation)
            # Get updated confirmation
            updated_summary = self._generate_confirmation_summary()
            self.conversation_history.append({
                "role": "user",
                "content": user_confirmation
            })
            self.conversation_history.append({
                "role": "assistant",
                "content": f"Got it! I've updated my understanding:\n\n{updated_summary}\n\nReady to generate the PRD?"
            })
            # Return updated summary for another confirmation round
            return {
                "session_id": self.session_id,
                "status": "updated",
                "message": f"I've updated my understanding:\n\n{updated_summary}\n\nReady to generate the PRD?",
                "conversation": self.conversation_history,
                "summary": updated_summary
            }
        
        # Generate PRD
        self.conversation_history.append({
            "role": "user",
            "content": user_confirmation
        })
        
        generating_message = "Perfect! Generating your comprehensive PRD now. This will take a moment..."
        self.conversation_history.append({
            "role": "assistant",
            "content": generating_message
        })
        
        # Generate PRD
        prd_content = self._generate_prd_with_ai(author_name)
        
        return {
            "session_id": self.session_id,
            "prd": prd_content,
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "author": author_name,
                "product_name": self.extracted_info.get("product_name", "Unknown Product"),
                "version": "1.0.0"
            },
            "conversation": self.conversation_history
        }
    
    def _generate_opening_message(self, initial_message: Optional[str] = None) -> str:
        """Generate consultant's opening message."""
        if initial_message:
            # User already provided initial info, respond to it
            return self._get_consultant_response()
        
        return """Hello! I'm your AI Product Management consultant. I'm here to help you create a comprehensive Product Requirements Document (PRD) for your product.

Think of me as your experienced PM consultant - I'll ask you thoughtful questions, help clarify your vision, and make sure we capture everything needed for a solid PRD.

To get started, tell me about your product idea. What are you building, and what problem does it solve?"""
    
    def _extract_info_from_message(self, message: str) -> Dict:
        """Extract structured information from user's message using AI."""
        try:
            # Prepare context
            current_info = {k: v for k, v in self.extracted_info.items() if v is not None}
            conversation_context = "\n".join([
                f"{msg['role']}: {msg['content']}" 
                for msg in self.conversation_history[-6:]  # Last 6 messages for context
            ])
            
            extraction_prompt = f"""You are an information extraction assistant. Extract product information from the user's message and update the structured data.

Current extracted information:
{json.dumps(current_info, indent=2)}

Recent conversation:
{conversation_context}

User's latest message:
{message}

Extract and update the following fields if mentioned:
- product_name: Name of the product
- purpose: Why the product exists
- problem_statement: Problem being solved
- business_goals: Business objectives
- user_goals: What users want to achieve
- non_goals: What's out of scope
- background: Context or background
- target_users: Who the users are
- use_cases: Primary use cases
- functional_requirements: Key features/capabilities
- performance_requirements: Performance needs
- security_requirements: Security needs
- tech_stack: Technology preferences
- integrations: External integrations
- deployment: Deployment considerations
- success_metrics: How to measure success
- timeline: Expected timeline
- risks: Risks and challenges

Return ONLY a JSON object with updated fields. Only include fields that are mentioned or can be inferred. Use null for fields not mentioned.

Example: {{"product_name": "GrabNGo", "purpose": "Food delivery app"}}"""

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an information extraction assistant. Return only valid JSON."},
                    {"role": "user", "content": extraction_prompt}
                ],
                temperature=0.3,
                max_tokens=1000
            )
            
            extracted_json = response.choices[0].message.content.strip()
            # Remove markdown code blocks if present
            if extracted_json.startswith("```"):
                extracted_json = extracted_json.split("```")[1]
                if extracted_json.startswith("json"):
                    extracted_json = extracted_json[4:]
            extracted_json = extracted_json.strip()
            
            extracted_data = json.loads(extracted_json)
            
            # Update extracted info
            updated_fields = []
            for key, value in extracted_data.items():
                if key in self.extracted_info and value is not None:
                    if self.extracted_info[key] is None or value != self.extracted_info[key]:
                        self.extracted_info[key] = value
                        updated_fields.append(key)
            
            return {
                "updated_fields": updated_fields,
                "extracted_data": extracted_data
            }
            
        except Exception as e:
            logger.error(f"Error extracting info: {e}")
            return {"updated_fields": [], "extracted_data": {}}
    
    def _get_consultant_response(self) -> str:
        """Get consultant's conversational response using AI."""
        try:
            # Build system prompt
            missing_required = self._get_missing_required_fields()
            collected_info = {k: v for k, v in self.extracted_info.items() if v is not None}
            
            system_prompt = f"""{self.consultant_persona}

Your goal is to have a natural, engaging conversation to gather information for a PRD. 

Current information you've collected:
{json.dumps(collected_info, indent=2) if collected_info else "None yet"}

Missing required information:
{missing_required if missing_required else "All required information collected!"}

Guidelines:
- Be conversational, confident, and engaging - act like an experienced PM consultant
- Ask thoughtful follow-up questions naturally
- Deduce information from what the user says - don't ask for info they've already mentioned
- Don't repeat questions about information you already have
- Focus on missing required fields, but do it naturally in conversation
- Be proactive - infer things from context
- Keep responses concise (2-3 sentences max, conversational tone)
- If you have most info (80%+), naturally transition to asking if they want to add anything else before confirming
- Show confidence in your understanding"""

            # Get conversation context
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
            # Add conversation history (last 10 messages for context)
            for msg in self.conversation_history[-10:]:
                messages.append(msg)
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.7,
                max_tokens=300
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error getting consultant response: {e}")
            return "I understand. Can you tell me more about your product?"
    
    def _get_missing_required_fields(self) -> List[str]:
        """Get list of missing required fields."""
        return [field for field in REQUIRED_FIELDS if not self.extracted_info.get(field)]
    
    def _calculate_info_completeness(self) -> float:
        """Calculate how complete the information is (0-1)."""
        total_fields = len(PRD_INFO_STRUCTURE)
        filled_fields = sum(1 for v in self.extracted_info.values() if v is not None)
        return filled_fields / total_fields if total_fields > 0 else 0.0
    
    def _get_info_summary(self) -> Dict:
        """Get summary of collected information."""
        return {
            "collected": {k: v for k, v in self.extracted_info.items() if v is not None},
            "missing_required": self._get_missing_required_fields(),
            "completeness": round(self._calculate_info_completeness() * 100, 1)
        }
    
    def _generate_confirmation_summary(self) -> str:
        """Generate a summary of collected information for confirmation."""
        summary_parts = []
        
        if self.extracted_info.get("product_name"):
            summary_parts.append(f"**Product Name:** {self.extracted_info['product_name']}")
        
        if self.extracted_info.get("purpose"):
            summary_parts.append(f"**Purpose:** {self.extracted_info['purpose']}")
        
        if self.extracted_info.get("problem_statement"):
            summary_parts.append(f"**Problem:** {self.extracted_info['problem_statement']}")
        
        if self.extracted_info.get("target_users"):
            summary_parts.append(f"**Target Users:** {self.extracted_info['target_users']}")
        
        if self.extracted_info.get("business_goals"):
            summary_parts.append(f"**Business Goals:** {self.extracted_info['business_goals']}")
        
        if self.extracted_info.get("functional_requirements"):
            summary_parts.append(f"**Key Features:** {self.extracted_info['functional_requirements']}")
        
        if self.extracted_info.get("success_metrics"):
            summary_parts.append(f"**Success Metrics:** {self.extracted_info['success_metrics']}")
        
        return "\n\n".join(summary_parts) if summary_parts else "No information collected yet."
    
    def _generate_prd_with_ai(self, author_name: str) -> str:
        """Generate PRD document using AI based on collected information."""
        
        # Prepare context
        context = self._prepare_context_for_ai()
        
        system_prompt = """You are an expert Product Manager consultant. Your task is to generate a comprehensive Product Requirements Document (PRD) following industry-standard format.

Generate a PRD that includes ALL of the following sections in this exact order:

1. **Document Details** - Product name, version, date, author, reviewers
2. **Overview** - Purpose, problem statement, goals, non-goals
3. **Background & Context** - What led to this idea, market research, dependencies
4. **User Personas & Use Cases** - Target users, primary use cases, user stories
5. **Requirements** - Functional requirements (FR-01, FR-02, etc.) and Non-functional requirements (performance, security, usability, reliability, compliance)
6. **User Experience (UX/UI)** - Wireframes references, user flows, interaction rules
7. **Technical Specifications** - Architecture, APIs, tech stack, integrations, deployment
8. **Metrics & Success Criteria** - KPIs and measurable success indicators
9. **Risks & Mitigations** - Risk table with impact, likelihood, and mitigation strategies
10. **Timeline / Milestones** - Phase, deliverable, owner, target date table
11. **Approvals** - Approval table with roles, names, signatures, dates

Format the PRD professionally with clear sections, subsections, and proper markdown formatting.
Use tables where appropriate (especially for risks, timeline, and approvals).
Make it comprehensive and production-ready."""

        user_prompt = f"""Based on the following product information, generate a complete PRD document:

{context}

Author: {author_name}
Date: {datetime.now().strftime('%Y-%m-%d')}

Generate a comprehensive PRD following the standard format. Be thorough and professional."""

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=4000
            )
            
            prd_content = response.choices[0].message.content
            
            logger.info(f"Generated PRD successfully (length: {len(prd_content)} chars)")
            
            return prd_content
            
        except Exception as e:
            logger.error(f"Error generating PRD: {e}")
            raise Exception(f"Failed to generate PRD: {str(e)}")
    
    def _prepare_context_for_ai(self) -> str:
        """Prepare context string from collected information for AI generation."""
        context_parts = []
        
        context_parts.append("# Product Information\n")
        if self.extracted_info.get("product_name"):
            context_parts.append(f"**Product Name:** {self.extracted_info['product_name']}\n")
        if self.extracted_info.get("purpose"):
            context_parts.append(f"**Purpose:** {self.extracted_info['purpose']}\n")
        if self.extracted_info.get("problem_statement"):
            context_parts.append(f"**Problem Statement:** {self.extracted_info['problem_statement']}\n")
        
        context_parts.append("\n# Goals\n")
        if self.extracted_info.get("business_goals"):
            context_parts.append(f"**Business Goals:** {self.extracted_info['business_goals']}\n")
        if self.extracted_info.get("user_goals"):
            context_parts.append(f"**User Goals:** {self.extracted_info['user_goals']}\n")
        if self.extracted_info.get("non_goals"):
            context_parts.append(f"**Non-Goals:** {self.extracted_info['non_goals']}\n")
        
        context_parts.append("\n# Context\n")
        if self.extracted_info.get("background"):
            context_parts.append(f"**Background:** {self.extracted_info['background']}\n")
        if self.extracted_info.get("target_users"):
            context_parts.append(f"**Target Users:** {self.extracted_info['target_users']}\n")
        if self.extracted_info.get("use_cases"):
            context_parts.append(f"**Use Cases:** {self.extracted_info['use_cases']}\n")
        
        context_parts.append("\n# Requirements\n")
        if self.extracted_info.get("functional_requirements"):
            context_parts.append(f"**Functional Requirements:** {self.extracted_info['functional_requirements']}\n")
        if self.extracted_info.get("performance_requirements"):
            context_parts.append(f"**Performance Requirements:** {self.extracted_info['performance_requirements']}\n")
        if self.extracted_info.get("security_requirements"):
            context_parts.append(f"**Security Requirements:** {self.extracted_info['security_requirements']}\n")
        
        context_parts.append("\n# Technical\n")
        if self.extracted_info.get("tech_stack"):
            context_parts.append(f"**Tech Stack:** {self.extracted_info['tech_stack']}\n")
        if self.extracted_info.get("integrations"):
            context_parts.append(f"**Integrations:** {self.extracted_info['integrations']}\n")
        if self.extracted_info.get("deployment"):
            context_parts.append(f"**Deployment:** {self.extracted_info['deployment']}\n")
        
        context_parts.append("\n# Success Criteria\n")
        if self.extracted_info.get("success_metrics"):
            context_parts.append(f"**Success Metrics:** {self.extracted_info['success_metrics']}\n")
        if self.extracted_info.get("timeline"):
            context_parts.append(f"**Timeline:** {self.extracted_info['timeline']}\n")
        if self.extracted_info.get("risks"):
            context_parts.append(f"**Risks & Mitigations:** {self.extracted_info['risks']}\n")
        
        return "\n".join(context_parts)

