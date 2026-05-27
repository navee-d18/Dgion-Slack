import React, { useState, useEffect, useRef } from 'react';
import { 
  Hash, Lock, Search, Users, Menu, Send, Bold, Italic, 
  Strikethrough, Code, Link, Paperclip, Smile, HelpCircle, 
  MoreHorizontal, MessageSquare, Bookmark, SmilePlus, Loader2, Settings, Briefcase,
  X, FileText, Trash2, Edit, Bell, BellOff
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

// Inline Markdown Parser to convert simple formatting tokens to HTML
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

export default function ChatArea({
  activeWorkspace,
  activeDestinationId,
  isDestinationDm,
  messages,
  messagesLoading,
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  onToggleReaction,
  activeThreadMessageId,
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
  onMarkAllAsRead
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

  // Rich Composer states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachment, setAttachment] = useState(null);

  // Message deletion confirmation states
  const [deleteTargetMessageId, setDeleteTargetMessageId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  
  // Custom rich-interaction states
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState(null);
  const [activeToolbarReactionPickerId, setActiveToolbarReactionPickerId] = useState(null);
  const [bookmarks, setBookmarks] = useState({});
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');

  const handleEditClick = (msg) => {
    setEditingMessageId(msg.id);
    setEditText(msg.content);
    setActiveMenuMessageId(null);
  };

  const getUserName = (uid) => {
    if (uid === user?.uid) return 'You';
    const member = activeWorkspace?.allWorkspaceMembers?.find(m => m.id === uid);
    return member ? member.name : 'Unknown User';
  };

  const renderReactions = (msg) => {
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

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!highlightedMessageId) {
      scrollToBottom();
    }
  }, [activeMessages.length, activeDestinationId]);

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
    onSendMessage(inputText, attachment);
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

  const renderAttachment = (file) => {
    if (!file || !file.url) return null;

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
    if (highlightedMessageId && messageRefs.current[highlightedMessageId]) {
      setTimeout(() => {
        messageRefs.current[highlightedMessageId].scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        const timer = setTimeout(() => {
          if (clearHighlight) clearHighlight();
        }, 3000);
        
        return () => clearTimeout(timer);
      }, 200);
    }
  }, [highlightedMessageId, activeMessages]);

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
      <header className="h-[52px] bg-[#FFFFFF] border-b border-[#E8E8E8] px-6 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileDrawer}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700 sm:hidden shrink-0"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex flex-col min-w-0">
            <h1 className="text-[16px] font-bold text-[#1D1C1D] flex items-center gap-1 leading-tight tracking-tight">
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
              <span className="truncate">{destinationName}</span>
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
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-[#E8E8E8] hover:border-slate-300 rounded-md text-[12px] text-[#616061] font-medium transition-all w-28 sm:w-52 text-left"
            title="Search channels and messages"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate opacity-75">Search messages...</span>
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
                              setShowNotificationsDropdown(false);
                            }}
                            className="w-full p-3 hover:bg-slate-50 flex items-start gap-2.5 text-left transition-colors cursor-pointer group/notif-row"
                          >
                            {/* Avatar */}
                            <div className={`w-7.5 h-7.5 rounded-full text-white font-extrabold flex items-center justify-center text-[10px] shrink-0 shadow-sm ${getAvatarColorClass(notif.senderName || 'Unknown')}`}>
                              {getInitials(notif.senderName || 'US')}
                            </div>

                            {/* Details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between select-none">
                                <span className="text-xs font-bold text-[#1D1C1D] group-hover/notif-row:text-[#1164A3] transition-colors truncate pr-1">
                                  {notif.senderName}
                                </span>
                                <span className="text-[9px] text-slate-400 font-semibold shrink-0">
                                  {timeString}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-bold mt-0.5 flex items-center gap-1 select-none">
                                <span>in</span>
                                <span className="text-[#1164A3] truncate">
                                  {notif.type === 'dm' ? 'Direct Message' : notif.type === 'invite' ? 'Invites' : `#${notif.destinationName}`}
                                </span>
                              </p>
                              <p className="text-[11.5px] text-slate-700 font-normal truncate mt-1 leading-normal">
                                {notif.content}
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
      >
        {messagesLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 select-none z-10 animate-in fade-in duration-150">
            <Loader2 className="w-7 h-7 animate-spin text-[#522653] mb-1.5 shrink-0" />
            <span className="text-[12px] text-[#616061] font-bold">Syncing conversations...</span>
          </div>
        )}
        {/* Welcome Header */}
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

        {/* Message Log Stack */}
        <div className="space-y-[3px]">
          {(() => {
            const mainMessages = activeMessages.filter(m => !m.parentMessageId);
            return mainMessages.map((msg, index) => {
              const prevMsg = index > 0 ? mainMessages[index - 1] : null;
              const currentDate = getMessageDate(msg);
              const prevDate = prevMsg ? getMessageDate(prevMsg) : null;
              const isNewDay = !prevDate || !isSameDay(currentDate, prevDate);

              // Group messages only if same sender AND same calendar day AND within 5 minutes!
              const isCloseTogether = prevDate && (currentDate.getTime() - prevDate.getTime()) < 5 * 60 * 1000;
              const isGrouped = prevMsg && prevMsg.senderId === msg.senderId && !isNewDay && isCloseTogether;
              const isHighlighted = highlightedMessageId === msg.id;

              // Sender of this message is current user OR current user is workspace creator
              const canDelete = msg.senderId === user?.uid || isCreator;

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

                  <div
                    ref={el => messageRefs.current[msg.id] = el}
                    className={`relative group flex items-start px-6 py-1 -mx-6 rounded transition-colors ${
                      isHighlighted ? 'bg-yellow-50 border-l-[3px] border-yellow-400 pl-[21px]' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Floating message toolbar */}
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

                    {isGrouped ? (
                      /* Grouped message layout - EXACT LEFT TEXT ALIGNMENT at 48px */
                      <>
                        {/* Timestamp column */}
                        <div className="w-9 text-[10px] text-slate-400 text-right pr-2 shrink-0 select-none pt-0.5 font-semibold">
                          {msg.timestamp.split(' ')[0] || msg.timestamp}
                        </div>
                        {/* Text aligns with standard message text column (exactly 12px margin) */}
                        <div className="flex-1 min-w-0 ml-3 text-[15px] text-[#1D1C1D] leading-relaxed font-sans flex flex-col">
                          {editingMessageId === msg.id ? (
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
                              <span className="inline">{renderFormattedContent(msg.content)}</span>
                              {msg.isEdited && <span className="text-[10px] text-slate-400 font-semibold ml-1.5 select-none inline-block align-baseline" title="This message has been edited">(edited)</span>}
                              {bookmarks[msg.id] && <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0 ml-1.5 inline-block align-middle animate-in zoom-in-95 duration-100" title="Bookmarked message" />}
                              {msg.file && renderAttachment(msg.file)}
                            </div>
                          )}
                          {renderReactions(msg)}
                          {renderThreadIndicator(msg)}
                        </div>
                      </>
                    ) : (
                      /* Standard message layout */
                      <>
                        {/* Perfect Avatar Circle badge */}
                        <div className={`w-9 h-9 rounded-full text-white font-extrabold flex items-center justify-center text-sm shrink-0 shadow-sm transition-all duration-100 hover:scale-105 ${getAvatarColorClass(msg.senderName)}`}>
                          {getInitials(msg.senderName)}
                        </div>
                        
                        {/* Content Block */}
                        <div className="flex-1 min-w-0 ml-3 font-sans flex flex-col">
                          <div className="flex items-baseline gap-2 mb-0.5 select-none">
                            <span className="font-bold text-[15px] text-[#1D1C1D] hover:underline cursor-pointer flex items-center gap-1">
                              <span>{msg.senderName}</span>
                              {bookmarks[msg.id] && <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" title="Bookmarked message" />}
                            </span>
                            <span className="text-[12px] text-[#616061] font-medium">
                              {msg.timestamp} {msg.isEdited && <span className="text-[9px] text-slate-400 font-bold ml-1 hover:underline cursor-help select-none" title="This message has been edited">(edited)</span>}
                            </span>
                          </div>
                          
                          {editingMessageId === msg.id ? (
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
                            <div className="text-[15px] text-[#1D1C1D] leading-relaxed">
                              {renderFormattedContent(msg.content)}
                              {msg.file && renderAttachment(msg.file)}
                            </div>
                          )}
                          {renderReactions(msg)}
                          {renderThreadIndicator(msg)}
                        </div>
                      </>
                    )}
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
        <div className="border border-[#E8E8E8] focus-within:ring-1 focus-within:ring-[#1164A3] focus-within:border-[#1164A3] rounded-xl flex flex-col overflow-hidden bg-white shadow-sm transition-all duration-100 bg-white">
          
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

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
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
          <div className="px-3 py-2 bg-slate-50 border-t border-[#E8E8E8] flex items-center justify-between select-none">
            {/* Hidden native file uploader input */}
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              className="hidden"
            />

            {/* Toolbar Icons */}
            <div className="flex items-center gap-1.5 text-slate-500">
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
            </div>

            {/* Blue Send Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() && !attachment}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
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
        
        <div className="text-[11px] text-[#616061] mt-1.5 px-2 flex items-center justify-between select-none">
          <span><b>Shift + Enter</b> to add a new line • <b>Ctrl + B</b>/<b>I</b> formatting shortcuts</span>
          <span className="flex items-center gap-0.5 hover:underline cursor-pointer">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            Formatting instructions
          </span>
        </div>
      </footer>

      {/* 4. CHAT DELETE CONFIRMATION POPUP MODAL */}
      {deleteTargetMessageId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-100 font-sans" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px]" onClick={() => !isDeleting && setDeleteTargetMessageId(null)}></div>
          
          <div className="relative w-full max-w-sm overflow-hidden bg-white rounded-2xl shadow-slack-modal border border-[#E8E8E8] transition-all duration-200 animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8E8E8] select-none">
              <h2 className="text-[15px] font-extrabold text-[#1D1C1D] tracking-tight">
                Delete message
              </h2>
              <button 
                onClick={() => setDeleteTargetMessageId(null)} 
                disabled={isDeleting}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg leading-normal flex items-start gap-2.5">
                <span>⚠️</span>
                <span>Are you sure you want to permanently delete this message? This action cannot be undone.</span>
              </div>
              <p className="text-xs text-slate-500 select-none leading-relaxed">
                Deleting this message will also permanently remove any associated file previews and files from the channel feed.
              </p>
            </div>

            {/* Actions */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-[#E8E8E8] flex justify-end gap-2 select-none">
              <button
                type="button"
                onClick={() => setDeleteTargetMessageId(null)}
                className="px-4 py-2 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 transition-all duration-100 cursor-pointer"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onDeleteMessage(deleteTargetMessageId);
                    setDeleteTargetMessageId(null);
                  } catch (err) {
                    alert(err.message || 'Failed to delete message.');
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
                disabled={isDeleting}
              >
                {isDeleting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />}
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
