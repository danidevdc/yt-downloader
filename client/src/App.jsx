import React, { useState } from 'react';
import { Download, Loader2, Youtube, Music, Video, Settings } from 'lucide-react';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [backendUrl, setBackendUrl] = useState(import.meta.env.PROD ? 'https://yt-downloader-backend-vrx7.onrender.com' : 'http://localhost:3001');
  const [showSettings, setShowSettings] = useState(false);

  const fetchInfo = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/info?url=${encodeURIComponent(url)}`);
      if (!response.ok) throw new Error('Failed to fetch info');
      const data = await response.json();
      setVideoInfo(data);
    } catch (error) {
      console.error(error);
      alert('Error fetching video info. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (format) => {
    if (!url) return;
    // Trigger download by opening in new window/tab or setting window.location
    // Using window.location.href works for attachments
    window.location.href = `${backendUrl}/api/download?url=${encodeURIComponent(url)}&format=${format}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 text-white font-sans flex flex-col items-center justify-center p-4">

      {/* Header */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Youtube className="w-12 h-12 text-red-500" />
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-purple-500">
            YT Downloader
          </h1>
        </div>
        <p className="text-gray-400">Download high-quality videos and audio instantly</p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-2xl border border-white/10 relative">

        {/* Settings Toggle */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-4 bg-black/20 rounded-xl border border-white/5">
            <label className="block text-xs text-gray-400 mb-1">Backend URL</label>
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              placeholder="http://localhost:3001"
            />
          </div>
        )}

        {/* Input Area */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube URL here..."
            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          />
          <button
            onClick={fetchInfo}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
          </button>
        </div>

        {/* Video Info & Download Options */}
        {videoInfo && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative aspect-video rounded-xl overflow-hidden mb-4 shadow-lg group bg-black">
              <img
                src={videoInfo.thumbnail || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop'}
                alt={videoInfo.title || 'YouTube Video'}
                className="w-full h-full object-cover opacity-90"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                <h3 className="font-semibold line-clamp-2 text-sm text-white">
                  {videoInfo.title || 'Video Found (No Title Available)'}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDownload('mp4')}
                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 transition-all hover:scale-[1.02] active:scale-95"
              >
                <Video className="w-5 h-5 text-blue-400" />
                <div className="text-left">
                  <div className="text-sm font-medium">Video</div>
                  <div className="text-xs text-gray-400">MP4 Format</div>
                </div>
              </button>

              <button
                onClick={() => handleDownload('mp3')}
                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 transition-all hover:scale-[1.02] active:scale-95"
              >
                <Music className="w-5 h-5 text-green-400" />
                <div className="text-left">
                  <div className="text-sm font-medium">Audio</div>
                  <div className="text-xs text-gray-400">MP3 Format</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {!videoInfo && !loading && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Paste a link to get started
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-xs text-gray-500">
        Powered by React & Node.js
      </div>
    </div>
  );
}

export default App;
