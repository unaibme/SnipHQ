import React, { useState, useEffect } from 'react';
import { 
  Clipboard, 
  Check, 
  Plus, 
  Trash2, 
  Lock, 
  Wifi, 
  WifiOff, 
  Database, 
  X, 
  Info,
  ExternalLink,
  Search
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';

const INITIAL_SNIPPETS = [
  { id: '1', title: 'Work Email', description: 'john.doe@company.com', order_index: 0 },
  { id: '2', title: 'Phone Number', description: '+1 (555) 019-2834', order_index: 1 },
  { id: '3', title: 'Home Address', description: '123 Elm Street, Springfield, IL 62701', order_index: 2 },
  { id: '4', title: 'Quick Note', description: 'Pick up milk, eggs, and bread on the way back!', order_index: 3 },
];

export default function App() {
  const [snippets, setSnippets] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Connection and system states
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('local'); // 'local' | 'synced' | 'syncing' | 'error'
  const [showConfigInfo, setShowConfigInfo] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState(null); // null means adding new
  const [formData, setFormData] = useState({ title: '', description: '' });

  // Monitor network connection status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (isSupabaseConfigured) {
        triggerSync();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('local');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initial load
  useEffect(() => {
    // 1. First, load from localStorage immediately for fast visual boot
    const cached = localStorage.getItem('copier_snippets');
    let localData = [];
    if (cached) {
      try {
        localData = JSON.parse(cached);
        setSnippets(localData);
      } catch (e) {
        console.error('Error parsing cached snippets:', e);
      }
    } else {
      // Load initial dummy snippets if nothing cached
      setSnippets(INITIAL_SNIPPETS);
      localStorage.setItem('copier_snippets', JSON.stringify(INITIAL_SNIPPETS));
      localData = INITIAL_SNIPPETS;
    }

    // 2. If Supabase is configured, sync in background
    if (isSupabaseConfigured) {
      fetchFromSupabase(localData);
    } else {
      setSyncStatus('local');
    }
  }, []);

  // Sync / Fetch from Supabase
  const fetchFromSupabase = async (fallbackData = []) => {
    if (!isSupabaseConfigured) return;
    
    setSyncStatus('syncing');
    try {
      const { data, error } = await supabase
        .from('snippets')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setSnippets(data);
        localStorage.setItem('copier_snippets', JSON.stringify(data));
        setSyncStatus('synced');
      } else if (data && data.length === 0) {
        // Table is empty, seed it with fallbackData
        setSyncStatus('syncing');
        const uploadData = fallbackData.map((item, idx) => ({
          title: item.title,
          description: item.description,
          order_index: idx
        }));

        const { data: insertedData, error: insertError } = await supabase
          .from('snippets')
          .insert(uploadData)
          .select();

        if (insertError) throw insertError;
        
        if (insertedData) {
          setSnippets(insertedData);
          localStorage.setItem('copier_snippets', JSON.stringify(insertedData));
        }
        setSyncStatus('synced');
      }
    } catch (err) {
      console.error('Supabase fetch error, running offline/local:', err);
      setSyncStatus('error');
    }
  };

  const triggerSync = () => {
    fetchFromSupabase(snippets);
  };

  // Copy to Clipboard Action
  const handleCopy = async (snippet) => {
    try {
      await navigator.clipboard.writeText(snippet.description);
      setCopiedId(snippet.id);
      
      // Haptic feedback for mobile
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      // Show toast
      showToast(`Copied "${snippet.title}" to clipboard!`);

      // Reset card checkmark state after 1.5s
      setTimeout(() => {
        setCopiedId(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showToast('Copy failed. Please try again.');
    }
  };

  const showToast = (message) => {
    setToast(message);
    // Auto clear toast
    const timer = setTimeout(() => {
      setToast(null);
    }, 2000);
    return () => clearTimeout(timer);
  };

  // Delete Action (Now called from inside the Edit modal)
  const handleDelete = async (id) => {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this snippet?')) return;

    // Optimistically update local state & cache
    const updated = snippets.filter(item => item.id !== id);
    setSnippets(updated);
    localStorage.setItem('copier_snippets', JSON.stringify(updated));

    // Close Modal immediately
    setIsModalOpen(false);
    showToast('Snippet deleted');

    // Sync deletion to Supabase
    if (isSupabaseConfigured && isOnline) {
      try {
        const { error } = await supabase
          .from('snippets')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setSyncStatus('synced');
      } catch (err) {
        console.error('Failed to delete on Supabase:', err);
        setSyncStatus('error');
      }
    } else if (isSupabaseConfigured) {
      setSyncStatus('error'); // triggers offline warning sync indicator
    }
  };

  // Open Add Modal
  const openAddModal = () => {
    setEditingSnippet(null);
    setFormData({ title: '', description: '' });
    setIsModalOpen(true);
  };

  // Open Edit Modal (via double click)
  const openEditModal = (snippet) => {
    setEditingSnippet(snippet);
    setFormData({ title: snippet.title, description: snippet.description });
    setIsModalOpen(true);
  };

  // Handle Form Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Please fill out all fields.');
      return;
    }

    const { title, description } = formData;

    if (editingSnippet) {
      // Editing Mode
      const updatedId = editingSnippet.id;
      const updatedList = snippets.map(item => 
        item.id === updatedId ? { ...item, title, description } : item
      );

      setSnippets(updatedList);
      localStorage.setItem('copier_snippets', JSON.stringify(updatedList));
      setIsModalOpen(false);
      showToast('Snippet updated');

      if (isSupabaseConfigured && isOnline) {
        try {
          const { error } = await supabase
            .from('snippets')
            .update({ title, description })
            .eq('id', updatedId);

          if (error) throw error;
          setSyncStatus('synced');
        } catch (err) {
          console.error('Supabase update failed:', err);
          setSyncStatus('error');
        }
      } else if (isSupabaseConfigured) {
        setSyncStatus('error');
      }

    } else {
      // Adding Mode
      const tempId = crypto.randomUUID();
      const nextIndex = snippets.length > 0 
        ? Math.max(...snippets.map(s => s.order_index ?? 0)) + 1 
        : 0;

      const newSnippet = {
        id: tempId,
        title,
        description,
        order_index: nextIndex
      };

      const updatedList = [...snippets, newSnippet];
      setSnippets(updatedList);
      localStorage.setItem('copier_snippets', JSON.stringify(updatedList));
      setIsModalOpen(false);
      showToast('New snippet added');

      if (isSupabaseConfigured && isOnline) {
        try {
          const { data, error } = await supabase
            .from('snippets')
            .insert({
              title,
              description,
              order_index: nextIndex
            })
            .select();

          if (error) throw error;

          // Replace temp memory id with database id
          if (data && data[0]) {
            const syncedList = updatedList.map(item => 
              item.id === tempId ? data[0] : item
            );
            setSnippets(syncedList);
            localStorage.setItem('copier_snippets', JSON.stringify(syncedList));
          }
          setSyncStatus('synced');
        } catch (err) {
          console.error('Supabase insert failed:', err);
          setSyncStatus('error');
        }
      } else if (isSupabaseConfigured) {
        setSyncStatus('error');
      }
    }
  };

  // Filter snippets based on search input (matching EXCLUSIVELY with title)
  const filteredSnippets = snippets.filter((snippet) =>
    snippet.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-0 md:p-6 lg:p-10 font-sans antialiased overflow-x-hidden">
      
      {/* Responsive App Viewport Wrapper (Tablet/Windows floating mockup, Mobile Fullscreen) */}
      <div className="w-full min-h-screen md:min-h-0 md:h-[85vh] lg:h-[90vh] max-w-6xl bg-slate-900 md:rounded-3xl border border-transparent md:border-slate-800/80 flex flex-col justify-between shadow-2xl relative select-none overflow-hidden transition-all duration-300">
        
        {/* Top Header */}
        <header className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
              <Clipboard className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-base tracking-tight">Copier</h1>
          </div>

          {/* Sync & Settings status */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowConfigInfo(!showConfigInfo)}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
              title="Connection Info"
            >
              {isSupabaseConfigured ? (
                isOnline ? (
                  syncStatus === 'synced' ? (
                    <Wifi className="w-4 h-4 text-emerald-400" />
                  ) : syncStatus === 'syncing' ? (
                    <div className="w-4 h-4 border-2 border-t-transparent border-blue-400 rounded-full animate-spin" />
                  ) : (
                    <Wifi className="w-4 h-4 text-amber-400" /> // Synced error or connecting
                  )
                ) : (
                  <WifiOff className="w-4 h-4 text-rose-400" />
                )
              ) : (
                <Database className="w-4 h-4 text-slate-500" />
              )}
            </button>
          </div>
        </header>

        {/* Search Bar section (Strict Titles Search) */}
        <div className="px-5 py-3.5 border-b border-slate-800/60 bg-slate-950/30 flex-shrink-0">
          <div className="relative max-w-lg mx-auto">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search snippets by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-950/60 hover:bg-slate-950/90 focus:bg-slate-950 border border-slate-800 focus:border-blue-500/80 rounded-2xl text-sm placeholder-slate-500 text-slate-100 outline-none transition-all focus:ring-2 focus:ring-blue-500/10 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                title="Clear Search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Connection / Sync Banner Info Panel */}
        {showConfigInfo && (
          <div className="mx-5 mt-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl animate-fadeIn text-xs text-slate-300 space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-200">Database Connection Info</h3>
              <button onClick={() => setShowConfigInfo(false)}>
                <X className="w-4 h-4 hover:text-white" />
              </button>
            </div>
            <div className="space-y-1">
              <p className="flex justify-between">
                <span>Cloud Provider:</span>
                <span className="font-semibold text-blue-400">Supabase</span>
              </p>
              <p className="flex justify-between">
                <span>API Status:</span>
                <span className={isSupabaseConfigured ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                  {isSupabaseConfigured ? "Configured" : "Not Configured (Local)"}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Network State:</span>
                <span className="font-semibold flex items-center gap-1">
                  {isOnline ? (
                    <>Online <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span></>
                  ) : (
                    <>Offline (Caching on) <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span></>
                  )}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Local Storage sync:</span>
                <span className="text-emerald-400 font-semibold">Enabled</span>
              </p>
            </div>
            {!isSupabaseConfigured && (
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                To connect cloud sync across devices, populate your credentials in your <code className="bg-slate-800 text-slate-300 px-1 rounded font-mono">.env</code> file. Check <span className="font-semibold underline text-blue-400">supabase.md</span> for details.
              </div>
            )}
          </div>
        )}

        {/* Main Body (Adaptive scroll container) */}
        <main className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
          {snippets.length === 0 ? (
            /* Empty State: No snippets at all */
            <div className="h-full flex flex-col items-center justify-center text-center py-20 px-6 space-y-4">
              <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-full">
                <Clipboard className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <p className="font-bold text-slate-200">No Snippets Found</p>
                <p className="text-sm text-slate-400 mt-1 max-w-xs">
                  Click the "+" button in the bottom right corner to add your first snippet!
                </p>
              </div>
            </div>
          ) : filteredSnippets.length === 0 ? (
            /* Empty State: No search results */
            <div className="h-full flex flex-col items-center justify-center text-center py-20 px-6 space-y-3">
              <div className="p-3 bg-slate-800/30 rounded-full text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-200">No matching titles</p>
              <p className="text-sm text-slate-400 max-w-xs">
                No saved snippet titles match your search query for "<span className="text-blue-400 font-semibold font-mono">{searchQuery}</span>".
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-colors"
              >
                Clear Search Query
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quick Helper Badge */}
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">
                  {searchQuery ? `SEARCH RESULTS FOR "${searchQuery.toUpperCase()}"` : "SNIPPETS"}
                </p>
                <p className="text-xs text-slate-500 font-bold font-mono">
                  {filteredSnippets.length} {filteredSnippets.length === 1 ? 'item' : 'items'}
                </p>
              </div>

              {/* Grid Area: Extremely optimized, responsive spacing for Mobile (2cols), iPad (4cols), Windows Desktop (5-6cols) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                {filteredSnippets.map((snippet) => {
                  const isCopied = copiedId === snippet.id;
                  return (
                    <div
                      key={snippet.id}
                      onClick={() => handleCopy(snippet)}
                      onDoubleClick={() => openEditModal(snippet)}
                      className={`relative flex flex-col justify-between p-4 rounded-2xl border text-left transition-all duration-150 group overflow-hidden min-h-[135px] md:min-h-[145px] aspect-auto ${
                        isCopied
                          ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/30 scale-95 shadow-md'
                          : 'bg-slate-800/60 border-slate-800/80 active:scale-95 hover:bg-slate-800 hover:border-slate-700 md:hover:-translate-y-0.5 lg:hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/5 cursor-pointer shadow-sm active:border-blue-500/50'
                      }`}
                    >
                      {/* Copied highlight background wave */}
                      <div 
                        className={`absolute inset-0 bg-blue-500 transition-opacity duration-300 pointer-events-none ${
                          isCopied ? 'opacity-10' : 'opacity-0'
                        }`}
                      />

                      {/* Card Header (Title & Status icon) */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-[13px] md:text-[14px] tracking-tight text-slate-100 line-clamp-2 leading-snug">
                          {snippet.title}
                        </h3>
                        <div className={`flex-shrink-0 transition-all duration-200 ${
                          isCopied ? 'text-blue-400 scale-110' : 'text-slate-600'
                        }`}>
                          {isCopied ? (
                            <Check className="w-4 h-4 stroke-[3px]" />
                          ) : (
                            <Clipboard className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </div>

                      {/* Card Content (Snippet Preview) */}
                      <div className="mt-2.5 flex-1 flex flex-col justify-end">
                        <p className="text-[11px] md:text-[12px] text-slate-400 font-mono break-all line-clamp-3 leading-relaxed">
                          {snippet.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* Floating Add Plus Button (always accessible!) */}
        <button
          onClick={openAddModal}
          className="absolute bottom-20 right-6 md:bottom-24 md:right-8 p-4 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-full shadow-2xl shadow-blue-500/35 transition-all duration-150 z-40 flex items-center justify-center hover:scale-110 hover:rotate-90"
          title="Add New Card"
        >
          <Plus className="w-6 h-6 stroke-[3px]" />
        </button>

        {/* Footer Area with Pinned speed disclaimer (adapts width beautifully on tablets and laptops) */}
        <footer className="py-4 px-5 border-t border-slate-800 bg-slate-950/40 backdrop-blur-md sticky bottom-0 z-20 text-center">
          <p className="text-[11px] text-slate-500 font-medium">
            Designed for instantaneous copy speed. Installs locally as a standalone offline app.
          </p>
        </footer>

        {/* Global Bottom Toast Alert */}
        {toast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4.5 py-3 bg-blue-600 text-white text-xs font-semibold rounded-2xl shadow-xl border border-blue-400/30 flex items-center gap-2 z-50 animate-bounce">
            <Check className="w-4 h-4 stroke-[3px]" />
            <span>{toast}</span>
          </div>
        )}

        {/* Form Dialog Modal (Add/Edit Snippet) */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop blur */}
            <div 
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" 
              onClick={() => setIsModalOpen(false)}
            />
            
            {/* Form container */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-scaleUp">
              <div className="px-5 py-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
                <h2 className="font-bold text-slate-100">
                  {editingSnippet ? 'Edit Snippet' : 'Add New Snippet'}
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
                {/* Title field */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Snippet Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. My Phone Number"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    autoFocus
                  />
                </div>

                {/* Description field */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Value to Copy (Description)
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="e.g. +1 (555) 019-2834"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono resize-none"
                  />
                </div>

                {/* Save / Cancel buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 border border-slate-800 hover:bg-slate-850 hover:text-white text-slate-400 text-sm font-bold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/10 transition-colors"
                  >
                    Save Snippet
                  </button>
                </div>

                {/* Delete button (only rendered when editing an existing card) */}
                {editingSnippet && (
                  <div className="pt-2 border-t border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => handleDelete(editingSnippet.id)}
                      className="w-full py-3 bg-rose-950/20 hover:bg-rose-600 border border-rose-900/50 hover:border-rose-500 text-rose-400 hover:text-white text-sm font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-rose-950/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Snippet</span>
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
