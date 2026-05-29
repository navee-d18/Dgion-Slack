import { useState } from 'react';
import { ChevronDown, ChevronRight, Hash, Lock, Plus, Settings, Bell, HelpCircle, LogOut } from 'lucide-react';

export default function ChannelNav({
  activeWorkspace,
  activeDestinationId,
  isDestinationDm,
  onSelectDestination,
  onAddChannelClick,
  onInviteClick,
  onCloseMobileDrawer,
  currentUser,
  onLogout,
  onSettingsClick,
  onPreferencesClick,
  onHelpClick,
  compactMode,
  unreadNotifications = []
}) {
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [dmsExpanded, setDmsExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!activeWorkspace) return null;

  const isCreator = activeWorkspace.createdBy === currentUser?.uid;

  const handleSelect = (destId, isDm) => {
    onSelectDestination(destId, isDm);
    if (onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  return (
    <div className="w-full sm:w-[240px] bg-[#522653] text-white/70 flex flex-col h-full shrink-0 select-none border-r border-[#E8E8E8]/10 font-sans">
      {/* Workspace Top Header Bar */}
      <div className="relative border-b border-[#E8E8E8]/10 shrink-0">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-full py-2.5 px-4 flex items-center justify-between text-left hover:bg-white/5 text-white transition-colors"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Avatar Initials Badge beside the name */}
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 text-white font-bold flex items-center justify-center text-[11px] shrink-0 relative shadow-sm select-none">
              {currentUser?.avatarInitials || (currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US')}
              
              {/* Presence Dot Indicator in corner */}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#522653] bg-[#2BAC76] shrink-0 animate-pulse" />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-[13px] leading-tight truncate text-white/95 tracking-tight mb-0.5">
                {activeWorkspace.name}
              </span>
              <span className="font-bold text-[12px] leading-none text-white truncate">
                {currentUser?.name || 'Slack User'}
              </span>
              <span className="text-[10px] text-white/50 truncate font-normal mt-0.5 leading-none">
                {currentUser?.email || 'user@slack.com'}
              </span>
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-white/60 shrink-0 ml-1.5" />
        </button>

        {/* Workspace Dropdown Panel */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>
            <div className="absolute left-3 top-[56px] w-[220px] bg-white rounded-lg shadow-slack-popover border border-[#E8E8E8] text-[#1D1C1D] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans">
              <div className="px-3 py-2 border-b border-[#E8E8E8] mb-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider select-none font-sans">Active Workspace</p>
                <p className="text-sm font-bold text-[#1D1C1D] truncate font-sans">{activeWorkspace.name}</p>
                
                {/* Workspace ID Copy Block */}
                {isCreator && (
                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-col gap-0.5 font-sans">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider select-none">Workspace ID (Share to join)</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(activeWorkspace.id);
                        alert(`Workspace ID copied to clipboard!\n\n${activeWorkspace.id}`);
                      }}
                      className="w-full text-left font-mono text-[10px] text-[#1164A3] hover:underline font-bold break-all select-all flex items-center gap-1 group cursor-pointer"
                      title="Click to copy Workspace ID"
                    >
                      <span>{activeWorkspace.id}</span>
                    </button>
                    <span className="text-[8px] text-slate-400 italic">Click ID to copy</span>
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                {isCreator && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onInviteClick();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-bold text-[#1164A3] hover:bg-slate-50 flex items-center gap-2 rounded transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#1164A3] shrink-0" />
                    Invite people to {activeWorkspace.name}
                  </button>
                )}

                {isCreator && <div className="h-[1px] bg-[#E8E8E8] my-1" />}

                {isCreator && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onSettingsClick();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 rounded text-[#1D1C1D] transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    Workspace Settings
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onPreferencesClick();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 rounded text-[#1D1C1D] transition-colors cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5 text-slate-400" />
                  Preferences
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onHelpClick();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 rounded text-[#1D1C1D] transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  Help & Feedback
                </button>
                
                {/* Visual Separator */}
                <div className="h-[1px] bg-[#E8E8E8] my-1" />
                
                {/* Logout Trigger Action */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-red-50 flex items-center gap-2 rounded text-red-600 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  Sign Out of Slack
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Navigation Lists Scrollable Box */}
      <div className="flex-1 overflow-y-auto custom-scrollbar-dark py-4 px-1.5 space-y-4">
        
        {/* CHANNELS SECTION */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between px-2 py-1 group text-white/40 hover:text-white/70 transition-colors select-none">
            <button
              onClick={() => setChannelsExpanded(!channelsExpanded)}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-left flex-1"
              aria-label={`${channelsExpanded ? 'Collapse' : 'Expand'} channels`}
            >
              {channelsExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>Channels</span>
            </button>
            {isCreator && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChannelClick();
                }}
                className="p-0.5 hover:bg-white/10 rounded text-white/60 hover:text-white transition-all duration-100 cursor-pointer"
                title="Create channel"
                aria-label="Create channel"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {channelsExpanded && (
            <div className="space-y-[1.5px]">
              {(activeWorkspace.channels || []).map((ch) => {
                const isSelected = !isDestinationDm && ch.id === activeDestinationId;
                const channelUnreadCount = (unreadNotifications || []).filter(
                  n => n.workspaceId === activeWorkspace.id && n.destinationId === ch.id && !n.isRead
                ).length;
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleSelect(ch.id, false)}
                    className={`w-full flex items-center gap-2.5 px-3.5 rounded-md text-left transition-colors font-medium ${
                      compactMode ? 'py-0.5 text-[13px]' : 'py-1 text-[14px]'
                    } ${
                      isSelected 
                        ? 'bg-[#1164A3] text-white font-semibold shadow-sm' 
                        : channelUnreadCount > 0
                          ? 'text-white font-bold hover:bg-white/5'
                          : 'hover:bg-white/5 text-white/70 hover:text-white'
                    }`}
                  >
                    {ch.isPrivate ? (
                      <Lock className={`w-3.5 h-3.5 shrink-0 ${channelUnreadCount > 0 ? 'opacity-100 text-white font-extrabold' : 'opacity-80'}`} />
                    ) : (
                      <Hash className={`w-3.5 h-3.5 shrink-0 ${channelUnreadCount > 0 ? 'opacity-100 text-white font-extrabold' : 'opacity-80'}`} />
                    )}
                    <span className="truncate flex-1">{ch.name}</span>
                    {channelUnreadCount > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#1164A3] text-white font-black text-[9.5px] flex items-center justify-center shadow-sm select-none animate-in scale-in duration-100">
                        {channelUnreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
              
              {isCreator && (
                <button
                  onClick={onAddChannelClick}
                  className={`w-full flex items-center gap-2.5 px-3.5 rounded-md text-left hover:bg-white/5 text-white/40 hover:text-white/80 transition-colors font-semibold mt-0.5 ${
                    compactMode ? 'py-0.5 text-[12px]' : 'py-1 text-[13px]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Add channel</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* DIRECT MESSAGES SECTION */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between px-2 py-1 group text-white/40 hover:text-white/70 transition-colors select-none">
            <button
              onClick={() => setDmsExpanded(!dmsExpanded)}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-left flex-1"
              aria-label={`${dmsExpanded ? 'Collapse' : 'Expand'} direct messages`}
            >
              {dmsExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>Direct messages</span>
            </button>
          </div>

          {dmsExpanded && (
            <div className="space-y-[1.5px]">
              {(activeWorkspace.dms || []).map((dm) => {
                const isSelected = isDestinationDm && dm.id === activeDestinationId;
                const dmUnreadCount = (unreadNotifications || []).filter(
                  n => n.workspaceId === activeWorkspace.id && n.destinationId === dm.id && !n.isRead
                ).length;
                return (
                  <button
                    key={dm.id}
                    onClick={() => handleSelect(dm.id, true)}
                    className={`w-full flex items-center gap-2.5 px-3.5 rounded-md text-left transition-colors font-medium ${
                      compactMode ? 'py-0.5 text-[13px]' : 'py-1 text-[14px]'
                    } ${
                      isSelected 
                        ? 'bg-[#1164A3] text-white font-semibold shadow-sm' 
                        : dmUnreadCount > 0
                          ? 'text-white font-bold hover:bg-white/5'
                          : 'hover:bg-white/5 text-white/70 hover:text-white'
                    }`}
                  >
                    <span 
                      className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                        dm.status === 'online' 
                          ? 'bg-[#2BAC76]' 
                          : 'bg-white/20'
                      }`}
                    />
                    <span className="truncate flex-1">{dm.name}</span>
                    {dmUnreadCount > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#2BAC76] text-white font-black text-[9.5px] flex items-center justify-center shadow-sm select-none animate-in scale-in duration-100">
                        {dmUnreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Pinned Bottom Account Section */}
      <div className="border-t border-white/10 p-3 bg-black/10 shrink-0 select-none font-sans">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar Initials Badge */}
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 text-white font-bold flex items-center justify-center text-[11px] shrink-0 relative shadow-sm">
            {currentUser?.avatarInitials || (currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US')}
            
            {/* Presence Dot Indicator in corner */}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#522653] bg-[#2BAC76] shrink-0 animate-pulse" />
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-extrabold text-[13px] leading-tight truncate text-white/95 tracking-tight">
              {currentUser?.name || 'Slack User'}
            </span>
            <span className="text-[10px] text-white/50 truncate font-normal leading-none mt-0.5">
              {currentUser?.email || 'user@slack.com'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
