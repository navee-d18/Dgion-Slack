import { useState, useEffect, useMemo } from 'react';
import {
  X, LayoutDashboard, Users, Hash, Lock, Settings, Shield, ShieldCheck, Crown,
  Trash2, Search, MessageSquare, Copy, Check, AlertTriangle, UserMinus, UserPlus,
  Plus, Circle, Loader2, Save, BarChart3, ScrollText, RefreshCw
} from 'lucide-react';

// Firestore is queried directly here (same pattern as Modals.jsx) to compute live
// workspace data the parent App.jsx doesn't keep in memory: channel-message stats
// + the moderation feed, and the audit_logs trail.
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, isConfigured } from '../firebase';
import { getInitials, getAvatarColorClass } from '../utils/avatar';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'channels', label: 'Channels', icon: Hash },
  { id: 'moderation', label: 'Moderation', icon: ShieldCheck },
  { id: 'audit', label: 'Audit log', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings }
];

// Human label + accent for each logged admin action.
const ACTION_META = {
  admin_promoted: { label: 'promoted to admin', dot: 'bg-[#1164A3]' },
  admin_demoted: { label: 'admin rights revoked', dot: 'bg-slate-400' },
  member_removed: { label: 'removed a member', dot: 'bg-[#E01E5A]' },
  channel_deleted: { label: 'deleted a channel', dot: 'bg-[#E01E5A]' },
  message_deleted: { label: 'removed a message', dot: 'bg-[#ECB22E]' },
  workspace_updated: { label: 'updated workspace', dot: 'bg-[#613064]' }
};

// Coerce Firestore Timestamp | ISO string | epoch-ms into epoch milliseconds.
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') { const n = Date.parse(ts); return Number.isNaN(n) ? 0 : n; }
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

