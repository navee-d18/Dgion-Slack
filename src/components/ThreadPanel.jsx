import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, Bold, Italic, Strikethrough, Code, Link, 
  Paperclip, Smile, MessageSquare, Bookmark, SmilePlus, Loader2,
  Trash2, Edit, HelpCircle, FileText, MoreHorizontal
} from 'lucide-react';
import { emojiCategories, searchEmojis } from '../utils/emojiData';

// Helper: resolve user avatar background classes
const getAvatarColorClass = (name) => {
  if (!name) return 'bg-[#522653]';
  const colors = [
    'bg-[#E01E5A]', 'bg-[#36C5F0]', 'bg-[#2BAC76]', 
    'bg-[#ECB22E]', 'bg-[#613064]', 'bg-[#1164A3]'
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return colors[sum % colors.length];
};

const getInitials = (name) => {
  if (!name) return 'US';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

// Check if two dates represent the same calendar day
const isSameDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  return date1.toDateString() === date2.toDateString();
};

// Format date separator text ("Today", "Yesterday", or "May 27, 2026")
const formatDateHeader = (date) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }
};

const getMessageDate = (msg) => {
  if (msg.createdAt) {
    if (typeof msg.createdAt.toDate === 'function') {
      return msg.createdAt.toDate();
    }
    if (msg.createdAt.seconds) {
      return new Date(msg.createdAt.seconds * 1000);
    }
    return new Date(msg.createdAt);
  }
  if (msg.id && msg.id.startsWith('msg-')) {
    const ts = parseInt(msg.id.replace('msg-', ''), 10);
    if (!isNaN(ts)) {
      return new Date(ts);
    }
  }
  return new Date(); // fallback
};

