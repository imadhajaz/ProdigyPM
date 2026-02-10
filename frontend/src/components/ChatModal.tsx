"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiBase: string;
  onPRDGenerated: (prd: string, metadata: any) => void;
}

export default function ChatModal({ isOpen, onClose, apiBase, onPRDGenerated }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !sessionId) {
      startSession();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startSession = async () => {
    try {
      const r = await fetch(`${apiBase}/api/prd/consultant/chat/start`);
      const j = await r.json();
      setSessionId(j.session_id);
      setMessages([{ role: "assistant", content: j.message }]);
    } catch (e) {
      console.error("Failed to start chat session", e);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !sessionId) return;

    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const r = await fetch(`${apiBase}/api/prd/consultant/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: userMsg }),
      });
      const j = await r.json();

      setMessages(prev => [...prev, { role: "assistant", content: j.message }]);

      if (j.prd_ready) {
        if (window.confirm("PRD is ready to be generated. Proceed?")) {
          await generatePRD(sessionId);
        }
      }
    } catch (e) {
      console.error("Msg failed", e);
    } finally {
      setLoading(false);
    }
  };

  const generatePRD = async (sid: string) => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/prd/consultant/chat/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid, confirmation: "yes" }),
      });
      const j = await r.json();
      onPRDGenerated(j.prd, j.metadata);
      onClose();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-[#0f172a] rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="bg-slate-900/50 p-4 border-b border-white/5 flex justify-between items-center backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="text-white text-lg">🤖</span>
            </div>
            <div>
              <h3 className="font-bold text-white">AI PRD Consultant</h3>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Online
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-[#0f172a] to-[#020617] custom-scrollbar">
          {messages.map((msg, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${msg.role === "user"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none"
                    : "bg-slate-800/80 text-slate-200 border border-white/5 rounded-tl-none"
                  }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-800/50 p-4 rounded-2xl rounded-tl-none border border-white/5 flex gap-1 items-center">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-900/50 border-t border-white/5 backdrop-blur-md">
          <div className="relative flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your product idea..."
              disabled={loading}
              className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-500"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="absolute right-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-700 transition-colors shadow-lg shadow-blue-600/20"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