function timeAgo(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-[22px] font-black text-[#1D1C1D] leading-none tracking-tight">{value}</div>
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

// A non-configured (offline emulation) note for tabs that need live Firestore data.
function EmulatedNote() {
  return (
    <div className="p-6 text-center bg-white border border-[#E8E8E8] rounded-xl">
      <Shield className="w-6 h-6 text-slate-300 mx-auto mb-2" />
      <p className="text-sm font-bold text-slate-500">Live data unavailable</p>
      <p className="text-[12px] text-slate-400 mt-1">Connect Firebase to use this in real time.</p>
    </div>
  );
}

export default function AdminPanel({
  isOpen,
  onClose,
  workspace,
  currentUser,
  isOwner = false,
  onUpdateWorkspace,
  onDeleteWorkspace,
  onDeleteChannel,
  onRemoveMember,
  onPromoteAdmin,
  onDemoteAdmin,
  onModerateMessage,
  onAddChannelClick,
  onInviteClick,
  onOpenProfile
}) {
  const [tab, setTab] = useState('overview');
  const [memberQuery, setMemberQuery] = useState('');
  const [channelQuery, setChannelQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [copied, setCopied] = useState(false);

  // Live channel messages (Firestore-only). Counts, the moderation feed and the
  // analytics charts are all derived from this one fetch.
  const [msgDocs, setMsgDocs] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Audit trail (Firestore-only), refetched whenever the Audit tab is opened.
  const [auditLogs, setAuditLogs] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditRefresh, setAuditRefresh] = useState(0);

  // Settings form state
  const [nameDraft, setNameDraft] = useState('');
  const [iconDraft, setIconDraft] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const members = useMemo(() => workspace?.allWorkspaceMembers || [], [workspace?.allWorkspaceMembers]);
  const channels = useMemo(() => workspace?.channels || [], [workspace?.channels]);
  const admins = useMemo(() => workspace?.admins || [], [workspace?.admins]);

  // Reset transient state every time the panel (re)opens.
  useEffect(() => {
    if (isOpen) {
      setTab('overview');
      setMemberQuery('');
      setChannelQuery('');
      setActionError('');
      setBusyId(null);
      setCopied(false);
      setNameDraft(workspace?.name || '');
      setIconDraft(workspace?.iconText || (workspace?.name || '').substring(0, 2).toUpperCase());
      setSettingsMsg('');
      setDeleteConfirm('');
    }
  }, [isOpen, workspace?.id, workspace?.name, workspace?.iconText]);

  // Close on Escape (unless a destructive action is mid-flight).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && isOpen && !deleting && !busyId) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, deleting, busyId]);

  // Fetch channel messages on open.
  useEffect(() => {
    if (!isOpen || !workspace?.id || !isConfigured) {
      setMsgDocs(null);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    (async () => {
      try {
        // Equality-only query (no composite index). Channel messages only — DM docs
        // are privacy-scoped and not bulk-readable, even by the owner.
        const snap = await getDocs(query(
          collection(db, 'messages'),
          where('workspaceId', '==', workspace.id),
          where('isDm', '==', false)
        ));
        if (cancelled) return;
        setMsgDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('AdminPanel message fetch error:', err);
        if (!cancelled) setMsgDocs(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, workspace?.id]);

  // Fetch the audit trail whenever the Audit tab is opened (or manually refreshed).
  useEffect(() => {
    if (!isOpen || tab !== 'audit' || !workspace?.id || !isConfigured) return;
    let cancelled = false;
    setAuditLoading(true);
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'audit_logs'),
          where('workspaceId', '==', workspace.id)
        ));
        if (cancelled) return;
        const rows = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
        setAuditLogs(rows);
      } catch (err) {
        console.error('AdminPanel audit fetch error:', err);
        if (!cancelled) setAuditLogs(null);
      } finally {
        if (!cancelled) setAuditLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, tab, workspace?.id, auditRefresh]);

  // ----- Derived data -----
  const memberById = useMemo(() => {
    const map = {};
    members.forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  const channelById = useMemo(() => {
    const map = {};
    channels.forEach(c => { map[c.id] = c; });
    return map;
  }, [channels]);

  const msgCounts = useMemo(() => {
    if (!msgDocs) return null;
    const counts = {};
    msgDocs.forEach(m => { if (m.destinationId) counts[m.destinationId] = (counts[m.destinationId] || 0) + 1; });
    return counts;
  }, [msgDocs]);

  const totalMsgs = msgDocs ? msgDocs.length : null;
  const onlineCount = useMemo(() => members.filter(m => m.status === 'online').length, [members]);
  const privateChannels = useMemo(() => channels.filter(c => c.isPrivate).length, [channels]);

  // Most-recent, not-yet-removed channel messages for the moderation feed.
  const moderationFeed = useMemo(() => {
    if (!msgDocs) return [];
    return msgDocs
      .filter(m => !m.deletedForEveryone)
      .sort((a, b) => tsToMillis(b.timestamp) - tsToMillis(a.timestamp))
      .slice(0, 60);
  }, [msgDocs]);

  // Messages bucketed into the last 7 calendar days for the activity chart.
  const activityByDay = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ start: d.getTime(), label: d.toLocaleDateString(undefined, { weekday: 'short' }), count: 0 });
    }
    if (msgDocs) {
      msgDocs.forEach(m => {
        const t = tsToMillis(m.timestamp);
        for (let i = 0; i < days.length; i++) {
          const next = i + 1 < days.length ? days[i + 1].start : Infinity;
          if (t >= days[i].start && t < next) { days[i].count++; break; }
        }
      });
    }
    return days;
  }, [msgDocs]);

  const channelBars = useMemo(() => {
    return channels
      .map(c => ({ id: c.id, name: c.name, isPrivate: c.isPrivate, count: msgCounts ? (msgCounts[c.id] || 0) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [channels, msgCounts]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m =>
      (m.name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q));
  }, [members, memberQuery]);

  const filteredChannels = useMemo(() => {
    const q = channelQuery.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(c => (c.name || '').toLowerCase().includes(q));
  }, [channels, channelQuery]);

  if (!isOpen || !workspace) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(workspace.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const runAction = async (id, fn, errPrefix) => {
    setActionError('');
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      setActionError(err.message || errPrefix);
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = (member) => {
    if (member.id === workspace.createdBy) return;
    if (!window.confirm(`Remove ${member.name} from ${workspace.name}? They will lose access to all channels.`)) return;
    runAction(member.id, () => onRemoveMember(member.id), 'Failed to remove member.');
  };

  const handlePromote = (member) =>
    runAction(member.id, () => onPromoteAdmin(member.id), 'Failed to update role.');

  const handleDemote = (member) =>
    runAction(member.id, () => onDemoteAdmin(member.id), 'Failed to update role.');

  const handleDeleteCh = (ch) => {
    if (ch.name === 'general') { setActionError('The #general channel cannot be deleted.'); return; }
    if (!window.confirm(`Delete #${ch.name}? All of its messages will be permanently removed.`)) return;
    runAction(ch.id, () => onDeleteChannel(ch.id), 'Failed to delete channel.');
  };

  const handleModerate = async (msg) => {
    if (!window.confirm('Remove this message for everyone? This cannot be undone.')) return;
    const sender = memberById[msg.senderId];
    const chan = channelById[msg.destinationId];
    setActionError('');
    setBusyId(msg.id);
    try {
      await onModerateMessage(msg.id, { senderName: sender?.name || '', channelName: chan?.name || '' });
      // Optimistically drop it from the local feed.
      setMsgDocs(prev => (prev ? prev.map(m => (m.id === msg.id ? { ...m, deletedForEveryone: true } : m)) : prev));
    } catch (err) {
      setActionError(err.message || 'Failed to remove message.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const name = nameDraft.trim();
    if (!name) { setSettingsMsg('Workspace name is required.'); return; }
    setSavingSettings(true);
    setSettingsMsg('');
    try {
      await onUpdateWorkspace(workspace.id, name, (iconDraft.trim() || name.substring(0, 2)).toUpperCase().substring(0, 2));
      setSettingsMsg('saved');
      setTimeout(() => setSettingsMsg(''), 2000);
    } catch (err) {
      setSettingsMsg(err.message || 'Failed to save changes.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteWs = async () => {
    if (deleteConfirm !== workspace.name) return;
    setDeleting(true);
    try {
      await onDeleteWorkspace(workspace.id);
      onClose();
    } catch (err) {
      setActionError(err.message || 'Failed to delete workspace.');
      setDeleting(false);
    }
  };

  const roleOf = (id) => {
    if (id === workspace.createdBy) return 'owner';
    if (admins.includes(id)) return 'admin';
    return 'member';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-100" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[3px]" onClick={() => !deleting && !busyId && onClose()}></div>

      <div className="relative w-full max-w-4xl h-[88vh] sm:h-[84vh] flex flex-col overflow-hidden bg-[#F8F8F8] rounded-2xl shadow-slack-modal border border-[#E8E8E8] animate-in zoom-in-95 duration-150 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#3F0E40] text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center font-black text-[13px] shrink-0">
              {workspace.iconText || getInitials(workspace.name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-extrabold tracking-tight truncate">{workspace.name}</h2>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#ECB22E] text-[#1D1C1D] text-[9px] font-black uppercase tracking-wider shrink-0">
                  <Shield className="w-2.5 h-2.5" /> {isOwner ? 'Owner' : 'Admin'}
                </span>
              </div>
              <p className="text-[11px] text-white/55 truncate font-medium">Workspace administration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={deleting || !!busyId}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors disabled:opacity-40"
            aria-label="Close admin panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action error banner */}
        {actionError && (
          <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">{actionError}</span>
            <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          {/* Tab rail */}
          <nav className="w-[52px] sm:w-[180px] bg-white border-r border-[#E8E8E8] shrink-0 py-3 px-2 space-y-1 overflow-y-auto custom-scrollbar">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setActionError(''); }}
                className={`w-full flex items-center gap-2.5 px-2.5 sm:px-3 py-2 rounded-lg text-[13px] font-bold transition-colors ${
                  tab === id ? 'bg-[#F1E7F2] text-[#3F0E40]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
                title={label}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline truncate">{label}</span>
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
            {/* ---------- OVERVIEW ---------- */}
            {tab === 'overview' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard icon={Users} label="Members" value={members.length} accent="bg-[#1164A3]" />
                  <StatCard icon={Circle} label="Online now" value={onlineCount} accent="bg-[#2BAC76]" />
                  <StatCard icon={Hash} label="Channels" value={channels.length} accent="bg-[#613064]" />
                  <StatCard icon={MessageSquare} label="Channel messages" value={statsLoading ? '…' : (totalMsgs ?? '—')} accent="bg-[#E01E5A]" />
                </div>

                <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
                  <h3 className="text-[12px] font-black text-[#1D1C1D] uppercase tracking-wider mb-3">Workspace details</h3>
                  <dl className="space-y-2.5 text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500 font-semibold">Admins</dt>
                      <dd className="font-bold text-[#1D1C1D]">{admins.length + 1} (incl. owner)</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500 font-semibold">Private channels</dt>
                      <dd className="font-bold text-[#1D1C1D]">{privateChannels} of {channels.length}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500 font-semibold shrink-0">Workspace ID</dt>
                      <dd className="flex items-center gap-2 min-w-0">
                        <code className="font-mono text-[11px] text-[#1164A3] font-bold truncate">{workspace.id}</code>
                        <button onClick={handleCopyId} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 shrink-0" title="Copy Workspace ID">
                          {copied ? <Check className="w-3.5 h-3.5 text-[#2BAC76]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button onClick={() => { onClose(); onInviteClick(); }} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#007a5a] hover:bg-[#148567] text-white text-[13px] font-bold transition-colors">
                    <UserPlus className="w-4 h-4" /> Invite people
                  </button>
                  <button onClick={() => { onClose(); onAddChannelClick(); }} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-[#1D1C1D] text-[13px] font-bold transition-colors">
                    <Plus className="w-4 h-4" /> Create channel
                  </button>
                </div>
              </div>
            )}

            {/* ---------- ANALYTICS ---------- */}
            {tab === 'analytics' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {!isConfigured ? <EmulatedNote /> : (
                  <>
                    <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
                      <h3 className="text-[12px] font-black text-[#1D1C1D] uppercase tracking-wider mb-4">Messages — last 7 days</h3>
                      {statsLoading ? (
                        <div className="h-32 flex items-center justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                      ) : (
                        <div className="flex items-end justify-between gap-2 h-32">
                          {activityByDay.map((d, i) => {
                            const max = Math.max(1, ...activityByDay.map(x => x.count));
                            const h = Math.round((d.count / max) * 100);
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                                <span className="text-[10px] font-bold text-slate-500">{d.count}</span>
                                <div className="w-full bg-[#3F0E40] rounded-t-md transition-all" style={{ height: `${Math.max(h, 2)}%` }} title={`${d.count} messages`} />
                                <span className="text-[10px] font-semibold text-slate-400">{d.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="bg-white border border-[#E8E8E8] rounded-xl p-4">
                      <h3 className="text-[12px] font-black text-[#1D1C1D] uppercase tracking-wider mb-4">Messages by channel</h3>
                      {statsLoading ? (
                        <div className="h-24 flex items-center justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                      ) : channelBars.length === 0 ? (
                        <p className="text-sm text-slate-400 font-semibold text-center py-4">No channels yet.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {channelBars.map(c => {
                            const max = Math.max(1, ...channelBars.map(x => x.count));
                            const w = Math.round((c.count / max) * 100);
                            return (
                              <div key={c.id} className="flex items-center gap-3">
                                <div className="w-28 sm:w-36 flex items-center gap-1.5 shrink-0 min-w-0">
                                  {c.isPrivate ? <Lock className="w-3 h-3 text-slate-400 shrink-0" /> : <Hash className="w-3 h-3 text-slate-400 shrink-0" />}
                                  <span className="text-[12px] font-bold text-[#1D1C1D] truncate">{c.name}</span>
                                </div>
                                <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden">
                                  <div className="h-full bg-[#1164A3] rounded-md transition-all" style={{ width: `${Math.max(w, c.count > 0 ? 4 : 0)}%` }} />
                                </div>
                                <span className="text-[12px] font-black text-slate-600 w-8 text-right shrink-0">{c.count}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ---------- MEMBERS ---------- */}
            {tab === 'members' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Search members by name or email"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium bg-white" />
                  </div>
                  <button onClick={() => { onClose(); onInviteClick(); }} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#007a5a] hover:bg-[#148567] text-white text-[13px] font-bold transition-colors shrink-0">
                    <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Invite</span>
                  </button>
                </div>

                <div className="bg-white border border-[#E8E8E8] rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {filteredMembers.length === 0 && (
                    <div className="p-6 text-center text-sm text-slate-400 font-semibold">No members match your search.</div>
                  )}
                  {filteredMembers.map((m) => {
                    const role = roleOf(m.id);
                    const isMe = m.id === currentUser?.uid;
                    // Owner can manage every role; a non-owner admin can only remove plain members.
                    const canRemove = role !== 'owner' && (isOwner || role === 'member');
                    return (
                      <div key={m.id} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 transition-colors">
                        <button onClick={() => onOpenProfile && onOpenProfile(m.id)}
                          className={`w-9 h-9 rounded-lg ${getAvatarColorClass(m.name)} text-white font-bold flex items-center justify-center text-[12px] shrink-0 relative`} title="View profile">
                          {m.avatar || getInitials(m.name)}
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${m.status === 'online' ? 'bg-[#2BAC76]' : 'bg-slate-300'}`} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[13px] text-[#1D1C1D] truncate">{m.name}</span>
                            {role === 'owner' && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider text-[#B8860B]"><Crown className="w-3 h-3" /> Owner</span>
                            )}
                            {role === 'admin' && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider text-[#1164A3]"><ShieldCheck className="w-3 h-3" /> Admin</span>
                            )}
                            {isMe && role === 'member' && <span className="text-[10px] text-slate-400 font-bold">(you)</span>}
                          </div>
                          <span className="text-[11px] text-slate-500 truncate block">{m.email}</span>
                        </div>

                        {/* Role + remove actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Owner-only role toggles */}
                          {isOwner && role === 'member' && (
                            <button onClick={() => handlePromote(m)} disabled={busyId === m.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-bold text-[#1164A3] hover:bg-blue-50 transition-colors disabled:opacity-50">
                              {busyId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                              <span className="hidden sm:inline">Make admin</span>
                            </button>
                          )}
                          {isOwner && role === 'admin' && (
                            <button onClick={() => handleDemote(m)} disabled={busyId === m.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
                              {busyId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                              <span className="hidden sm:inline">Revoke</span>
                            </button>
                          )}
                          {canRemove ? (
                            <button onClick={() => handleRemove(m)} disabled={busyId === m.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-bold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                              {busyId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                              <span className="hidden sm:inline">Remove</span>
                            </button>
                          ) : role === 'owner' ? (
                            <span className="text-[11px] text-slate-300 font-bold px-2">—</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!isOwner && (
                  <p className="text-[11px] text-slate-400 px-1">Only the workspace owner can change admin roles.</p>
                )}
              </div>
            )}

            {/* ---------- CHANNELS ---------- */}
            {tab === 'channels' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={channelQuery} onChange={(e) => setChannelQuery(e.target.value)} placeholder="Search channels"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium bg-white" />
                  </div>
                  <button onClick={() => { onClose(); onAddChannelClick(); }} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-[#1D1C1D] text-[13px] font-bold transition-colors shrink-0">
                    <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New</span>
                  </button>
                </div>

                <div className="bg-white border border-[#E8E8E8] rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {filteredChannels.length === 0 && (
                    <div className="p-6 text-center text-sm text-slate-400 font-semibold">No channels match your search.</div>
                  )}
                  {filteredChannels.map((ch) => {
                    const count = msgCounts ? (msgCounts[ch.id] || 0) : null;
                    return (
                      <div key={ch.id} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                          {ch.isPrivate ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[13px] text-[#1D1C1D] truncate">{ch.name}</span>
                            {ch.isPrivate && <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Private</span>}
                          </div>
                          <span className="text-[11px] text-slate-500 truncate block">
                            {ch.description || 'No description'}
                            {count !== null && <span className="text-slate-400"> · {count} message{count === 1 ? '' : 's'}</span>}
                          </span>
                        </div>
                        {ch.name === 'general' ? (
                          <span className="text-[10px] text-slate-300 font-bold px-2 shrink-0 hidden sm:inline">Default</span>
                        ) : (
                          <button onClick={() => handleDeleteCh(ch)} disabled={busyId === ch.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-bold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0">
                            {busyId === ch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---------- MODERATION ---------- */}
            {tab === 'moderation' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <p className="text-[12px] text-slate-500 font-medium px-1">
                  Most recent channel messages. Removing a message clears it for everyone (it stays as
                  <span className="font-bold"> “deleted by an admin”</span>). Direct messages are private and never shown here.
                </p>
                {!isConfigured ? <EmulatedNote /> : statsLoading ? (
                  <div className="h-24 flex items-center justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                ) : (
                  <div className="bg-white border border-[#E8E8E8] rounded-xl divide-y divide-slate-100 overflow-hidden">
                    {moderationFeed.length === 0 && (
                      <div className="p-6 text-center text-sm text-slate-400 font-semibold">No channel messages to moderate.</div>
                    )}
                    {moderationFeed.map((msg) => {
                      const sender = memberById[msg.senderId];
                      const chan = channelById[msg.destinationId];
                      const preview = msg.content?.trim()
                        ? msg.content
                        : (msg.file || msg.voiceRecording ? '📎 Attachment' : '(no text)');
                      return (
                        <div key={msg.id} className="flex items-start gap-3 px-3.5 py-2.5 hover:bg-slate-50 transition-colors">
                          <div className={`w-8 h-8 rounded-lg ${getAvatarColorClass(sender?.name || 'U')} text-white font-bold flex items-center justify-center text-[11px] shrink-0`}>
                            {sender?.avatar || getInitials(sender?.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-[12px] text-[#1D1C1D] truncate">{sender?.name || 'Unknown user'}</span>
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 font-semibold">
                                {chan?.isPrivate ? <Lock className="w-2.5 h-2.5" /> : <Hash className="w-2.5 h-2.5" />}{chan?.name || 'channel'}
                              </span>
                              <span className="text-[10px] text-slate-300 font-medium">· {timeAgo(tsToMillis(msg.timestamp))}</span>
                            </div>
                            <p className="text-[13px] text-slate-700 break-words line-clamp-3">{preview}</p>
                          </div>
                          <button onClick={() => handleModerate(msg)} disabled={busyId === msg.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-bold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0">
                            {busyId === msg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">Remove</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ---------- AUDIT LOG ---------- */}
            {tab === 'audit' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[12px] text-slate-500 font-medium">A record of recent admin actions in this workspace.</p>
                  <button onClick={() => setAuditRefresh(n => n + 1)} disabled={auditLoading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                </div>
                {!isConfigured ? <EmulatedNote /> : auditLoading && !auditLogs ? (
                  <div className="h-24 flex items-center justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                ) : (
                  <div className="bg-white border border-[#E8E8E8] rounded-xl divide-y divide-slate-100 overflow-hidden">
                    {(!auditLogs || auditLogs.length === 0) && (
                      <div className="p-6 text-center text-sm text-slate-400 font-semibold">No admin activity recorded yet.</div>
                    )}
                    {(auditLogs || []).map((log) => {
                      const meta = ACTION_META[log.action] || { label: log.action, dot: 'bg-slate-300' };
                      return (
                        <div key={log.id} className="flex items-start gap-3 px-3.5 py-2.5">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${meta.dot}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] text-[#1D1C1D] leading-snug">
                              <span className="font-bold">{log.actorName || 'Admin'}</span>{' '}
                              <span className="text-slate-600">{meta.label}</span>
                              {log.targetName && <span className="font-bold"> {log.targetName}</span>}
                            </p>
                            {log.detail && <p className="text-[11px] text-slate-400">{log.detail}</p>}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium shrink-0 mt-0.5">{timeAgo(tsToMillis(log.createdAt))}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ---------- SETTINGS ---------- */}
            {tab === 'settings' && (
              <div className="space-y-5 animate-in fade-in duration-150 max-w-xl">
                <form onSubmit={handleSaveSettings} className="bg-white border border-[#E8E8E8] rounded-xl p-4 space-y-4">
                  <h3 className="text-[12px] font-black text-[#1D1C1D] uppercase tracking-wider">General</h3>
                  <div>
                    <label className="block text-[12px] font-bold text-[#1D1C1D] mb-1.5">Workspace name</label>
                    <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={50}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-medium" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#1D1C1D] mb-1.5">Icon initials</label>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-lg bg-[#3F0E40] text-white font-black flex items-center justify-center text-[14px] shrink-0">
                        {(iconDraft.trim() || nameDraft.substring(0, 2)).toUpperCase().substring(0, 2)}
                      </div>
                      <input value={iconDraft} onChange={(e) => setIconDraft(e.target.value)} maxLength={2} placeholder="AB"
                        className="w-24 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1164A3] focus:border-[#1164A3] font-bold uppercase tracking-wider" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <button type="submit" disabled={savingSettings}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#007a5a] hover:bg-[#148567] text-white text-[13px] font-bold transition-colors disabled:opacity-60">
                      {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes
                    </button>
                    {settingsMsg === 'saved' ? (
                      <span className="text-[12px] font-bold text-[#2BAC76] flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>
                    ) : settingsMsg ? (
                      <span className="text-[12px] font-bold text-red-600">{settingsMsg}</span>
                    ) : null}
                  </div>
                </form>

                {/* Danger zone — owner only */}
                {isOwner ? (
                  <div className="bg-white border border-red-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <h3 className="text-[12px] font-black text-red-600 uppercase tracking-wider">Danger zone</h3>
                    </div>
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                      Deleting <span className="font-bold text-[#1D1C1D]">{workspace.name}</span> permanently removes all of its
                      channels and messages for every member. This cannot be undone.
                    </p>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                        Type <span className="font-mono text-red-600">{workspace.name}</span> to confirm
                      </label>
                      <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={workspace.name}
                        className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 font-medium" />
                    </div>
                    <button onClick={handleDeleteWs} disabled={deleteConfirm !== workspace.name || deleting}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[13px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete this workspace
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 px-1">Only the workspace owner can delete the workspace.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
