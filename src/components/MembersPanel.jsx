import React, { useState } from 'react';
import { X, Mail, Globe, Briefcase, ArrowLeft, Plus } from 'lucide-react';

export default function MembersPanel({ 
  activeWorkspace, 
  onClose,
  onInviteClick,
  currentUser,
  onRemoveMember
}) {
  const [selectedMember, setSelectedMember] = useState(null);

  if (!activeWorkspace) return null;

  const isCreator = activeWorkspace.createdBy === currentUser?.uid;

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

  return (
    <div 
      className="w-full sm:w-[260px] border-l border-[#E8E8E8] flex flex-col h-full bg-[#FFFFFF] select-none shrink-0 relative animate-in slide-in-from-right duration-100 font-sans"
      aria-label="Workspace members"
    >
      {/* MEMBERS LIST VIEW */}
      {!selectedMember ? (
        <>
          {/* Header */}
          <div className="h-[52px] px-4 border-b border-[#E8E8E8] flex items-center justify-between bg-white shrink-0">
            <h2 className="text-[14px] font-extrabold text-[#1D1C1D] tracking-tight">
              Members ({activeWorkspace.members?.length || activeWorkspace.dms.length})
            </h2>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              aria-label="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List Section */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5 bg-[#FFFFFF]">
            {/* Invite button */}
            {isCreator && (
              <button
                onClick={onInviteClick}
                className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-[#E8E8E8] hover:border-slate-300 text-xs font-bold text-[#1164A3] rounded-md transition-all active:scale-[0.99] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Invite people to workspace</span>
              </button>
            )}

            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 select-none">
              In this workspace
            </p>
            {activeWorkspace.dms.map(member => {
              const isThisMemberCreator = activeWorkspace.createdBy === member.id;
              const displayRole = isThisMemberCreator ? 'Workspace Owner' : 'Workspace Member';
              const emailText = member.email || `${member.id}@acme-corp.com`;

              return (
                <button
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className="w-full flex items-center gap-3 px-2.5 py-2 hover:bg-slate-50 border border-transparent rounded-md text-left transition-all duration-100 group"
                >
                  {/* Perfect Avatar Circle badge */}
                  <div className={`w-9 h-9 rounded-full text-white font-bold flex items-center justify-center text-xs shrink-0 relative ${getAvatarColorClass(member.name)}`}>
                    {getInitials(member.name)}
                    
                    {/* Miniature Presence indicators */}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white shrink-0 ${
                      member.status === 'online' ? 'bg-[#2BAC76]' : 'bg-slate-300'
                    }`} />
                  </div>

                  <div className="min-w-0 flex-1 font-sans">
                    <div className="flex items-baseline justify-between gap-1.5">
                      <p className="text-sm font-bold text-[#1D1C1D] truncate group-hover:text-[#1164A3] transition-colors">
                        {member.name}
                      </p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold tracking-tight shrink-0 ${
                        isThisMemberCreator ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {isThisMemberCreator ? 'Owner' : 'Member'}
                      </span>
                    </div>
                    <p className="text-xs text-[#616061] truncate font-normal mt-0.5">
                      {emailText}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        /* DETAILED CARD DRAWER VIEW */
        <div className="flex flex-col h-full bg-[#FFFFFF] animate-in fade-in slide-in-from-left-2 duration-100">
          {/* Header */}
          <div className="h-[52px] px-3 border-b border-[#E8E8E8] flex items-center justify-between bg-white shrink-0">
            <button 
              onClick={() => setSelectedMember(null)}
              className="flex items-center gap-1 text-[12px] text-[#616061] hover:text-[#1D1C1D] p-1.5 hover:bg-slate-100 rounded-md font-semibold transition-colors"
              aria-label="Back to list"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              aria-label="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Detail card list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
            {/* Massive circular avatar display */}
            <div className="flex flex-col items-center text-center pb-2 select-none">
              <div className={`w-24 h-24 rounded-full text-white font-extrabold flex items-center justify-center text-3xl mb-4 relative shadow-md ${getAvatarColorClass(selectedMember.name)}`}>
                {getInitials(selectedMember.name)}
                <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white shrink-0 ${
                  selectedMember.status === 'online' ? 'bg-[#2BAC76]' : 'bg-slate-300'
                }`} />
              </div>
              <h3 className="text-[17px] font-extrabold text-[#1D1C1D] leading-tight tracking-tight">
                {selectedMember.name}
              </h3>
              <p className="text-sm text-[#616061] mt-1 font-semibold">
                {activeWorkspace.createdBy === selectedMember.id ? 'Workspace Owner' : 'Workspace Member'}
              </p>
            </div>

            {/* Profile Fields section */}
            <div className="space-y-4 border-t border-[#E8E8E8] pt-4 font-sans">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 select-none">
                  Active Status
                </p>
                <div className="flex items-center gap-2 text-sm text-[#1D1C1D] font-semibold">
                  <span className={`w-2 h-2 rounded-full ${
                    selectedMember.status === 'online' ? 'bg-[#2BAC76]' : 'bg-slate-300'
                  }`} />
                  <span className="capitalize">{selectedMember.status}</span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 select-none">
                  Display Job Title
                </p>
                <div className="flex items-center gap-2 text-sm text-[#1D1C1D]">
                  <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-700">{activeWorkspace.createdBy === selectedMember.id ? 'Workspace Owner' : 'Workspace Member'}</span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 select-none">
                  Email Address
                </p>
                <div className="flex items-center gap-2 text-sm text-[#1D1C1D]">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <a 
                    href={`mailto:${selectedMember.email || (selectedMember.id + '@acme-corp.com')}`} 
                    className="text-[#1164A3] hover:underline truncate font-bold"
                  >
                    {selectedMember.email || `${selectedMember.id}@acme-corp.com`}
                  </a>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 select-none">
                  Local Timezone
                </p>
                <div className="flex items-center gap-2 text-sm text-[#1D1C1D]">
                  <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-700">
                    EST (UTC -5)
                  </span>
                </div>
              </div>
            </div>

            {/* Remove member option - visible ONLY to the creator, and NOT for themselves */}
            {isCreator && selectedMember.id !== currentUser?.uid && (
              <div className="border-t border-[#E8E8E8] pt-4 mt-6">
                <button
                  onClick={async () => {
                    const confirmRemove = window.confirm(
                      `Are you sure you want to remove ${selectedMember.name} from this workspace?`
                    );
                    if (confirmRemove) {
                      try {
                        await onRemoveMember(selectedMember.id);
                        setSelectedMember(null);
                      } catch (err) {
                        alert(err.message || 'Failed to remove member.');
                      }
                    }
                  }}
                  className="w-full py-2 px-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 text-xs font-bold rounded-lg transition-all active:scale-[0.98] cursor-pointer text-center"
                >
                  Remove from Workspace
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
