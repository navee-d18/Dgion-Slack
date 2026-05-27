import React, { useState, useEffect, useRef } from 'react';
import { X, Hash, Lock, Search, MessageSquare, Briefcase, Mail, Settings, Trash2, Bell, HelpCircle, Copy, Check } from 'lucide-react';

// Firestore Search Queries
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, isConfigured } from '../firebase';

// Create Channel Modal
export function CreateChannelModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setName('');
      setDescription('');
      setIsPrivate(false);
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  const handleNameChange = (e) => {
    const rawVal = e.target.value;
    const formattedVal = rawVal
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '');
    
    if (formattedVal.length <= 80) {
      setName(formattedVal);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Channel name is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onCreate(name, description, isPrivate);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create channel.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-100" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-[3px]" onClick={() => !loading && onClose()}></div>
      
      <div className="relative w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-slack-modal border border-[#E8E8E8] transition-all duration-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8]">
          <h2 className="text-[17px] font-extrabold text-[#1D1C1D] tracking-tight">
            Create a channel
          </h2>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
 
        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 font-sans">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}
 
          <div>
            <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
              Name
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">
                {isPrivate ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="e.g. qa-discussions"
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium"
                required
                disabled={loading}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Channels are where your team communicates. They’re best when organized around a topic.
            </p>
          </div>
 
          <div>
            <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
              Description <span className="text-xs text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium"
              disabled={loading}
            />
          </div>
 
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-[#E8E8E8]">
            <div>
              <span className="block text-sm font-bold text-[#1D1C1D]">
                Make private
              </span>
              <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                When a channel is private, it can only be viewed or joined by invitation.
              </span>
            </div>
            <button
              type="button"
              onClick={() => !loading && setIsPrivate(!isPrivate)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isPrivate ? 'bg-[#1164A3]' : 'bg-slate-200'
              }`}
              role="switch"
              aria-checked={isPrivate}
              disabled={loading}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isPrivate ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
 
          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 select-none">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              disabled={loading}
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />}
              <span>{loading ? 'Creating...' : 'Create'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create Workspace Modal
export function CreateWorkspaceModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setName('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onCreate(name);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create workspace.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-100" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-[3px]" onClick={() => !loading && onClose()}></div>
      
      <div className="relative w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-slack-modal border border-[#E8E8E8] transition-all duration-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8]">
          <h2 className="text-[17px] font-extrabold text-[#1D1C1D] tracking-tight">
            Create a workspace
          </h2>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 font-sans">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
              Workspace Name
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">
                <Briefcase className="w-4 h-4" />
              </span>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="e.g. Design Studio"
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium"
                required
                disabled={loading}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
              Workspaces are shared hubs where channels reside and teams sync up.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 select-none">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              disabled={loading}
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />}
              <span>{loading ? 'Creating...' : 'Create Workspace'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Search Modal
export function SearchModal({ isOpen, onClose, activeWorkspace, allMessages, onJumpTo }) {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState({ channels: [], messages: [] });
  const [cloudMessages, setCloudMessages] = useState([]);
  const inputRef = useRef(null);

  // 1. Live Real-time Firestore Search observer (triggers only when modal is open!)
  useEffect(() => {
    if (!isOpen || !isConfigured || !activeWorkspace) {
      setCloudMessages([]);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('workspaceId', '==', activeWorkspace.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setCloudMessages(msgs);
    }, (err) => {
      console.warn('Search query error:', err);
    });

    return () => unsubscribe();
  }, [isOpen, activeWorkspace?.id]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQueryText('');
      setResults({ channels: [], messages: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Execute fuzzy match queries
  useEffect(() => {
    if (!queryText.trim() || !activeWorkspace) {
      setResults({ channels: [], messages: [] });
      return;
    }

    const cleanQuery = queryText.toLowerCase();

    // 1. Search Channels
    const matchingChannels = (activeWorkspace.channels || []).filter(ch => 
      ch.name.toLowerCase().includes(cleanQuery)
    );

    // 2. Search DMs
    const matchingDms = (activeWorkspace.dms || []).filter(dm => 
      dm.name.toLowerCase().includes(cleanQuery)
    );

    const mergedChannels = [
      ...matchingChannels.map(ch => ({ ...ch, type: 'channel' })),
      ...matchingDms.map(dm => ({ ...dm, type: 'dm' }))
    ];

    // 3. Search Messages
    const matchingMessages = [];
    
    if (isConfigured) {
      // Real Cloud Search: search in our live workspaces messages document logs
      cloudMessages.forEach(msg => {
        if (msg.content.toLowerCase().includes(cleanQuery)) {
          const isDm = activeWorkspace.dms.some(d => d.id === msg.channelId);
          const isPrivate = activeWorkspace.channels.find(c => c.id === msg.channelId)?.isPrivate || false;
          
          const destName = 
            activeWorkspace.channels.find(c => c.id === msg.channelId)?.name ||
            activeWorkspace.dms.find(d => d.id === msg.channelId)?.name || 
            msg.channelId;

          matchingMessages.push({
            ...msg,
            destinationId: msg.channelId,
            destinationName: destName,
            isPrivate,
            isDm
          });
        }
      });
    } else {
      // Emulator Search fallback
      Object.entries(allMessages).forEach(([channelKey, msgList]) => {
        if (channelKey.startsWith(`${activeWorkspace.id}-`)) {
          const destId = channelKey.replace(`${activeWorkspace.id}-`, '');
          
          const destName = 
            activeWorkspace.channels.find(c => c.id === destId)?.name ||
            activeWorkspace.dms.find(d => d.id === destId)?.name || 
            destId;
          
          const isPrivate = activeWorkspace.channels.find(c => c.id === destId)?.isPrivate || false;
          const isDm = activeWorkspace.dms.some(d => d.id === destId);

          msgList.forEach(msg => {
            if (msg.content.toLowerCase().includes(cleanQuery)) {
              matchingMessages.push({
                ...msg,
                destinationId: destId,
                destinationName: destName,
                isPrivate,
                isDm
              });
            }
          });
        }
      });
    }

    setResults({
      channels: mergedChannels.slice(0, 5),
      messages: matchingMessages.slice(0, 10)
    });
  }, [queryText, activeWorkspace, allMessages, cloudMessages]);

  if (!isOpen) return null;

  const handleSelectResult = (destId, isDm, messageId = null) => {
    onJumpTo(destId, isDm, messageId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-10 pt-20 animate-in fade-in duration-100" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-[3px]" onClick={onClose}></div>

      <div className="relative w-full max-w-2xl overflow-hidden bg-white rounded-2xl shadow-slack-modal border border-[#E8E8E8] flex flex-col max-h-[80vh] transition-all duration-200 animate-in slide-in-from-top-4">
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E8E8E8] bg-slate-50">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder={`Search channels, people or messages in ${activeWorkspace.name}...`}
            className="w-full bg-transparent text-[#1D1C1D] placeholder-slate-400 text-[15px] focus:outline-none font-medium font-sans"
            aria-label="Search"
          />
          {queryText && (
            <button 
              type="button"
              onClick={() => setQueryText('')}
              className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] text-slate-400 bg-slate-200 border border-slate-300 rounded px-1.5 py-0.5 shrink-0 hidden sm:inline font-bold select-none">
            ESC
          </span>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-white">
          {!queryText.trim() ? (
            <div className="py-8 text-center text-slate-400 font-sans select-none animate-in fade-in">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
              <p className="text-sm font-bold">Search anything in this workspace</p>
              <p className="text-xs mt-1">Try typing a channel name, user name, or message keyword.</p>
            </div>
          ) : results.channels.length === 0 && results.messages.length === 0 ? (
            <div className="py-8 text-center text-slate-400 font-sans select-none animate-in fade-in">
              <p className="text-sm font-bold">No results found for <span className="text-[#1D1C1D]">"{queryText}"</span></p>
              <p className="text-xs mt-1">Double check spelling or try a different term.</p>
            </div>
          ) : (
            <>
              {results.channels.length > 0 && (
                <div className="animate-in fade-in duration-100">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-2 select-none">
                    Channels & People
                  </h3>
                  <div className="space-y-0.5">
                    {results.channels.map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleSelectResult(item.id, item.type === 'dm')}
                        className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-[#1164A3]/10 text-left rounded-md group text-[#1D1C1D] font-bold text-sm transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          {item.type === 'channel' ? (
                            item.isPrivate ? (
                              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                            ) : (
                              <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                            )
                          ) : (
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              item.status === 'online' ? 'bg-[#2BAC76]' : 'bg-slate-300'
                            }`} />
                          )}
                          <span className="group-hover:text-[#1164A3] transition-colors">{item.name}</span>
                        </div>
                        <span className="text-xs text-[#1164A3] opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                          Jump to →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.messages.length > 0 && (
                <div className="animate-in fade-in duration-100">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-2 select-none">
                    Messages ({results.messages.length})
                  </h3>
                  <div className="space-y-1.5">
                    {results.messages.map(msg => (
                      <button
                        key={msg.id}
                        onClick={() => handleSelectResult(msg.destinationId, msg.isDm, msg.id)}
                        className="w-full p-3.5 hover:bg-slate-50 text-left border border-slate-100 rounded-lg group hover:border-[#1164A3]/30 transition-all duration-100 space-y-1 bg-white shadow-sm"
                      >
                        <div className="flex items-center justify-between select-none">
                          <span className="text-xs font-extrabold text-[#1D1C1D]">
                            {msg.senderName}
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold">
                            <span className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-500 font-sans">
                              {msg.isDm ? (
                                <MessageSquare className="w-3 h-3" />
                              ) : msg.isPrivate ? (
                                <Lock className="w-3 h-3" />
                              ) : (
                                <Hash className="w-3 h-3" />
                              )}
                              {msg.destinationName}
                            </span>
                            <span>{msg.timestamp}</span>
                          </div>
                        </div>
                        <p className="text-[14px] text-slate-700 leading-relaxed line-clamp-2 pl-0.5 break-words">
                          {(() => {
                            const text = msg.content;
                            const idx = text.toLowerCase().indexOf(queryText.toLowerCase());
                            if (idx === -1) return text;
                            const before = text.substring(0, idx);
                            const match = text.substring(idx, idx + queryText.length);
                            const after = text.substring(idx + queryText.length);
                            return (
                              <>
                                {before}
                                <mark className="bg-yellow-100 text-yellow-800 font-bold px-0.5 rounded border border-yellow-200">
                                  {match}
                                </mark>
                                {after}
                              </>
                            );
                          })()}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-[#E8E8E8] text-xs text-slate-500 flex items-center justify-between hidden sm:flex shrink-0 font-medium select-none">
          <span>Fuzzy search indexes all conversations in this workspace.</span>
          <span className="flex items-center gap-1 font-semibold">
            <span>Press</span>
            <kbd className="bg-white border rounded px-1.5 py-0.5 text-[10px] font-bold shadow-sm">↵</kbd>
            <span>to jump directly</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// Invite Workspace Modal
export function InviteWorkspaceModal({ isOpen, onClose, onInvite, activeWorkspace }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setEmail('');
      setError('');
      setSuccess('');
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await onInvite(targetEmail);
      if (res && res.success) {
        setSuccess(res.message || 'User invited successfully!');
        setTimeout(() => onClose(), 1500);
      } else {
        setError(res?.message || 'Failed to invite user.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-100" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-[3px]" onClick={onClose}></div>
      
      <div className="relative w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-slack-modal border border-[#E8E8E8] transition-all duration-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8]">
          <h2 className="text-[17px] font-extrabold text-[#1D1C1D] tracking-tight">
            Invite to {activeWorkspace?.name || 'workspace'}
          </h2>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 font-sans">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg leading-normal flex items-start gap-2.5 animate-in shake duration-200">
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold rounded-lg leading-normal flex items-start gap-2.5 animate-in fade-in duration-200">
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="name@gmail.com"
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium"
                required
                disabled={loading || success}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
              Enter the email address of a registered user to add them here.
            </p>
          </div>

          <div className="h-[1px] bg-slate-100 my-2" />

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <span className="block text-[11px] font-bold text-[#1D1C1D] uppercase tracking-wider select-none">
              Or share Workspace ID
            </span>
            <span className="block text-xs text-slate-500 leading-relaxed">
              Your team can join this workspace directly by entering this unique Workspace ID in their "Join Workspace" panel:
            </span>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                readOnly
                value={activeWorkspace?.id || ''}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-600 font-bold select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeWorkspace?.id || '');
                  alert(`Workspace ID copied! Share this with your team:\n\n${activeWorkspace?.id}`);
                }}
                className="px-3 py-1.5 bg-[#1164A3] hover:bg-[#1164A3]/90 text-white text-xs font-bold rounded-lg transition-all active:scale-[0.98] cursor-pointer shrink-0"
              >
                Copy ID
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 select-none">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              disabled={loading || success}
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />}
              <span>{loading ? 'Inviting...' : 'Invite'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit/Delete Channel Modal
export function EditDeleteChannelModal({ isOpen, onClose, channel, onEdit, onDelete }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && channel) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setName(channel.name);
      setDescription(channel.description || '');
      setError('');
      setLoading(false);
      setShowConfirmDelete(false);
      setConfirmName('');
    }
  }, [isOpen, channel]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, loading]);

  if (!isOpen || !channel) return null;

  const handleNameChange = (e) => {
    const rawVal = e.target.value;
    const formattedVal = rawVal
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '');
    
    if (formattedVal.length <= 80) {
      setName(formattedVal);
      setError('');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Channel name is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onEdit(channel.id, name, description);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update channel.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    if (confirmName !== channel.name) {
      setError('Please type the channel name correctly to confirm deletion.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onDelete(channel.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete channel.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-100" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-[3px]" onClick={() => !loading && onClose()}></div>
      
      <div className="relative w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-slack-modal border border-[#E8E8E8] transition-all duration-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8]">
          <h2 className="text-[17px] font-extrabold text-[#1D1C1D] tracking-tight">
            {showConfirmDelete ? 'Delete channel' : `Channel settings: #${channel.name}`}
          </h2>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!showConfirmDelete ? (
          <form onSubmit={handleSave} className="p-6 space-y-4 font-sans">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
                Name
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400">
                  <Hash className="w-4 h-4" />
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium"
                  required
                  disabled={loading || channel.name === 'general' || channel.name === 'random'}
                />
              </div>
              {channel.name === 'general' || channel.name === 'random' ? (
                <p className="mt-1 text-[11px] text-amber-600 font-medium">
                  System default channels cannot be renamed or deleted.
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Names must be lowercase, without spaces or special characters.
                </p>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium"
                disabled={loading}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2 select-none border-t border-[#E8E8E8] mt-4">
              {channel.name !== 'general' && channel.name !== 'random' ? (
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors cursor-pointer"
                  disabled={loading}
                >
                  Delete channel
                </button>
              ) : (
                <div />
              )}
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  disabled={loading}
                >
                  {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />}
                  <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleDeleteSubmit} className="p-6 space-y-4 font-sans">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
                <span>{error}</span>
              </div>
            )}

            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 space-y-2">
              <span className="block text-sm font-bold leading-normal">Are you absolutely sure?</span>
              <span className="block text-xs leading-relaxed opacity-90">
                This action is permanent and cannot be undone. This will permanently delete the channel <b>#{channel.name}</b> and all associated messages.
              </span>
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-2 select-none">
                Type <span className="font-mono bg-slate-100 border rounded px-1.5 py-0.5 text-slate-700 font-bold select-all">{channel.name}</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => { setConfirmName(e.target.value); setError(''); }}
                placeholder={channel.name}
                className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 font-medium font-mono"
                required
                disabled={loading}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8] mt-4 select-none">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
                disabled={loading}
              >
                Go Back
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                disabled={loading || confirmName !== channel.name}
              >
                {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />}
                <span>{loading ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Join Workspace Modal
export function JoinWorkspaceModal({ isOpen, onClose, onJoin }) {
  const [workspaceId, setWorkspaceId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setWorkspaceId('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanId = workspaceId.trim();
    if (!cleanId) {
      setError('Workspace ID is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onJoin(cleanId);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to join workspace.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-100" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-[3px]" onClick={() => !loading && onClose()}></div>
      
      <div className="relative w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-slack-modal border border-[#E8E8E8] transition-all duration-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8]">
          <h2 className="text-[17px] font-extrabold text-[#1D1C1D] tracking-tight">
            Join a workspace
          </h2>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 font-sans">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
              Workspace ID
            </label>
            <input
              ref={inputRef}
              type="text"
              value={workspaceId}
              onChange={(e) => { setWorkspaceId(e.target.value); setError(''); }}
              placeholder="e.g. acme-seed-workspace-id"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium"
              required
              disabled={loading}
            />
            <p className="mt-1.5 text-[11px] text-slate-500">
              Ask the workspace creator or administrator for their Workspace ID to join.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 select-none border-t border-[#E8E8E8] mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              disabled={loading}
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />}
              <span>{loading ? 'Joining...' : 'Join Workspace'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Workspace Settings Modal
export function WorkspaceSettingsModal({ isOpen, onClose, workspace, currentUser, onUpdate, onDelete }) {
  const [name, setName] = useState('');
  const [iconText, setIconText] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && workspace) {
      setName(workspace.name || '');
      setIconText(workspace.iconText || '');
      setConfirmName('');
      setShowConfirmDelete(false);
      setError('');
      setLoading(false);
      setCopied(false);
    }
  }, [isOpen, workspace]);

  if (!isOpen || !workspace) return null;

  const isCreator = workspace.createdBy === currentUser?.uid;

  const handleCopy = () => {
    navigator.clipboard.writeText(workspace.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name cannot be empty.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onUpdate(workspace.id, name, iconText || name.substring(0, 2));
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update workspace.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (confirmName !== workspace.name) {
      setError('Workspace name does not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onDelete(workspace.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete workspace.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-100" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-[3px]" onClick={() => !loading && onClose()}></div>
      
      <div className="relative w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-slack-modal border border-[#E8E8E8] transition-all duration-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8]">
          <h2 className="text-[17px] font-extrabold text-[#1D1C1D] tracking-tight">
            {showConfirmDelete ? 'Delete Workspace' : 'Workspace Settings'}
          </h2>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!showConfirmDelete ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 font-sans">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2">
                <span>{error}</span>
              </div>
            )}

            {isCreator && (
              <div>
                <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
                  Workspace ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={workspace.id}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-500 font-bold select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors cursor-pointer text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
                Workspace Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium disabled:bg-slate-50 disabled:text-slate-500"
                required
                disabled={loading || !isCreator}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
                  Icon Initials
                </label>
                <input
                  type="text"
                  value={iconText}
                  onChange={(e) => setIconText(e.target.value.substring(0, 2).toUpperCase())}
                  placeholder={name.substring(0, 2).toUpperCase()}
                  maxLength={2}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium text-center font-bold disabled:bg-slate-50 disabled:text-slate-500"
                  disabled={loading || !isCreator}
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-1.5 select-none">
                  Member Count
                </label>
                <div className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-500 text-center select-none">
                  {workspace.members?.length || 1} members
                </div>
              </div>
            </div>

            {/* Non-Creator Settings Notice */}
            {!isCreator && (
              <div className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-xl text-amber-700 text-xs font-semibold flex items-start gap-2.5 leading-relaxed mt-2 animate-in fade-in select-none">
                <span className="mt-0.5">ℹ️</span>
                <span>Only the workspace creator can rename this workspace or change its icon initials.</span>
              </div>
            )}

            {/* Danger Delete Zone for Creator */}
            {isCreator && (
              <div className="p-4 bg-red-50/50 border border-red-200/60 rounded-xl space-y-2 mt-2">
                <span className="block text-xs font-bold text-red-700 uppercase tracking-wider select-none">Danger Zone</span>
                <span className="block text-xs text-slate-600 leading-normal">
                  Permanently delete this workspace, including all of its channels and messages. This action cannot be undone.
                </span>
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="w-full mt-2 py-2 px-3 bg-white border border-red-200 hover:border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg transition-all active:scale-[0.98] cursor-pointer text-center"
                >
                  Delete Workspace...
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8] mt-4 select-none">
              {isCreator ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    disabled={loading}
                  >
                    {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />}
                    <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={handleDelete} className="p-6 space-y-4 font-sans">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
                <span>{error}</span>
              </div>
            )}

            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 space-y-2">
              <span className="block text-sm font-bold leading-normal">Are you absolutely sure?</span>
              <span className="block text-xs leading-relaxed opacity-90">
                This action is permanent and cannot be undone. This will permanently delete the workspace <b>{workspace.name}</b>, all channels (including general/random), and all message histories.
              </span>
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider mb-2 select-none leading-relaxed">
                Type <span className="font-mono bg-slate-100 border rounded px-1.5 py-0.5 text-slate-700 font-bold select-all">{workspace.name}</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => { setConfirmName(e.target.value); setError(''); }}
                placeholder={workspace.name}
                className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 font-medium font-mono"
                required
                disabled={loading}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8] mt-4 select-none">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
                disabled={loading}
              >
                Go Back
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                disabled={loading || confirmName !== workspace.name}
              >
                {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />}
                <span>{loading ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Preferences Modal
export function PreferencesModal({ 
  isOpen, 
  onClose,
  theme,
  setTheme,
  notifications,
  setNotifications,
  compactMode,
  setCompactMode
}) {
  const [localTheme, setLocalTheme] = useState(theme);
  const [localNotifications, setLocalNotifications] = useState(notifications);
  const [localCompactMode, setLocalCompactMode] = useState(compactMode);

  useEffect(() => {
    if (isOpen) {
      setLocalTheme(theme);
      setLocalNotifications(notifications);
      setLocalCompactMode(compactMode);
    }
  }, [isOpen, theme, notifications, compactMode]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    setTheme(localTheme);
    setNotifications(localNotifications);
    setCompactMode(localCompactMode);
    
    // Save to local storage for persistence
    localStorage.setItem('slack_theme', localTheme);
    localStorage.setItem('slack_notifications', localNotifications);
    localStorage.setItem('slack_compact_mode', localCompactMode ? 'on' : 'off');
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-100" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-[3px]" onClick={onClose}></div>
      
      <div className="relative w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-slack-modal border border-[#E8E8E8] transition-all duration-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8]">
          <h2 className="text-[17px] font-extrabold text-[#1D1C1D] tracking-tight">
            Preferences
          </h2>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-5 font-sans">
          {/* Theme Settings */}
          <div className="space-y-2">
            <span className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider select-none">
              Theme Mode
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLocalTheme('light')}
                className={`py-3 px-4 border rounded-xl font-bold text-sm transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                  localTheme === 'light'
                    ? 'border-[#1164A3] bg-blue-50/20 text-[#1164A3] ring-2 ring-[#1164A3]/15'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="w-4 h-4 rounded-full border border-slate-300 bg-white" />
                <span>Light Theme</span>
              </button>
              
              <button
                type="button"
                onClick={() => setLocalTheme('dark')}
                className={`py-3 px-4 border rounded-xl font-bold text-sm transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                  localTheme === 'dark'
                    ? 'border-[#1164A3] bg-blue-50/20 text-[#1164A3] ring-2 ring-[#1164A3]/15'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="w-4 h-4 rounded-full border border-slate-600 bg-slate-900" />
                <span>Dark Theme</span>
              </button>
            </div>
          </div>

          <div className="h-[1px] bg-slate-100" />

          {/* Sound & Notifications Toggles */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-[#E8E8E8] rounded-xl select-none">
            <div className="pr-3 flex-1 min-w-0">
              <span className="block text-sm font-bold text-[#1D1C1D]">
                Sound Alerts
              </span>
              <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                Play a premium dual-tone chime sound when a new message arrives from another user.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLocalNotifications(localNotifications === 'on' ? 'off' : 'on')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                localNotifications === 'on' ? 'bg-[#1164A3]' : 'bg-slate-200'
              }`}
              role="switch"
              aria-checked={localNotifications === 'on'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  localNotifications === 'on' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Compact Spacing Sidebar Toggles */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-[#E8E8E8] rounded-xl select-none">
            <div className="pr-3 flex-1 min-w-0">
              <span className="block text-sm font-bold text-[#1D1C1D]">
                Compact Sidebar Mode
              </span>
              <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                Squeeze padding and sizing inside the sidebar lists to display more channels/DMs.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLocalCompactMode(!localCompactMode)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                localCompactMode ? 'bg-[#1164A3]' : 'bg-slate-200'
              }`}
              role="switch"
              aria-checked={localCompactMode}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  localCompactMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E8E8] select-none">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              Save Preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Help & Feedback Modal
export function HelpFeedbackModal({ isOpen, onClose }) {
  const [feedback, setFeedback] = useState('');
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFeedback('');
      setSuccess(false);
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('support@slack-clone.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    
    // Simulate feedback submission
    setSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-100" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-[3px]" onClick={onClose}></div>
      
      <div className="relative w-full max-w-lg overflow-hidden bg-white rounded-2xl shadow-slack-modal border border-[#E8E8E8] transition-all duration-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8]">
          <h2 className="text-[17px] font-extrabold text-[#1D1C1D] tracking-tight">
            Help & Feedback
          </h2>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Panel */}
        <div className="max-h-[70vh] overflow-y-auto custom-scrollbar p-6 space-y-6 font-sans">
          
          {/* Quick Guide */}
          <div className="space-y-2">
            <span className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider select-none">
              Quick Usage Guide
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed text-slate-600">
              <div className="p-3 bg-slate-50 border border-[#E8E8E8] rounded-xl space-y-1">
                <span className="block font-bold text-slate-800">1. Channels</span>
                <span>Create open discussions for work streams. Default channels `#general` and `#random` are system locks.</span>
              </div>
              <div className="p-3 bg-slate-50 border border-[#E8E8E8] rounded-xl space-y-1">
                <span className="block font-bold text-slate-800">2. Invite People</span>
                <span>Invite teammates by entering their registered email or sharing your unique Workspace ID.</span>
              </div>
              <div className="p-3 bg-slate-50 border border-[#E8E8E8] rounded-xl space-y-1">
                <span className="block font-bold text-slate-800">3. Direct Messages</span>
                <span>Engage in private, real-time encrypted conversations with instant multi-tab status syncs.</span>
              </div>
              <div className="p-3 bg-slate-50 border border-[#E8E8E8] rounded-xl space-y-1">
                <span className="block font-bold text-slate-800">4. Keyboard Shortcuts</span>
                <span>Navigate quickly. Open fuzzy search shortcuts or switch workspaces using absolute click-paths.</span>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Cheatsheet */}
          <div className="space-y-2.5">
            <span className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider select-none">
              Keyboard Shortcuts
            </span>
            <div className="p-3.5 bg-slate-50 border border-[#E8E8E8] rounded-xl space-y-2 text-xs font-medium text-slate-700">
              <div className="flex items-center justify-between">
                <span>Open Fuzzy Message Search</span>
                <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono shadow-sm">Click search bar...</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cancel Modal Dialogs</span>
                <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono shadow-sm">Esc</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Send Chat Message</span>
                <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono shadow-sm">Enter</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Add Carriage Return (New line)</span>
                <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-mono shadow-sm">Shift + Enter</span>
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-slate-100" />

          {/* Submit Feedback */}
          <form onSubmit={handleFeedbackSubmit} className="space-y-3">
            <span className="block text-[12px] font-bold text-[#1D1C1D] uppercase tracking-wider select-none">
              Submit Product Feedback
            </span>
            
            {success ? (
              <div className="p-3.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold rounded-lg flex items-center gap-2 animate-in fade-in duration-100">
                <span>Feedback submitted successfully! Thank you.</span>
              </div>
            ) : (
              <>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="How can we make this Slack Clone better? Tell us what you think..."
                  required
                  className="w-full resize-none border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] min-h-[80px]"
                />
                
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 select-none">
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="w-full sm:w-auto px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors cursor-pointer text-xs font-bold flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Mail className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Support email copied!' : 'Copy Support Email'}</span>
                  </button>

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    Send Feedback
                  </button>
                </div>
              </>
            )}
          </form>

        </div>
      </div>
    </div>
  );
}



