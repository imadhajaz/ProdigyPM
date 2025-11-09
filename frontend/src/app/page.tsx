// import Image from "next/image";

// export default function Home() {
//   return (
//     <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
//       <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
//         <Image
//           className="dark:invert"
//           src="/next.svg"
//           alt="Next.js logo"
//           width={100}
//           height={20}
//           priority
//         />
//         <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
//           <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
//             To get started, edit the page.tsx file.
//           </h1>
//           <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
//             Looking for a starting point or more instructions? Head over to{" "}
//             <a
//               href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//               className="font-medium text-zinc-950 dark:text-zinc-50"
//             >
//               Templates
//             </a>{" "}
//             or the{" "}
//             <a
//               href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//               className="font-medium text-zinc-950 dark:text-zinc-50"
//             >
//               Learning
//             </a>{" "}
//             center.
//           </p>
//         </div>
//         <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
//           <a
//             className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
//             href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//             target="_blank"
//             rel="noopener noreferrer"
//           >
//             <Image
//               className="dark:invert"
//               src="/vercel.svg"
//               alt="Vercel logomark"
//               width={16}
//               height={16}
//             />
//             Deploy Now
//           </a>
//           <a
//             className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
//             href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//             target="_blank"
//             rel="noopener noreferrer"
//           >
//             Documentation
//           </a>
//         </div>
//       </main>
//     </div>
//   );
// }


