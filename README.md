# ProdigyPM - AI Product Management Console

ProdigyPM is an AI-driven Product Management Console that helps product managers decompose high-level product documents into actionable subprojects and generate PRDs through conversational AI.

## Features

- **PDF Upload & Processing**: Upload product documents (PDFs) and automatically extract structured information
- **AI-Powered Decomposition**: Break down product requirements into department-level subprojects with effort estimates
- **PRD Generation**: Create comprehensive Product Requirements Documents through AI consultation
- **Jira Integration**: Automatically sync subprojects to Jira as issues
- **Real-time Dashboard**: Track project progress with live updates from Jira
- **Project Management**: Manage single-project workflows with session tracking

## Tech Stack

### Backend
- **FastAPI**: Python web framework
- **OpenAI API**: AI-powered text processing and generation
- **Jira API**: Integration for issue tracking
- **PDF Processing**: pdfplumber for text extraction

### Frontend
- **Next.js**: React framework
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Styling with dark mode theme

## Project Structure

```
ProdigyPM/
├── backend/           # FastAPI backend
│   ├── main.py       # Main application entry point
│   ├── services/     # Business logic services
│   ├── uploads/      # PDF upload storage
│   └── mock_data/    # Mock data for development
├── frontend/         # Next.js frontend
│   └── src/
│       ├── app/      # Next.js app router
│       └── components/ # React components
├── ai_engine/        # AI agent modules
│   └── agents/       # AI agents for PRD, PDF, decomposition
└── .env             # Environment variables (not in repo)
```

## Setup Instructions

### Prerequisites
- Python 3.13+
- Node.js 18+
- OpenAI API key
- Jira account (optional, for integration)

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python3 -m venv myvenv
source myvenv/bin/activate  # On Windows: myvenv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file in `backend/` directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
USE_REAL_JIRA=true
JIRA_URL=your_jira_url
JIRA_EMAIL=your_email
JIRA_API_TOKEN=your_jira_api_token
JIRA_PROJECT_KEY=your_project_key
```

5. Start the backend server:
```bash
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### PDF Processing
1. Navigate to the Home page
2. Upload a PDF document
3. Click "Generate Projects" to decompose the PDF into department-level subprojects
4. Review the generated subprojects with effort estimates

### PRD Generation
1. Click the chat button in the bottom right
2. Engage with the AI consultant to create a PRD from scratch
3. Answer questions about your product
4. Review and finalize the generated PRD

### Jira Sync
1. After generating subprojects, click "Sync to Jira"
2. Issues will be created in your Jira project
3. View progress on the Dashboard

### Dashboard
1. Navigate to the Dashboard page
2. View real-time project progress
3. Track issue status, priorities, and assignments
4. Monitor completion rates

## Environment Variables

### Backend (.env)
- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `USE_REAL_JIRA`: Set to `true` for real Jira integration (default: `false`)
- `JIRA_URL`: Your Jira instance URL
- `JIRA_EMAIL`: Your Jira email
- `JIRA_API_TOKEN`: Your Jira API token
- `JIRA_PROJECT_KEY`: Default Jira project key

## Development

### Running Tests
```bash
# Backend tests (when available)
cd backend
pytest

# Frontend tests (when available)
cd frontend
npm test
```

### Code Structure
- Backend services are modular and can be easily extended
- AI agents are separated by functionality
- Frontend components are reusable and follow React best practices

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is proprietary and confidential.

## Support

For issues or questions, please contact the development team.