// Fuzzy Markdown formatting parser
const renderFormattedContent = (content) => {
  if (!content) return '';
  
  const escapeHTML = (text) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  let html = escapeHTML(content);

  // 1. Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 2. Italics: *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 3. Strikethrough: ~~text~~
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

  // 4. Inline Code: `code`
  html = html.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[13px] text-red-600 font-bold">$1</code>');

  // 5. Link: [label](url)
  html = html.replace(/\[(.*?)\]\((https?:\/\/.*?|mailto:.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#1164A3] hover:underline font-bold font-sans">$1</a>');

  return <span dangerouslySetInnerHTML={{ __html: html }} className="break-words whitespace-pre-wrap inline" />;
};

const FullEmojiPicker = ({ onSelectEmoji, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');

  const categories = emojiCategories;
  const filteredEmojis = searchTerm 
    ? searchEmojis(searchTerm)
    : categories.find(cat => cat.id === activeCategory)?.emojis || [];

  return (
    <div className="absolute bottom-14 left-4 w-72 bg-white border border-[#E8E8E8] rounded-xl shadow-slack-popover flex flex-col z-[100] animate-in fade-in slide-in-from-bottom-2 duration-150 font-sans select-none overflow-hidden h-[320px]">
      {/* Search Input */}
      <div className="p-3 border-b border-slate-100 flex items-center gap-2 shrink-0">
        <SearchIcon className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search emojis..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs font-semibold focus:outline-none bg-slate-50 border border-slate-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3]"
          autoFocus
        />
      </div>

      {/* Category Icons Tabs */}
      {!searchTerm && (
        <div className="flex border-b border-slate-100 bg-slate-50 shrink-0 overflow-x-auto custom-scrollbar p-1 gap-0.5 scrollbar-none justify-between">
          {[
            { id: 'smileys', icon: '😀', label: 'Smileys' },
            { id: 'people', icon: '👋', label: 'People' },
            { id: 'animals', icon: '🐱', label: 'Animals' },
            { id: 'food', icon: '🍎', label: 'Food' },
            { id: 'travel', icon: '🚗', label: 'Travel' },
            { id: 'activities', icon: '⚽', label: 'Activities' },
            { id: 'objects', icon: '💻', label: 'Objects' },
            { id: 'symbols', icon: '❤️', label: 'Symbols' },
            { id: 'flags', icon: '🏁', label: 'Flags' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`p-1.5 rounded text-xs transition-colors shrink-0 ${
                activeCategory === tab.id ? 'bg-white shadow-sm font-black' : 'hover:bg-slate-150 grayscale-20 opacity-70 hover:opacity-100'
              }`}
              title={tab.label}
            >
              {tab.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emojis Grid Container */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {filteredEmojis.length === 0 ? (
          <div className="text-center text-xs text-slate-400 font-semibold pt-12">
            No emojis match search
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1.5">
            {filteredEmojis.map(emoji => (
              <button
                key={emoji.char}
                type="button"
                onClick={() => {
                  onSelectEmoji(emoji.char);
                  onClose();
                }}
                className="w-8 h-8 text-lg rounded-md hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                title={emoji.name}
              >
                {emoji.char}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer / Hover Status preview */}
      <div className="p-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 font-bold shrink-0 flex items-center justify-between">
        <span>Slack Emoji Library</span>
        <button
          type="button"
          onClick={onClose}
          className="text-[#1164A3] hover:underline"
        >
          Close
        </button>
      </div>
    </div>
  );
};

// Tiny Search Icon inside FullEmojiPicker to avoid lucide imports
const SearchIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
  </svg>
);

const VoiceNotePlayer = ({ file, messageId, activeAudioId, setActiveAudioId }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio(file.url);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    if (audio.duration) {
      setDuration(audio.duration);
    }

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [file.url]);

  // Synchronize playing states globally: pause others when another voice note plays
  useEffect(() => {
    const handleOtherPlay = (e) => {
      if (e.detail.messageId !== messageId && isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener('voice-note-played', handleOtherPlay);
    return () => {
      window.removeEventListener('voice-note-played', handleOtherPlay);
    };
  }, [messageId, isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Pause other voice notes globally first
      window.dispatchEvent(new CustomEvent('voice-note-played', { detail: { messageId } }));
      if (setActiveAudioId) {
        setActiveAudioId(messageId);
      }
      audioRef.current.play().catch(err => {
        console.warn('Audio playback failure:', err);
      });
      setIsPlaying(true);
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleSpeedToggle = () => {
    setPlaybackRate(prev => {
      if (prev === 1) return 1.5;
      if (prev === 1.5) return 2;
      return 1;
    });
  };

  const formatTime = (time) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="mt-2 p-3 bg-slate-50 border border-slate-200 hover:bg-slate-100/50 rounded-xl max-w-[240px] transition-all duration-100 flex items-center justify-between gap-3 font-sans select-none animate-in slide-in-from-top-1 shadow-sm border-l-4 border-l-[#1164A3]">
      <button
        type="button"
        onClick={handlePlayPause}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#1164A3] text-white flex items-center justify-center hover:bg-[#1164A3]/90 transition-all hover:scale-105 active:scale-95 shrink-0 shadow-sm cursor-pointer"
        aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isPlaying ? (
          <span className="text-[12px] sm:text-[13px]">⏸️</span>
        ) : (
          <span className="text-[12px] sm:text-[13px] ml-0.5">▶️</span>
        )}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1164A3] focus:outline-none focus:ring-0"
          style={{
            background: `linear-gradient(to right, #1164A3 0%, #1164A3 ${(currentTime / (duration || 1)) * 100}%, #cbd5e1 ${(currentTime / (duration || 1)) * 100}%, #cbd5e1 100%)`
          }}
        />
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold select-none leading-none mt-0.5">
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          <span className="text-slate-400/80 uppercase tracking-widest text-[7.5px] flex items-center gap-0.5">
            <span>🎤</span> Voice Note
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSpeedToggle}
        className="px-2 py-1 text-[9px] font-black tracking-tight text-[#1164A3] hover:text-white bg-white hover:bg-[#1164A3] border border-slate-200 hover:border-[#1164A3] rounded-md transition-all shrink-0 shadow-sm cursor-pointer select-none"
        title="Change playback speed"
      >
        {playbackRate}x
      </button>
    </div>
  );
};

export default function ThreadPanel({
  activeWorkspace,
  activeDestinationId,
  isDestinationDm,
  messages,
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  onToggleReaction,
  activeThreadMessageId,
  onClose,
  currentUser
}) {
  const [inputText, setInputText] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [activeAudioId, setActiveAudioId] = useState(null);

  // States for Reactions, Editing, and Bookmarks within thread panel
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState(null);
  const [activeToolbarReactionPickerId, setActiveToolbarReactionPickerId] = useState(null);
  const [bookmarks, setBookmarks] = useState({});
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);

  // Deletion confirm states inside thread panel
  const [deleteTargetMessageId, setDeleteTargetMessageId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const repliesEndRef = useRef(null);

  const channelKey = activeWorkspace ? `${activeWorkspace.id}-${activeDestinationId}` : '';
  const activeMessages = messages[channelKey] || [];

  // Pinned parent message
  const parentMessage = activeMessages.find(m => m.id === activeThreadMessageId);
  const isParentDeleted = parentMessage && (
    parentMessage.deletedForEveryone || 
    (parentMessage.deletedFor && parentMessage.deletedFor.includes(currentUser?.uid))
  );

  // Thread replies stream
  const threadReplies = activeMessages.filter(m => m.parentMessageId === activeThreadMessageId && !(m.deletedFor && m.deletedFor.includes(currentUser?.uid)));

  const isCreator = activeWorkspace?.createdBy === currentUser?.uid;

  const scrollToBottom = () => {
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [threadReplies.length]);

  const handleEditClick = (msg) => {
    setEditingMessageId(msg.id);
    setEditText(msg.content);
    setActiveMenuMessageId(null);
  };

  const getUserName = (uid) => {
    if (uid === currentUser?.uid) return 'You';
    const member = activeWorkspace?.allWorkspaceMembers?.find(m => m.id === uid);
    return member ? member.name : 'Unknown User';
  };

  const insertMarkdown = (token) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const selectedText = text.substring(start, end);
    let wrappedText = '';

    if (token === 'bold') {
      wrappedText = `**${selectedText || 'bold'}**`;
    } else if (token === 'italic') {
      wrappedText = `*${selectedText || 'italic'}*`;
    } else if (token === 'strike') {
      wrappedText = `~~${selectedText || 'text'}~~`;
    } else if (token === 'code') {
      wrappedText = `\`${selectedText || 'code'}\``;
    }

    const newText = text.substring(0, start) + wrappedText + text.substring(end);
    setInputText(newText);

    setTimeout(() => {
      textarea.focus();
      const offset = token === 'bold' ? 2 : token === 'italic' ? 1 : token === 'strike' ? 2 : 1;
      textarea.selectionStart = start + offset;
      textarea.selectionEnd = start + offset + (selectedText ? selectedText.length : token === 'bold' ? 4 : token === 'italic' ? 6 : token === 'strike' ? 4 : 4);
    }, 50);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      alert("File size exceeds 800 KB limit. Please upload a smaller file for this demo clone.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        url: reader.result
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSend = () => {
    if (!inputText.trim() && !attachment) return;
    onSendMessage(inputText, attachment, activeThreadMessageId);
    setInputText('');
    setAttachment(null);
    setShowLinkModal(false);
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertMarkdown('bold');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertMarkdown('italic');
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderAttachment = (file, messageId) => {
    if (!file || !file.url) return null;
    const isAudio = file.type?.startsWith('audio/') || file.name?.endsWith('.webm');
    if (isAudio) {
      return (
        <VoiceNotePlayer 
          file={file} 
          messageId={messageId} 
          activeAudioId={activeAudioId} 
          setActiveAudioId={setActiveAudioId} 
        />
      );
    }
    const isImage = file.type.startsWith('image/');
    
    if (isImage) {
      return (
        <div className="mt-1.5 group/attachment relative inline-block select-none animate-in zoom-in-95 duration-100">
          <img 
            src={file.url} 
            alt={file.name}
            className="max-w-[200px] max-h-36 rounded-lg border border-slate-200 hover:scale-[1.01] transition-transform duration-100 cursor-pointer shadow-sm"
            onClick={() => window.open(file.url, '_blank')}
          />
        </div>
      );
    } else {
      const isPdf = file.type.includes('pdf') || file.name.endsWith('.pdf');
      return (
        <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg max-w-[220px] transition-all flex items-center justify-between gap-2 font-sans select-none animate-in slide-in-from-top-1 duration-100">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded bg-red-100 flex items-center justify-center text-red-600 font-black text-[9px] shrink-0">
              {isPdf ? 'PDF' : 'DOC'}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#1D1C1D] truncate" title={file.name}>
                {file.name}
              </p>
              <p className="text-[9px] text-slate-500 font-medium">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <a 
            href={file.url} 
            download={file.name}
            className="px-2 py-0.5 text-[9px] font-bold text-[#1164A3] bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors shrink-0 shadow-sm"
          >
            Get
          </a>
        </div>
      );
    }
  };

  const renderReactions = (msg) => {
    const reactions = msg.reactions || {};
    const emojis = Object.keys(reactions);
    if (emojis.length === 0) {
      return (
        <div className="flex flex-wrap gap-1 mt-1 font-sans select-none items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveReactionPickerMessageId(activeReactionPickerMessageId === msg.id ? null : msg.id)}
              className="inline-flex items-center justify-center w-5 h-4.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 text-[10px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Add reaction"
            >
              <SmilePlus className="w-3 h-3" />
            </button>

            {activeReactionPickerMessageId === msg.id && (
              <>
                <div 
                  className="fixed inset-0 z-[70]" 
                  onClick={(e) => { e.stopPropagation(); setActiveReactionPickerMessageId(null); }}
                />
                <div className="absolute bottom-6 left-0 bg-white border border-[#E8E8E8] rounded-xl shadow-slack-popover p-1.5 z-[85] animate-in fade-in zoom-in-95 duration-100 flex gap-1 w-48 flex-wrap max-h-24 overflow-y-auto">
                  {['👍', '🔥', '🎉', '😂', '😮', '😢', '🙏', '❤️', '✅', '👀', '🚀', '💯'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onToggleReaction(msg.id, emoji);
                        setActiveReactionPickerMessageId(null);
                      }}
                      className="w-6 h-6 text-xs hover:bg-slate-100 rounded flex items-center justify-center transition-colors cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-1 mt-1 font-sans select-none items-center">
        {emojis.map(emoji => {
          const userIds = reactions[emoji] || [];
          const count = userIds.length;
          const hasReacted = userIds.includes(currentUser?.uid);
          const reactedNames = userIds.map(uid => getUserName(uid)).join(', ');

          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggleReaction(msg.id, emoji)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer relative group/reaction-pill ${
                hasReacted
                  ? 'bg-blue-50/70 border-blue-200 text-[#1164A3] hover:bg-blue-50 font-extrabold'
                  : 'bg-slate-50 border-slate-150 text-slate-500 hover:bg-slate-100 font-medium'
              }`}
              title={`${emoji} reacted by: ${reactedNames}`}
            >
              <span>{emoji}</span>
              <span>{count}</span>

              {/* Hover Tooltip name list */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/reaction-pill:block bg-[#1D1C1D] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-slack-popover whitespace-nowrap z-[60] pointer-events-none border border-slate-700 animate-in fade-in zoom-in-95 duration-75">
                <span>{reactedNames}</span>
              </div>
            </button>
          );
        })}

        {/* Reaction Shortcut "+" trigger pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setActiveReactionPickerMessageId(activeReactionPickerMessageId === msg.id ? null : msg.id)}
            className="inline-flex items-center justify-center w-5 h-4.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 text-[10px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Add reaction"
          >
            <SmilePlus className="w-3 h-3" />
          </button>

          {activeReactionPickerMessageId === msg.id && (
            <>
              <div 
                className="fixed inset-0 z-[70]" 
                onClick={(e) => { e.stopPropagation(); setActiveReactionPickerMessageId(null); }}
              />
              <div className="absolute bottom-6 left-0 bg-white border border-[#E8E8E8] rounded-xl shadow-slack-popover p-1.5 z-[85] animate-in fade-in zoom-in-95 duration-100 flex gap-1 w-48 flex-wrap max-h-24 overflow-y-auto">
                {['👍', '🔥', '🎉', '😂', '😮', '😢', '🙏', '❤️', '✅', '👀', '🚀', '💯'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onToggleReaction(msg.id, emoji);
                      setActiveReactionPickerMessageId(null);
                    }}
                    className="w-6 h-6 text-xs hover:bg-slate-100 rounded flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const channelName = isDestinationDm 
    ? `DM with ${activeWorkspace?.dms?.find(d => d.id === activeDestinationId)?.name || 'Member'}`
    : `#${activeWorkspace?.channels?.find(c => c.id === activeDestinationId)?.name || 'channel'}`;

  return (
    <div className="w-[380px] sm:w-[400px] border-l border-[#E8E8E8] h-full flex flex-col bg-white shrink-0 font-sans z-[20] shadow-sm relative overflow-hidden flex flex-col h-full bg-[#FFFFFF]">
      
      {/* HEADER */}
      <header className="h-[52px] bg-[#FFFFFF] border-b border-[#E8E8E8] px-4 flex items-center justify-between shrink-0 select-none">
        <div className="min-w-0">
          <h2 className="text-[14px] font-extrabold text-[#1D1C1D] tracking-tight leading-tight">
            Thread
          </h2>
          <p className="text-[11px] text-[#616061] truncate mt-0.5 leading-none">
            {channelName}
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors shrink-0 cursor-pointer"
          title="Close Thread sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* FEED CONTROLLER */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        
        {/* Pinned Parent Message Card */}
        <div className="bg-slate-50/70 border border-slate-150 rounded-xl p-3.5 relative group shadow-sm select-text">
          {parentMessage ? (
            <div className="flex items-start">
              {/* Avatar circle */}
              <div className={`w-8 h-8 rounded-full text-white font-extrabold flex items-center justify-center text-xs shrink-0 shadow-sm ${getAvatarColorClass(parentMessage.senderName)}`}>
                {getInitials(parentMessage.senderName)}
              </div>
              {/* Content block */}
              <div className="flex-1 min-w-0 ml-2.5 font-sans flex flex-col">
                <div className="flex items-baseline gap-1.5 mb-0.5 select-none">
                  <span className="font-bold text-[13px] text-[#1D1C1D] hover:underline cursor-pointer flex items-center gap-1">
                    {parentMessage.senderName}
                    {!isParentDeleted && bookmarks[parentMessage.id] && <Bookmark className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                  </span>
                  <span className="text-[10px] text-[#616061] font-semibold">
                    {parentMessage.timestamp} {parentMessage.isEdited && <span className="text-[8px] text-slate-400 font-bold">(edited)</span>}
                  </span>
                </div>

                {isParentDeleted ? (
                  <div className="text-[13px] leading-relaxed select-none">
                    <span className="text-slate-400 italic">
                      {parentMessage.deletedByAdmin ? 'This message was deleted by admin' : 'This message was deleted'}
                    </span>
                    {parentMessage.deletedAtTime && (
                       <span className="text-[10px] text-slate-400 ml-1.5 font-medium not-italic font-sans">
                        (Deleted at {parentMessage.deletedAtTime})
                      </span>
                    )}
                  </div>
                ) : editingMessageId === parentMessage.id ? (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          onEditMessage(parentMessage.id, editText);
                          setEditingMessageId(null);
                        } else if (e.key === 'Escape') {
                          setEditingMessageId(null);
                        }
                      }}
                      className="w-full text-xs font-semibold p-2 border border-[#1164A3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] bg-white resize-none max-h-20 min-h-[38px]"
                      autoFocus
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          onEditMessage(parentMessage.id, editText);
                          setEditingMessageId(null);
                        }}
                        className="px-2 py-0.5 text-[9px] font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded transition-colors cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMessageId(null)}
                        className="px-2 py-0.5 text-[9px] font-bold text-slate-500 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[13px] text-[#1D1C1D] leading-relaxed break-words">
                    {renderFormattedContent(parentMessage.content)}
                    {parentMessage.file && renderAttachment(parentMessage.file, parentMessage.id)}
                  </div>
                )}
                
                {!isParentDeleted && renderReactions(parentMessage)}
              </div>
            </div>
          ) : (
            /* safe placeholder inside thread if parent is deleted */
            <div className="flex items-center gap-2.5 text-slate-400 py-1.5 text-xs font-bold font-sans justify-center select-none">
              <span>⚠️</span>
              <span>This message was deleted</span>
            </div>
          )}

          {/* Floating Actions bar for parent message in thread */}
          {parentMessage && !isParentDeleted && (
            <div className="absolute right-3 -top-3 hidden group-hover:flex items-center gap-0.5 bg-white border border-[#E8E8E8] rounded-lg shadow-slack-popover p-0.5 z-[25]">
              <div className="relative">
                <button 
                  onClick={() => setActiveToolbarReactionPickerId(activeToolbarReactionPickerId === parentMessage.id ? null : parentMessage.id)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                  title="Add reaction"
                >
                  <SmilePlus className="w-3.5 h-3.5" />
                </button>
                {activeToolbarReactionPickerId === parentMessage.id && (
                  <>
                    <div className="fixed inset-0 z-[70]" onClick={() => setActiveToolbarReactionPickerId(null)} />
                    <div className="absolute right-0 bottom-5 bg-white border border-[#E8E8E8] rounded-xl shadow-slack-popover p-1.5 z-[85] flex gap-1 w-48 flex-wrap">
                      {['👍', '🔥', '🎉', '😂', '😮', '😢', '🙏', '❤️', '✅', '👀', '🚀', '💯'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            onToggleReaction(parentMessage.id, emoji);
                            setActiveToolbarReactionPickerId(null);
                          }}
                          className="w-6 h-6 text-xs hover:bg-slate-100 rounded flex items-center justify-center cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button 
                onClick={() => setBookmarks(prev => ({ ...prev, [parentMessage.id]: !prev[parentMessage.id] }))}
                className={`p-1 hover:bg-slate-100 rounded cursor-pointer ${bookmarks[parentMessage.id] ? 'text-amber-500' : 'text-slate-400'}`}
                title="Bookmark message"
              >
                <Bookmark className="w-3.5 h-3.5" />
              </button>
              <div className="relative">
                <button 
                  onClick={() => setActiveMenuMessageId(activeMenuMessageId === parentMessage.id ? null : parentMessage.id)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
                {activeMenuMessageId === parentMessage.id && (
                  <>
                    <div className="fixed inset-0 z-[30]" onClick={() => setActiveMenuMessageId(null)} />
                    <div className="absolute right-0 mt-1 w-36 bg-white border border-[#E8E8E8] rounded-lg shadow-slack-popover py-1 z-[40] font-sans">
                      <button
                        onClick={() => handleEditClick(parentMessage)}
                        className="w-full px-3 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Edit message</span>
                      </button>
                      {parentMessage.senderId === currentUser?.uid || isCreator ? (
                        <button
                          onClick={() => {
                            setDeleteTargetMessageId(parentMessage.id);
                            setActiveMenuMessageId(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete message</span>
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Separator count */}
        <div className="flex items-center select-none py-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pr-3 bg-white shrink-0">
            {threadReplies.length === 0 ? 'No replies' : threadReplies.length === 1 ? '1 reply' : `${threadReplies.length} replies`}
          </span>
          <div className="flex-1 h-[1px] bg-slate-150" />
        </div>

        {/* REPLIES CONTAINER SCROLLFEED */}
        <div className="space-y-3.5 select-text pb-4">
          {threadReplies.map((reply, index) => {
            const prevReply = index > 0 ? threadReplies[index - 1] : null;
            const currentReplyDate = getMessageDate(reply);
            const prevReplyDate = prevReply ? getMessageDate(prevReply) : null;
            const isNewDay = !prevReplyDate || !isSameDay(currentReplyDate, prevReplyDate);
            const isCloseTogether = prevReplyDate && (currentReplyDate.getTime() - prevReplyDate.getTime()) < 5 * 60 * 1000;
            const isGrouped = prevReply && prevReply.senderId === reply.senderId && !isNewDay && isCloseTogether;

            const canDeleteReply = reply.senderId === currentUser?.uid || isCreator;

            return (
              <div key={reply.id} className="flex flex-col animate-in fade-in duration-75">
                {isNewDay && (
                  <div className="flex items-center my-3 select-none">
                    <div className="flex-1 h-[1px] bg-slate-150" />
                    <span className="px-2.5 text-[10px] font-bold text-slate-400 bg-white leading-none">
                      {formatDateHeader(currentReplyDate)}
                    </span>
                    <div className="flex-1 h-[1px] bg-slate-150" />
                  </div>
                )}

                <div className="relative group flex items-start px-2 py-0.5 rounded transition-colors hover:bg-slate-50/70">
                  {/* Floating Action toolbar for reply message */}
                  {!reply.deletedForEveryone && (
                    <div className={`absolute right-2 -top-3.5 ${activeMenuMessageId === reply.id || activeToolbarReactionPickerId === reply.id ? 'flex' : 'hidden group-hover:flex'} items-center gap-0.5 bg-white border border-[#E8E8E8] rounded-lg shadow-slack-popover p-0.5 z-[25]`}>
                      <div className="relative">
                        <button 
                          onClick={() => setActiveToolbarReactionPickerId(activeToolbarReactionPickerId === reply.id ? null : reply.id)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                          title="Add reaction"
                        >
                          <SmilePlus className="w-3.5 h-3.5" />
                        </button>
                        {activeToolbarReactionPickerId === reply.id && (
                          <>
                            <div className="fixed inset-0 z-[70]" onClick={() => setActiveToolbarReactionPickerId(null)} />
                            <div className="absolute right-0 bottom-5 bg-white border border-[#E8E8E8] rounded-xl shadow-slack-popover p-1.5 z-[85] flex gap-1 w-48 flex-wrap">
                              {['👍', '🔥', '🎉', '😂', '😮', '😢', '🙏', '❤️', '✅', '👀', '🚀', '💯'].map(emoji => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    onToggleReaction(reply.id, emoji);
                                    setActiveToolbarReactionPickerId(null);
                                  }}
                                  className="w-6 h-6 text-xs hover:bg-slate-100 rounded flex items-center justify-center cursor-pointer"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      <button 
                        onClick={() => setBookmarks(prev => ({ ...prev, [reply.id]: !prev[reply.id] }))}
                        className={`p-1 hover:bg-slate-100 rounded cursor-pointer ${bookmarks[reply.id] ? 'text-amber-500' : 'text-slate-400'}`}
                        title="Bookmark message"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                      <div className="relative">
                        <button 
                          onClick={() => setActiveMenuMessageId(activeMenuMessageId === reply.id ? null : reply.id)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                        {activeMenuMessageId === reply.id && (
                          <>
                            <div className="fixed inset-0 z-[30]" onClick={() => setActiveMenuMessageId(null)} />
                            <div className="absolute right-0 mt-1 w-36 bg-white border border-[#E8E8E8] rounded-lg shadow-slack-popover py-1 z-[40] font-sans">
                              <button
                                onClick={() => handleEditClick(reply)}
                                className="w-full px-3 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                              >
                                <Edit className="w-3 h-3" />
                                <span>Edit message</span>
                              </button>
                              {canDeleteReply ? (
                                <button
                                  onClick={() => {
                                    setDeleteTargetMessageId(reply.id);
                                    setActiveMenuMessageId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete message</span>
                                </button>
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {isGrouped ? (
                    <>
                      {/* Grouped message timestamp */}
                      <div className="w-8 text-[9px] text-slate-400 text-right pr-2 shrink-0 select-none pt-0.5 font-semibold">
                        {reply.timestamp.split(' ')[0]}
                      </div>
                      <div className="flex-1 min-w-0 ml-2 text-[13px] text-[#1D1C1D] leading-relaxed flex flex-col">
                        {reply.deletedForEveryone ? (
                          <div className="text-[13px] leading-relaxed select-none">
                            <span className="text-slate-400 italic">
                              {reply.deletedByAdmin ? 'This message was deleted by admin' : 'This message was deleted'}
                            </span>
                            {reply.deletedAtTime && (
                              <span className="text-[10px] text-slate-400 ml-1.5 font-medium not-italic font-sans">
                                (Deleted at {reply.deletedAtTime})
                              </span>
                            )}
                          </div>
                        ) : editingMessageId === reply.id ? (
                          <div className="flex flex-col gap-1 mt-1">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  onEditMessage(reply.id, editText);
                                  setEditingMessageId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingMessageId(null);
                                }
                              }}
                              className="w-full text-xs font-semibold p-2 border border-[#1164A3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] bg-white resize-none max-h-20 min-h-[38px]"
                              autoFocus
                            />
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  onEditMessage(reply.id, editText);
                                  setEditingMessageId(null);
                                }}
                                className="px-2 py-0.5 text-[9px] font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded transition-colors cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingMessageId(null)}
                                className="px-2 py-0.5 text-[9px] font-bold text-slate-500 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[13px] text-[#1D1C1D] leading-relaxed break-words">
                            <span className="inline">{renderFormattedContent(reply.content)}</span>
                            {reply.isEdited && <span className="text-[9px] text-slate-400 font-semibold ml-1.5 select-none inline-block align-baseline" title="This message has been edited">(edited)</span>}
                            {bookmarks[reply.id] && <Bookmark className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0 ml-1.5 inline-block align-middle animate-in zoom-in-95 duration-100" title="Bookmarked message" />}
                            {reply.file && renderAttachment(reply.file, reply.id)}
                          </div>
                        )}
                        {!reply.deletedForEveryone && renderReactions(reply)}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full text-white font-extrabold flex items-center justify-center text-xs shrink-0 shadow-sm ${getAvatarColorClass(reply.senderName)}`}>
                        {getInitials(reply.senderName)}
                      </div>
                      {/* Content block */}
                      <div className="flex-1 min-w-0 ml-2.5 font-sans flex flex-col">
                        <div className="flex items-baseline gap-1.5 mb-0.5 select-none">
                          <span className="font-bold text-[13px] text-[#1D1C1D] hover:underline cursor-pointer flex items-center gap-1">
                            {reply.senderName}
                            {!reply.deletedForEveryone && bookmarks[reply.id] && <Bookmark className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                          </span>
                          <span className="text-[10px] text-[#616061] font-semibold">
                            {reply.timestamp} {reply.isEdited && <span className="text-[8px] text-slate-400 font-bold ml-1 hover:underline cursor-help select-none" title="Edited message">(edited)</span>}
                          </span>
                        </div>

                        {reply.deletedForEveryone ? (
                          <div className="text-[13px] leading-relaxed select-none">
                            <span className="text-slate-400 italic">
                              {reply.deletedByAdmin ? 'This message was deleted by admin' : 'This message was deleted'}
                            </span>
                            {reply.deletedAtTime && (
                              <span className="text-[10px] text-slate-400 ml-1.5 font-medium not-italic font-sans">
                                (Deleted at {reply.deletedAtTime})
                              </span>
                            )}
                          </div>
                        ) : editingMessageId === reply.id ? (
                          <div className="flex flex-col gap-1 mt-1">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    onEditMessage(reply.id, editText);
                                    setEditingMessageId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingMessageId(null);
                                  }
                                }}
                              className="w-full text-xs font-semibold p-2 border border-[#1164A3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] bg-white resize-none max-h-20 min-h-[38px]"
                              autoFocus
                            />
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  onEditMessage(reply.id, editText);
                                  setEditingMessageId(null);
                                }}
                                className="px-2 py-0.5 text-[9px] font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded transition-colors cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingMessageId(null)}
                                className="px-2 py-0.5 text-[9px] font-bold text-slate-500 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[13px] text-[#1D1C1D] leading-relaxed break-words">
                            {renderFormattedContent(reply.content)}
                            {reply.file && renderAttachment(reply.file, reply.id)}
                          </div>
                        )}
                        {!reply.deletedForEveryone && renderReactions(reply)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={repliesEndRef} />
        </div>
      </div>

      {/* COMPOSER AT BOTTOM */}
      <footer className="p-4 pt-1 bg-white shrink-0">
        <div className="border border-[#E8E8E8] focus-within:ring-1 focus-within:ring-[#1164A3] focus-within:border-[#1164A3] rounded-xl flex flex-col overflow-hidden bg-white shadow-sm transition-all duration-100 bg-white relative">
          
          {/* Staged staged file preview */}
          {attachment && (
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 animate-in slide-in-from-top-1 duration-100">
              <div className="flex items-center gap-1.5 min-w-0">
                <Paperclip className="w-3 h-3 text-[#1164A3] shrink-0" />
                <span className="text-[11px] font-bold text-slate-700 truncate">{attachment.name}</span>
                <span className="text-[9px] text-slate-500 font-medium">({(attachment.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply..."
            className="w-full resize-none border-none focus:outline-none p-3 pb-1 text-[13px] text-[#1D1C1D] placeholder-slate-400 min-h-[38px] max-h-[120px] font-normal font-sans bg-transparent"
            rows={1}
            aria-label="Thread reply text"
          />

          {/* Emoji Picker Popover inside ThreadPanel */}
          {showEmojiPicker && (
            <FullEmojiPicker
              onSelectEmoji={(emoji) => {
                const textarea = textareaRef.current;
                if (!textarea) {
                  setInputText(prev => prev + emoji);
                  return;
                }
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                const newText = text.substring(0, start) + emoji + text.substring(end);
                setInputText(newText);
                setTimeout(() => textarea.focus(), 50);
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}

          {/* Link Modal above toolbar inside ThreadPanel */}
          {showLinkModal && (
            <div className="px-3 py-2 bg-slate-50 border-t border-[#E8E8E8] flex flex-col gap-1.5 animate-in fade-in duration-100 font-sans">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Link Builder</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Label (e.g. Doc)"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  className="flex-1 px-2 py-0.5 text-[10px] border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1164A3] bg-white font-semibold text-slate-700"
                />
                <input
                  type="text"
                  placeholder="URL (https://...)"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="flex-[1.5] px-2 py-0.5 text-[10px] border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1164A3] bg-white font-semibold text-slate-700"
                />
              </div>
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => { setShowLinkModal(false); setLinkUrl(''); setLinkLabel(''); }}
                  className="px-2 py-0.5 border border-slate-300 hover:bg-slate-200 rounded text-[9px] font-bold text-slate-600 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!linkUrl.trim()}
                  onClick={() => {
                    if (!linkUrl.trim()) return;
                    const label = linkLabel.trim() || linkUrl.trim();
                    let url = linkUrl.trim();
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                      url = 'https://' + url;
                    }
                    const textarea = textareaRef.current;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const markdownLink = `[${label}](${url})`;
                    const newText = text.substring(0, start) + markdownLink + text.substring(end);
                    setInputText(newText);
                    setShowLinkModal(false);
                    setLinkUrl('');
                    setLinkLabel('');
                    setTimeout(() => textarea.focus(), 50);
                  }}
                  className="px-2 py-0.5 bg-[#1164A3] hover:bg-[#1164A3]/90 text-white rounded text-[9px] font-bold disabled:opacity-50 cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Bottom Toolbar inside ThreadPanel */}
          <div className="px-2.5 py-1 bg-slate-50 border-t border-[#E8E8E8] flex items-center justify-between select-none shrink-0">
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              className="hidden"
            />
            
            <div className="flex items-center gap-1 text-slate-500">
              <button 
                type="button" 
                onClick={() => insertMarkdown('bold')}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition-colors cursor-pointer" 
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button" 
                onClick={() => insertMarkdown('italic')}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition-colors cursor-pointer" 
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button" 
                onClick={() => insertMarkdown('strike')}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition-colors cursor-pointer" 
                title="Strikethrough"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button" 
                onClick={() => insertMarkdown('code')}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition-colors cursor-pointer" 
                title="Code"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button" 
                onClick={() => { setShowLinkModal(!showLinkModal); setShowEmojiPicker(false); }}
                className={`p-1 hover:bg-slate-200 rounded transition-colors cursor-pointer ${showLinkModal ? 'bg-slate-200 text-[#1164A3]' : 'text-slate-500 hover:text-slate-900'}`} 
                title="Link"
              >
                <Link className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition-colors cursor-pointer" 
                title="Attach file"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button" 
                onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowLinkModal(false); }}
                className={`p-1 hover:bg-slate-200 rounded transition-colors cursor-pointer ${showEmojiPicker ? 'bg-slate-200 text-[#1164A3]' : 'text-slate-500 hover:text-slate-900'}`} 
                title="Emoji"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() && !attachment}
              className={`p-1 rounded flex items-center justify-center transition-all ${
                inputText.trim() || attachment
                  ? 'bg-[#1164A3] hover:bg-[#1164A3]/90 text-white scale-100 hover:scale-105 active:scale-[0.95] cursor-pointer shadow-sm' 
                  : 'text-slate-300 cursor-not-allowed bg-transparent'
              }`}
              title="Send reply"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>

      {/* CHAT DELETE CONFIRMATION POPUP MODAL (INSIDE THREAD SIDEBAR) */}
      {deleteTargetMessageId && (() => {
        const deleteTargetMsg = activeMessages.find(m => m.id === deleteTargetMessageId);
        const canDeleteForEveryone = deleteTargetMsg && (deleteTargetMsg.senderId === currentUser?.uid || isCreator);
        const isAdminDelete = deleteTargetMsg && (deleteTargetMsg.senderId !== currentUser?.uid && isCreator);
        
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-100 font-sans" role="dialog" aria-modal="true">
            <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px]" onClick={() => !isDeleting && setDeleteTargetMessageId(null)}></div>
            
            <div className="relative w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-slack-modal border border-[#E8E8E8] transition-all duration-200 animate-in zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8E8E8] select-none">
                <h2 className="text-[15px] font-extrabold text-[#1D1C1D] tracking-tight">
                  Delete message
                </h2>
                <button onClick={() => setDeleteTargetMessageId(null)} disabled={isDeleting} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed select-none">
                  Choose how you want to delete this message:
                </p>
                
                <div className="flex flex-col gap-2">
                  {canDeleteForEveryone && (
                    <button
                      type="button; "
                      onClick={async () => {
                        setIsDeleting(true);
                        try {
                          await onDeleteMessage(deleteTargetMessageId, 'everyone');
                          setDeleteTargetMessageId(null);
                        } catch (err) {
                          alert(err.message || 'Failed to delete message.');
                        } finally {
                          setIsDeleting(false);
                        }
                      }}
                      className="w-full text-left px-4 py-3 border border-red-200 hover:bg-red-50 hover:border-red-300 rounded-xl transition-all duration-100 flex flex-col cursor-pointer active:scale-[0.99] disabled:opacity-50"
                      disabled={isDeleting}
                    >
                      <span className="text-xs font-bold text-red-700">
                        {isAdminDelete ? 'Delete for everyone (Admin delete)' : 'Delete for everyone'}
                      </span>
                      <span className="text-[10px] text-red-500 mt-0.5 font-medium leading-normal">
                        This will replace the message content with a deleted placeholder for all members in the workspace.
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      setIsDeleting(true);
                      try {
                        await onDeleteMessage(deleteTargetMessageId, 'me');
                        setDeleteTargetMessageId(null);
                      } catch (err) {
                        alert(err.message || 'Failed to delete message.');
                      } finally {
                        setIsDeleting(false);
                      }
                    }}
                    className="w-full text-left px-4 py-3 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all duration-100 flex flex-col cursor-pointer active:scale-[0.99] disabled:opacity-50"
                    disabled={isDeleting}
                  >
                    <span className="text-xs font-bold text-slate-700">Delete for me</span>
                    <span className="text-[10px] text-slate-500 mt-0.5 font-medium leading-normal">
                      This message will be hidden from your feed only. Other members will still see it normally.
                    </span>
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-[#E8E8E8] flex justify-end select-none">
                <button
                  type="button"
                  onClick={() => setDeleteTargetMessageId(null)}
                  className="px-4 py-2 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 transition-all duration-100 cursor-pointer"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