"use client";
import { useState } from "react";
import PRDDisplay from "../components/PRDDisplay";
import SubprojectDisplay from "../components/SubprojectDisplay";
import Dashboard from "../components/Dashboard";
import ChatModal from "../components/ChatModal";
import FloatingChatButton from "../components/FloatingChatButton";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function Home() {
  const [resp, setResp] = useState<string>("(click a button)");
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

  const hitHealth = async () => {
    setLoading(true);
    setError(null);
    setResp("Loading...");
    try {
      console.log("Fetching:", `${API_BASE}/`);
      const r = await fetch(`${API_BASE}/`);
      console.log("Response status:", r.status);
      if (!r.ok) {
        throw new Error(`HTTP ${r.status}: ${r.statusText}`);
      }
      const j = await r.json();
      setResp(JSON.stringify(j, null, 2));
      console.log("Success:", j);
    } catch (e: any) {
      const errorMsg = `Error: ${e.message || String(e)}`;
      setError(errorMsg);
      setResp(errorMsg);
      console.error("Health check error:", e);
    } finally {
      setLoading(false);
    }
  };

  const genPRD = async () => {
    setLoading(true);
    setError(null);
    setResp("Generating PRD...");
    try {
      const url = `${API_BASE}/api/generate_prd`;
      const payload = {
        feature_name: "Instant Credit Score",
        context: "sample context",
      };
      console.log("Fetching:", url);
      console.log("Payload:", payload);
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("Response status:", r.status);
      console.log("Response headers:", Object.fromEntries(r.headers.entries()));
      
      if (!r.ok) {
        const errorText = await r.text();
        console.error("Error response:", errorText);
        throw new Error(`HTTP ${r.status}: ${r.statusText}\n${errorText}`);
      }
      
      const j = await r.json();
      setResp(JSON.stringify(j, null, 2));
      setPrdData(j); // Store PRD data for formatted display
      setSubprojectData(null); // Clear subproject data
      console.log("Success:", j);
    } catch (e: any) {
      const errorMsg = `Error: ${e.message || String(e)}`;
      setError(errorMsg);
      setResp(errorMsg);
      console.error("PRD generation error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setError("Please select a PDF file");
        return;
      }
      setSelectedFile(file);
      setError(null);
      setUploadStatus(null);
    }
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
      
      console.log("Uploading PDF:", selectedFile.name);
      const r = await fetch(`${API_BASE}/api/upload_pdf`, {
        method: "POST",
        body: formData,
      });
      
      console.log("Response status:", r.status);
      
      if (!r.ok) {
        const errorText = await r.text();
        console.error("Error response:", errorText);
        throw new Error(`HTTP ${r.status}: ${r.statusText}\n${errorText}`);
      }
      
      const j = await r.json();
      setUploadStatus("Upload successful!");
      setUploadedFileId(j.file_id); // Store file_id for text extraction
      setResp(JSON.stringify(j, null, 2));
      console.log("Upload success:", j);
      
      // Reset file input
      setSelectedFile(null);
      const fileInput = document.getElementById("pdf-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (e: any) {
      const errorMsg = `Error: ${e.message || String(e)}`;
      setError(errorMsg);
      setUploadStatus("Upload failed");
      console.error("PDF upload error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header Navigation */}
      <header className="sticky top-0 z-40 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  ProdigyPM
                </h1>
                <p className="text-xs text-slate-400">AI Product Management Console</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("pdf")}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === "pdf"
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                    : "text-slate-400 hover:text-blue-300 hover:bg-slate-700/50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Home
                </span>
              </button>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === "dashboard"
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                    : "text-slate-400 hover:text-blue-300 hover:bg-slate-700/50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Dashboard
                </span>
              </button>
            </nav>
          </div>
        </div>
      </header>

          {/* Main Content */}
          {activeTab === "dashboard" ? (
            <Dashboard 
              apiBase={API_BASE} 
              projectKey="SCRUM" 
              onProjectCleared={() => {
                // Reset all state and navigate to PDF processing
                setPrdData(null);
                setSubprojectData(null);
                setUploadedFileId(null);
                setSelectedFile(null);
                setUploadStatus(null);
                setError(null);
                setActiveTab("pdf");
              }}
            />
          ) : (
        <div className="flex-1 flex items-center justify-center w-full px-6 py-12">
          <div className="w-full max-w-5xl mx-auto">
            {/* PDF Upload Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm p-10 rounded-2xl shadow-2xl border border-slate-700">
              {/* Header Section */}
              <div className="flex items-start gap-5 mb-10">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-xl flex items-center justify-center border border-blue-500/30 flex-shrink-0">
                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 pt-1">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-3">PDF Upload & Project Generation</h2>
                  <p className="text-base text-slate-300 leading-relaxed">
                    Upload a PDF document and generate department-level projects with effort estimates automatically.
                  </p>
                </div>
              </div>
              
              {/* File Upload Section */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-200">
                    Select PDF File
                  </label>
                  <div className="relative">
                    <input
                      id="pdf-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-slate-300 file:mr-5 file:py-2.5 file:px-5 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-blue-600 file:to-purple-600 file:text-white hover:file:from-blue-700 hover:file:to-purple-700 file:cursor-pointer cursor-pointer bg-slate-700/50 border-2 border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    />
                  </div>
                </div>
                
                {selectedFile && (
                  <div className="bg-slate-700/40 p-4 rounded-lg border-2 border-slate-600">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <div className="text-xs text-slate-400 mb-1">Selected File:</div>
                        <div className="text-sm font-medium text-slate-100">{selectedFile.name}</div>
                        <div className="text-xs text-slate-400 mt-1">({(selectedFile.size / 1024).toFixed(2)} KB)</div>
                      </div>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={uploadPDF}
                  disabled={loading || !selectedFile}
                  className="w-full px-6 py-3.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Upload PDF</span>
                    </>
                  )}
                </button>
                
                {uploadStatus && (
                  <div className="text-sm p-4 rounded-lg border-2 bg-slate-700/40 text-slate-300 border-slate-600">
                    <div className="flex items-center gap-3">
                      {uploadStatus.includes("success") ? (
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      <span>{uploadStatus}</span>
                    </div>
                  </div>
                )}
                
                {uploadedFileId && (
                  <div className="space-y-5">
                    <button
                      onClick={async () => {
                        setLoading(true);
                        setError(null);
                        setResp("Generating projects from PDF...");
                        try {
                          const r = await fetch(`${API_BASE}/api/pdf/${uploadedFileId}/decompose`, {
                            method: "POST",
                          });
                          if (!r.ok) {
                            const errorText = await r.text();
                            throw new Error(`HTTP ${r.status}: ${errorText}`);
                          }
                          const j = await r.json();
                          setResp(JSON.stringify(j, null, 2));
                          setSubprojectData(j);
                          setPrdData(null);
                          console.log("PDF decomposition success:", j);
                        } catch (e: any) {
                          setError(`Error: ${e.message}`);
                          console.error("PDF decomposition error:", e);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="w-full px-6 py-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-3 shadow-lg shadow-purple-500/20"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Generating Projects...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span>Generate Projects</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-slate-700/40 border-2 border-slate-600 text-slate-300 px-5 py-4 rounded-lg mt-6">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <strong className="font-semibold text-sm">Error:</strong>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
      
            {/* View Mode Toggle */}
            {(prdData || subprojectData) && (
              <div className="flex justify-end mb-4">
                <div className="flex gap-2 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
        <button
                    onClick={() => setViewMode("formatted")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      viewMode === "formatted"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                        : "text-slate-400 hover:text-blue-300 hover:bg-slate-700/50"
                    }`}
                  >
                    Formatted
        </button>
        <button
                    onClick={() => setViewMode("json")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      viewMode === "json"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                        : "text-slate-400 hover:text-blue-300 hover:bg-slate-700/50"
                    }`}
                  >
                    JSON
                  </button>
                </div>
              </div>
            )}
      
            {/* Formatted PRD Display */}
            {viewMode === "formatted" && prdData && prdData.prd && (
              <div className="w-full">
                <PRDDisplay prdData={prdData} />
              </div>
            )}
            
            {/* Formatted Subproject Display */}
            {viewMode === "formatted" && subprojectData && subprojectData.subprojects && (
              <div className="w-full space-y-6 mt-8">
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700 p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-3 flex items-center gap-3">
                        <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Product Decomposition
                      </h2>
                      {subprojectData.interpretation && (
                        <p className="text-base text-slate-400">
                          Product: <strong className="text-slate-200">{subprojectData.interpretation.product_name}</strong>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        setLoading(true);
                        setError(null);
                        setResp("Syncing subprojects to Jira...");
                        try {
                          // Get product name from interpretation if available
                          const productName = subprojectData.interpretation?.product_name || "ProdigyPM Product";
                          
                          const r = await fetch(`${API_BASE}/api/jira/sync`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              subprojects: subprojectData.subprojects,
                              product_name: productName,
                            }),
                          });
                          if (!r.ok) {
                            const errorText = await r.text();
                            throw new Error(`HTTP ${r.status}: ${errorText}`);
                          }
                          const j = await r.json();
                          setResp(JSON.stringify(j, null, 2));
                          console.log("Jira sync success:", j);
                          
                          if (j.subproject_mapping && subprojectData) {
                            const updatedSubprojects = subprojectData.subprojects.map((sp: any) => {
                              const mapping = j.subproject_mapping[sp.subproject_id];
                              if (mapping) {
                                return { ...sp, jira_id: mapping.jira_id };
                              }
                              return sp;
                            });
                            setSubprojectData({
                              ...subprojectData,
                              subprojects: updatedSubprojects
                            });
                          }
                          
                          // Show detailed success message
                          const projectMessage = j.project_created 
                            ? `✅ Created new Jira project "${j.project_key}" (${j.project_name}) and added ${j.total_created} issues!\n\nView in Jira: ${j.jira_project_url || 'N/A'}`
                            : `✅ Successfully created ${j.total_created} Jira issues in ${j.project_key} project (${j.project_name})!\n\nView in Jira: ${j.jira_project_url || 'N/A'}`;
                          alert(projectMessage);
                          
                          // Log detailed info for debugging
                          console.log("Jira sync response:", {
                            project_key: j.project_key,
                            project_name: j.project_name,
                            total_created: j.total_created,
                            issue_keys: j.issue_keys,
                            jira_url: j.jira_project_url
                          });
                          
                          if (typeof (window as any).refreshDashboard === 'function') {
                            (window as any).refreshDashboard();
                            setTimeout(() => {
                              (window as any).refreshDashboard();
                            }, 2000);
                            setTimeout(() => {
                              (window as any).refreshDashboard();
                            }, 5000);
                          }
                          
                          if (activeTab !== "dashboard") {
                            setTimeout(() => {
                              setActiveTab("dashboard");
                            }, 1000);
                          }
                        } catch (e: any) {
                          setError(`Error: ${e.message}`);
                          console.error("Jira sync error:", e);
                          alert(`❌ Failed to sync to Jira: ${e.message}`);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-500/20"
        >
                      {loading ? (
                        <>
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Syncing...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Sync to Jira
                        </>
                      )}
        </button>
      </div>
                </div>
                <SubprojectDisplay
                  subprojects={subprojectData.subprojects}
                  summary={subprojectData.summary}
                />
              </div>
            )}
            
            {/* JSON View */}
            {viewMode === "json" && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
                <pre className="text-sm text-slate-300 overflow-auto font-mono bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                  {resp}
                </pre>
              </div>
            )}
            
            {/* Default view when no data */}
            {!prdData && !subprojectData && viewMode === "json" && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
                <pre className="text-sm text-slate-300 overflow-auto font-mono bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        {resp}
      </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Chat Button */}
      <FloatingChatButton onClick={() => setIsChatOpen(true)} />

      {/* Chat Modal */}
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
    </main>
  );
}

