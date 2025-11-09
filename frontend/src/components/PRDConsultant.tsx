"use client";

import React, { useState, useEffect } from "react";

interface Question {
  id: string;
  category: string;
  question: string;
  required: boolean;
  type: string;
  help_text?: string;
}

interface PRDConsultantProps {
  apiBase?: string;
  onPRDGenerated?: (prd: string, metadata: any) => void;
}

export default function PRDConsultant({ apiBase = "http://localhost:8000", onPRDGenerated }: PRDConsultantProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [answersCollected, setAnswersCollected] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [generatedPRD, setGeneratedPRD] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Start session on mount
  useEffect(() => {
    startSession();
  }, []);

  const startSession = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBase}/api/prd/consultant/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initial_info: null }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setSessionId(data.session_id);
      setCurrentQuestion(data.question);
      setProgress(data.progress);
      setTotalQuestions(data.total_questions);
      setAnswersCollected(0);
      setIsComplete(false);
      setGeneratedPRD(null);
    } catch (err: any) {
      setError(`Failed to start session: ${err.message}`);
      console.error("Error starting PRD session:", err);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!sessionId || !currentQuestion) return;
    if (currentQuestion.required && !answer.trim()) {
      setError("This question is required. Please provide an answer.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBase}/api/prd/consultant/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: currentQuestion.id,
          answer: answer.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status === "complete") {
        setIsComplete(true);
        setCurrentQuestion(null);
      } else {
        setCurrentQuestion(data.question);
        setProgress(data.progress);
        setAnswersCollected(data.answers_collected);
      }
      setAnswer("");
    } catch (err: any) {
      setError(`Failed to submit answer: ${err.message}`);
      console.error("Error submitting answer:", err);
    } finally {
      setLoading(false);
    }
  };

  const generatePRD = async () => {
    if (!sessionId) return;

    try {
      setGenerating(true);
      setError(null);
      const response = await fetch(`${apiBase}/api/prd/consultant/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          author_name: "Product Manager",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setGeneratedPRD(data.prd);
      
      if (onPRDGenerated) {
        onPRDGenerated(data.prd, data.metadata);
      }
    } catch (err: any) {
      setError(`Failed to generate PRD: ${err.message}`);
      console.error("Error generating PRD:", err);
    } finally {
      setGenerating(false);
    }
  };

  if (generatedPRD) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6 space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h2 className="text-2xl font-bold text-green-900 mb-2">✅ PRD Generated Successfully!</h2>
          <p className="text-green-700">Your Product Requirements Document has been generated.</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Product Requirements Document</h3>
            <button
              onClick={() => {
                setGeneratedPRD(null);
                startSession();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create New PRD
            </button>
          </div>
          
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm bg-gray-50 p-4 rounded border border-gray-200 overflow-auto max-h-96">
              {generatedPRD}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="w-full max-w-3xl mx-auto p-6 space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-blue-900 mb-2">🎉 All Questions Answered!</h2>
          <p className="text-blue-700 mb-4">
            You've completed all {totalQuestions} questions. Ready to generate your PRD?
          </p>
          <button
            onClick={generatePRD}
            disabled={generating}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {generating ? "Generating PRD..." : "🚀 Generate PRD"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-md border border-purple-200 p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 AI PRD Consultant</h1>
        <p className="text-gray-700">
          I'll help you create a comprehensive Product Requirements Document by asking you structured questions.
        </p>
      </div>

      {/* Progress Bar */}
      {totalQuestions > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-medium text-gray-700">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Answered {answersCollected} of {totalQuestions} questions
          </p>
        </div>
      )}

      {/* Current Question */}
      {currentQuestion && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium uppercase">
                {currentQuestion.category.replace("_", " ")}
              </span>
              {currentQuestion.required && (
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                  Required
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{currentQuestion.question}</h2>
            {currentQuestion.help_text && (
              <p className="text-sm text-gray-600 italic mb-4">💡 {currentQuestion.help_text}</p>
            )}
          </div>

          {currentQuestion.type === "textarea" ? (
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full min-h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
              disabled={loading}
            />
          ) : (
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitAnswer();
                }
              }}
              placeholder="Type your answer here..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={submitAnswer}
              disabled={loading || (currentQuestion.required && !answer.trim())}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? "Submitting..." : "Next Question →"}
            </button>
            {!currentQuestion.required && (
              <button
                onClick={submitAnswer}
                disabled={loading}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Skip (Optional)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && !currentQuestion && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Starting PRD consultation...</p>
        </div>
      )}
    </div>
  );
}

