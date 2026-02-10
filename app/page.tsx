'use client';

import { useState } from "react";
import { Search, Download, Youtube, Loader2, Music, Video, AlertCircle, Clipboard, ArrowRight, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Download State
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  // List of public Cobalt instances to try (Client-side)
  const COBALT_INSTANCES = [
    'https://api.cobalt.tools',
    'https://cobalt.canine.tools',
    'https://cobalt.meowing.de',
    'https://cobalt.xyx.host',
    'https://cobalt.synn.cc',
    'https://api.server.social',
    'https://cobalt.kwiatekmiki.pl',
    'https://cobalt.noway.cc',
    'https://cobalt.defnot001.com',
    'https://cobalt.darkness.services',
    'https://cobalt.femboy.beauty',
    'https://dl.khub.net'
  ];

  // List of Piped instances (Fallback)
  const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.video',
  ];

  const logToDebug = (msg: string) => {
    console.log(msg);
    setDebugLogs(prev => [`${new Date().toLocaleTimeString()}: ${msg}`, ...prev]);
  };

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
    setDebugLogs([]); // Clear logs for new search
    logToDebug(`Starting fetch for: ${url}`);

    // 1. Try Client-Side Cobalt for YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      logToDebug("Attempting Client-Side Cobalt fetch...");
      for (const instance of COBALT_INSTANCES) {
        try {
          // Try v10 API
          logToDebug(`Trying Cobalt: ${instance}`);
          const response = await axios.post(`${instance}/`, {
            url: url,
            vQuality: "720",
            filenamePattern: "basic"
          }, {
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
          });

          const data = response.data;
          if (data && (data.url || data.status === 'stream' || data.status === 'redirect' || data.status === 'picker')) {
            logToDebug(`Cobalt Success! ${data.status}`);

            const videoUrl = data.url || (data.picker && data.picker[0]?.url);

            if (videoUrl) {
              setVideoInfo({
                title: data.filename || "Video Found",
                thumbnail: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop",
                duration: "Unknown",
                author: "YouTube",
                formats: [
                  { quality: "720p", type: "mp4", label: "Download MP4", url: videoUrl, direct: true },
                  { quality: "Audio", type: "mp3", label: "Download Audio", url: videoUrl, isAudio: true, direct: true }
                ]
              });
              setLoading(false);
              return;
            }
          }
        } catch (err: any) {
          logToDebug(`Cobalt Failed ${instance}: ${err.message}`);
        }
      }
      logToDebug("All Cobalt instances failed. Trying Piped...");

      // 2. Try Client-Side Piped API
      for (const instance of PIPED_INSTANCES) {
        try {
          // Extract Video ID
          let videoId = "";
          if (url.includes("v=")) {
            videoId = url.split("v=")[1].split("&")[0];
          } else if (url.includes("youtu.be/")) {
            videoId = url.split("youtu.be/")[1].split("?")[0];
          } else if (url.includes("shorts/")) {
            videoId = url.split("shorts/")[1].split("?")[0];
          }

          if (videoId) {
            logToDebug(`Testing Piped: ${instance}/streams/${videoId}`);
            const response = await axios.get(`${instance}/streams/${videoId}`);
            const data = response.data;

            if (data && data.videoStreams && data.videoStreams.length > 0) {
              logToDebug("Piped Success!");
              // Filter for 720p or highest
              const bestVideo = data.videoStreams.find((s: any) => s.quality === "1080p" && !s.videoOnly) ||
                data.videoStreams.find((s: any) => s.quality === "720p" && !s.videoOnly) ||
                data.videoStreams.find((s: any) => !s.videoOnly) ||
                data.videoStreams[0];

              const bestAudio = data.audioStreams.find((s: any) => s.mimeType === "audio/mp4") || data.audioStreams[0];

              setVideoInfo({
                title: data.title,
                thumbnail: data.thumbnailUrl,
                duration: new Date(data.duration * 1000).toISOString().substr(14, 5),
                author: data.uploader,
                formats: [
                  { quality: "720p", type: "mp4", label: "Download Video", url: bestVideo.url, direct: true },
                  { quality: "Audio", type: "mp3", label: "Download Audio", url: bestAudio?.url, isAudio: true, direct: true }
                ]
              });
              setLoading(false);
              return;
            }
          }
        } catch (err: any) {
          logToDebug(`Piped failed ${instance}: ${err.message}`);
        }
      }
    }

    // 3. Fallback to Vercel Backend
    logToDebug("All Client-Side APIs failed. Falling back to Server...");
    try {
      const response = await axios.get(`/api/info?url=${encodeURIComponent(cleanUrl)}`);
      setVideoInfo(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.details || err.response?.data?.error || "Could not load video. Check the link.";
      setError(errorMessage);
      logToDebug(`Server Error: ${errorMessage}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format: any) => {
    try {
      setDownloading(true);
      setProgress(10);
      setStatus("Starting...");

      // If direct Cobalt/Piped URL, download directly
      if (format.direct) {
        const link = document.createElement('a');
        link.href = format.url;
        link.target = '_blank';
        link.download = videoInfo.title || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setDownloading(false);
        setProgress(100);
        setTimeout(() => setProgress(0), 1000);
        return;
      }

      // Existing Server Logic
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
            setStatus("Downloading...");
            setProgress((old) => (old < 90 ? old + 5 : old));
          }
        }
      });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = blobUrl;
      const filename = `download.${format.type}`;
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      setStatus("Complete!");
      setTimeout(() => setDownloading(false), 2000);

    } catch (err) {
      setError("Download failed. Please try again.");
      console.error(err);
      setStatus("Failed");
      setDownloading(false);
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

        {/* Debug Console */}
        {loading || debugLogs.length > 0 ? (
          <div className="mb-4 p-3 bg-black/40 rounded-lg border border-white/5 max-h-40 overflow-y-auto font-mono text-[10px]">
            <p className="text-gray-500 mb-1 sticky top-0 bg-black/40 backdrop-blur w-full">System Logs:</p>
            {debugLogs.map((log, i) => (
              <div key={i} className={`mb-1 ${log.includes("Success") ? "text-green-400" : log.includes("Failed") || log.includes("Error") ? "text-red-400" : "text-blue-300"}`}>
                {log}
              </div>
            ))}
          </div>
        ) : null}

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
