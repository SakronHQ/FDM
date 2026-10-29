import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  Plus,
  Play,
  Pause,
  Trash2,
  FolderOpen,
  FileText,
  Settings,
  Film,
  Music,
  Archive,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowDownCircle,
  Search,
  ExternalLink,
  Minimize2,
  Square,
  X,
  Gauge,
  Sparkles
} from 'lucide-react';
import {
  DownloadItem,
  DownloadCategory,
  ConnectionPreset,
  FdmSettings,
  VideoMetadata,
  formatBytes,
  formatSpeed,
  formatEta
} from '@fdm/shared';

export default function App() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<DownloadCategory | 'active' | 'completed' | 'paused' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ activeCount: 0, totalSpeed: 0 });
  const [settings, setSettings] = useState<FdmSettings | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Add Download Form State
  const [newUrl, setNewUrl] = useState('');
  const [newFilename, setNewFilename] = useState('');
  const [newDestination, setNewDestination] = useState('');
  const [newPreset, setNewPreset] = useState<ConnectionPreset>('high_speed');

  // Video Downloader Form State
  const [videoUrl, setVideoUrl] = useState('');
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState('');

  // Initial load & IPC event listeners
  useEffect(() => {
    window.fdm?.getDownloads().then(setDownloads);
    window.fdm?.getSettings().then((s) => {
      setSettings(s);
      setNewDestination(s.defaultDownloadDir);
      setNewPreset(s.connectionPreset);
    });

    const unsubAdd = window.fdm?.onDownloadAdded((item) => {
      setDownloads((prev) => [item, ...prev.filter((d) => d.id !== item.id)]);
    });

    const unsubUpdate = window.fdm?.onDownloadUpdated((item) => {
      setDownloads((prev) => {
        if (item.status === 'removed') {
          return prev.filter((d) => d.id !== item.id);
        }
        return prev.map((d) => (d.id === item.id ? item : d));
      });
    });

    const unsubStats = window.fdm?.onStatsUpdated(setStats);

    return () => {
      unsubAdd?.();
      unsubUpdate?.();
      unsubStats?.();
    };
  }, []);

  // Filtered downloads
  const filteredDownloads = useMemo(() => {
    return downloads.filter((d) => {
      // Category filter
      if (activeCategory === 'active' && d.status !== 'active') return false;
      if (activeCategory === 'completed' && d.status !== 'complete') return false;
      if (activeCategory === 'paused' && d.status !== 'paused') return false;
      if (activeCategory === 'failed' && d.status !== 'error') return false;
      if (['video', 'audio', 'document', 'archive', 'program'].includes(activeCategory)) {
        if (d.category !== activeCategory) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return d.filename.toLowerCase().includes(q) || d.url.toLowerCase().includes(q);
      }
      return true;
    });
  }, [downloads, activeCategory, searchQuery]);

  // Actions
  const handleStartSelected = async () => {
    if (!selectedId) return;
    await window.fdm.resumeDownload(selectedId);
  };

  const handlePauseSelected = async () => {
    if (!selectedId) return;
    await window.fdm.pauseDownload(selectedId);
  };

  const handleDeleteSelected = async (deleteFile = false) => {
    if (!selectedId) return;
    await window.fdm.cancelDownload(selectedId, deleteFile);
    setSelectedId(null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    await window.fdm.addDownload({
      url: newUrl.trim(),
      filename: newFilename.trim() || undefined,
      destination: newDestination.trim() || undefined,
      preset: newPreset
    });

    setNewUrl('');
    setNewFilename('');
    setIsAddModalOpen(false);
  };

  const handleSelectFolder = async () => {
    const folder = await window.fdm.selectFolder();
    if (folder) {
      setNewDestination(folder);
    }
  };

  const handleAnalyzeVideo = async () => {
    if (!videoUrl.trim()) return;
    setIsVideoLoading(true);
    setVideoError('');
    try {
      const meta = await window.fdm.getVideoInfo(videoUrl.trim());
      setVideoMetadata(meta);
      if (meta.formats.length > 0) {
        setSelectedFormatId(meta.formats[0].formatId);
      }
    } catch (err: any) {
      setVideoError(err.message || 'Failed to analyze video');
    } finally {
      setIsVideoLoading(false);
    }
  };

  const handleDownloadVideoSubmit = async () => {
    if (!videoUrl.trim() || !selectedFormatId) return;
    await window.fdm.downloadVideo(videoUrl.trim(), selectedFormatId, videoMetadata?.title);
    setIsVideoModalOpen(false);
    setVideoUrl('');
    setVideoMetadata(null);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    await window.fdm.saveSettings(settings);
    setIsSettingsModalOpen(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans">
      {/* Title Bar */}
      <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-sky-600 flex items-center justify-center font-bold text-xs text-white">⚡</div>
          <span className="text-xs font-semibold tracking-wide text-slate-200">FDM — Free Download Manager</span>
          <span className="text-[10px] bg-slate-800 text-sky-400 font-mono px-1.5 py-0.5 rounded border border-slate-700">v1.0</span>
        </div>

        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button onClick={() => window.fdm?.minimizeWindow()} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200">
            <Minimize2 size={13} />
          </button>
          <button onClick={() => window.fdm?.maximizeWindow()} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200">
            <Square size={12} />
          </button>
          <button onClick={() => window.fdm?.closeWindow()} className="p-1.5 hover:bg-red-600 rounded text-slate-400 hover:text-white">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Main Toolbar */}
      <div className="h-14 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between px-4 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-semibold shadow-sm transition"
          >
            <Plus size={15} />
            <span>Add URL</span>
          </button>

          <button
            onClick={() => setIsVideoModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-xs font-semibold shadow-sm transition"
          >
            <Film size={15} />
            <span>Video Grabber</span>
          </button>

          <div className="h-6 w-px bg-slate-800 mx-1" />

          <button
            onClick={handleStartSelected}
            disabled={!selectedId}
            className="p-1.5 text-slate-300 hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-slate-300 rounded hover:bg-slate-800 transition"
            title="Resume Download"
          >
            <Play size={17} />
          </button>

          <button
            onClick={handlePauseSelected}
            disabled={!selectedId}
            className="p-1.5 text-slate-300 hover:text-amber-400 disabled:opacity-30 disabled:hover:text-slate-300 rounded hover:bg-slate-800 transition"
            title="Pause Download"
          >
            <Pause size={17} />
          </button>

          <button
            onClick={() => handleDeleteSelected(false)}
            disabled={!selectedId}
            className="p-1.5 text-slate-300 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-300 rounded hover:bg-slate-800 transition"
            title="Delete Download"
          >
            <Trash2 size={17} />
          </button>

          <div className="h-6 w-px bg-slate-800 mx-1" />

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition"
            title="Settings"
          >
            <Settings size={17} />
          </button>
        </div>

        {/* Global Live Stats */}
        <div className="flex items-center gap-4 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <ArrowDownCircle size={15} className="text-sky-400 animate-pulse" />
            <span className="text-xs font-mono font-medium text-slate-200">{formatSpeed(stats.totalSpeed)}</span>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <Gauge size={14} className="text-emerald-400" />
            <span className="text-xs text-slate-400">Active:</span>
            <span className="text-xs font-bold text-slate-200">{stats.activeCount}</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Categories */}
        <div className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-3 select-none">
          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-2">Downloads</div>
              <div className="space-y-0.5">
                {[
                  { id: 'all', label: 'All Downloads', icon: Layers, count: downloads.length },
                  { id: 'active', label: 'Downloading', icon: Download, count: downloads.filter(d => d.status === 'active').length },
                  { id: 'completed', label: 'Completed', icon: CheckCircle2, count: downloads.filter(d => d.status === 'complete').length },
                  { id: 'paused', label: 'Paused', icon: Pause, count: downloads.filter(d => d.status === 'paused').length },
                  { id: 'failed', label: 'Failed', icon: AlertCircle, count: downloads.filter(d => d.status === 'error').length }
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeCategory === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveCategory(item.id as any)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                        isActive ? 'bg-sky-600/20 text-sky-300 font-semibold border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={isActive ? 'text-sky-400' : 'text-slate-400'} />
                        <span>{item.label}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-800 text-slate-500'}`}>
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-2">Categories</div>
              <div className="space-y-0.5">
                {[
                  { id: 'video', label: 'Videos', icon: Film },
                  { id: 'audio', label: 'Audio', icon: Music },
                  { id: 'document', label: 'Documents', icon: FileText },
                  { id: 'archive', label: 'Compressed', icon: Archive },
                  { id: 'program', label: 'Programs', icon: Sparkles }
                ].map((item) => {
                  const Icon = item.icon;
                  const count = downloads.filter(d => d.category === item.id).length;
                  const isActive = activeCategory === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveCategory(item.id as any)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                        isActive ? 'bg-sky-600/20 text-sky-300 font-semibold border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={isActive ? 'text-sky-400' : 'text-slate-400'} />
                        <span>{item.label}</span>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.2 rounded-full">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Preset Selector */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Multi-Segment Preset</div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'balanced', label: '4x' },
                { id: 'high_speed', label: '8x' },
                { id: 'max_connections', label: '16x' }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    if (settings) {
                      const updated = { ...settings, connectionPreset: p.id as ConnectionPreset };
                      setSettings(updated);
                      window.fdm.saveSettings(updated);
                    }
                  }}
                  className={`py-1 text-[11px] font-mono font-bold rounded border transition ${
                    settings?.connectionPreset === p.id
                      ? 'bg-sky-600 border-sky-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Downloads Table View */}
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
          {/* Search bar */}
          <div className="h-10 bg-slate-900/50 border-b border-slate-800/80 px-4 flex items-center justify-between">
            <div className="relative w-72">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search file name or URL..."
                className="w-full bg-slate-900 border border-slate-800 text-xs rounded-md pl-8 pr-3 py-1 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing <span className="text-slate-300 font-semibold">{filteredDownloads.length}</span> downloads
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-slate-800 text-slate-400 font-semibold z-10">
                <tr>
                  <th className="py-2.5 px-3 w-8">#</th>
                  <th className="py-2.5 px-3">File Name</th>
                  <th className="py-2.5 px-3 w-28">Size</th>
                  <th className="py-2.5 px-3 w-48">Progress</th>
                  <th className="py-2.5 px-3 w-24">Speed</th>
                  <th className="py-2.5 px-3 w-20">ETA</th>
                  <th className="py-2.5 px-3 w-24">Status</th>
                  <th className="py-2.5 px-3 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredDownloads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-20 text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Download size={32} className="opacity-20" />
                        <span>No downloads in this section</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDownloads.map((item, idx) => {
                    const isSelected = selectedId === item.id;
                    const percent = item.totalLength > 0 ? Math.min(100, Math.round((item.completedLength / item.totalLength) * 100)) : 0;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-sky-900/20 border-l-2 border-sky-500' : 'hover:bg-slate-900/60'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-200 max-w-xs truncate" title={item.filename}>
                          <div className="flex items-center gap-2">
                            <span className="text-sky-400">{item.isMediaMuxing ? '🎬' : '📄'}</span>
                            <span className="truncate">{item.filename}</span>
                          </div>
                          {item.errorMessage && (
                            <div className="text-[10px] text-rose-400 truncate max-w-xs mt-0.5" title={item.errorMessage}>
                              {item.errorMessage}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono">
                          {item.isMediaMuxing
                            ? `${item.completedLength}%`
                            : `${formatBytes(item.completedLength)} / ${item.totalLength > 0 ? formatBytes(item.totalLength) : '--'}`}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="space-y-1">
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 rounded-full ${
                                  item.status === 'complete'
                                    ? 'bg-emerald-500'
                                    : item.status === 'error'
                                    ? 'bg-rose-500'
                                    : item.status === 'paused'
                                    ? 'bg-amber-500'
                                    : 'bg-gradient-to-r from-sky-500 to-indigo-500'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                              <span>{percent}%</span>
                              <span>{item.isMediaMuxing ? 'Video Stream' : `${item.connections} conns`}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-mono">
                          {item.status === 'active' ? formatSpeed(item.downloadSpeed) : '--'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono">
                          {item.status === 'active' ? formatEta(item.eta) : '--'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${
                              item.status === 'active'
                                ? 'bg-sky-500/20 text-sky-400'
                                : item.status === 'complete'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : item.status === 'paused'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {item.status === 'active' ? (
                              <button
                                onClick={() => window.fdm.pauseDownload(item.id)}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-amber-400"
                                title="Pause"
                              >
                                <Pause size={13} />
                              </button>
                            ) : item.status === 'paused' || item.status === 'error' ? (
                              <button
                                onClick={() => window.fdm.resumeDownload(item.id)}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400"
                                title="Resume"
                              >
                                <Play size={13} />
                              </button>
                            ) : null}

                            <button
                              onClick={() => window.fdm.openFolder(item.id)}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-sky-400"
                              title="Open Folder"
                            >
                              <FolderOpen size={13} />
                            </button>

                            {item.status === 'complete' && (
                              <button
                                onClick={() => window.fdm.openFile(item.id)}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400"
                                title="Open File"
                              >
                                <ExternalLink size={13} />
                              </button>
                            )}

                            <button
                              onClick={() => window.fdm.cancelDownload(item.id, false)}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Download Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <Plus size={16} className="text-sky-400" />
                Add New Download
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Download Address (URL)</label>
                <input
                  type="text"
                  required
                  placeholder="https://example.com/file.zip"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Save As (Optional filename)</label>
                <input
                  type="text"
                  placeholder="auto-detect from server"
                  value={newFilename}
                  onChange={(e) => setNewFilename(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Save Folder</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDestination}
                    onChange={(e) => setNewDestination(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
                  >
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Multi-Connection Preset</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'balanced', label: 'Balanced (4 Conns)' },
                    { id: 'high_speed', label: 'High Speed (8 Conns)' },
                    { id: 'max_connections', label: 'Max (16 Conns)' }
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setNewPreset(p.id as ConnectionPreset)}
                      className={`py-2 text-xs font-medium rounded-lg border transition ${
                        newPreset === p.id
                          ? 'bg-sky-600/30 border-sky-500 text-sky-300 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
                >
                  Start Download
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Grabber Modal */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <Film size={16} className="text-purple-400" />
                Video Stream Grabber (yt-dlp + FFmpeg)
              </h3>
              <button onClick={() => setIsVideoModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Web Video URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <button
                    onClick={handleAnalyzeVideo}
                    disabled={isVideoLoading || !videoUrl.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow transition"
                  >
                    {isVideoLoading ? 'Analyzing...' : 'Fetch'}
                  </button>
                </div>
              </div>

              {videoError && <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800 p-2 rounded-lg">{videoError}</div>}

              {videoMetadata && (
                <div className="space-y-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex gap-3">
                    {videoMetadata.thumbnail && (
                      <img src={videoMetadata.thumbnail} alt="" className="w-24 h-16 object-cover rounded bg-slate-800 border border-slate-700" />
                    )}
                    <div className="flex-1 overflow-hidden">
                      <div className="text-xs font-semibold text-slate-200 truncate">{videoMetadata.title}</div>
                      <div className="text-[11px] text-slate-400 mt-1">Duration: {videoMetadata.duration ? `${Math.round(videoMetadata.duration)}s` : '--'}</div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Select Quality / Format</label>
                    <select
                      value={selectedFormatId}
                      onChange={(e) => setSelectedFormatId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      <option value="bestvideo+bestaudio/best">Best Available (Auto Merge via FFmpeg)</option>
                      {videoMetadata.formats.map((f) => (
                        <option key={f.formatId} value={f.formatId}>
                          {f.resolution || f.formatNote || f.ext} - {f.ext} {f.filesize ? `(${formatBytes(f.filesize)})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsVideoModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownloadVideoSubmit}
                  disabled={!videoMetadata}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-md transition"
                >
                  Download Video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && settings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <Settings size={16} className="text-slate-400" />
                FDM Configuration & Bandwidth Settings
              </h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Default Download Folder</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.defaultDownloadDir}
                    onChange={(e) => setSettings({ ...settings, defaultDownloadDir: e.target.value })}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const f = await window.fdm.selectFolder();
                      if (f) setSettings({ ...settings, defaultDownloadDir: f });
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
                  >
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Global Download Speed Limit (Bytes/s, 0 = unlimited)</label>
                <input
                  type="number"
                  value={settings.globalDownloadLimit}
                  onChange={(e) => setSettings({ ...settings, globalDownloadLimit: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.minimizeToTray}
                    onChange={(e) => setSettings({ ...settings, minimizeToTray: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-700"
                  />
                  <span>Minimize to System Tray when closing window</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

