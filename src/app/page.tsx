"use client";

import React, { useState, useRef } from "react";
import { 
  FileStack, 
  Scissors, 
  Unlock, 
  Upload, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Lock,
  Eye,
  EyeOff,
  ShieldAlert
} from "lucide-react";

const API_BASE = "http://127.0.0.1:8000/api";

type Tab = "merge" | "split" | "unlock";

interface PageRange {
  start: number;
  end: number;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("merge");
  
  // File inputs state
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [unlockFile, setUnlockFile] = useState<File | null>(null);
  
  // Operation states
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ranges, setRanges] = useState<PageRange[]>([{ start: 1, end: 1 }]);
  
  // Loading & notification states
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; downloadUrl: string; filename: string } | null>(null);

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);

  // Refs for file input elements
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const splitInputRef = useRef<HTMLInputElement>(null);
  const unlockInputRef = useRef<HTMLInputElement>(null);

  // Reset notifications
  const clearStatus = () => {
    setError(null);
    setSuccess(null);
  };

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    clearStatus();

    const files = Array.from(e.dataTransfer.files).filter(file => file.type === "application/pdf");
    
    if (files.length === 0) {
      setError("Please drop PDF files only.");
      return;
    }

    if (activeTab === "merge") {
      setMergeFiles(prev => [...prev, ...files]);
    } else if (activeTab === "split") {
      setSplitFile(files[0]);
    } else if (activeTab === "unlock") {
      setUnlockFile(files[0]);
    }
  };

  // Manual file selection handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearStatus();
    if (!e.target.files) return;
    const files = Array.from(e.target.files).filter(file => file.type === "application/pdf");
    
    if (files.length === 0) {
      setError("Please select PDF files only.");
      return;
    }

    if (activeTab === "merge") {
      setMergeFiles(prev => [...prev, ...files]);
    } else if (activeTab === "split") {
      setSplitFile(files[0]);
    } else if (activeTab === "unlock") {
      setUnlockFile(files[0]);
    }

    // Reset input value to allow selecting same file again
    e.target.value = "";
  };

  // Merge order handlers
  const moveFile = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === mergeFiles.length - 1) return;

    const newFiles = [...mergeFiles];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const temp = newFiles[index];
    newFiles[index] = newFiles[targetIndex];
    newFiles[targetIndex] = temp;
    setMergeFiles(newFiles);
  };

  const removeMergeFile = (index: number) => {
    setMergeFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Split ranges handlers
  const handleRangeChange = (index: number, field: "start" | "end", value: number) => {
    const newRanges = [...ranges];
    newRanges[index] = {
      ...newRanges[index],
      [field]: Math.max(1, value)
    };
    setRanges(newRanges);
  };

  const addRange = () => {
    const lastRange = ranges[ranges.length - 1];
    setRanges(prev => [...prev, { start: lastRange.end + 1, end: lastRange.end + 1 }]);
  };

  const removeRange = (index: number) => {
    if (ranges.length === 1) return;
    setRanges(prev => prev.filter((_, i) => i !== index));
  };

  // Trigger download helper
  const triggerDownload = (blob: Blob, defaultFilename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", defaultFilename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    setSuccess({
      message: `Successfully processed! Your file "${defaultFilename}" has been downloaded.`,
      downloadUrl: url,
      filename: defaultFilename
    });
  };

  // API Submission Handlers
  const handleMergeSubmit = async () => {
    if (mergeFiles.length < 2) return;
    clearStatus();
    setLoading(true);
    setLoadingMessage("Merging your PDF files...");

    const formData = new FormData();
    mergeFiles.forEach(file => {
      formData.append("files", file);
    });

    try {
      const response = await fetch(`${API_BASE}/merge`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to merge PDFs");
      }

      const blob = await response.blob();
      triggerDownload(blob, "merged_documents.pdf");
      // Optional: Clear files on success
      setMergeFiles([]);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during merging.");
    } finally {
      setLoading(false);
    }
  };

  const handleSplitSubmit = async () => {
    if (!splitFile) return;
    clearStatus();
    setLoading(true);
    setLoadingMessage("Splitting your PDF file...");

    // Validate ranges briefly client side
    const invalidRange = ranges.find(r => r.start > r.end);
    if (invalidRange) {
      setError(`Invalid range: Start page (${invalidRange.start}) cannot be greater than End page (${invalidRange.end}).`);
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", splitFile);
    
    // Format: [[start, end], [start, end]]
    const rangeArray = ranges.map(r => [r.start, r.end]);
    formData.append("ranges_json", JSON.stringify(rangeArray));

    try {
      const response = await fetch(`${API_BASE}/split`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to split PDF");
      }

      const contentType = response.headers.get("content-type");
      const blob = await response.blob();
      
      const baseName = getBaseName(splitFile.name) || "split_document";
      const isZip = contentType && contentType.includes("zip");
      const filename = isZip ? `${baseName}_split_parts.zip` : `${baseName}_part_${ranges[0].start}_to_${ranges[0].end}.pdf`;
      
      triggerDownload(blob, filename);
      setSplitFile(null);
      setRanges([{ start: 1, end: 1 }]);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during splitting.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockSubmit = async () => {
    if (!unlockFile || !password) return;
    clearStatus();
    setLoading(true);
    setLoadingMessage("Decrypting your PDF file...");

    const formData = new FormData();
    formData.append("file", unlockFile);
    formData.append("password", password);

    try {
      const response = await fetch(`${API_BASE}/unlock`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to decrypt PDF");
      }

      const blob = await response.blob();
      const baseName = getBaseName(unlockFile.name) || "unlocked_document";
      const filename = `${baseName}_unlocked.pdf`;
      
      triggerDownload(blob, filename);
      setUnlockFile(null);
      setPassword("");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during unlocking.");
    } finally {
      setLoading(false);
    }
  };

  // Helper extension for JS string rsplit
  // (we implement inline to avoid prototype pollution issues)
  const rsplitHelper = (str: string, sep: string, maxsplit: number) => {
    const split = str.split(sep);
    if (split.length <= 1) return [str, ""];
    const out = [
      split.slice(0, split.length - maxsplit).join(sep),
      split.slice(split.length - maxsplit).join(sep)
    ];
    return out;
  };

  // Wrap file names nicely
  const getBaseName = (filename: string) => {
    const parts = rsplitHelper(filename, ".", 1);
    return parts[0];
  };

  return (
    <div className="flex-1 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl w-full mx-auto space-y-8 z-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            100% Secure &bull; In-Memory Processing
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-100 via-indigo-100 to-indigo-400 bg-clip-text text-transparent">
            PDF Nexus
          </h1>
          <p className="text-zinc-400 max-w-lg mx-auto text-sm sm:text-base">
            Perform common PDF manipulations completely in-memory. Your sensitive files never touch persistent storage.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex justify-center">
          <div className="inline-flex p-1 bg-zinc-900/80 border border-zinc-800 rounded-xl backdrop-blur-md shadow-lg">
            <button
              onClick={() => { setActiveTab("merge"); clearStatus(); }}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === "merge"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/10"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <FileStack className="w-4 h-4" />
              Merge PDFs
            </button>
            <button
              onClick={() => { setActiveTab("split"); clearStatus(); }}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === "split"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/10"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Scissors className="w-4 h-4" />
              Split PDF
            </button>
            <button
              onClick={() => { setActiveTab("unlock"); clearStatus(); }}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === "unlock"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/10"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Unlock className="w-4 h-4" />
              Unlock PDF
            </button>
          </div>
        </div>

        {/* Success/Error Alerts */}
        {error && (
          <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-4 flex gap-3 text-red-200 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold text-red-300">Processing Failed:</span> {error}
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-xl p-4 flex gap-3 text-emerald-200 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-emerald-300">Success!</p>
              <p>{success.message}</p>
              <div className="pt-2">
                <a
                  href={success.downloadUrl}
                  download={success.filename}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-md shadow-emerald-500/10"
                >
                  Download Again
                </a>
              </div>
            </div>
            <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-300 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Main Interface Box */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-lg">
          
          {/* UPLOAD ZONE (Drag & Drop) */}
          {((activeTab === "merge") || 
            (activeTab === "split" && !splitFile) || 
            (activeTab === "unlock" && !unlockFile)) && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                if (activeTab === "merge") mergeInputRef.current?.click();
                if (activeTab === "split") splitInputRef.current?.click();
                if (activeTab === "unlock") unlockInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-4 ${
                isDragging
                  ? "border-indigo-500 bg-indigo-500/5 scale-[0.99] shadow-inner shadow-indigo-500/10"
                  : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-950/60"
              }`}
            >
              <input
                type="file"
                multiple={activeTab === "merge"}
                accept="application/pdf"
                className="hidden"
                ref={activeTab === "merge" ? mergeInputRef : activeTab === "split" ? splitInputRef : unlockInputRef}
                onChange={handleFileChange}
              />
              <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-indigo-400 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="text-zinc-200 font-semibold text-sm sm:text-base">
                  {activeTab === "merge" 
                    ? "Drag & drop files here, or click to upload" 
                    : "Drag & drop your PDF file here, or click to upload"
                  }
                </p>
                <p className="text-zinc-500 text-xs sm:text-sm">
                  {activeTab === "merge" ? "Upload 2 or more PDF documents" : "Supported: encrypted or plain PDF"}
                </p>
              </div>
            </div>
          )}

          {/* TAB 1: MERGE FILES LIST */}
          {activeTab === "merge" && mergeFiles.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                  Files to Merge ({mergeFiles.length})
                </h3>
                <button
                  onClick={() => mergeInputRef.current?.click()}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Files
                </button>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {mergeFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between bg-zinc-950/70 border border-zinc-850 rounded-lg p-3 group hover:border-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded bg-red-950/40 border border-red-900/40 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-red-400">PDF</span>
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-zinc-200 text-sm font-medium truncate pr-4">{file.name}</p>
                        <p className="text-zinc-500 text-xs">{formatBytes(file.size)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => moveFile(idx, "up")}
                        disabled={idx === 0}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveFile(idx, "down")}
                        disabled={idx === mergeFiles.length - 1}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeMergeFile(idx)}
                        className="p-1.5 rounded hover:bg-red-950/30 text-zinc-500 hover:text-red-400 transition-colors ml-1"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <button
                  onClick={handleMergeSubmit}
                  disabled={mergeFiles.length < 2 || loading}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Merging files...
                    </>
                  ) : (
                    <>
                      <FileStack className="w-4 h-4" />
                      Merge {mergeFiles.length} PDFs
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SPLIT PAGE RANGE CONFIG */}
          {activeTab === "split" && splitFile && (
            <div className="space-y-6">
              <div className="bg-zinc-950/60 border border-zinc-850 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded bg-red-950/40 border border-red-900/40 flex items-center justify-center shrink-0">
                    <span className="text-[12px] font-bold text-red-400">PDF</span>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-zinc-200 text-sm font-semibold truncate pr-4">{splitFile.name}</p>
                    <p className="text-zinc-500 text-xs">{formatBytes(splitFile.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSplitFile(null)}
                  className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Define Page Ranges
                  </h4>
                  <button
                    onClick={addRange}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Range
                  </button>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {ranges.map((range, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 bg-zinc-950/30 border border-zinc-850/60 p-3 rounded-xl"
                    >
                      <div className="text-xs font-bold text-zinc-500 w-8">
                        Part {idx + 1}
                      </div>
                      
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Start Page</label>
                          <input
                            type="number"
                            min="1"
                            value={range.start}
                            onChange={(e) => handleRangeChange(idx, "start", parseInt(e.target.value) || 1)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">End Page</label>
                          <input
                            type="number"
                            min="1"
                            value={range.end}
                            onChange={(e) => handleRangeChange(idx, "end", parseInt(e.target.value) || 1)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => removeRange(idx)}
                        disabled={ranges.length === 1}
                        className="p-2 rounded bg-zinc-900/60 hover:bg-red-950/20 text-zinc-500 hover:text-red-400 border border-zinc-850/60 disabled:opacity-30 disabled:pointer-events-none transition-colors self-end"
                        title="Remove Range"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                
                <p className="text-[11px] text-zinc-500">
                  ℹ️ Multiple ranges will be compressed into a single ZIP file containing each split PDF.
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleSplitSubmit}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Splitting PDF...
                    </>
                  ) : (
                    <>
                      <Scissors className="w-4 h-4" />
                      Split PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: UNLOCK PDF AND ENTER PASSWORD */}
          {activeTab === "unlock" && unlockFile && (
            <div className="space-y-6">
              <div className="bg-zinc-950/60 border border-zinc-850 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded bg-red-950/40 border border-red-900/40 flex items-center justify-center shrink-0">
                    <span className="text-[12px] font-bold text-red-400">PDF</span>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-zinc-200 text-sm font-semibold truncate pr-4">{unlockFile.name}</p>
                    <p className="text-zinc-500 text-xs">{formatBytes(unlockFile.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setUnlockFile(null); setPassword(""); }}
                  className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Enter PDF Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password to decrypt..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-10 py-3 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-650"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleUnlockSubmit}
                  disabled={!password || loading}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Decrypting PDF...
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      Unlock PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Global Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-200">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-zinc-800 border-t-indigo-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Lock className="w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
            </div>
            <p className="text-zinc-200 font-semibold text-sm">{loadingMessage}</p>
            <p className="text-zinc-500 text-xs animate-pulse">Running securely in local environment</p>
          </div>
        )}

        {/* Security Notice Card */}
        <div className="bg-zinc-950/40 border border-zinc-850/60 rounded-2xl p-4 flex gap-4 items-start max-w-2xl mx-auto backdrop-blur-md">
          <div className="p-2 bg-indigo-950/50 border border-indigo-900/50 rounded-xl text-indigo-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h5 className="text-xs font-semibold text-zinc-300">Privacy & Security</h5>
            <p className="text-[11px] text-zinc-550 leading-relaxed">
              Your files are uploaded directly to your locally running FastAPI server and are processed entirely in-memory (`BytesIO`). Files are never saved to disk, nor are they sent to any external clouds. They are discarded immediately after processing.
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="text-center text-[11px] text-zinc-600 mt-12">
        &copy; {new Date().getFullYear()} PDF Nexus. Created locally.
      </footer>
    </div>
  );
}
