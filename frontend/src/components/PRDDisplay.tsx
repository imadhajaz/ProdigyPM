"use client";

import React from "react";

interface PRDData {
  feature?: string;
  prd?: string;
  status?: string;
  [key: string]: any;
}

interface PRDDisplayProps {
  prdData: PRDData;
}

export default function PRDDisplay({ prdData }: PRDDisplayProps) {
  const prdText = prdData.prd || "";
  
  // Parse PRD text into sections
  const parsePRD = (text: string) => {
    const sections: { [key: string]: string } = {};
    const lines = text.split("\n");
    
    let currentSection = "overview";
    let currentContent: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Detect section headers
      if (trimmedLine.match(/^#+\s*(Overview|Goals|Requirements|User Stories|Acceptance Criteria|Overview:)/i)) {
        if (currentContent.length > 0) {
          sections[currentSection] = currentContent.join("\n").trim();
        }
        currentSection = "overview";
        currentContent = [];
      } else if (trimmedLine.match(/^#+\s*(Goals|Goals:)/i)) {
        if (currentContent.length > 0) {
          sections[currentSection] = currentContent.join("\n").trim();
        }
        currentSection = "goals";
        currentContent = [];
      } else if (trimmedLine.match(/^#+\s*(Requirements|Requirements:)/i)) {
        if (currentContent.length > 0) {
          sections[currentSection] = currentContent.join("\n").trim();
        }
        currentSection = "requirements";
        currentContent = [];
      } else if (trimmedLine.match(/^#+\s*(User Stories|User Stories:)/i)) {
        if (currentContent.length > 0) {
          sections[currentSection] = currentContent.join("\n").trim();
        }
        currentSection = "userStories";
        currentContent = [];
      } else if (trimmedLine.match(/^#+\s*(Acceptance Criteria|Acceptance Criteria:)/i)) {
        if (currentContent.length > 0) {
          sections[currentSection] = currentContent.join("\n").trim();
        }
        currentSection = "acceptanceCriteria";
        currentContent = [];
      } else if (trimmedLine.length > 0) {
        currentContent.push(line);
      }
    }
    
    // Add last section
    if (currentContent.length > 0) {
      sections[currentSection] = currentContent.join("\n").trim();
    }
    
    return sections;
  };
  
  const formatContent = (content: string) => {
    // Split by lines and process
    const lines = content.split("\n");
    const formatted: JSX.Element[] = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        // List item
        formatted.push(
          <li key={index} className="ml-4 mb-2 text-gray-700">
            {trimmed.substring(2)}
          </li>
        );
      } else if (trimmed.match(/^\d+\.\s/)) {
        // Numbered list
        formatted.push(
          <li key={index} className="ml-4 mb-2 text-gray-700 list-decimal">
            {trimmed.replace(/^\d+\.\s/, "")}
          </li>
        );
      } else if (trimmed.length > 0) {
        // Regular paragraph
        formatted.push(
          <p key={index} className="mb-3 text-gray-700 leading-relaxed">
            {trimmed}
          </p>
        );
      }
    });
    
    return formatted;
  };
  
  const sections = parsePRD(prdText);
  
  // If no sections found, display raw text
  if (Object.keys(sections).length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Requirements Document</h2>
        <div className="prose max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
            {prdText}
          </pre>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {prdData.feature || "Product Requirements Document"}
        </h1>
        {prdData.status && (
          <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            {prdData.status}
          </span>
        )}
      </div>
      
      {/* Overview Section */}
      {sections.overview && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">📋</span>
            Overview
          </h2>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
            <div className="prose max-w-none">
              {formatContent(sections.overview)}
            </div>
          </div>
        </section>
      )}
      
      {/* Goals Section */}
      {sections.goals && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">🎯</span>
            Goals
          </h2>
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r">
            <ul className="list-none space-y-2">
              {formatContent(sections.goals)}
            </ul>
          </div>
        </section>
      )}
      
      {/* Requirements Section */}
      {sections.requirements && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">📝</span>
            Requirements
          </h2>
          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r">
            <div className="prose max-w-none">
              {formatContent(sections.requirements)}
            </div>
          </div>
        </section>
      )}
      
      {/* User Stories Section */}
      {sections.userStories && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">👤</span>
            User Stories
          </h2>
          <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r">
            <div className="prose max-w-none">
              {formatContent(sections.userStories)}
            </div>
          </div>
        </section>
      )}
      
      {/* Acceptance Criteria Section */}
      {sections.acceptanceCriteria && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">✅</span>
            Acceptance Criteria
          </h2>
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r">
            <div className="prose max-w-none">
              {formatContent(sections.acceptanceCriteria)}
            </div>
          </div>
        </section>
      )}
      
      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
        <p>Generated by ProdigyPM AI</p>
      </div>
    </div>
  );
}

