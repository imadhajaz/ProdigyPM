"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PRDDisplay from "../components/PRDDisplay";
import SubprojectDisplay from "../components/SubprojectDisplay";
import Dashboard from "../components/Dashboard";
import ChatModal from "../components/ChatModal";
import FloatingChatButton from "../components/FloatingChatButton";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function Home() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [prdData, setPrdData] = useState<any>(null);
  const [subprojectData, setSubprojectData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"json" | "formatted">("formatted");
  const [activeTab, setActiveTab] = useState<"pdf" | "dashboard">("pdf");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setError("Please select a valid PDF file");
        return;
      }
      setSelectedFile(file);
      setError(null);
      setUploadStatus(null);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const uploadPDF = async () => {
    if (!selectedFile) {
      setError("Please select a file first");
      return;
    }

    setLoading(true);
    setError(null);
    setUploadStatus("Uploading...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const r = await fetch(`${API_BASE}/api/upload_pdf`, {
        method: "POST",
        body: formData,
      });

      if (!r.ok) {
        throw new Error(`Upload failed: ${r.statusText}`);
      }

      const j = await r.json();
      setUploadStatus("Upload successful!");
      setUploadedFileId(j.file_id);
      setSelectedFile(null); // Clear selection after upload
    } catch (e: any) {
      setError(e.message);
      setUploadStatus("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const generateProjects = async () => {
    if (!uploadedFileId) return;

    setLoading(true);
    setError(null);

    try {
      const r = await fetch(`${API_BASE}/api/pdf/${uploadedFileId}/decompose`, {
        method: "POST",
      });

      if (!r.ok) throw new Error("Decomposition failed");

      const j = await r.json();
      setSubprojectData(j);
      setPrdData(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">

      {/* Floating Glass Navigation */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center py-6 pointer-events-none"
      >
        <div className="glass rounded-full px-6 py-3 flex items-center justify-between pointer-events-auto backdrop-blur-xl border-white/10 shadow-2xl">
          <div className="flex items-center gap-3 mr-8">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="font-bold text-white text-sm">P</span>
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              ProdigyPM
            </span>
          </div>

          <nav className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/5">
            <button
              onClick={() => setActiveTab("pdf")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === "pdf"
                ? "bg-white/10 text-white shadow-inner shadow-white/5 border border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
            >
              Workspace
            </button>
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === "dashboard"
                ? "bg-white/10 text-white shadow-inner shadow-white/5 border border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
            >
              Dashboard
            </button>
          </nav>
        </div>
      </motion.header>

      {/* Main Content Area */}
      {/* Main Content Area */}
      <div className="min-h-screen flex flex-col items-center justify-center py-28 md:py-32 relative z-0">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-7xl mx-auto"
            >
              <Dashboard
                apiBase={API_BASE}
                projectKey="SCRUM"
                onProjectCleared={() => {
                  setPrdData(null);
                  setSubprojectData(null);
                  setUploadedFileId(null);
                  setSelectedFile(null);
                  setUploadStatus(null);
                  setError(null);
                  setActiveTab("pdf");
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="workspace"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full mx-auto flex flex-col items-center ${activeTab === "dashboard" ? "max-w-7xl justify-start pt-10" : "max-w-5xl justify-center"
                }`}
            >
              {/* Hero Section */}
              {!prdData && !subprojectData && (
                <div className="text-center mb-10 md:mb-20 relative shrink-0">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] -z-10" />
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-5xl md:text-7xl font-extrabold mb-8 tracking-tight leading-tight"
                  >
                    <span className="bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-transparent drop-shadow-sm">
                      Future of Product
                    </span>
                    <br />
                    <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent drop-shadow-2xl">
                      Management
                    </span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-light"
                  >
                    Transform chaos into clarity. The AI-powered co-pilot that turns raw ideas into comprehensive PRDs and actionable Jira tasks.
                  </motion.p>
                </div>
              )}

              {/* Upload Card */}
              {!prdData && !subprojectData && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  whileHover={{ scale: 1.01 }}
                  transition={{ delay: 0.6 }}
                  className="glass rounded-[2.5rem] p-1 border border-white/10 relative overflow-hidden group max-w-3xl mx-auto shadow-2xl shadow-indigo-500/10 shrink-0"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                  <div className="flex flex-col items-center gap-12 border-2 border-dashed border-slate-700/50 hover:border-cyan-500/50 rounded-[2.5rem] p-12 md:p-20 transition-all duration-500 bg-[#030712]/50 backdrop-blur-md group-hover:bg-[#030712]/40 w-full h-auto min-h-[500px] relative z-10">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {!selectedFile && !uploadedFileId ? (
                      <>
                        <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 flex items-center justify-center shadow-2xl border border-white/10 group-hover:scale-110 transition-transform duration-500 flex-none ring-1 ring-white/20 group-hover:ring-cyan-500/50">
                          <svg className="w-12 h-12 text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>

                        <div className="text-center flex-none space-y-6 max-w-lg">
                          <h3 className="text-3xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                            Upload Context
                          </h3>
                          <p className="text-slate-400 text-lg md:text-xl leading-relaxed font-light">
                            Drag & drop your PDF requirements or click below to start the AI analysis.
                          </p>
                        </div>

                        <div className="flex-1 w-full flex items-end justify-center pt-8">
                          <button
                            onClick={triggerFileUpload}
                            className="px-10 py-5 bg-white text-black font-bold text-xl rounded-2xl hover:scale-105 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] flex-none ring-4 ring-white/10 mb-12"
                          >
                            Select PDF Document
                          </button>
                        </div>
                      </>
                    ) : selectedFile && !uploadedFileId ? (
                      <div className="text-center w-full">
                        <div className="w-20 h-20 mx-auto rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 border border-cyan-500/20 text-cyan-400 relative overflow-hidden">
                          <div className="absolute inset-0 bg-cyan-500/20 blur-xl" />
                          <svg className="w-8 h-8 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-2xl font-medium text-white mb-2">{selectedFile.name}</h3>
                        <p className="text-sm text-slate-400 mb-8">{(selectedFile.size / 1024).toFixed(2)} KB</p>

                        <div className="flex gap-4 justify-center">
                          <button
                            onClick={() => setSelectedFile(null)}
                            className="px-8 py-3 text-slate-400 hover:text-white transition-colors font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={uploadPDF}
                            disabled={loading}
                            className="px-10 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all flex items-center gap-3 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                          >
                            {loading && <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>}
                            {loading ? "Processsing..." : "Analyze Document"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center w-full">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 260, damping: 20 }}
                          className="w-24 h-24 mx-auto rounded-3xl bg-green-500/10 flex items-center justify-center mb-8 border border-green-500/20 relative"
                        >
                          <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full" />
                          <svg className="w-10 h-10 text-green-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </motion.div>
                        <h3 className="text-3xl font-bold text-white mb-3">Analysis Complete</h3>
                        <p className="text-slate-400 mb-10 max-w-lg mx-auto leading-relaxed">
                          The document has been successfully processed. The AI is ready to decompose this into actionable work items.
                        </p>

                        <button
                          onClick={generateProjects}
                          disabled={loading}
                          className="group relative px-10 py-4 bg-white text-black font-bold rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all hover:scale-105 hover:shadow-[0_0_50px_rgba(255,255,255,0.5)]"
                        >
                          <span className="relative z-10 flex items-center gap-3 text-lg">
                            {loading ? "Thinking..." : "Generate Project Plan"}
                            {!loading && <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Dynamic Content Display */}
              <AnimatePresence>
                {(prdData || subprojectData) && (
                  <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                  >
                    {/* View Controls */}
                    <div className="flex justify-end gap-3 sticky top-24 z-30">
                      <div className="glass p-1 rounded-lg flex gap-1">
                        <button
                          onClick={() => setViewMode("formatted")}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === "formatted" ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"
                            }`}
                        >
                          Visual
                        </button>
                        <button
                          onClick={() => setViewMode("json")}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === "json" ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"
                            }`}
                        >
                          JSON
                        </button>
                      </div>
                    </div>

                    {viewMode === "formatted" ? (
                      <>
                        {prdData && <PRDDisplay prdData={prdData} />}
                        {subprojectData && (
                          <SubprojectDisplay
                            subprojects={subprojectData.subprojects}
                            summary={subprojectData.summary}
                          />
                        )}

                        {/* Sync Button Logic reused from original but styled */}
                        {subprojectData && (
                          <div className="flex justify-center pt-8">
                            <button
                              onClick={async () => {
                                setLoading(true);
                                try {
                                  const productName = subprojectData.interpretation?.product_name || "ProdigyPM Product";
                                  const r = await fetch(`${API_BASE}/api/jira/sync`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      subprojects: subprojectData.subprojects,
                                      product_name: productName,
                                    }),
                                  });
                                  if (!r.ok) throw new Error("Sync failed");
                                  const j = await r.json();
                                  alert(`✅ Synced to Jira Project: ${j.project_key}`);
                                  setActiveTab("dashboard");
                                } catch (e: any) {
                                  alert(e.message);
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-[0_0_40px_rgba(79,70,229,0.4)] hover:shadow-[0_0_60px_rgba(79,70,229,0.6)] font-bold text-lg transition-all hover:scale-105 flex items-center gap-3"
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              Sync to Jira
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="glass rounded-xl p-6 overflow-auto border border-white/10">
                        <pre className="text-xs font-mono text-cyan-300">
                          {JSON.stringify(prdData || subprojectData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <FloatingChatButton onClick={() => setIsChatOpen(true)} />

      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        apiBase={API_BASE}
        onPRDGenerated={(prd, metadata) => {
          setPrdData({ prd, feature: metadata.product_name });
          setIsChatOpen(false);
          setActiveTab("pdf");
        }}
      />
    </main >
  );
}
