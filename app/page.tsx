"use client";
import { useState } from "react";
import { Search, Download, Loader2, Music, Video, Clipboard, ArrowRight, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [error, setError] = useState("");

  // Download State
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch (err) {
      console.error("Failed to read clipboard", err);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError("");
    setVideoInfo(null);

    try {
      const response = await axios.get(`/api/info?url=${encodeURIComponent(url)}`);
      setVideoInfo(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.details || err.response?.data?.error || "Could not load video. Check the link.";
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format: any) => {
    setDownloading(true);
    setProgress(0);
    setStatus("Initializing...");

    try {
      const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&type=${format.type}&quality=${format.quality}`;

      const response = await axios.get(downloadUrl, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          const total = progressEvent.total;
          if (total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
            setProgress(percentCompleted);
            setStatus(percentCompleted < 100 ? "Downloading..." : "Finalizing...");
          } else {
            // Fallback if no content-length
            setStatus("Downloading...");
            // Fake progress for visual feedback if total is unknown
            setProgress((old) => (old < 90 ? old + 5 : old));
          }
        }
      });

      // Create a link to download the blob
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      // Try to get filename from headers if possible, otherwise generate one
      const filename = `download.${format.type}`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      setStatus("Complete!");
      setTimeout(() => setDownloading(false), 2000);

    } catch (err) {
      console.error("Download failed", err);
      setStatus("Failed");
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#0f172a] text-slate-100 font-sans selection:bg-blue-500/30">

      {/* Mobile-first Container */}
      <div className="w-full max-w-md min-h-screen flex flex-col p-6 relative z-10">

        {/* Header / Intro */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 mb-8 text-center"
        >
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Media<span className="text-blue-500">Loader</span>
          </h1>
          <p className="text-sm text-slate-400">Download video & audio in seconds</p>
        </motion.div>

        {/* Top Section: URL Input */}
        <div className="mb-8">
          <div className="relative group">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube link..."
              className="w-full pl-4 pr-12 py-4 rounded-2xl glass-input text-sm font-medium placeholder-slate-500 focus:ring-2 focus:ring-blue-500 transition-all shadow-lg shadow-black/20"
            />
            <button
              onClick={() => { if (!url) handlePaste(); else handleSearch(); }}
              className="absolute right-2 top-2 bottom-2 aspect-square rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors shadow-lg shadow-blue-500/20"
            >
              {url ? <ArrowRight className="w-5 h-5" /> : <Clipboard className="w-5 h-5" />}
            </button>
          </div>
          {error && <p className="text-red-400 text-xs mt-3 text-center bg-red-500/10 py-2 rounded-lg">{error}</p>}
        </div>

        {/* Middle & Bottom Sections */}
        <div className="flex-1 flex flex-col">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
              <p className="text-xs font-medium tracking-wide">FETCHING INFO...</p>
            </div>
          )}

          <AnimatePresence>
            {videoInfo && !loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col gap-6"
              >
                {/* Preview Card */}
                <div className="glass-card p-4 shadow-xl shadow-black/20 overflow-hidden relative">
                  <div className="aspect-video w-full rounded-xl overflow-hidden mb-4 relative bg-black/50">
                    <img src={videoInfo.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-[10px] font-bold text-white backdrop-blur-sm">
                      {videoInfo.duration}
                    </div>
                  </div>
                  <h2 className="text-sm font-bold text-white leading-snug line-clamp-2 mb-1">
                    {videoInfo.title}
                  </h2>
                  <p className="text-xs text-slate-400">{videoInfo.author}</p>
                </div>

                {/* Download Buttons */}
                <div className="flex flex-col gap-4">
                  {/* MP4 Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <Video className="w-3 h-3" /> <span>Video (MP4)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {videoInfo.formats.filter((f: any) => !f.isAudio).map((fmt: any, i: number) => (
                        <button
                          key={i}
                          onClick={() => handleDownload(fmt)}
                          className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/50 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/50 transition-all group"
                        >
                          <span className="text-sm font-bold text-white group-hover:text-blue-400">{fmt.quality}</span>
                          <span className="text-[10px] text-slate-500 group-hover:text-blue-300/70">MP4</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* MP3 Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <Music className="w-3 h-3" /> <span>Audio (MP3)</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {videoInfo.formats.filter((f: any) => f.isAudio).map((fmt: any, i: number) => (
                        <button
                          key={i}
                          onClick={() => handleDownload(fmt)}
                          className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-blue-600/10 to-blue-600/5 hover:from-blue-600/20 hover:to-blue-600/10 border border-blue-500/20 transition-all group"
                        >
                          <div className="flex flex-col items-start bg-transparent">
                            <span className="text-sm font-bold text-blue-400 group-hover:text-blue-300">{fmt.label}</span>
                            <span className="text-[10px] text-slate-400">High Quality 320kbps</span>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                            <Download className="w-4 h-4 text-white" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center py-4 border-t border-white/5">
          <p className="text-[10px] text-slate-600 mb-2">Secure & Private Download</p>
          <p className="text-xs text-slate-500 font-medium">Made by Juned</p>
        </div>
      </div>

      {/* Download Modal */}
      <AnimatePresence>
        {downloading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl relative"
            >
              <button onClick={() => setDownloading(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-1">Processing...</h3>
                <p className="text-sm text-slate-400">Please wait while we prepare your file.</p>
              </div>

              <div className="mb-2 flex justify-between text-xs font-medium text-slate-300">
                <span>{status}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden mb-6">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 50, damping: 20 }}
                />
              </div>

              {status === "Complete!" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 text-green-400 font-bold"
                >
                  <Check className="w-5 h-5" />
                  <span>Download Started!</span>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient Background Glows */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

    </main>
  );
}
