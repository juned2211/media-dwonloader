'use client';

import { useState } from "react";
import { Search, Download, Youtube, Loader2, Music, Video, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  // List of public Cobalt instances to try (Client-side to bypass Vercel IP block)
  const COBALT_INSTANCES = [
    'https://api.cobalt.tools',
    'https://cobalt.canine.tools',
    'https://cobalt.meowing.de',
    'https://cobalt.xyx.host',
    'https://cobalt.synn.cc',
    'https://api.server.social',
    // Fallbacks
    'https://cobalt.kwiatekmiki.pl',
    'https://cobalt.noway.cc',
    'https://cobalt.defnot001.com',
    'https://cobalt.darkness.services',
    'https://cobalt.femboy.beauty',
    'https://dl.khub.net'
  ];

  const handleSearch = async () => {
    if (!url) return;
    setLoading(true);
    setError("");
    setVideoInfo(null);

    // Try Client-Side Cobalt first for YouTube (Bypasses Vercel)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      console.log("Attempting Client-Side Cobalt fetch...");
      for (const instance of COBALT_INSTANCES) {
        try {
          console.log(`Trying ${instance}...`);
          // Try v10 API
          const response = await axios.post(`${instance}/`, {
            url: url,
            vQuality: "720",
            filenamePattern: "basic"
          }, {
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
          });

          const data = response.data;
          if (data && (data.url || data.status === 'stream' || data.status === 'redirect' || data.status === 'picker')) {
            console.log("Cobalt fetch success!", data);

            // Map Cobalt response to our app's format
            // If picker, we might need more logic, but basic implementation:
            const videoUrl = data.url || (data.picker && data.picker[0]?.url);

            if (videoUrl) {
              setVideoInfo({
                title: data.filename || "Video Found",
                thumbnail: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop", // Placeholder or fetch actual thumb if available
                duration: "Unknown",
                author: "YouTube",
                formats: [
                  { quality: "720p", type: "mp4", label: "Download MP4", url: videoUrl, direct: true },
                  { quality: "Audio", type: "mp3", label: "Download Audio", url: videoUrl, isAudio: true, direct: true }
                ]
              });
              setLoading(false);
              return; // Success! Stop here.
            }
          }
        } catch (err) {
          console.log(`Failed ${instance}`);
          // Continue to next instance
        }
      }
      console.log("All Client-Side Cobalt instances failed. Falling back to Server...");
      // If we are here, client-side failed. Fallback to server below.
      // But server is likely blocked too. We might want to show specific error.
    }

    // Fallback to our Vercel Backend (Original Logic)
    try {
      const response = await axios.get(`/api/info?url=${encodeURIComponent(url)}`);
      setVideoInfo(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.details || err.response?.data?.error || "Could not load video. Server might be blocked by YouTube.";
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format: any) => {
    try {
      setDownloading(true);
      setProgress(10);

      // If direct Cobalt URL, download directly
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
      const response = await fetch(`/api/download?url=${encodeURIComponent(url)}&type=${format.type}&quality=${format.quality}`);
      if (!response.ok) throw new Error('Download failed');

      const reader = response.body?.getReader();
      const contentLength = +response.headers.get('Content-Length')!;
      let receivedLength = 0;

      const chunks = [];
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        setProgress(Math.round((receivedLength / contentLength) * 100));
      }

      const blob = new Blob(chunks);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${videoInfo.title}.${format.type}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      setDownloading(false);
      setTimeout(() => setProgress(0), 2000);
    } catch (err) {
      setError("Download failed. Please try again.");
      console.error(err);
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] p-4 text-center space-y-8">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4 max-w-2xl"
      >
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          MediaLoader
        </h1>
        <p className="text-xl text-gray-400">
          Download video & audio in seconds
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-xl space-y-4"
      >
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-xl blur-xl group-hover:blur-2xl transition-all" />
          <div className="relative flex items-center bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl">
            <Search className="ml-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Paste YouTube, TikTok, Instagram link..."
              className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 p-3"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !url}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Start"}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {videoInfo && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="w-full max-w-xl"
          >
            <div className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-white/5 flex gap-6 items-start">
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="w-32 h-24 object-cover rounded-lg shadow-lg bg-gray-800"
                />
                <div className="text-left space-y-2 flex-1">
                  <h3 className="font-semibold text-lg line-clamp-2 leading-tight">{videoInfo.title}</h3>
                  <div className="flex gap-4 text-sm text-gray-400">
                    <span>{videoInfo.duration}</span>
                    <span>•</span>
                    <span>{videoInfo.author}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-black/20 space-y-3">
                {videoInfo.formats.map((format: any, index: number) => (
                  <div key={index} className="flex items-center justify-between bg-white/5 hover:bg-white/10 p-3 rounded-lg transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${format.isAudio ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                        {format.isAudio ? <Music className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{format.label}</p>
                        <p className="text-xs text-gray-500">{format.quality} • {format.type.toUpperCase()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(format)}
                      disabled={downloading}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <Download className="w-5 h-5 text-gray-400 group-hover:text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Modal */}
      <AnimatePresence>
        {downloading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-gray-900 border border-white/10 p-8 rounded-2xl w-full max-w-sm text-center space-y-6 shadow-2xl"
            >
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-cyan-400" />
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Downloading...</h3>
                <p className="text-gray-400 text-sm">Please wait while we process your media</p>
              </div>

              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 font-mono">{progress}%</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
