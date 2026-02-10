"use client";

import React from "react";
import { motion } from "framer-motion";

interface FloatingChatButtonProps {
  onClick: () => void;
  unreadCount?: number;
}

export default function FloatingChatButton({ onClick, unreadCount = 0 }: FloatingChatButtonProps) {
  return (
    <motion.button
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      whileHover={{ scale: 1.1, rotate: 10 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="fixed bottom-8 right-8 z-40 w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_50px_rgba(6,182,212,0.6)] flex items-center justify-center border border-white/20 backdrop-blur-md group"
      aria-label="Open AI PRD Consultant"
    >
      <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse" />

      <svg
        className="w-8 h-8 relative z-10 drop-shadow-md"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
        />
      </svg>

      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-[#030712] animate-bounce">
          {unreadCount}
        </span>
      )}

      <span className="absolute right-full mr-4 bg-white/10 backdrop-blur-md text-white text-sm px-3 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        Chat with AI Consultant
      </span>
    </motion.button>
  );
}
