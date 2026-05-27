import React from 'react';
import { X, Pin, Paperclip, FileText, Image as ImageIcon } from 'lucide-react';
import { renderFormattedContent } from './ChatArea';

export default function PinnedPanel({
  activeWorkspace,
  activeDestinationId,
  isDestinationDm,
  messages,
  onClose,
  onJumpTo,
  onTogglePinMessage,
  currentUser
}) {
  if (!activeWorkspace) return null;

  const isCreator = activeWorkspace.createdBy === currentUser?.uid;

  // 1. Get all messages inside the active channel/DM
  const channelKey = `${activeWorkspace.id}-${activeDestinationId}`;
  const activeMessages = messages[channelKey] || [];

  // 2. Filter only pinned messages
  const pinnedMsgs = activeMessages.filter(msg => msg.isPinned);

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
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // 3. Helper: Group pinned messages by date
  const groupMessagesByDate = (msgs) => {
    const groups = {};
    msgs.forEach(msg => {
      let dateObj = new Date();
      if (msg.createdAt) {
        dateObj = typeof msg.createdAt.toDate === 'function' ? msg.createdAt.toDate() : new Date(msg.createdAt);
      }
      
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      let dateKey = '';
      if (dateObj.toDateString() === today.toDateString()) {
        dateKey = 'Today';
      } else if (dateObj.toDateString() === yesterday.toDateString()) {
        dateKey = 'Yesterday';
      } else {
        dateKey = dateObj.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }

      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
    });
    return groups;
  };

  const groupedPins = groupMessagesByDate(pinnedMsgs);
  const dateKeys = Object.keys(groupedPins).sort((a, b) => {
    if (a === 'Today') return -1;
    if (b === 'Today') return 1;
    if (a === 'Yesterday') return -1;
    if (b === 'Yesterday') return 1;
    return new Date(b) - new Date(a);
  });

  return (
    <div 
      className="w-full sm:w-[280px] md:w-[320px] border-l border-[#E8E8E8] flex flex-col h-full bg-[#FFFFFF] select-none shrink-0 relative animate-in slide-in-from-right duration-100 font-sans"
      aria-label="Pinned messages panel"
    >
      {/* Header */}
      <div className="h-[52px] px-4 border-b border-[#E8E8E8] flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-1.5 select-none">
          <Pin className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
          <h2 className="text-[14px] font-extrabold text-[#1D1C1D] tracking-tight">
            Pinned Messages ({pinnedMsgs.length})
          </h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Scroll Feed */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5 bg-[#FFFFFF]">
        {pinnedMsgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 font-semibold h-64 select-none">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-3">
              <Pin className="w-6 h-6 text-amber-500 shrink-0" />
            </div>
            <p className="text-sm font-bold text-slate-600">No pinned messages yet</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Keep important messages handy by pinning them from the message menu.</p>
          </div>
        ) : (
          dateKeys.map(dateKey => (
            <div key={dateKey} className="space-y-2">
              {/* Date Group Header */}
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                {dateKey}
              </div>

              {/* Cards List */}
              <div className="space-y-2.5">
                {groupedPins[dateKey].map(msg => {
                  const canUnpin = msg.senderId === currentUser?.uid || isCreator;
                  const isImage = msg.file?.type?.startsWith('image/') || msg.file?.name?.match(/\.(jpg|jpeg|png|gif)$/i);
                  
                  return (
                    <div 
                      key={msg.id}
                      onClick={() => onJumpTo(
                        activeDestinationId,
                        isDestinationDm,
                        msg.id,
                        activeWorkspace.id,
                        msg.parentMessageId || null
                      )}
                      className="group/pin-card p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl flex flex-col gap-2 transition-all cursor-pointer relative"
                    >
                      {/* Unpin Action */}
                      {canUnpin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onTogglePinMessage) onTogglePinMessage(msg.id);
                          }}
                          className="absolute top-2.5 right-2.5 p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-500 opacity-0 group-hover/pin-card:opacity-100 transition-all cursor-pointer"
                          title="Unpin message"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Sender Header */}
                      <div className="flex items-center gap-2 pr-6">
                        <div className={`w-6 h-6 rounded-md text-white font-extrabold flex items-center justify-center text-[9px] shrink-0 shadow-sm ${getAvatarColorClass(msg.senderName)}`}>
                          {getInitials(msg.senderName)}
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col">
                          <span className="text-xs font-bold text-[#1D1C1D] truncate">
                            {msg.senderName}
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold select-none">
                            {msg.timestamp || 'Just now'}
                          </span>
                        </div>
                      </div>

                      {/* Content Preview */}
                      <div className="text-[12.5px] text-slate-700 font-normal leading-relaxed line-clamp-3 break-words">
                        {renderFormattedContent(msg.content, activeWorkspace.allWorkspaceMembers)}
                      </div>

                      {/* Attachment Badge Display */}
                      {msg.file && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg max-w-full min-w-0 shrink-0 self-start animate-in zoom-in-95 duration-100 select-none">
                          {isImage ? (
                            <ImageIcon className="w-3 h-3 text-[#1164A3] shrink-0" />
                          ) : (
                            <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                          )}
                          <span className="text-[10px] font-bold text-slate-600 truncate max-w-[140px] md:max-w-[180px]">
                            {msg.file.name}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
