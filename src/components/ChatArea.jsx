import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Hash, Lock, Search, Users, Menu, Send, Bold, Italic,
  Strikethrough, Code, Link, Paperclip, Smile, HelpCircle,
  MoreHorizontal, MessageSquare, Bookmark, SmilePlus, Loader2, Settings,
  X, Trash2, Edit, Bell, Pin, Mic, Check, CheckCheck, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Module-level helper functions
const getAvatarColorClass = (name) => {
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

// Helper to parse simple calendar Date for a message
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


export const formatReminderTime = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);

  const timeString = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  
  if (d.toDateString() === today.toDateString()) {
    return `Today ${timeString}`;
  } else if (d.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${timeString}`;
  } else {
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    return `${month} ${day} at ${timeString}`;
  }
};

export const parseReminderCommand = (text) => {
  let rest = text.trim();
  if (!rest.toLowerCase().startsWith('/remind')) return null;
  
  rest = rest.substring(7).trim(); // remove "/remind"
  if (rest.toLowerCase().startsWith('me ')) {
    rest = rest.substring(3).trim(); // remove "me"
  }
  
  let scheduledAt = null;
  
  // 1. Check for relative duration: "in X mins/hours/secs"
  const inRegex = /\bin\s+(\d+)\s*(min|minute|hour|hr|second|sec)s?\b/i;
  const inMatch = rest.match(inRegex);
  if (inMatch) {
    const amount = parseInt(inMatch[1], 10);
    const unit = inMatch[2].toLowerCase();
    let ms = amount * 1000;
    if (unit.startsWith('min')) {
      ms = amount * 60 * 1000;
    } else if (unit.startsWith('hour') || unit.startsWith('hr')) {
      ms = amount * 60 * 60 * 1000;
    }
    scheduledAt = Date.now() + ms;
    let reminderText = rest.replace(inRegex, '').trim();
    // Strip leading/trailing 'at' or 'to' or 'that'
    reminderText = reminderText.replace(/^\s*(at|to|that)\s+/i, '').trim();
    reminderText = reminderText.replace(/\s+(at|to)$/i, '').trim();
    return {
      text: reminderText || 'Reminder',
      scheduledAt: scheduledAt
    };
  }

  // 2. Determine target date (default to today)
  const hasTomorrow = /\btomorrow\b/i.test(rest);
  
  const targetDate = new Date();
  if (hasTomorrow) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  
  // Clean date keywords to get core message and time
  let tempText = rest
    .replace(/\btoday\b/gi, '')
    .replace(/\btomorrow\b/gi, '')
    .trim();

  // Find the time match
  let hour = null;
  let minute = 0;
  let matchedString = '';

  // Try Candidate 1: \b(\d{1,2}):(\d{2})\s*(am|pm)?\b
  const c1Regex = /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i;
  const m1 = tempText.match(c1Regex);
  if (m1) {
    hour = parseInt(m1[1], 10);
    minute = parseInt(m1[2], 10);
    matchedString = m1[0];
    const ampm = m1[3] ? m1[3].toLowerCase() : '';
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
  } else {
    // Try Candidate 2: \b(\d{1,2})\s*(am|pm)\b
    const c2Regex = /\b(\d{1,2})\s*(am|pm)\b/i;
    const m2 = tempText.match(c2Regex);
    if (m2) {
      hour = parseInt(m2[1], 10);
      matchedString = m2[0];
      const ampm = m2[2].toLowerCase();
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
    } else {
      // Try Candidate 3: \b(?:at\s+)(\d{1,2})\b
      const c3Regex = /\b(?:at\s+)(\d{1,2})\b/i;
      const m3 = tempText.match(c3Regex);
      if (m3) {
        hour = parseInt(m3[1], 10);
        matchedString = m3[0];
      }
    }
  }

  if (hour !== null) {
    targetDate.setHours(hour, minute, 0, 0);
    let reminderText = tempText.replace(matchedString, '').trim();
    // remove helper words like 'at', 'to' at the beginning/end
    reminderText = reminderText.replace(/^\s*(at|to|that)\s+/i, '').trim();
    reminderText = reminderText.replace(/\s+(at|to)$/i, '').trim();

    return {
      text: reminderText || 'Reminder',
      scheduledAt: targetDate.getTime()
    };
  }

  // Fallback to 9:00 AM
  targetDate.setHours(9, 0, 0, 0);
  let reminderText = tempText;
  reminderText = reminderText.replace(/^\s*(at|to|that)\s+/i, '').trim();
  reminderText = reminderText.replace(/\s+(at|to)$/i, '').trim();

  return {
    text: reminderText || 'Reminder',
    scheduledAt: targetDate.getTime()
  };
};

export const getTodayDateString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const getNextNearestSlot = () => {
  const d = new Date();
  let min = d.getMinutes();
  const rem = min % 5;
  d.setMinutes(min + (5 - rem), 0, 0);
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  
  return {
    dateStr: `${yyyy}-${mm}-${dd}`,
    timeStr: `${hh}:${mi}`
  };
};

export const getMinTime = () => {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
};

// Inline Markdown Parser to convert simple formatting tokens to HTML
export const renderFormattedContent = (content, members = []) => {
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

  // Parse exact workspace members mentions safely
  if (members && members.length > 0) {
    // Sort members by name length descending to avoid prefix collision
    const sortedMembers = [...members].sort((a, b) => b.name.length - a.name.length);
    sortedMembers.forEach(member => {
      // Escape special characters in member name for RegExp
      const escapedName = member.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Match exact name after '@', checking boundaries dynamically (space, punctuation, end of line, word boundaries)
      const regex = new RegExp(`@(${escapedName})(?=\\s|[.,!?]|$|\\b)`, 'g');
      html = html.replace(regex, `<span class="mention-link cursor-pointer text-[#1164A3] bg-[#E8F5FA] hover:bg-[#D0ECF7] px-1.5 py-0.5 rounded font-bold transition-colors select-none" data-uid="${member.id}">@$1</span>`);
    });
  }

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

  return <span dangerouslySetInnerHTML={{ __html: html }} className="break-words whitespace-pre-wrap inline animate-in fade-in duration-100" />;
};

const FullEmojiPicker = ({ onSelectEmoji, onClose }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState('smileys');

  const categories = emojiCategories;
  const filteredEmojis = searchTerm 
    ? searchEmojis(searchTerm)
    : categories.find(cat => cat.id === activeCategory)?.emojis || [];

  return (
    <div className="absolute bottom-14 left-4 w-72 bg-white border border-[#E8E8E8] rounded-xl shadow-slack-popover flex flex-col z-[100] animate-in fade-in slide-in-from-bottom-2 duration-150 font-sans select-none overflow-hidden h-[320px]">
      {/* Search Input */}
      <div className="p-3 border-b border-slate-100 flex items-center gap-2 shrink-0">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
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
              {tab.char || tab.icon}
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

import { emojiCategories, searchEmojis } from '../utils/emojiData';

const VoiceNotePlayer = ({ file, messageId, setActiveAudioId }) => {
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
    <div className="mt-2 p-3 bg-slate-50 border border-slate-200 hover:bg-slate-100/50 rounded-xl max-w-xs sm:max-w-sm transition-all duration-100 flex items-center justify-between gap-3 font-sans select-none animate-in slide-in-from-top-1 shadow-sm border-l-4 border-l-[#1164A3]">
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
          <span className="text-slate-400/80 uppercase tracking-widest text-[8px] flex items-center gap-0.5">
            <span>🎤</span> Voice Note
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSpeedToggle}
        className="px-2.5 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-[11px] font-black tracking-tight text-[#1164A3] hover:text-white bg-white hover:bg-[#1164A3] border border-slate-200 hover:border-[#1164A3] rounded-md transition-all shrink-0 shadow-sm cursor-pointer select-none"
        title="Change playback speed"
      >
        {playbackRate}x
      </button>
    </div>
  );
};

// Channel "Seen by N" — click to expand the list of members who've read the message.
const SeenByIndicator = ({ names }) => {
  const [open, setOpen] = useState(false);
  if (!names || names.length === 0) return null;
  return (
    <div className="mt-0.5 select-none">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 font-semibold transition-colors cursor-pointer"
        title="Seen by"
      >
        <Eye className="w-3.5 h-3.5 shrink-0" />
        Seen by {names.length}
      </button>
      {open && (
        <div className="mt-1 flex flex-wrap gap-1 animate-in fade-in duration-100">
          {names.map((n, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default function ChatArea({
  activeWorkspace,
  activeDestinationId,
  isDestinationDm,
  messages,
  messagesLoading,
  hasMoreMessages = false,
  loadingMoreMessages = false,
  onLoadMoreMessages,
  pinnedMessages = [],
  readReceipts = [],
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  onToggleReaction,
  onOpenThread,
  onOpenSearch,
  onToggleRightPanel,
  rightPanelOpen,
  onOpenMobileDrawer,
  highlightedMessageId,
  clearHighlight,
  onAddChannelClick,
  onAddWorkspaceClick,
  onChannelSettingsClick,
  onJoinWorkspaceClick,
  unreadNotifications = [],
  onJumpTo,
  onMarkAllAsRead,
  onMarkNotificationAsRead,
  activeTypers = [],
  onTypingStart,
  onTypingStop,
  activeRecorders = [],
  onRecordingStart,
  onRecordingStop,
  onOpenProfile,
  pinnedPanelOpen = false,
  onTogglePinnedPanel,
  onTogglePinMessage,
  scheduledMessages = [],
  onScheduleMessage,
  onCancelScheduledMessage,
  onScheduleReminder
}) {
  const { user, loading } = useAuth();
  const isCreator = activeWorkspace?.createdBy === user?.uid;
  const [inputText, setInputText] = useState('');
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);

  const activeWorkspaceUnreads = (unreadNotifications || []).filter(
    n => n.workspaceId === activeWorkspace?.id
  );
  const messageRefs = useRef({});

  const activeChannel = !isDestinationDm 
    ? activeWorkspace?.channels?.find(c => c.id === activeDestinationId) 
    : null;
  const activeDm = isDestinationDm 
    ? activeWorkspace?.dms?.find(d => d.id === activeDestinationId) 
    : null;

  const destinationName = activeChannel ? activeChannel.name : activeDm ? activeDm.name : '';
  const destinationDesc = activeChannel ? (activeChannel.description || activeChannel.desc || 'No description provided.') : `This is your direct message history with ${activeDm?.name}.`;
  const isPrivate = activeChannel ? activeChannel.isPrivate : false;

  const channelKey = activeWorkspace ? `${activeWorkspace.id}-${activeDestinationId}` : '';
  const activeMessages = messages[channelKey] || [];
  // Id of the most-recent (bottom-most) own real message — the read-status
  // indicator is shown only on this message (WhatsApp/iMessage/Slack style).
  const lastOwnMessageId = useMemo(() => {
    for (let i = activeMessages.length - 1; i >= 0; i--) {
      const m = activeMessages[i];
      if (m && m.senderId === user?.uid && !m.isEphemeral && !m.deletedForEveryone) return m.id;
    }
    return null;
  }, [activeMessages, user?.uid]);
  // Full pin count comes from the dedicated pinned query, not the paginated window.
  const pinnedCount = pinnedMessages.length;

  // Rich Composer states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachment, setAttachment] = useState(null);

  // Typing status refs & state
  const typingTimeoutRef = useRef(null);
  const [isTypingState, setIsTypingState] = useState(false);

  // Message deletion confirmation states
  const [deleteTargetMessageId, setDeleteTargetMessageId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  
  // Voice note / audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [micError, setMicError] = useState('');
  const [activeAudioId, setActiveAudioId] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);

  // Scheduled Messages & Reminders states
  const [showSchedulerPopover, setShowSchedulerPopover] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(null); // epoch milliseconds or null
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [ephemeralMessages, setEphemeralMessages] = useState([]);

  // Auto default when popover opens
  useEffect(() => {
    if (showSchedulerPopover) {
      const slot = getNextNearestSlot();
      setCustomDate(slot.dateStr);
      setCustomTime(slot.timeStr);
    }
  }, [showSchedulerPopover]);

  // Compute live validation state of custom input
  const isScheduleInvalid = React.useMemo(() => {
    if (!customDate || !customTime) return false;
    const [year, month, day] = customDate.split('-').map(Number);
    const [hour, min] = customTime.split(':').map(Number);
    const target = new Date(year, month - 1, day, hour, min, 0, 0);
    return isNaN(target.getTime()) || target.getTime() <= Date.now();
  }, [customDate, customTime]);

  // Voice note / audio recording refs
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const chunksRef = useRef([]);
  
  // Custom rich-interaction states
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState(null);
  const [activeToolbarReactionPickerId, setActiveToolbarReactionPickerId] = useState(null);
  const [bookmarks, setBookmarks] = useState({});
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');

  // Mention States
  const [mentionQuery, setMentionQuery] = useState(null); // string query or null if dropdown closed
  const [mentionStartIndex, setMentionStartIndex] = useState(-1); // where '@' starts
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0); // active dropdown selection index

  // Filtered members list for mention dropdown
  const filteredMembers = React.useMemo(() => {
    if (mentionQuery === null || !activeWorkspace?.allWorkspaceMembers) return [];
    const query = mentionQuery.toLowerCase();
    return activeWorkspace.allWorkspaceMembers.filter(member =>
      member.name.toLowerCase().includes(query)
    );
  }, [mentionQuery, activeWorkspace?.allWorkspaceMembers]);

  const handleEditClick = (msg) => {
    setEditingMessageId(msg.id);
    setEditText(msg.content);
    setActiveMenuMessageId(null);
  };

  const handleContainerClick = (e) => {
    const mentionLink = e.target.closest('.mention-link');
    if (mentionLink) {
      const uid = mentionLink.getAttribute('data-uid');
      if (uid && onOpenProfile) {
        onOpenProfile(uid);
      }
    }
  };

  const getUserName = (uid) => {
    if (uid === user?.uid) return 'You';
    const member = activeWorkspace?.allWorkspaceMembers?.find(m => m.id === uid);
    return member ? member.name : 'Unknown User';
  };

  const getCurrentName = (uid, fallback) => {
    const member = activeWorkspace?.allWorkspaceMembers?.find(m => m.id === uid);
    return member ? member.name : fallback;
  };

  const renderReactions = (msg) => {
    if (msg.deletedForEveryone) return null;
    const reactions = msg.reactions || {};
    const emojis = Object.keys(reactions);
    if (emojis.length === 0) {
      // Still show the "+" reaction shortcut on hover, but we will place a simple trigger here:
      return (
        <div className="flex flex-wrap gap-1 mt-1 font-sans select-none items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveReactionPickerMessageId(activeReactionPickerMessageId === msg.id ? null : msg.id)}
              className="inline-flex items-center justify-center w-6 h-5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Add reaction"
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>

            {activeReactionPickerMessageId === msg.id && (
              <>
                <div 
                  className="fixed inset-0 z-[70]" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveReactionPickerMessageId(null);
                  }}
                />
                <div className="absolute bottom-6 left-0 bg-white border border-[#E8E8E8] rounded-xl shadow-slack-popover p-2 z-[85] animate-in fade-in zoom-in-95 duration-100 flex gap-1 w-52 flex-wrap max-h-24 overflow-y-auto">
                  {['👍', '🔥', '🎉', '😂', '😮', '😢', '🙏', '❤️', '✅', '👀', '🚀', '💯'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onToggleReaction(msg.id, emoji);
                        setActiveReactionPickerMessageId(null);
                      }}
                      className="w-7 h-7 text-sm hover:bg-slate-100 rounded flex items-center justify-center transition-colors cursor-pointer active:scale-90"
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
      <div className="flex flex-wrap gap-1 mt-1.5 font-sans select-none items-center">
        {emojis.map(emoji => {
          const userIds = reactions[emoji] || [];
          const count = userIds.length;
          const hasReacted = userIds.includes(user?.uid);
          const reactedNames = userIds.map(uid => getUserName(uid)).join(', ');

          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggleReaction(msg.id, emoji)}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer relative group/reaction-pill ${
                hasReacted
                  ? 'bg-blue-50/70 border-blue-300 text-[#1164A3] hover:bg-blue-50 hover:border-blue-400 font-extrabold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 font-medium'
              }`}
              title={`${emoji} reacted by: ${reactedNames}`}
            >
              <span>{emoji}</span>
              <span className="text-[10px] opacity-90">{count}</span>

              {/* Hover Tooltip name list */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/reaction-pill:block bg-[#1D1C1D] text-white text-[10px] font-bold px-2 py-1 rounded shadow-slack-popover whitespace-nowrap z-[60] pointer-events-none border border-slate-700 animate-in fade-in zoom-in-95 duration-75">
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
            className="inline-flex items-center justify-center w-6 h-5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Add reaction"
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>

          {activeReactionPickerMessageId === msg.id && (
            <>
              <div 
                className="fixed inset-0 z-[70]" 
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveReactionPickerMessageId(null);
                }}
              />
              <div className="absolute bottom-6 left-0 bg-white border border-[#E8E8E8] rounded-xl shadow-slack-popover p-2 z-[85] animate-in fade-in zoom-in-95 duration-100 flex gap-1 w-52 flex-wrap max-h-24 overflow-y-auto">
                {['👍', '🔥', '🎉', '😂', '😮', '😢', '🙏', '❤️', '✅', '👀', '🚀', '💯'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onToggleReaction(msg.id, emoji);
                      setActiveReactionPickerMessageId(null);
                    }}
                    className="w-7 h-7 text-sm hover:bg-slate-100 rounded flex items-center justify-center transition-colors cursor-pointer active:scale-90"
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

  const renderThreadIndicator = (msg) => {
    const replies = activeMessages.filter(m => m.parentMessageId === msg.id);
    if (replies.length === 0) return null;

    return (
      <button
        type="button"
        onClick={() => onOpenThread(msg.id)}
        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-xs font-bold text-[#1164A3] rounded-md transition-all duration-100 cursor-pointer shadow-sm group/thread-trigger relative w-max"
        title="View thread replies"
      >
        <MessageSquare className="w-3.5 h-3.5 text-[#1164A3] shrink-0" />
        <span>
          {replies.length === 1 ? '1 reply' : `${replies.length} replies`}
        </span>
        <span className="text-[10px] text-slate-400 font-semibold group-hover/thread-trigger:underline ml-1">
          View thread
        </span>
      </button>
    );
  };

  // ── Read receipts ───────────────────────────────────────────────
  const getReceiptMillis = (ts) => {
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const formatSeenTime = (ts) => {
    const ms = getReceiptMillis(ts);
    if (!ms) return '';
    return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // Status shown only on the current user's OWN messages.
  const renderSeenStatus = (msg) => {
    if (!msg || !user || msg.senderId !== user.uid) return null;
    if (msg.isEphemeral || msg.deletedForEveryone) return null;
    if (msg.id !== lastOwnMessageId) return null;
    const msgMs = getReceiptMillis(msg.createdAt);
    if (!msgMs) return null;

    if (isDestinationDm) {
      const recipientReceipt = readReceipts.find(r => r.userId === activeDestinationId);
      const seenMs = recipientReceipt ? getReceiptMillis(recipientReceipt.lastReadAt) : 0;
      if (seenMs && seenMs >= msgMs) {
        return (
          <span className="flex items-center gap-1 text-[11px] text-[#1164A3] font-bold mt-0.5 select-none">
            <CheckCheck className="w-3.5 h-3.5 shrink-0" /> Seen {formatSeenTime(recipientReceipt.lastReadAt)}
          </span>
        );
      }
      // Delivered: recipient online now, or online after the message was sent.
      const recipientMember = activeWorkspace?.allWorkspaceMembers?.find(m => m.id === activeDestinationId);
      const isOnline = recipientMember && recipientMember.status === 'online';
      const presenceMs = recipientMember ? getReceiptMillis(recipientMember.lastSeenAt) : 0;
      if (isOnline || (presenceMs && presenceMs >= msgMs)) {
        return (
          <span className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold mt-0.5 select-none">
            <CheckCheck className="w-3.5 h-3.5 shrink-0" /> Delivered
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold mt-0.5 select-none">
          <Check className="w-3.5 h-3.5 shrink-0" /> Sent
        </span>
      );
    }

    // Channel: who has read up to this message (excluding the sender).
    const seenByNames = readReceipts
      .filter(r => r.userId !== user.uid && getReceiptMillis(r.lastReadAt) >= msgMs)
      .map(r => r.userName)
      .filter(Boolean);
    return <SeenByIndicator names={seenByNames} />;
  };

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // When loading older messages we prepend to the top, so preserve the user's
  // scroll position instead of jumping to the bottom.
  const isRestoringScrollRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  const handleLoadMoreClick = () => {
    if (containerRef.current) {
      prevScrollHeightRef.current = containerRef.current.scrollHeight;
      isRestoringScrollRef.current = true;
    }
    onLoadMoreMessages?.();
  };

  useLayoutEffect(() => {
    if (isRestoringScrollRef.current && containerRef.current) {
      // Keep the viewport anchored after older messages are prepended.
      const delta = containerRef.current.scrollHeight - prevScrollHeightRef.current;
      containerRef.current.scrollTop += delta;
      isRestoringScrollRef.current = false;
    } else if (!highlightedMessageId) {
      scrollToBottom();
    }
  }, [activeMessages.length, activeDestinationId]);

  useEffect(() => {
    const handleInsertMentionEvent = (e) => {
      const { userName } = e.detail;
      if (!userName) return;
      
      const textToInsert = `@${userName} `;
      setInputText(prev => {
        const textarea = textareaRef.current;
        if (!textarea) return prev + textToInsert;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;
        
        const updated = val.substring(0, start) + textToInsert + val.substring(end);
        
        // Refocus and place cursor after the mention
        setTimeout(() => {
          textarea.focus();
          const newCursorPos = start + textToInsert.length;
          textarea.selectionStart = newCursorPos;
          textarea.selectionEnd = newCursorPos;
        }, 50);
        
        return updated;
      });
    };
    
    window.addEventListener('insert-mention', handleInsertMentionEvent);
    return () => window.removeEventListener('insert-mention', handleInsertMentionEvent);
  }, []);

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

    if (file.size > 2 * 1024 * 1024) {
      alert("File size exceeds 2 MB limit. Please upload a smaller file.");
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

  // Cleanup typing status when ChatArea unmounts or switches
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (onTypingStop) onTypingStop();
    };
  }, [activeDestinationId, activeWorkspace?.id]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    // Mentions check
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursor);
    const lastWordMatch = textBeforeCursor.match(/(?:\s|^)@([a-zA-Z0-9_]*)$/);

    if (lastWordMatch) {
      const matchText = lastWordMatch[1];
      const startIndex = lastWordMatch.index + lastWordMatch[0].indexOf('@');
      setMentionQuery(matchText);
      setMentionStartIndex(startIndex);
      setSelectedMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionStartIndex(-1);
    }

    if (val.trim().length > 0) {
      if (!isTypingState) {
        setIsTypingState(true);
        if (onTypingStart) onTypingStart();
      }
      
      // Reset typing timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTypingState(false);
        if (onTypingStop) onTypingStop();
      }, 2000); // stops typing after 2 seconds of inactivity
    } else {
      // If text becomes completely empty, stop typing instantly (no wait)
      if (isTypingState) {
        setIsTypingState(false);
        if (onTypingStop) onTypingStop();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const insertMentionSelection = (member) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const val = textarea.value;
    const before = val.substring(0, mentionStartIndex);
    const after = val.substring(textarea.selectionStart);
    const mentionText = `@${member.name} `;
    const newVal = before + mentionText + after;

    setInputText(newVal);
    setMentionQuery(null);
    setMentionStartIndex(-1);

    // Set cursor focus and position after the inserted mention
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = mentionStartIndex + mentionText.length;
      textarea.selectionStart = newCursorPos;
      textarea.selectionEnd = newCursorPos;
    }, 50);
  };

  // Cleanup recording stream and timers when unmounting
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleStartRecording = async () => {
    setMicError('');
    chunksRef.current = [];
    setRecordedBlob(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const options = { audioBitsPerSecond: 16000 };
      let recorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        console.warn('MediaRecorder options failure, falling back to default:', e);
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setRecordedBlob(blob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsRecordingPaused(false);
      setRecordingDuration(0);
      if (onRecordingStart) onRecordingStart();

      // Start countdown / up timer
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= 179) { // 3 minutes limit (180 seconds)
            clearInterval(timerIntervalRef.current);
            handleStopRecordingForced();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.warn('Microphone permission blocked or failure:', err);
      setMicError('Microphone access denied. Enable permissions to record voice notes.');
    }
  };

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsRecordingPaused(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (onRecordingStop) onRecordingStop();
    }
  };

  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsRecordingPaused(false);
      if (onRecordingStart) onRecordingStart();
      
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= 179) {
            clearInterval(timerIntervalRef.current);
            handleStopRecordingForced();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const handleCancelRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null; // discard recording chunks
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setIsRecording(false);
    setIsRecordingPaused(false);
    setRecordingDuration(0);
    setRecordedBlob(null);
    chunksRef.current = [];
    if (onRecordingStop) onRecordingStop();
  };

  const handleStopRecordingForced = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsRecordingPaused(false);
    if (onRecordingStop) onRecordingStop();
  };

  const handleSendVoiceNote = async () => {
    if (onRecordingStop) onRecordingStop();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    const sendBlob = async (blob) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64DataUri = reader.result;
        onSendMessage('', {
          name: 'Voice Note.webm',
          size: blob.size,
          type: blob.type || 'audio/webm',
          url: base64DataUri
        });
        
        setIsRecording(false);
        setIsRecordingPaused(false);
        setRecordingDuration(0);
        setRecordedBlob(null);
        chunksRef.current = [];
      };
    };

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current.mimeType || 'audio/webm' });
        await sendBlob(blob);
      };
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    } else if (recordedBlob) {
      await sendBlob(recordedBlob);
    }
  };

  const handleSend = () => {
    if (!inputText.trim() && !attachment) return;

    // 1. Intercept /remind slash commands
    if (inputText.trim().startsWith('/remind')) {
      const parsed = parseReminderCommand(inputText);
      if (parsed) {
        onScheduleReminder(parsed.text, parsed.scheduledAt);
      } else {
        const ephemeralError = {
          id: `ephem-err-${Date.now()}`,
          senderId: 'slackbot',
          senderName: 'Slackbot',
          avatar: 'SB',
          content: `❌ Sorry, I couldn't parse that command. Try:\n• \`/remind review docs tomorrow\`\n• \`/remind team meeting at 4 PM\`\n• \`/remind review docs in 5 mins\``,
          isEphemeral: true,
          createdAt: Date.now(),
          destinationId: activeDestinationId
        };
        setEphemeralMessages(prev => [...prev, ephemeralError]);
      }
      setInputText('');
      setAttachment(null);
      setShowLinkModal(false);
      setShowEmojiPicker(false);
      setMentionQuery(null);
      setMentionStartIndex(-1);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setIsTypingState(false);
      if (onTypingStop) onTypingStop();
      return;
    }

    // 2. Intercept scheduled messages
    if (scheduledTime) {
      onScheduleMessage(inputText, attachment, null, scheduledTime);
      setScheduledTime(null);
    } else {
      onSendMessage(inputText, attachment);
    }

    setInputText('');
    setAttachment(null);
    setShowLinkModal(false);
    setShowEmojiPicker(false);
    setMentionQuery(null);
    setMentionStartIndex(-1);

    // Clear typing timeout and stop typing instantly!
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTypingState(false);
    if (onTypingStop) onTypingStop();
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => (prev + 1) % filteredMembers.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        insertMentionSelection(filteredMembers[selectedMentionIndex]);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        setMentionStartIndex(-1);
        return;
      }
    }

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
        <div className="mt-2 group/attachment relative inline-block select-none animate-in zoom-in-95 duration-100">
          <img 
            src={file.url} 
            alt={file.name}
            className="max-w-xs max-h-48 rounded-lg border border-slate-200 mt-1 hover:scale-[1.01] transition-transform duration-100 cursor-pointer shadow-sm"
            onClick={() => window.open(file.url, '_blank')}
          />
        </div>
      );
    } else {
      const isPdf = file.type.includes('pdf') || file.name.endsWith('.pdf');
      
      return (
        <div className="mt-2 p-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-lg max-w-xs transition-all flex items-center justify-between gap-3 font-sans select-none animate-in slide-in-from-top-1 duration-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 font-black text-[10px] shrink-0">
              {isPdf ? 'PDF' : 'DOC'}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1D1C1D] truncate" title={file.name}>
                {file.name}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <a 
            href={file.url} 
            download={file.name}
            className="px-2.5 py-1 text-[10px] font-bold text-[#1164A3] bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:border-slate-400 transition-colors shrink-0 shadow-sm"
          >
            Download
          </a>
        </div>
      );
    }
  };

  useEffect(() => {
    if (!highlightedMessageId) return;

    let attempts = 0;
    const tryScroll = () => {
      // Find the message element by id or reminderId
      const targetElement = Object.entries(messageRefs.current).find(([id, el]) => {
        if (!el) return false;
        if (id === highlightedMessageId) return true;
        const msg = activeMessages.find(m => m.id === id);
        return msg && msg.reminderId === highlightedMessageId;
      })?.[1];

      if (targetElement) {
        targetElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        setTimeout(() => {
          if (clearHighlight) clearHighlight();
        }, 2000);
        
        return true;
      }
      return false;
    };

    // Try immediately
    if (tryScroll()) return;

    // Retry periodically up to 3 seconds if messages are still loading or rendering
    const interval = setInterval(() => {
      attempts++;
      if (tryScroll() || attempts > 30) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [highlightedMessageId, activeMessages, messagesLoading]);

  // 1. EMPTY STATE: NO WORKSPACE
  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] items-center justify-center p-6 text-center select-none font-sans relative" aria-label="Loading profile skeleton">
        <header className="absolute top-0 left-0 right-0 h-[52px] bg-[#FFFFFF] border-b border-[#E8E8E8] px-6 flex items-center shrink-0">
          <div className="w-[100px] h-4 bg-slate-100 rounded-md animate-pulse animate-in fade-in" />
        </header>
        <div className="max-w-md space-y-6 animate-pulse">
          {/* Circular avatar placeholder */}
          <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto" />
          <div className="space-y-3">
            {/* Title placeholder */}
            <div className="w-[220px] h-6 bg-slate-100 rounded-md mx-auto" />
            {/* Subtitle placeholders */}
            <div className="w-[300px] h-4 bg-slate-100 rounded-md mx-auto" />
            <div className="w-[240px] h-4 bg-slate-100 rounded-md mx-auto" />
          </div>
          {/* Button placeholders */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 select-none">
            <div className="w-36 h-10 bg-slate-100 rounded-lg" />
            <div className="w-36 h-10 bg-slate-100 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!activeWorkspace) {
    const userName = user?.name || 'Slack User';
    const userInitials = user?.avatarInitials || getInitials(userName);

    return (
      <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] items-center justify-center p-6 text-center select-none font-sans relative" aria-label="No workspaces empty state">
        <header className="absolute top-0 left-0 right-0 h-[52px] bg-[#FFFFFF] border-b border-[#E8E8E8] px-6 flex items-center shrink-0">
          <button
            onClick={onOpenMobileDrawer}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700 sm:hidden shrink-0 mr-3"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-[15px] font-extrabold text-[#1D1C1D] tracking-tight">slack</span>
        </header>

        <div className="max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* User avatar initials badge */}
          <div className={`w-20 h-20 rounded-full text-white font-extrabold flex items-center justify-center text-2xl mx-auto shadow-md ring-8 ring-slate-50/50 hover:scale-105 transition-transform duration-200 select-none ${
            userName ? getAvatarColorClass(userName) : 'bg-[#522653]'
          }`}>
            {userInitials}
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-black text-[#1D1C1D] tracking-tight">
              Welcome to Slack, {userName}
            </h2>
            <p className="text-[14px] text-[#616061] leading-relaxed max-w-sm mx-auto font-normal">
              Create your own workspace to start collaborating with your team or join an existing workspace using an invite.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 select-none">
            <button
              type="button"
              onClick={onAddWorkspaceClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#522653] hover:bg-[#441f45] text-white text-sm font-bold rounded-lg transition-all shadow-sm scale-100 hover:scale-105 active:scale-95 cursor-pointer"
            >
              Create workspace
            </button>
            <button
              type="button"
              onClick={onJoinWorkspaceClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-bold rounded-lg transition-all shadow-sm scale-100 hover:scale-105 active:scale-95 cursor-pointer"
            >
              Join workspace
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. EMPTY STATE: NO CHANNELS OR DMS (Empty Workspace)
  const hasChannels = activeWorkspace.channels && activeWorkspace.channels.length > 0;
  const hasDms = activeWorkspace.dms && activeWorkspace.dms.length > 0;

  if (!hasChannels && !hasDms) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] relative min-w-0 font-sans" aria-label="No channels empty state">
        <header className="h-[52px] bg-[#FFFFFF] border-b border-[#E8E8E8] px-6 flex items-center shrink-0 select-none">
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenMobileDrawer}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-700 sm:hidden shrink-0"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-[16px] font-bold text-[#1D1C1D] truncate leading-tight tracking-tight">
              {activeWorkspace.name}
            </h1>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto shadow-sm ring-8 ring-slate-50/50">
              <Hash className="w-10 h-10 text-[#1164A3]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-[#1D1C1D] tracking-tight">This workspace has no channels yet</h2>
              <p className="text-sm text-[#616061] leading-relaxed">
                Channels are where your team discusses projects, coordinates events, and shares banter. Create a channel to get the conversations started!
              </p>
            </div>
            {isCreator ? (
              <button
                type="button"
                onClick={onAddChannelClick}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1164A3] hover:bg-[#1164A3]/90 text-white text-sm font-bold rounded-lg transition-all shadow-sm scale-100 hover:scale-105 active:scale-[0.95] cursor-pointer"
              >
                Create a channel
              </button>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs font-semibold select-none max-w-xs mx-auto">
                Only the workspace creator can create channels in this workspace.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] relative min-w-0 font-sans" aria-label="Chat Area">
      
      {/* 1. TOP HEADER - TALLER, CLEAN WHITE, TIGHTER SPACING, #E8E8E8 border */}
      <header className="h-[52px] bg-[#FFFFFF] border-b border-[#E8E8E8] px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0 select-none">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={onOpenMobileDrawer}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700 sm:hidden shrink-0"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex flex-col min-w-0">
            <h1 className="text-[16px] font-bold text-[#1D1C1D] flex items-center gap-1 leading-tight tracking-tight min-w-0">
              {!isDestinationDm ? (
                isPrivate ? (
                  <Lock className="w-4 h-4 text-[#1D1C1D] shrink-0" />
                ) : (
                  <Hash className="w-4 h-4 text-[#1D1C1D] shrink-0 opacity-80" />
                )
              ) : (
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  activeDm?.status === 'online' ? 'bg-[#2BAC76]' : 'bg-slate-300'
                }`} />
              )}
              {isDestinationDm ? (
                <button
                  onClick={() => onOpenProfile && onOpenProfile(activeDestinationId)}
                  className="truncate text-left hover:underline cursor-pointer font-bold flex items-center min-w-0 focus:outline-none"
                  title="View user profile"
                >
                  <span className="truncate" title={destinationName}>{destinationName}</span>
                </button>
              ) : (
                <span className="truncate" title={destinationName}>{destinationName}</span>
              )}
              {!isDestinationDm && activeChannel && isCreator && (
                <button
                  onClick={onChannelSettingsClick}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors ml-1 cursor-pointer shrink-0"
                  title="Channel settings (Edit/Delete)"
                  aria-label="Channel settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </h1>
            <p className="text-[12px] text-[#616061] truncate hidden sm:block mt-0.5 leading-none">
              {destinationDesc}
            </p>
          </div>
        </div>

        {/* Header Search Shortcuts */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={onOpenSearch}
            className="flex items-center justify-center sm:justify-start gap-2 px-2 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-[#E8E8E8] hover:border-slate-300 rounded-md text-[12px] text-[#616061] font-medium transition-all w-9 sm:w-32 md:w-40 lg:w-56 text-left shrink-0"
            title="Search channels and messages"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate opacity-75 hidden sm:inline">Search messages...</span>
          </button>

          {/* Notifications Bell Button */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 shrink-0 transition-colors border border-transparent active:scale-[0.97] transition-all font-sans relative ${
                showNotificationsDropdown ? 'bg-slate-100 text-[#1164A3] hover:text-[#1164A3] border-[#E8E8E8] shadow-sm font-extrabold' : 'font-bold'
              }`}
              title="Notifications"
              aria-label="Toggle notifications dropdown"
            >
              <Bell className="w-4 h-4 shrink-0" />
              {activeWorkspaceUnreads.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white font-extrabold text-[9px] flex items-center justify-center border border-white animate-pulse">
                  {activeWorkspaceUnreads.length}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {showNotificationsDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-[60]" 
                  onClick={() => setShowNotificationsDropdown(false)}
                />
                <div className="absolute right-0 mt-1.5 w-80 sm:w-[340px] bg-white border border-[#E8E8E8] rounded-xl shadow-slack-popover flex flex-col z-[80] animate-in fade-in slide-in-from-top-2 duration-100 overflow-hidden font-sans select-none max-h-[380px]">
                  
                  {/* Header */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-150 flex items-center justify-between shrink-0">
                    <span className="text-xs font-black text-[#1D1C1D] flex items-center gap-1.5">
                      <span>Notifications</span>
                      {activeWorkspaceUnreads.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-black leading-none">
                          {activeWorkspaceUnreads.length} unread
                        </span>
                      )}
                    </span>
                    {activeWorkspaceUnreads.length > 0 && (
                      <button
                        onClick={() => {
                          onMarkAllAsRead();
                          setShowNotificationsDropdown(false);
                        }}
                        className="text-[10px] font-black text-[#1164A3] hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Feed container */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 min-h-0">
                    {activeWorkspaceUnreads.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 font-semibold select-none h-44">
                        <span className="text-2xl mb-1 select-none">🔔</span>
                        <p className="text-xs font-bold text-slate-600">All caught up!</p>
                        <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">No unread notifications in this workspace.</p>
                      </div>
                    ) : (
                      activeWorkspaceUnreads.map(notif => {
                        const notifDate = notif.createdAt ? (typeof notif.createdAt.toDate === 'function' ? notif.createdAt.toDate() : new Date(notif.createdAt)) : new Date();
                        const timeString = notifDate.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        });

                        const isReminder = notif.type === 'reminder' || notif.senderName === 'Slackbot';
                        const senderName = isReminder ? '🔔 Reminder' : notif.senderName;
                        const initials = isReminder ? 'SB' : getInitials(notif.senderName || 'US');
                        const avatarBg = isReminder ? 'bg-[#613064]' : getAvatarColorClass(notif.senderName || 'Unknown');

                        return (
                          <button
                            key={notif.id}
                            onClick={() => {
                              onJumpTo(
                                notif.destinationId,
                                notif.isDestinationDm,
                                notif.messageId || null,
                                notif.workspaceId,
                                notif.parentMessageId || null
                              );
                              if (typeof onMarkNotificationAsRead === 'function') {
                                onMarkNotificationAsRead(notif.id);
                              }
                              setShowNotificationsDropdown(false);
                            }}
                            className="w-full p-3 hover:bg-slate-50 flex items-start gap-2.5 text-left transition-colors cursor-pointer group/notif-row"
                          >
                            {/* Avatar */}
                            <div className={`w-7.5 h-7.5 rounded-full text-white font-extrabold flex items-center justify-center text-[10px] shrink-0 shadow-sm ${avatarBg}`}>
                              {initials}
                            </div>

                            {/* Details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between select-none">
                                <span className="text-xs font-bold text-[#1D1C1D] group-hover/notif-row:text-[#1164A3] transition-colors truncate pr-1">
                                  {senderName}
                                </span>
                                <span className="text-[9px] text-slate-400 font-semibold shrink-0">
                                  {timeString}
                                </span>
                              </div>
                              {isReminder ? (
                                <p className="text-[10px] text-slate-500 font-bold mt-0.5 flex items-center gap-1 select-none">
                                  <span>from Slackbot</span>
                                </p>
                              ) : (
                                <p className="text-[10px] text-slate-500 font-bold mt-0.5 flex items-center gap-1 select-none">
                                  <span>{notif.type === 'mention' ? 'mentioned you in' : 'in'}</span>
                                  <span className="text-[#1164A3] truncate">
                                    {notif.type === 'dm' ? 'Direct Message' : notif.type === 'invite' ? 'Invites' : `#${notif.destinationName}`}
                                  </span>
                                </p>
                              )}
                              <p className="text-[11.5px] text-slate-700 font-normal truncate mt-1 leading-normal">
                                {renderFormattedContent(notif.content, activeWorkspace?.allWorkspaceMembers)}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Pinned Messages Button */}
          <button
            onClick={onTogglePinnedPanel}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-amber-600 hover:text-amber-800 hover:bg-amber-50 shrink-0 transition-colors border active:scale-[0.97] transition-all font-sans relative ${
              pinnedPanelOpen ? 'bg-amber-50 text-amber-800 border-amber-200 shadow-sm font-extrabold' : 'font-bold border-transparent bg-transparent'
            }`}
            aria-label="Toggle pinned messages"
            title="Pinned Messages"
          >
            <Pin className={`w-4 h-4 shrink-0 text-amber-500 ${pinnedPanelOpen ? 'fill-amber-500' : ''}`} />
            {pinnedCount > 0 && (
              <span className="text-xs font-black leading-none bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">
                {pinnedCount}
              </span>
            )}
          </button>

          <button
            onClick={onToggleRightPanel}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 shrink-0 transition-colors border border-transparent active:scale-[0.97] transition-all font-sans ${
              rightPanelOpen ? 'bg-slate-100 text-[#1164A3] hover:text-[#1164A3] border-[#E8E8E8] shadow-sm font-extrabold' : 'font-bold'
            }`}
            aria-label="Toggle members list"
            title="Workspace Members"
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="text-xs leading-none">
              {activeWorkspace?.members?.length || 0}
            </span>
          </button>
        </div>
      </header>

      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-5 bg-[#FFFFFF] relative"
        onClick={handleContainerClick}
      >
        {messagesLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 select-none z-10 animate-in fade-in duration-150">
            <Loader2 className="w-7 h-7 animate-spin text-[#522653] mb-1.5 shrink-0" />
            <span className="text-[12px] text-[#616061] font-bold">Syncing conversations...</span>
          </div>
        )}
        {/* Load older messages OR start-of-history header */}
        {hasMoreMessages ? (
          <div className="flex justify-center py-3 select-none">
            <button
              onClick={handleLoadMoreClick}
              disabled={loadingMoreMessages}
              className="flex items-center gap-2 px-4 py-1.5 text-[13px] font-bold text-[#1164A3] hover:bg-[#1164A3]/10 rounded-full border border-[#1164A3]/30 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default"
            >
              {loadingMoreMessages ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  Loading older messages…
                </>
              ) : (
                'Load older messages'
              )}
            </button>
          </div>
        ) : (
          /* Welcome Header */
          <div className="border-b border-[#E8E8E8] pb-5 mb-5 select-none animate-in fade-in duration-200">
            <div className="w-12 h-12 bg-[#522653] text-white flex items-center justify-center font-bold rounded-lg text-lg mb-3 shadow-sm">
              {isDestinationDm ? getInitials(destinationName) : '#'}
            </div>
            <h2 className="text-xl font-extrabold text-[#1D1C1D] tracking-tight">
              This is the start of the {isDestinationDm ? `direct message history with ${destinationName}` : `#${destinationName} channel`}
            </h2>
            <p className="text-[14px] text-[#616061] mt-1.5 leading-relaxed max-w-3xl">
              {destinationDesc} Use this space to exchange ideas, post updates, and collaborate.
            </p>
          </div>
        )}

        {/* Message Log Stack */}
        <div className="space-y-[3px]">
          {(() => {
            const mainMessages = [
              ...activeMessages.filter(m => !m.parentMessageId && !(m.deletedFor && m.deletedFor.includes(user?.uid)) && (!m.isEphemeral || m.createdBy === user?.uid)),
              ...ephemeralMessages.filter(m => m.destinationId === activeDestinationId && !m.parentMessageId)
            ].sort((a, b) => {
              const timeA = a.createdAt ? (typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
              const timeB = b.createdAt ? (typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
              return timeA - timeB;
            });
            return mainMessages.map((msg, index) => {
              const prevMsg = index > 0 ? mainMessages[index - 1] : null;
              const currentDate = getMessageDate(msg);
              const prevDate = prevMsg ? getMessageDate(prevMsg) : null;
              const isNewDay = !prevDate || !isSameDay(currentDate, prevDate);

              // Group messages only if same sender AND same calendar day AND within 5 minutes!
              const isCloseTogether = prevDate && (currentDate.getTime() - prevDate.getTime()) < 5 * 60 * 1000;
              const isGrouped = prevMsg && prevMsg.senderId === msg.senderId && !isNewDay && isCloseTogether && !msg.isEphemeral && !prevMsg.isEphemeral;
              const isHighlighted = highlightedMessageId && (highlightedMessageId === msg.id || highlightedMessageId === msg.reminderId);

              // Sender of this message is current user OR current user is workspace creator
              const canDelete = !msg.isEphemeral && (msg.senderId === user?.uid || isCreator);
              const canTogglePin = !msg.isEphemeral && (msg.senderId === user?.uid || isCreator);

              return (
                <div key={msg.id} className="flex flex-col animate-in fade-in duration-100">
                  {/* Clean Horizontal Date Separator Divider */}
                  {isNewDay && (
                    <div className="flex items-center my-4 select-none">
                      <div className="flex-1 h-[1px] bg-slate-200" />
                      <span className="px-4 text-[12px] font-bold text-slate-500 bg-white leading-none font-sans">
                        {formatDateHeader(currentDate)}
                      </span>
                      <div className="flex-1 h-[1px] bg-slate-200" />
                    </div>
                  )}

                  {msg.isPinned && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 ml-[54px] mt-1.5 -mb-0.5 select-none animate-in fade-in duration-100">
                      <Pin className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
                      <span>Pinned</span>
                    </div>
                  )}

                  <div
                    ref={el => messageRefs.current[msg.id] = el}
                    className={`relative group flex items-start px-6 py-1 -mx-6 rounded border-l-[3px] pl-[21px] transition-all duration-[2000ms] ease-out ${
                      isHighlighted ? 'bg-[#E8F5FA] border-[#36C5F0]' : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    {/* Floating message toolbar */}
                    {!msg.deletedForEveryone && !msg.isEphemeral && (
                      <div className={`absolute right-6 -top-3.5 ${activeMenuMessageId === msg.id || activeToolbarReactionPickerId === msg.id ? 'flex' : 'hidden group-hover:flex'} items-center gap-0.5 bg-white border border-[#E8E8E8] rounded-lg shadow-slack-popover p-0.5 z-[20] animate-in fade-in duration-75`}>
                        
                        {/* Add reaction button */}
                        <div className="relative">
                          <button 
                            onClick={() => setActiveToolbarReactionPickerId(activeToolbarReactionPickerId === msg.id ? null : msg.id)}
                            className={`p-1 rounded animate-in zoom-in-95 duration-100 cursor-pointer ${
                              activeToolbarReactionPickerId === msg.id ? 'bg-slate-100 text-[#1D1C1D]' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                            }`}
                            title="Add reaction"
                          >
                            <SmilePlus className="w-4 h-4" />
                          </button>

                          {activeToolbarReactionPickerId === msg.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-[70]" 
                                onClick={(e) => { e.stopPropagation(); setActiveToolbarReactionPickerId(null); }}
                              />
                              <div className="absolute right-0 bottom-6 bg-white border border-[#E8E8E8] rounded-xl shadow-slack-popover p-2 z-[85] animate-in fade-in zoom-in-95 duration-100 flex gap-1 w-52 flex-wrap max-h-24 overflow-y-auto">
                                {['👍', '🔥', '🎉', '😂', '😮', '😢', '🙏', '❤️', '✅', '👀', '🚀', '💯'].map(emoji => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                      onToggleReaction(msg.id, emoji);
                                      setActiveToolbarReactionPickerId(null);
                                    }}
                                    className="w-7 h-7 text-sm hover:bg-slate-100 rounded flex items-center justify-center transition-colors cursor-pointer active:scale-90"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Reply in thread button */}
                        <button 
                          onClick={() => onOpenThread(msg.id)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 animate-in zoom-in-95 duration-100 cursor-pointer" 
                          title="Reply in thread"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>

                        {/* Bookmark message button */}
                        <button 
                          onClick={() => setBookmarks(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                          className={`p-1 hover:bg-slate-100 rounded animate-in zoom-in-95 duration-100 cursor-pointer ${
                            bookmarks[msg.id] ? 'text-amber-500 hover:text-amber-600' : 'text-slate-400 hover:text-slate-600'
                          }`}
                          title={bookmarks[msg.id] ? 'Remove bookmark' : 'Bookmark message'}
                        >
                          <Bookmark className={`w-4 h-4 ${bookmarks[msg.id] ? 'fill-amber-500' : ''}`} />
                        </button>
                        
                        {/* More actions (3-dot menu) */}
                        <div className="relative">
                          <button 
                            onClick={() => setActiveMenuMessageId(activeMenuMessageId === msg.id ? null : msg.id)}
                            className={`p-1 rounded animate-in zoom-in-95 duration-100 cursor-pointer ${
                              activeMenuMessageId === msg.id ? 'bg-slate-200 text-[#1D1C1D]' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                            }`}
                            title="More actions"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {activeMenuMessageId === msg.id && (
                            <>
                              {/* Close backdrop */}
                              <div 
                                className="fixed inset-0 z-[30]" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuMessageId(null);
                                }}
                              />
                              
                              {/* Dropdown Menu */}
                              <div className="absolute right-0 mt-1 w-48 bg-white border border-[#E8E8E8] rounded-lg shadow-slack-popover py-1 z-[40] animate-in fade-in slide-in-from-top-1 duration-100 font-sans">
                                {/* Edit Message option */}
                                <button
                                  onClick={() => handleEditClick(msg)}
                                  className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>Edit message</span>
                                </button>

                                {/* Pin / Unpin option */}
                                {canTogglePin ? (
                                  <button
                                    onClick={() => {
                                      if (onTogglePinMessage) onTogglePinMessage(msg.id);
                                      setActiveMenuMessageId(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-100"
                                  >
                                    <Pin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span>{msg.isPinned ? 'Unpin message' : 'Pin message'}</span>
                                  </button>
                                ) : null}

                                {/* Delete Message option */}
                                {canDelete ? (
                                  <button
                                    onClick={() => {
                                      setDeleteTargetMessageId(msg.id);
                                      setActiveMenuMessageId(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete message</span>
                                  </button>
                                ) : (
                                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 border-t border-slate-100 select-none">
                                    Only sender/creator can delete
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {isGrouped ? (
                      /* Grouped message layout - EXACT LEFT TEXT ALIGNMENT at 48px */
                      <>
                        {/* Timestamp column */}
                        <div className="w-9 text-[10px] text-slate-400 text-right pr-2 shrink-0 select-none pt-0.5 font-semibold">
                          {msg.timestamp.split(' ')[0] || msg.timestamp}
                        </div>
                        {/* Text aligns with standard message text column (exactly 12px margin) */}
                        <div className="flex-1 min-w-0 ml-3 text-[15px] text-[#1D1C1D] leading-relaxed font-sans flex flex-col">
                          {msg.deletedForEveryone ? (
                            <div className="text-[15px] leading-relaxed select-none">
                              <span className="text-slate-400 italic">
                                {msg.deletedByAdmin ? 'This message was deleted by admin' : 'This message was deleted'}
                              </span>
                              {msg.deletedAtTime && (
                                <span className="text-[11px] text-slate-400 ml-1.5 font-medium not-italic font-sans">
                                  (Deleted at {msg.deletedAtTime})
                                </span>
                              )}
                            </div>
                          ) : editingMessageId === msg.id ? (
                            <div className="flex flex-col gap-1.5 mt-1 font-sans">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    onEditMessage(msg.id, editText);
                                    setEditingMessageId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingMessageId(null);
                                  }
                                }}
                                className="w-full text-sm font-semibold p-2 border border-[#1164A3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] bg-white resize-none max-h-24 min-h-[44px]"
                                autoFocus
                              />
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    onEditMessage(msg.id, editText);
                                    setEditingMessageId(null);
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded-md transition-colors cursor-pointer shadow-sm"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingMessageId(null)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-slate-500 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shadow-sm"
                                >
                                  Cancel
                                </button>
                                <span className="text-[10px] text-slate-400 font-bold ml-2">
                                  <b>Enter</b> to save • <b>Esc</b> to cancel
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[15px] text-[#1D1C1D] leading-relaxed break-words">
                              <span className="inline">{renderFormattedContent(msg.content, activeWorkspace?.allWorkspaceMembers)}</span>
                              {msg.isEdited && <span className="text-[10px] text-slate-400 font-semibold ml-1.5 select-none inline-block align-baseline" title="This message has been edited">(edited)</span>}
                              {bookmarks[msg.id] && <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0 ml-1.5 inline-block align-middle animate-in zoom-in-95 duration-100" title="Bookmarked message" />}
                              {msg.file && renderAttachment(msg.file, msg.id)}
                            </div>
                          )}
                          {renderReactions(msg)}
                          {renderThreadIndicator(msg)}
                          {renderSeenStatus(msg)}
                        </div>
                      </>
                    ) : (() => {
                      const isEphem = msg.isEphemeral;
                      const senderName = isEphem ? 'Slackbot' : getCurrentName(msg.senderId, msg.senderName);
                      const initials = isEphem ? 'SB' : getInitials(senderName);
                      const avatarBg = isEphem ? 'bg-[#613064]' : getAvatarColorClass(senderName);

                      return (
                        <>
                          {/* Perfect Avatar Circle badge */}
                          <div 
                            onClick={() => !isEphem && onOpenProfile && onOpenProfile(msg.senderId)}
                            className={`w-9 h-9 rounded-full text-white font-extrabold flex items-center justify-center text-sm shrink-0 shadow-sm transition-all duration-100 ${isEphem ? 'cursor-default bg-[#613064]' : 'hover:scale-105 cursor-pointer ' + avatarBg}`}
                          >
                            {initials}
                          </div>
                          
                          {/* Content Block */}
                          <div className="flex-1 min-w-0 ml-3 font-sans flex flex-col">
                            <div className="flex items-baseline gap-2 mb-0.5 select-none">
                              <span 
                                onClick={() => !isEphem && onOpenProfile && onOpenProfile(msg.senderId)}
                                className={`font-bold text-[15px] text-[#1D1C1D] flex items-center gap-1 ${isEphem ? 'cursor-default' : 'hover:underline cursor-pointer'}`}
                              >
                                <span>{senderName}</span>
                                {isEphem && (
                                  <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-500 font-black tracking-wide uppercase select-none">Bot</span>
                                )}
                                {!isEphem && !msg.deletedForEveryone && bookmarks[msg.id] && <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" title="Bookmarked message" />}
                              </span>
                              <span className="text-[12px] text-[#616061] font-medium">
                                {isEphem ? '(Only visible to you)' : msg.timestamp} {!isEphem && msg.isEdited && <span className="text-[9px] text-slate-400 font-bold ml-1 hover:underline cursor-help select-none" title="This message has been edited">(edited)</span>}
                              </span>
                            </div>
                            
                            {msg.deletedForEveryone ? (
                              <div className="text-[15px] leading-relaxed select-none">
                                <span className="text-slate-400 italic">
                                  {msg.deletedByAdmin ? 'This message was deleted by admin' : 'This message was deleted'}
                                </span>
                                {msg.deletedAtTime && (
                                  <span className="text-[11px] text-slate-400 ml-1.5 font-medium not-italic font-sans">
                                    (Deleted at {msg.deletedAtTime})
                                  </span>
                                )}
                              </div>
                            ) : editingMessageId === msg.id ? (
                              <div className="flex flex-col gap-1.5 mt-1 font-sans">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      onEditMessage(msg.id, editText);
                                      setEditingMessageId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingMessageId(null);
                                    }
                                  }}
                                  className="w-full text-sm font-semibold p-2 border border-[#1164A3] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] bg-white resize-none max-h-24 min-h-[44px]"
                                  autoFocus
                                />
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      onEditMessage(msg.id, editText);
                                      setEditingMessageId(null);
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#1164A3] hover:bg-[#1164A3]/90 rounded-md transition-colors cursor-pointer shadow-sm"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingMessageId(null)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-slate-500 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shadow-sm"
                                  >
                                    Cancel
                                  </button>
                                  <span className="text-[10px] text-slate-400 font-bold ml-2">
                                    <b>Enter</b> to save • <b>Esc</b> to cancel
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className={`text-[15px] text-[#1D1C1D] leading-relaxed ${isEphem ? 'text-slate-550 font-sans italic border-l-2 border-slate-200 pl-2.5 mt-0.5' : ''}`}>
                                {renderFormattedContent(msg.content, activeWorkspace?.allWorkspaceMembers)}
                                {msg.file && renderAttachment(msg.file, msg.id)}
                              </div>
                            )}
                            {renderReactions(msg)}
                            {renderThreadIndicator(msg)}
                            {renderSeenStatus(msg)}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            });
          })()}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 3. COMPOSER PANEL - FLOATING ROUNDED BOX WITH EXACT TOOLBAR STYLE */}
      <footer className="p-6 pt-1 select-none shrink-0 bg-white">
        {/* Active Scheduled Messages List (above composer) */}
        {(() => {
          const activeScheduled = (scheduledMessages || []).filter(
            m => m.destinationId === activeDestinationId && !m.parentMessageId && m.status === 'pending'
          );
          if (activeScheduled.length === 0) return null;
          return (
            <div className="flex flex-col gap-2 mb-3.5 max-h-48 overflow-y-auto custom-scrollbar">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">Scheduled Messages</span>
              {activeScheduled.map(sMsg => (
                <div 
                  key={sMsg.id} 
                  className="px-3.5 py-2.5 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between text-xs font-semibold text-amber-800 animate-in fade-in slide-in-from-bottom-2 duration-150 shadow-sm"
                >
                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <span className="text-[10.5px] text-amber-700 font-extrabold flex items-center gap-1 select-none">
                      <span>⏰</span>
                      <span>Scheduled for {formatReminderTime(sMsg.scheduledAt)}</span>
                    </span>
                    <p className="text-[11.5px] text-slate-800 font-normal truncate mt-0.5 max-w-[90%]">
                      {sMsg.content || (sMsg.file ? `Attachment: ${sMsg.file.name}` : '')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 select-none">
                    <button
                      type="button"
                      onClick={() => {
                        setInputText(sMsg.content || '');
                        if (sMsg.file) setAttachment(sMsg.file);
                        setScheduledTime(sMsg.scheduledAt ? (sMsg.scheduledAt.toDate ? sMsg.scheduledAt.toDate().getTime() : new Date(sMsg.scheduledAt).getTime()) : null);
                        onCancelScheduledMessage(sMsg.id);
                      }}
                      className="px-2 py-1 text-[10px] font-extrabold text-[#1164A3] bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-350 rounded cursor-pointer transition-colors shadow-xs active:scale-95"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onCancelScheduledMessage(sMsg.id)}
                      className="px-2 py-1 text-[10px] font-extrabold text-red-600 bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 rounded cursor-pointer transition-colors shadow-xs active:scale-95"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        {/* Typing & Recording status bar */}
        <div className="h-5 flex items-center mb-1 px-1">
          {activeRecorders && activeRecorders.length > 0 ? (
            <div className="text-[12px] text-slate-500 font-medium flex items-center gap-1.5 animate-in fade-in duration-200">
              <span className="inline-flex items-center justify-center text-[11px] animate-pulse">🎤</span>
              <span className="truncate max-w-[240px] font-bold text-slate-600">
                {activeRecorders.length === 1
                  ? `${activeRecorders[0].userName}`
                  : activeRecorders.length === 2
                    ? `${activeRecorders[0].userName} and ${activeRecorders[1].userName}`
                    : `${activeRecorders[0].userName}, ${activeRecorders[1].userName} and ${activeRecorders.length - 2} others`
                }
              </span>
              <span>
                {activeRecorders.length === 1
                  ? isDestinationDm 
                    ? 'is recording...' 
                    : 'is recording a voice note...'
                  : isDestinationDm 
                    ? 'are recording...' 
                    : 'are recording a voice note...'
                }
              </span>
              <span className="flex items-center gap-0.5 ml-1 select-none">
                <span className="w-0.5 h-2 bg-[#1164A3] rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-0.5 h-3 bg-[#1164A3] rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-0.5 h-1 bg-[#1164A3] rounded-full animate-bounce" />
              </span>
            </div>
          ) : activeTypers && activeTypers.length > 0 ? (
            <div className="text-[12px] text-slate-500 font-medium flex items-center gap-1.5 animate-in fade-in duration-200">
              <span className="truncate max-w-[240px] font-bold text-slate-600">
                {activeTypers.length === 1
                  ? `${activeTypers[0].userName}`
                  : activeTypers.length === 2
                    ? `${activeTypers[0].userName} and ${activeTypers[1].userName}`
                    : `${activeTypers[0].userName}, ${activeTypers[1].userName} and ${activeTypers.length - 2} others`
                }
              </span>
              <span>{activeTypers.length === 1 ? 'is typing' : 'are typing'}</span>
              <span className="flex items-center gap-0.5 ml-0.5 mt-0.5 select-none">
                <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" />
              </span>
            </div>
          ) : null}
        </div>
        <div className="relative">
          {/* Mention Dropdown list */}
          {mentionQuery !== null && filteredMembers.length > 0 && (
            <div className="absolute bottom-[calc(100%+8px)] left-0 w-64 bg-white border border-[#E8E8E8] rounded-xl shadow-slack-popover max-h-56 overflow-y-auto flex flex-col z-[110] animate-in fade-in slide-in-from-bottom-2 duration-150 font-sans select-none">
              {filteredMembers.map((member, idx) => {
                const isSelected = idx === selectedMentionIndex;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => insertMentionSelection(member)}
                    onMouseEnter={() => setSelectedMentionIndex(idx)}
                    className={`w-full px-4 py-2.5 sm:py-3 flex items-center gap-2.5 text-left text-sm font-semibold transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#1164A3] text-white' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className={`w-6.5 h-6.5 rounded-full text-white font-black flex items-center justify-center text-[9px] shrink-0 ${
                      isSelected ? 'bg-white/20' : getAvatarColorClass(member.name)
                    }`}>
                      {getInitials(member.name)}
                    </div>
                    <div className="flex-1 truncate">
                      <span>{member.name}</span>
                      {member.role && (
                        <span className={`text-[10px] ml-1.5 font-medium ${
                          isSelected ? 'text-white/60' : 'text-slate-400'
                        }`}>
                          {member.role}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

        {micError && (
          <div className="flex items-center justify-between px-4 py-2 bg-red-50 border border-red-200 rounded-lg mb-2 animate-in slide-in-from-bottom-2 duration-100 font-sans mx-1">
            <span className="text-xs font-bold text-red-600 flex items-center gap-1.5 select-none">
              <span>⚠️</span>
              <span>{micError}</span>
            </span>
            <button 
              type="button"
              onClick={() => setMicError('')}
              className="p-1 hover:bg-red-100 rounded-full text-red-400 hover:text-red-600 transition-colors cursor-pointer"
              title="Dismiss warning"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="border border-[#E8E8E8] focus-within:ring-1 focus-within:ring-[#1164A3] focus-within:border-[#1164A3] rounded-xl flex flex-col overflow-visible bg-white shadow-sm transition-all duration-100 bg-white relative">
          {isRecording ? (
            <div className="flex flex-col p-4 bg-slate-50 font-sans select-none animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3 shrink-0">
                    {!recordedBlob && !isRecordingPaused && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${recordedBlob ? 'bg-slate-400' : 'bg-red-500'}`}></span>
                  </span>
                  <span className="text-sm font-bold text-[#1D1C1D] flex items-center gap-1.5">
                    <span>
                      {recordedBlob 
                        ? 'Recording limit reached' 
                        : isRecordingPaused 
                          ? 'Recording paused' 
                          : 'Recording voice note...'}
                    </span>
                    <span className={`font-mono font-extrabold text-[15px] ${recordedBlob ? 'text-slate-600' : 'text-red-600'}`}>
                      {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                    </span>
                    <span className="text-[10.5px] text-slate-400 font-bold tracking-tight">/ 3:00</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!recordedBlob && (
                    <button
                      type="button"
                      onClick={isRecordingPaused ? handleResumeRecording : handlePauseRecording}
                      className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm min-w-[76px] text-center animate-in fade-in zoom-in-95 duration-100"
                    >
                      {isRecordingPaused ? 'Resume' : 'Pause'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCancelRecording}
                    className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendVoiceNote}
                    className="px-4 py-1.5 bg-[#1164A3] hover:bg-[#1164A3]/90 text-white text-xs font-bold rounded-lg transition-all hover:scale-[1.02] cursor-pointer shadow-sm"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Golden Scheduling Preview Status Banner */}
              {scheduledTime && (
                <div className="mx-3.5 mt-3.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs font-semibold text-amber-800 animate-in fade-in slide-in-from-top-1 duration-100 select-none shadow-sm shrink-0">
                  <span className="flex items-center gap-1.5">
                    <span>⏰</span>
                    <span>Scheduled to send <b>{formatReminderTime(scheduledTime)}</b></span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setScheduledTime(null)}
                    className="text-[10px] font-extrabold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200/80 px-2 py-0.5 rounded cursor-pointer transition-colors border-none"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Removable staged attachment pill */}
              {attachment && (
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 animate-in slide-in-from-top-1 duration-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="w-3.5 h-3.5 text-[#1164A3] shrink-0" />
                    <span className="text-xs font-bold text-slate-700 truncate">{attachment.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">({(attachment.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {inputText.trim().startsWith('/remind') && (() => {
                const parsed = parseReminderCommand(inputText);
                if (parsed) {
                  return (
                    <div className="mx-3.5 mt-3.5 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between text-xs font-semibold text-indigo-800 animate-in fade-in slide-in-from-top-1 duration-100 select-none shadow-sm shrink-0">
                      <span className="flex items-center gap-1.5">
                        <span>📅</span>
                        <span>Reminder set for <b>{formatReminderTime(parsed.scheduledAt)}</b>: "{parsed.text}"</span>
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${isDestinationDm ? destinationName : `#${destinationName}`}`}
                className="w-full resize-none border-none focus:outline-none p-3.5 pb-2 text-[15px] text-[#1D1C1D] placeholder-slate-400 min-h-[44px] max-h-[180px] font-normal font-sans bg-transparent"
                rows={1}
                aria-label="Message text"
              />

              {/* Inline Link Builder Popup panel */}
              {showLinkModal && (
                <div className="px-4 py-3 bg-slate-50 border-t border-[#E8E8E8] flex flex-col gap-2.5 animate-in fade-in duration-100 font-sans">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Insert Markdown Link</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Link Label (e.g. Google)"
                      value={linkLabel}
                      onChange={(e) => setLinkLabel(e.target.value)}
                      className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-semibold bg-white text-slate-700"
                    />
                    <input
                      type="text"
                      placeholder="URL (https://...)"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className="flex-[2] px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-semibold bg-white text-slate-700"
                    />
                  </div>
                  <div className="flex justify-end gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => { setShowLinkModal(false); setLinkUrl(''); setLinkLabel(''); }}
                      className="px-3 py-1 border border-slate-300 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-600 transition-colors cursor-pointer"
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
                      className="px-3 py-1 bg-[#1164A3] hover:bg-[#1164A3]/90 text-white rounded-lg text-[11px] font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Add Link
                    </button>
                  </div>
                </div>
              )}

              {/* Curated emoji picker popover */}
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

              {/* Polished Bottom Toolbar */}
              <div className="px-3 py-2 bg-slate-50 border-t border-[#E8E8E8] flex items-center justify-between gap-2 select-none">
                {/* Hidden native file uploader input */}
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  className="hidden"
                />

                {/* Toolbar Icons */}
                <div className="flex items-center gap-1.5 text-slate-500 min-w-0 overflow-x-auto scrollbar-none">
                  <button 
                    type="button" 
                    onClick={() => insertMarkdown('bold')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer" 
                    title="Bold (Ctrl+B)"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => insertMarkdown('italic')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer" 
                    title="Italic (Ctrl+I)"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => insertMarkdown('strike')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer" 
                    title="Strikethrough"
                  >
                    <Strikethrough className="w-4 h-4" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => insertMarkdown('code')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer" 
                    title="Code snippet"
                  >
                    <Code className="w-4 h-4" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setShowLinkModal(!showLinkModal); setShowEmojiPicker(false); }}
                    className={`p-1 hover:bg-slate-200 rounded transition-colors cursor-pointer ${showLinkModal ? 'bg-slate-200 text-[#1164A3]' : 'text-slate-600 hover:text-slate-900'}`} 
                    title="Add link"
                  >
                    <Link className="w-4 h-4" />
                  </button>
                  <div className="w-[1px] h-4 bg-slate-200 mx-1" />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer" 
                    title="Attach file"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowLinkModal(false); }}
                    className={`p-1 hover:bg-slate-200 rounded transition-colors cursor-pointer ${showEmojiPicker ? 'bg-slate-200 text-[#1164A3]' : 'text-slate-600 hover:text-slate-900'}`} 
                    title="Add emoji"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                  <button 
                    type="button" 
                    onClick={handleStartRecording}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer" 
                    title="Record voice note"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>

                {/* Send and Schedule Controls */}
                <div className="flex items-center gap-2 relative shrink-0">
                  {/* Highly polished calendar-clock Schedule Button */}
                  <button
                    type="button"
                    onClick={() => setShowSchedulerPopover(!showSchedulerPopover)}
                    className={`p-1.5 rounded-lg flex items-center justify-center transition-all border active:scale-[0.97] cursor-pointer ${
                      scheduledTime 
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 shadow-xs animate-pulse' 
                        : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-transparent'
                    }`}
                    title="Schedule message"
                  >
                    <span className="text-[11.5px] font-black flex items-center gap-1.5 select-none font-sans px-1 py-0.5">
                      📅 Schedule
                    </span>
                  </button>

                  {/* Polished, Timezone-Safe Date/Time Scheduler Popover */}
                  {showSchedulerPopover && (
                    <>
                      <div 
                        className="fixed inset-0 z-[60]" 
                        onClick={() => setShowSchedulerPopover(false)} 
                      />
                      <div className="absolute right-0 bottom-10 w-64 bg-white border border-[#E8E8E8] rounded-xl shadow-slack-popover p-4 z-[80] flex flex-col gap-3 font-sans animate-in fade-in slide-in-from-bottom-2 duration-100 select-none">
                        <span className="text-[12px] font-black text-[#1D1C1D] leading-none">Schedule Message</span>
                        
                        {/* Quick options shortcuts */}
                        <div className="flex flex-col gap-1 mt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              const target = new Date();
                              target.setHours(18, 0, 0, 0); // 6:00 PM
                              if (target.getTime() <= Date.now()) {
                                target.setDate(target.getDate() + 1); // tomorrow
                              }
                              setScheduledTime(target.getTime());
                              setShowSchedulerPopover(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1164A3] rounded transition-colors cursor-pointer border-none bg-transparent"
                          >
                            Today at 6:00 PM
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const target = new Date();
                              target.setDate(target.getDate() + 1); // tomorrow
                              target.setHours(9, 0, 0, 0); // 9:00 AM
                              setScheduledTime(target.getTime());
                              setShowSchedulerPopover(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#1164A3] rounded transition-colors cursor-pointer border-none bg-transparent"
                          >
                            Tomorrow at 9:00 AM
                          </button>
                        </div>
                        
                        <div className="h-[1px] bg-slate-100" />
                        
                        {/* Custom inputs */}
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Custom date & time</span>
                          <input
                            type="date"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            min={getTodayDateString()}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-355 rounded-lg bg-white font-bold text-slate-750 focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3]"
                          />
                          <input
                            type="time"
                            value={customTime}
                            onChange={(e) => setCustomTime(e.target.value)}
                            min={customDate === getTodayDateString() ? getMinTime() : undefined}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-355 rounded-lg bg-white font-bold text-slate-750 focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3]"
                          />
                          {isScheduleInvalid && (
                            <span className="text-[10.5px] font-black text-red-500 text-center animate-pulse">
                              ⚠️ Please choose a future date and time
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={!customDate || !customTime}
                            onClick={() => {
                              const [year, month, day] = customDate.split('-').map(Number);
                              const [hour, min] = customTime.split(':').map(Number);
                              const target = new Date(year, month - 1, day, hour, min, 0, 0);
                              if (isNaN(target.getTime()) || target.getTime() <= Date.now()) {
                                alert("Please choose a future date and time");
                                return;
                              }
                              setScheduledTime(target.getTime());
                              setShowSchedulerPopover(false);
                            }}
                            className="w-full py-1.5 mt-1 bg-[#1164A3] hover:bg-[#1164A3]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-lg text-xs transition-colors cursor-pointer border-none"
                          >
                            Set Date & Time
                          </button>
                        </div>
                        
                        {scheduledTime && (
                          <button
                            type="button"
                            onClick={() => {
                              setScheduledTime(null);
                              setShowSchedulerPopover(false);
                            }}
                            className="text-[10px] font-black text-red-600 hover:underline text-center cursor-pointer mt-1 border-none bg-transparent"
                          >
                            Cancel Scheduling
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {/* Blue Send Button */}
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!inputText.trim() && !attachment}
                    className={`p-1.5 rounded-lg flex items-center justify-center transition-all border border-transparent ${
                      inputText.trim() || attachment
                        ? 'bg-[#1164A3] hover:bg-[#1164A3]/90 text-white shadow-sm scale-100 hover:scale-105 active:scale-[0.95] cursor-pointer' 
                        : 'text-slate-300 cursor-not-allowed bg-transparent'
                    }`}
                    title="Send message"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
        
        <div className="text-[11px] text-[#616061] mt-1.5 px-2 flex items-center justify-between select-none">
          <span><b>Shift + Enter</b> to add a new line • <b>Ctrl + B</b>/<b>I</b> formatting shortcuts</span>
          <span className="flex items-center gap-0.5 hover:underline cursor-pointer">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            Formatting instructions
          </span>
        </div>
      </footer>

      {/* 4. CHAT DELETE CONFIRMATION POPUP MODAL */}
      {deleteTargetMessageId && (() => {
        const deleteTargetMsg = activeMessages.find(m => m.id === deleteTargetMessageId);
        const canDeleteForEveryone = deleteTargetMsg && (deleteTargetMsg.senderId === user?.uid || isCreator);
        const isAdminDelete = deleteTargetMsg && (deleteTargetMsg.senderId !== user?.uid && isCreator);
        
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-100 font-sans" role="dialog" aria-modal="true">
            <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px]" onClick={() => !isDeleting && setDeleteTargetMessageId(null)}></div>
            
            <div className="relative w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-slack-modal border border-[#E8E8E8] transition-all duration-200 animate-in zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8E8E8] select-none">
                <h2 className="text-[15px] font-extrabold text-[#1D1C1D] tracking-tight">
                  Delete message
                </h2>
                <button 
                  onClick={() => setDeleteTargetMessageId(null)} 
                  disabled={isDeleting}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed select-none">
                  Choose how you want to delete this message:
                </p>
                
                <div className="flex flex-col gap-2">
                  {canDeleteForEveryone && (
                    <button
                      type="button"
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
