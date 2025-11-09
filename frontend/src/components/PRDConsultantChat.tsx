"use client";

import React, { useState, useEffect, useRef } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

interface PRDConsultantChatProps {
  apiBase?: string;
  onPRDGenerated?: (prd: string, metadata: any) => void;
}

export default function PRDConsultantChat({ apiBase = "http://localhost:8000", onPRDGenerated }: PRDConsultantChatProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readyForConfirmation, setReadyForConfirmation] = useState(false);
  const [infoCompleteness, setInfoCompleteness] = useState(0);
  const [generatedPRD, setGeneratedPRD] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start session on mount
  useEffect(() => {
    startChat();
  }, []);

  const startChat = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBase}/api/prd/consultant/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initial_message: null }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setSessionId(data.session_id);
      setMessages(data.conversation || [{ role: "assistant", content: data.message }]);
      setReadyForConfirmation(data.ready_for_confirmation || false);
      setInfoCompleteness(data.info_completeness || 0);
    } catch (err: any) {
      setError(`Failed to start chat: ${err.message}`);
      console.error("Error starting PRD chat:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!sessionId || !inputMessage.trim() || loading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setError(null);

    // Add user message to UI immediately
    const newUserMessage: Message = { role: "user", content: userMessage, timestamp: new Date() };
    setMessages((prev) => [...prev, newUserMessage]);

    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/api/prd/consultant/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Add assistant response
      const assistantMessage: Message = { 
        role: "assistant", 
        content: data.message, 
        timestamp: new Date() 
      };
      setMessages((prev) => [...prev, assistantMessage]);
      
      setReadyForConfirmation(data.ready_for_confirmation || false);
      setInfoCompleteness(data.info_completeness || 0);

      // If ready for confirmation, auto-request it after a short delay
      if (data.ready_for_confirmation && !readyForConfirmation) {
        // Wait a bit for the user to see the consultant's message, then request confirmation
        setTimeout(() => {
          requestConfirmation();
        }, 2000);
      }
    } catch (err: any) {
      setError(`Failed to send message: ${err.message}`);
      console.error("Error sending message:", err);
      // Remove the user message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const requestConfirmation = async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/api/prd/consultant/chat/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const confirmationMessage: Message = { 
        role: "assistant", 
        content: data.message, 
        timestamp: new Date() 
      };
      setMessages((prev) => [...prev, confirmationMessage]);
      setReadyForConfirmation(true);
    } catch (err: any) {
      setError(`Failed to request confirmation: ${err.message}`);
      console.error("Error requesting confirmation:", err);
    } finally {
      setLoading(false);
    }
  };

  const confirmAndGenerate = async (confirmation: string = "Yes, that looks correct!") => {
    if (!sessionId) return;

    try {
      setGenerating(true);
      setError(null);
      
      // Add user confirmation to messages
      const userConfirmation: Message = { 
        role: "user", 
        content: confirmation, 
        timestamp: new Date() 
      };
      setMessages((prev) => [...prev, userConfirmation]);

      const response = await fetch(`${apiBase}/api/prd/consultant/chat/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          confirmation: confirmation,
          author_name: "Product Manager",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status === "updated") {
        // User made corrections, show updated summary
        const updatedMessage: Message = { 
          role: "assistant", 
          content: data.message, 
          timestamp: new Date() 
        };
        setMessages((prev) => [...prev, updatedMessage]);
        setGenerating(false);
        return;
      }

      // PRD generated successfully
      setGeneratedPRD(data.prd);
      
      // Add generation message
      const generatedMessage: Message = { 
        role: "assistant", 
        content: "✅ Your PRD has been generated! Scroll down to view it.", 
        timestamp: new Date() 
      };
      setMessages((prev) => [...prev, generatedMessage]);
      
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (generatedPRD) {
    return (
      <div className="w-full h-full flex flex-col space-y-4">
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
          <h2 className="text-xl font-bold text-green-400 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            PRD Generated Successfully!
          </h2>
          <p className="text-green-300 text-sm">Your Product Requirements Document has been generated from our conversation.</p>
        </div>
        
        {/* Generated PRD */}
        <div className="flex-1 bg-slate-800/50 rounded-lg border border-slate-700 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-100">Product Requirements Document</h3>
            <button
              onClick={() => {
                setGeneratedPRD(null);
                setMessages([]);
                startChat();
              }}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium transition-all duration-200"
            >
              Start New PRD
            </button>
          </div>
          
          <div className="prose prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-mono text-sm bg-slate-900/50 p-4 rounded-lg border border-slate-700 text-slate-300 overflow-auto">
              {generatedPRD}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg border border-purple-500/30 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100 mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI PRD Consultant
            </h1>
            <p className="text-sm text-slate-400">
              Chat with me to create your PRD. I'll understand your vision and generate a comprehensive document.
            </p>
          </div>
          {infoCompleteness > 0 && (
            <div className="text-right">
              <div className="text-xs text-slate-400 mb-1">Information Collected</div>
              <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                {Math.round(infoCompleteness)}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 bg-slate-800/30 rounded-lg border border-slate-700 p-4 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && !loading && (
          <div className="text-center text-slate-400 py-8">
            Starting conversation...
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg"
                  : "bg-slate-700/50 text-slate-100 border border-slate-600"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
              {msg.timestamp && (
                <p className={`text-xs mt-1 ${msg.role === "user" ? "text-purple-100" : "text-slate-400"}`}>
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
                <span className="text-sm text-slate-300">Consultant is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Confirmation Prompt */}
      {readyForConfirmation && !generating && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-300 mb-3">
            Ready to generate your PRD? Review the summary above and confirm.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => confirmAndGenerate("Yes, that looks correct!")}
              disabled={generating}
              className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 font-medium transition-all duration-200"
            >
              ✅ Yes, Generate PRD
            </button>
            <button
              onClick={() => setReadyForConfirmation(false)}
              className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 font-medium transition-all duration-200"
            >
              Continue Chatting
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-2 mb-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
            className="flex-1 p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-slate-100 placeholder-slate-400"
            rows={2}
            disabled={loading || generating}
          />
          <button
            onClick={sendMessage}
            disabled={loading || generating || !inputMessage.trim()}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200 shadow-lg shadow-purple-500/50 disabled:shadow-none"
          >
            {generating ? "Generating..." : "Send"}
          </button>
        </div>
        
        {generating && (
          <div className="mt-2 text-sm text-slate-400 flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
            Generating your PRD...
          </div>
        )}
      </div>
    </div>
  );
}

