import React from 'react';
import { Plus } from 'lucide-react';

export default function WorkspaceSidebar({ 
  workspaces, 
  activeWorkspaceId, 
  onSelectWorkspace, 
  onAddWorkspaceClick,
  unreadNotifications = []
}) {
  return (
    <div 
      className="w-[68px] bg-[#3F0E40] flex flex-col items-center py-3.5 gap-4 select-none shrink-0 border-r border-[#E8E8E8]/10"
      aria-label="Workspaces"
    >
      {/* Workspace List Scrollable panel */}
      <div className="flex-1 w-full flex flex-col items-center gap-3 overflow-y-auto custom-scrollbar-dark px-1">
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const wsUnreadCount = (unreadNotifications || []).filter(
            n => n.workspaceId === ws.id && !n.isRead
          ).length;
          return (
            <div key={ws.id} className="relative group flex justify-center w-full">
              {/* Vertical active white pill indicator on the far left edge */}
              <div 
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-[4px] rounded-r bg-white transition-all duration-200 ${
                  isActive ? 'h-9' : 'h-0 group-hover:h-5'
                }`}
              />
              
              {/* Wrapping container for the button and its badge */}
              <div className="relative w-11 h-11">
                {/* Rounded Workspace Button with custom morphing shape */}
                <button
                  onClick={() => onSelectWorkspace(ws.id)}
                  className={`w-full h-full text-white font-extrabold flex items-center justify-center text-sm shadow-md transition-all duration-200 ${
                    isActive 
                      ? 'bg-[#1164A3] rounded-xl border-2 border-white ring-2 ring-white/20 scale-100' 
                      : 'bg-white/10 hover:bg-white/20 rounded-[14px] hover:rounded-xl border border-white/5 hover:scale-105'
                  }`}
                  aria-label={`Switch to workspace ${ws.name}`}
                  title={ws.name}
                >
                  {ws.iconText || ws.name.substring(0, 2).toUpperCase()}
                </button>

                {/* Red Circular Badge Overlay on top-right of workspace icon */}
                {wsUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white font-extrabold text-[9px] flex items-center justify-center border border-[#3F0E40] shadow-sm select-none z-10 animate-in zoom-in duration-100 pointer-events-none">
                    {wsUnreadCount > 99 ? '99+' : wsUnreadCount}
                  </span>
                )}
              </div>

              {/* Polished Workspace Hover Tooltip */}
              <div className="absolute left-[72px] top-1/2 -translate-y-1/2 bg-[#1D1C1D] text-white text-[12px] font-bold py-1.5 px-3 rounded-lg shadow-slack-popover opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 z-50 whitespace-nowrap border border-[#E8E8E8]/20 translate-x-2 group-hover:translate-x-0">
                {ws.name}
              </div>
            </div>
          );
        })}

        {/* Separator line */}
        <div className="w-8 h-[1px] bg-white/10 my-0.5" />

        {/* Add Workspace Button */}
        <div className="relative group flex justify-center w-full">
          <button
            onClick={onAddWorkspaceClick}
            className="w-11 h-11 rounded-[14px] hover:rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-dashed border-white/30 transition-all duration-200 hover:scale-105 hover:border-white/50"
            aria-label="Create workspace"
            title="Create Workspace"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
          
          <div className="absolute left-[72px] top-1/2 -translate-y-1/2 bg-[#1D1C1D] text-white text-[12px] font-bold py-1.5 px-3 rounded-lg shadow-slack-popover opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 z-50 whitespace-nowrap border border-[#E8E8E8]/20 translate-x-2 group-hover:translate-x-0">
            Add Workspace
          </div>
        </div>
      </div>
    </div>
  );
}
