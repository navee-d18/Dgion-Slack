import { useState, useEffect, useRef, useMemo } from 'react';
import WorkspaceSidebar from './components/WorkspaceSidebar';
import ChannelNav from './components/ChannelNav';
import ChatArea from './components/ChatArea';
import MembersPanel from './components/MembersPanel';
import ThreadPanel from './components/ThreadPanel';
import PinnedPanel from './components/PinnedPanel';
import { 
  CreateChannelModal, CreateWorkspaceModal, SearchModal, InviteWorkspaceModal, 
  EditDeleteChannelModal, JoinWorkspaceModal, WorkspaceSettingsModal, 
  PreferencesModal, HelpFeedbackModal, UserProfileModal 
} from './components/Modals';
import { useAuth } from './context/AuthContext';
import AuthScreens from './components/AuthScreens';
import { Loader2 } from 'lucide-react';
import { playNotificationSound } from './utils/audio';

// Firebase Firestore Hooks
import { 
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  arrayUnion,
  deleteDoc,
  runTransaction
} from 'firebase/firestore';
import { db, isConfigured } from './firebase';
import { purgeAllDemoData } from './utils/dbCleanup';
import { uploadAttachment } from './utils/storage';
import { dmConversationId, conversationKey } from './utils/conversation';
import { formatReminderTime } from './utils/datetime';

// Rich fallback database (when running in Local Developer Emulation Mode)
const INITIAL_WORKSPACES = [];
const INITIAL_MESSAGES = {};

function SlackDashboard({ user, logout }) {
  const [workspaces, setWorkspaces] = useState(INITIAL_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    return localStorage.getItem(`slack_active_workspace_id_${user.uid}`) || '';
  });
  const [activeDestinationId, setActiveDestinationId] = useState(() => {
    return localStorage.getItem(`slack_active_destination_id_${user.uid}`) || '';
  });
  const [isDestinationDm, setIsDestinationDm] = useState(() => {
    return localStorage.getItem(`slack_is_destination_dm_${user.uid}`) === 'true';
  });
  
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [allRegisteredUsers, setAllRegisteredUsers] = useState([]);

  // Message pagination: load the latest page, grow the window on "load older".
  const MESSAGE_PAGE_SIZE = 30;
  const [messageLimit, setMessageLimit] = useState(MESSAGE_PAGE_SIZE);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  // Pinned messages are fetched separately (full set) so pagination doesn't hide them.
  const [pinnedMessages, setPinnedMessages] = useState([]);
  // Read receipts for the active conversation (per-user lastReadAt) → Seen/Delivered status.
  const [readReceipts, setReadReceipts] = useState([]);
  const [focusTick, setFocusTick] = useState(0);

  const latestUsersRef = useRef(allRegisteredUsers);
  useEffect(() => {
    latestUsersRef.current = allRegisteredUsers;
  }, [allRegisteredUsers]);

  const [workspacesLoading, setWorkspacesLoading] = useState(isConfigured);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [channelsLoading, setChannelsLoading] = useState(isConfigured);
  
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [pinnedPanelOpen, setPinnedPanelOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'create_channel' | 'create_workspace' | 'search' | null
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [channelSettingsTarget, setChannelSettingsTarget] = useState(null);
  const [activeThreadMessageId, setActiveThreadMessageId] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState([]);
  const [activeTypers, setActiveTypers] = useState([]);
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [reminders, setReminders] = useState([]);

  // Preference States
  const [theme, setTheme] = useState(() => localStorage.getItem('slack_theme') || 'light');
  const [notifications, setNotifications] = useState(() => localStorage.getItem('slack_notifications') || 'on');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('slack_compact_mode') === 'on');

  // Dynamically apply Theme changes
  useEffect(() => {
    document.body.classList.toggle('dark-theme', theme === 'dark');
  }, [theme]);

  // ========================================================
  // 1. ONE-TIME DATABASE DEMO PURGE TRIGGER (REAL FIRESTORE MODE)
  // ========================================================
  useEffect(() => {
    if (isConfigured && user) {
      // One-time demo cleanup. Previously this scanned the ENTIRE messages
      // collection on every login (O(all messages) reads per session). Gate it
      // behind a persistent flag so it runs at most once per browser.
      const PURGE_FLAG = 'slack_demo_purge_done';
      if (localStorage.getItem(PURGE_FLAG) === 'true') return;
      purgeAllDemoData(user.uid).finally(() => {
        localStorage.setItem(PURGE_FLAG, 'true');
      });
    }
  }, [user]);

  // ========================================================
  // 1.5. SECURE SESSION ISOLATION & RESET ON LOGOUT / USER SWITCH
  // ========================================================
  useEffect(() => {
    if (!user) {
      // Reset all React states immediately on session exit
      setWorkspaces(INITIAL_WORKSPACES);
      setActiveWorkspaceId('');
      setActiveDestinationId('');
      setMessages(INITIAL_MESSAGES);
      setAllRegisteredUsers([]);
      setWorkspacesLoading(false);
      setMessagesLoading(false);

      // Wipe potential local and session storage values
      try {
        localStorage.removeItem('activeWorkspaceId');
        localStorage.removeItem('activeDestinationId');
        sessionStorage.removeItem('activeWorkspaceId');
        sessionStorage.removeItem('activeDestinationId');
        localStorage.removeItem('slack_workspace_selection');
        
        // Securely wipe all session restoration keys from localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('slack_active_') || key.startsWith('slack_is_destination_')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.warn('Storage clear error:', e);
      }
    }
  }, [user]);

  // ========================================================
  // 1.5.5. SAVE SESSION SELECTION TO LOCALSTORAGE (REAL-TIME STATE PRESERVATION)
  // ========================================================
  useEffect(() => {
    if (user && activeWorkspaceId) {
      localStorage.setItem(`slack_active_workspace_id_${user.uid}`, activeWorkspaceId);
      if (activeDestinationId) {
        localStorage.setItem(`slack_active_destination_id_${user.uid}`, activeDestinationId);
        localStorage.setItem(`slack_is_destination_dm_${user.uid}`, isDestinationDm ? 'true' : 'false');
      }
    }
  }, [activeWorkspaceId, activeDestinationId, isDestinationDm, user]);

  // ========================================================
  // 1.5.6. RESTORE SESSION SELECTION FROM LOCALSTORAGE ON AUTHENTICATION
  // ========================================================
  useEffect(() => {
    if (user && !activeWorkspaceId) {
      const savedWsId = localStorage.getItem(`slack_active_workspace_id_${user.uid}`);
      const savedDestId = localStorage.getItem(`slack_active_destination_id_${user.uid}`);
      const savedIsDm = localStorage.getItem(`slack_is_destination_dm_${user.uid}`) === 'true';

      if (savedWsId) {
        setActiveWorkspaceId(savedWsId);
      }
      if (savedDestId) {
        setActiveDestinationId(savedDestId);
        setIsDestinationDm(savedIsDm);
      }
    }
  }, [user, activeWorkspaceId]);

  // ========================================================
  // 1.6. SECURITY ACCESS GUARD: STRICT WORKSPACE MEMBERSHIP ENFORCEMENT
  // ========================================================
  useEffect(() => {
    if (!user || !activeWorkspaceId || workspaces.length === 0) return;
    
    const matchedWs = workspaces.find(w => w.id === activeWorkspaceId);
    if (matchedWs) {
      const isMember = matchedWs.members?.includes(user.uid);
      if (!isMember) {
        console.warn(`Security Redirect: User ${user.uid} lacks membership for ${activeWorkspaceId}`);
        // Reset or fallback to the first authorized workspace
        const firstAvailable = workspaces.find(w => w.members?.includes(user.uid));
        if (firstAvailable) {
          setActiveWorkspaceId(firstAvailable.id);
        } else {
          setActiveWorkspaceId('');
          setActiveDestinationId('');
        }
      }
    }
  }, [activeWorkspaceId, workspaces, user]);

  // ========================================================
  // 2. REAL-TIME OBSERVER: WORKSPACES (members array contains user uid)
  // ========================================================
  useEffect(() => {
    if (!isConfigured || !user) return;

    const q = query(
      collection(db, 'workspaces'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedWorkspaces = [];
      snapshot.forEach((doc) => {
        fetchedWorkspaces.push({ id: doc.id, ...doc.data() });
      });

      // ALWAYS synchronize workspaces state with Firestore, even if it is empty!
      setWorkspaces(fetchedWorkspaces);

      if (fetchedWorkspaces.length > 0) {
        // Auto select active workspace if current is orphan, prioritizing saved session
        setActiveWorkspaceId(prev => {
          // Check if there is a saved workspace selection
          const savedWsId = localStorage.getItem(`slack_active_workspace_id_${user.uid}`);
          const hasSavedWs = fetchedWorkspaces.some(w => w.id === savedWsId);
          
          if (hasSavedWs) {
            // Security check: Verify user is still a listed member of this workspace
            const savedWs = fetchedWorkspaces.find(w => w.id === savedWsId);
            if (savedWs && savedWs.members?.includes(user.uid)) {
              return savedWsId;
            }
          }

          // Fallback to previous selection if still valid and user has membership
          if (fetchedWorkspaces.some(w => w.id === prev)) {
            const currentWs = fetchedWorkspaces.find(w => w.id === prev);
            if (currentWs && currentWs.members?.includes(user.uid)) {
              return prev;
            }
          }

          // Default fallback to first authorized workspace
          const firstWs = fetchedWorkspaces.find(w => w.members?.includes(user.uid));
          return firstWs ? firstWs.id : fetchedWorkspaces[0].id;
        });
      } else {
        // No workspaces found -> reset active ids to display onboarding
        setActiveWorkspaceId('');
        setActiveDestinationId('');
      }
      setWorkspacesLoading(false);
    }, (err) => {
      console.warn('Workspaces observer error:', err);
      setSyncError('Failed to load workspaces list. Verify your Firestore connection/rules.');
      setWorkspacesLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // ========================================================
  // 3. REAL-TIME OBSERVER: REGISTERED USERS (for direct messages list)
  // ========================================================
  useEffect(() => {
    if (!isConfigured || !user) return;

    const q = collection(db, 'users');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = [];
      snapshot.forEach((doc) => {
        fetchedUsers.push({ id: doc.id, ...doc.data() });
      });
      setAllRegisteredUsers(fetchedUsers);
    }, (err) => {
      console.warn('Users observer error:', err);
      setSyncError('Failed to synchronize workspace members directory.');
    });

    return () => unsubscribe();
  }, [user]);

  // ========================================================
  // 3.5. REAL-TIME OBSERVER: HIERARCHICAL PRESENCE TRACKING (ONLINE/OFFLINE)
  // ========================================================
  useEffect(() => {
    if (!user) return;

    let idleTimeout = null;
    let heartbeatInterval = null;
    const IDLE_TIME = 5 * 60 * 1000; // 5 minutes
    const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // 2 minutes

    // Helper to update database status
    const updateDbPresence = async (status) => {
      try {
        const timestamp = new Date().toISOString();
        if (isConfigured) {
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
            presenceStatus: status,
            onlineStatus: status,
            lastSeenAt: timestamp
          });
        } else {
          // Emulation LocalStorage fallback
          const dbUsers = JSON.parse(localStorage.getItem('emulated_users_docs') || '[]');
          const updated = dbUsers.map(u => 
            u.uid === user.uid 
              ? { ...u, presenceStatus: status, onlineStatus: status, lastSeenAt: timestamp } 
              : u
          );
          localStorage.setItem('emulated_users_docs', JSON.stringify(updated));
          
          // Force update local states instantly
          setAllRegisteredUsers(updated.map(u => ({ id: u.uid, ...u })));
          
          // Update emulated workspaces to update sidebar in real-time
          setWorkspaces(prev => prev.map(ws => {
            if (ws.dms) {
              const updatedDms = ws.dms.map(d => d.id === user.uid ? { 
                ...d, 
                status: status
              } : d);
              return { ...ws, dms: updatedDms };
            }
            return ws;
          }));

          // Also update session user status
          const session = JSON.parse(localStorage.getItem('emulated_session') || '{}');
          if (session.uid === user.uid) {
            localStorage.setItem('emulated_session', JSON.stringify({
              ...session,
              presenceStatus: status,
              onlineStatus: status,
              lastSeenAt: timestamp
            }));
          }
        }
      } catch (err) {
        console.warn('Failed to update presence status in database:', err);
      }
    };

    // Helper to report active (typing priority is fully honored here)
    let lastWriteTime = 0;
    const reportActive = async (isTyping = false) => {
      const now = Date.now();
      
      // Fetch latest DB status (optimized via latestUsersRef or localStorage in emulation)
      let currentDbStatus = 'offline';
      if (isConfigured) {
        const freshUserDoc = latestUsersRef.current.find(u => u.uid === user.uid || u.id === user.uid);
        currentDbStatus = freshUserDoc ? (freshUserDoc.presenceStatus || freshUserDoc.onlineStatus || 'offline') : 'offline';
      } else {
        const dbUsers = JSON.parse(localStorage.getItem('emulated_users_docs') || '[]');
        const freshUserDoc = dbUsers.find(u => u.uid === user.uid);
        currentDbStatus = freshUserDoc ? (freshUserDoc.presenceStatus || freshUserDoc.onlineStatus || 'offline') : 'offline';
      }

      // Instant online if user started typing OR if current DB status is not online
      // Heartbeat written every 2 minutes if already online
      if (currentDbStatus !== 'online' || isTyping || (now - lastWriteTime > HEARTBEAT_INTERVAL)) {
        lastWriteTime = now;
        await updateDbPresence('online');
      }

      // Reset the idle timer
      resetIdleTimer();
    };

    // Reset idle timer
    const resetIdleTimer = () => {
      if (idleTimeout) clearTimeout(idleTimeout);
      idleTimeout = setTimeout(reportIdle, IDLE_TIME);
    };

    // Idle check - queries latest lastSeenAt to support multi-tab coordination without conflicts
    const reportIdle = async () => {
      try {
        let latestLastSeen = null;
        if (isConfigured) {
          const userDocRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            latestLastSeen = docSnap.data().lastSeenAt;
          }
        } else {
          const dbUsers = JSON.parse(localStorage.getItem('emulated_users_docs') || '[]');
          const uDoc = dbUsers.find(u => u.uid === user.uid);
          if (uDoc) {
            latestLastSeen = uDoc.lastSeenAt;
          }
        }

        if (latestLastSeen) {
          const lastSeenMs = new Date(latestLastSeen).getTime();
          const diffMs = Date.now() - lastSeenMs;
          // If another active tab updated the heartbeat within 4.5 minutes, keep online status!
          if (diffMs < 4.5 * 60 * 1000) {
            console.log('Skipping offline: user is active in another session/tab. lastSeen ago (ms):', diffMs);
            resetIdleTimer();
            return;
          }
        }

        // Set status to offline
        await updateDbPresence('offline');
      } catch (err) {
        console.warn('Error verifying heartbeat during idle transition:', err);
        await updateDbPresence('offline');
      }
    };

    // Activity event bindings
    const handleActivity = () => {
      reportActive(false);
    };

    // mousemove fires dozens of times per second; throttle it so reportActive
    // isn't invoked on every pixel of movement. The DB write is already capped,
    // but the per-event work + idle-timer churn is pure waste otherwise.
    let lastMoveAt = 0;
    const handleMouseMove = () => {
      const now = Date.now();
      if (now - lastMoveAt < 1500) return;
      lastMoveAt = now;
      reportActive(false);
    };

    const handleKeyboardActivity = (e) => {
      const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
      reportActive(isTyping);
    };

    window.addEventListener('focus', handleActivity);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyboardActivity);
    document.addEventListener('mousedown', handleActivity);
    document.addEventListener('touchstart', handleActivity);

    // Dynamic user-started-typing custom event
    const handleTypingEvent = () => {
      reportActive(true);
    };
    window.addEventListener('user-started-typing', handleTypingEvent);

    // Initial mount check
    reportActive(false);

    // Periodically update active status while tab is focused/active
    heartbeatInterval = setInterval(() => {
      if (document.hasFocus()) {
        reportActive(false);
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      if (idleTimeout) clearTimeout(idleTimeout);
      if (heartbeatInterval) clearInterval(heartbeatInterval);

      window.removeEventListener('focus', handleActivity);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyboardActivity);
      document.removeEventListener('mousedown', handleActivity);
      document.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('user-started-typing', handleTypingEvent);
    };
  }, [user]);

  // ========================================================
  // 4. REAL-TIME OBSERVER: CHANNELS (workspaceId == activeWorkspaceId)
  // ========================================================
  useEffect(() => {
    if (!isConfigured || !activeWorkspaceId || !user) return;

    setChannelsLoading(true);

    const q = query(
      collection(db, 'channels'),
      where('workspaceId', '==', activeWorkspaceId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChannels = [];
      snapshot.forEach((doc) => {
        fetchedChannels.push({ id: doc.id, ...doc.data() });
      });

      // Sort chronologically on client-side to bypass compound index issues
      const sortedChannels = fetchedChannels.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeA - timeB;
      });

      setWorkspaces(prev => prev.map(ws => {
        if (ws.id === activeWorkspaceId) {
          return { ...ws, channels: sortedChannels };
        }
        return ws;
      }));
      setChannelsLoading(false);
    }, (err) => {
      console.warn('Channels observer error:', err);
      setSyncError('Failed to sync active workspace channels.');
      setChannelsLoading(false);
    });

    return () => unsubscribe();
  }, [activeWorkspaceId, user]);

  useEffect(() => {
    if (activeWorkspaceId && activeDestinationId && user) {
      setMessagesLoading(true);
      // Reset the pagination window whenever the open conversation changes.
      setMessageLimit(MESSAGE_PAGE_SIZE);
      setHasMoreMessages(false);
      setPinnedMessages([]);
      setReadReceipts([]);
    }
  }, [activeWorkspaceId, activeDestinationId, isDestinationDm, user]);

  // ========================================================
  // 5. REAL-TIME OBSERVER: MESSAGES
  // ========================================================
  useEffect(() => {
    if (!isConfigured || !activeWorkspaceId || !activeDestinationId || !user) return;

    let q;
    if (isDestinationDm) {
      // Direct message query: watch the shared conversation ID (latest page only)
      const sharedConversationId = dmConversationId(user.uid, activeDestinationId);
      q = query(
        collection(db, 'messages'),
        where('workspaceId', '==', activeWorkspaceId),
        where('conversationId', '==', sharedConversationId),
        orderBy('createdAt', 'desc'),
        limit(messageLimit)
      );
    } else {
      // Channel message query: watch the channel ID (latest page only)
      q = query(
        collection(db, 'messages'),
        where('workspaceId', '==', activeWorkspaceId),
        where('channelId', '==', activeDestinationId),
        orderBy('createdAt', 'desc'),
        limit(messageLimit)
      );
    }

    let isInitial = true;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // A full page back from the server means older messages may still exist.
      setHasMoreMessages(snapshot.size === messageLimit);
      setLoadingMoreMessages(false);

      const fetchedMessages = [];
      snapshot.forEach((doc) => {
        // Use estimated server timestamps so a just-sent message (pending write)
        // still sorts correctly instead of briefly jumping to the top.
        fetchedMessages.push({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) });
      });

      // Query returns newest-first; sort ascending for display (oldest at top).
      const sortedMessages = fetchedMessages.sort((a, b) => {
        const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
        return timeA - timeB;
      });

      // Notification Sound Trigger for incoming real-time messages
      if (!isInitial && sortedMessages.length > 0) {
        const lastMsg = sortedMessages[sortedMessages.length - 1];
        if (notifications === 'on' && lastMsg.senderId !== user.uid) {
          playNotificationSound();
        }
      }
      isInitial = false;

      const channelKey = `${activeWorkspaceId}-${activeDestinationId}`;
      setMessages(prev => ({
        ...prev,
        [channelKey]: sortedMessages
      }));
      setMessagesLoading(false);
    }, (err) => {
      console.warn('Messages observer error:', err);
      setSyncError('Database rules block read access or disconnected.');
      setMessagesLoading(false);
      setLoadingMoreMessages(false);
    });

    return () => unsubscribe();
  }, [activeWorkspaceId, activeDestinationId, user, isDestinationDm, notifications, messageLimit]);

  // ========================================================
  // 5.05. REAL-TIME OBSERVER: PINNED MESSAGES (full set, pagination-independent)
  // ========================================================
  useEffect(() => {
    if (!isConfigured || !activeWorkspaceId || !activeDestinationId || !user) return;

    let q;
    if (isDestinationDm) {
      const sharedConversationId = dmConversationId(user.uid, activeDestinationId);
      q = query(
        collection(db, 'messages'),
        where('workspaceId', '==', activeWorkspaceId),
        where('conversationId', '==', sharedConversationId),
        where('isPinned', '==', true)
      );
    } else {
      q = query(
        collection(db, 'messages'),
        where('workspaceId', '==', activeWorkspaceId),
        where('channelId', '==', activeDestinationId),
        where('isPinned', '==', true)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pins = [];
      snapshot.forEach((docSnap) => {
        pins.push({ id: docSnap.id, ...docSnap.data({ serverTimestamps: 'estimate' }) });
      });
      setPinnedMessages(pins);
    }, (err) => {
      console.warn('Pinned messages observer error:', err);
    });

    return () => unsubscribe();
  }, [activeWorkspaceId, activeDestinationId, user, isDestinationDm]);

  // ========================================================
  // 5.06. READ RECEIPTS: observe active conversation + mark-as-read writer
  // ========================================================
  // conversationKey groups a conversation symmetrically: a DM uses the sorted uid
  // pair (identical for both participants); a channel uses the channelId.
  const activeConversationKey = (activeWorkspaceId && activeDestinationId && user)
    ? conversationKey({ selfUid: user.uid, destinationId: activeDestinationId, isDm: isDestinationDm })
    : '';

  // 1. Firestore observer for the active conversation's receipts
  useEffect(() => {
    if (!isConfigured || !activeWorkspaceId || !activeConversationKey || !user) return;
    const q = query(
      collection(db, 'read_receipts'),
      where('workspaceId', '==', activeWorkspaceId),
      where('conversationKey', '==', activeConversationKey)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data({ serverTimestamps: 'estimate' }) });
      });
      setReadReceipts(list);
    }, (err) => {
      console.warn('Read receipts observer error:', err);
    });
    return () => unsubscribe();
  }, [isConfigured, activeWorkspaceId, activeConversationKey, user]);

  // 2. Emulation: load receipts from localStorage for the active conversation
  useEffect(() => {
    if (isConfigured || !activeWorkspaceId || !activeConversationKey || !user) return;
    const loadLocalReceipts = () => {
      const all = JSON.parse(localStorage.getItem('slack_read_receipts') || '{}');
      setReadReceipts(Object.values(all).filter(
        r => r.conversationKey === activeConversationKey && r.workspaceId === activeWorkspaceId
      ));
    };
    loadLocalReceipts();
    window.addEventListener('storage', loadLocalReceipts);
    window.addEventListener('slack_local_read_receipts_update', loadLocalReceipts);
    return () => {
      window.removeEventListener('storage', loadLocalReceipts);
      window.removeEventListener('slack_local_read_receipts_update', loadLocalReceipts);
    };
  }, [isConfigured, activeWorkspaceId, activeConversationKey, user]);

  // Re-trigger mark-as-read when the tab regains focus / becomes visible.
  useEffect(() => {
    const bump = () => setFocusTick(t => t + 1);
    window.addEventListener('focus', bump);
    document.addEventListener('visibilitychange', bump);
    return () => {
      window.removeEventListener('focus', bump);
      document.removeEventListener('visibilitychange', bump);
    };
  }, []);

  // 3. Mark the active conversation read (own lastReadAt) — focus-aware + throttled.
  const lastReadWriteRef = useRef({ key: '', at: 0 });
  const activeMessagesCount = messages[`${activeWorkspaceId}-${activeDestinationId}`]?.length || 0;
  useEffect(() => {
    if (!user || !activeWorkspaceId || !activeConversationKey) return;
    if (typeof document !== 'undefined' && document.hasFocus && !document.hasFocus()) return;

    // Throttle: skip if we wrote for this same conversation < 2s ago.
    const nowMs = Date.now();
    if (lastReadWriteRef.current.key === activeConversationKey && nowMs - lastReadWriteRef.current.at < 2000) return;
    lastReadWriteRef.current = { key: activeConversationKey, at: nowMs };

    const receiptId = `${activeConversationKey}__${user.uid}`;
    const payload = {
      workspaceId: activeWorkspaceId,
      conversationKey: activeConversationKey,
      isDm: isDestinationDm,
      userId: user.uid,
      userName: user.name
    };

    if (isConfigured) {
      setDoc(doc(db, 'read_receipts', receiptId), { ...payload, lastReadAt: serverTimestamp() }, { merge: true })
        .catch((err) => console.warn('Failed to write read receipt:', err));
    } else {
      try {
        const all = JSON.parse(localStorage.getItem('slack_read_receipts') || '{}');
        all[receiptId] = { ...payload, lastReadAt: nowMs };
        localStorage.setItem('slack_read_receipts', JSON.stringify(all));
        window.dispatchEvent(new Event('slack_local_read_receipts_update'));
      } catch (e) {
        console.warn('Failed to write local read receipt:', e);
      }
    }
  }, [user, activeWorkspaceId, activeConversationKey, isDestinationDm, activeMessagesCount, focusTick]);

  // ========================================================
  // 5.5. REAL-TIME OBSERVER: NOTIFICATIONS (FIRESTORE MODE)
  // ========================================================
  useEffect(() => {
    if (!isConfigured || !user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isRead === false) {
          fetchedNotifications.push({ id: doc.id, ...data });
        }
      });
      console.log('🔔 Loaded unread notifications for user:', user.uid, fetchedNotifications);
      setUnreadNotifications(fetchedNotifications);
    }, (err) => {
      console.warn('Notifications observer error:', err);
    });

    return () => unsubscribe();
  }, [user]);

  // ========================================================
  // 5.6. LOCAL STORAGE SYNC: NOTIFICATIONS (EMULATOR MODE)
  // ========================================================
  useEffect(() => {
    if (isConfigured || !user) return;

    const loadNotifications = () => {
      const localData = JSON.parse(localStorage.getItem(`slack_notifications_user_${user.uid}`) || '[]');
      setUnreadNotifications(localData.filter(n => !n.isRead));
    };

    loadNotifications();

    const handleStorageChange = (e) => {
      if (e.key === `slack_notifications_user_${user.uid}`) {
        loadNotifications();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const handleLocalUpdate = () => loadNotifications();
    window.addEventListener('slack_local_notifications_update', handleLocalUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('slack_local_notifications_update', handleLocalUpdate);
    };
  }, [user]);

  // ========================================================
  // 5.7. REAL-TIME OBSERVER: TYPING STATUS (FIRESTORE MODE)
  // ========================================================
  useEffect(() => {
    if (!isConfigured || !user || !activeWorkspaceId || !activeDestinationId) {
      setActiveTypers([]);
      return;
    }

    const q = collection(db, 'typing_status');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const typers = [];
      const now = Date.now();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        const isChannelMatch = !data.isDestinationDm && data.destinationId === activeDestinationId;
        const isDmMatch = data.isDestinationDm && data.userId === activeDestinationId && data.destinationId === user.uid;

        if (
          data.workspaceId === activeWorkspaceId &&
          (isChannelMatch || isDmMatch) &&
          data.userId !== user.uid &&
          data.isTyping === true
        ) {
          const updatedTime = data.updatedAt ? (typeof data.updatedAt.toMillis === 'function' ? data.updatedAt.toMillis() : new Date(data.updatedAt).getTime()) : now;
          const isFresh = (now - updatedTime) < 10000;
          if (isFresh) {
            typers.push(data);
          }
        }
      });
      setActiveTypers(typers);
    }, (err) => {
      console.warn('Typing observer error:', err);
    });

    return () => unsubscribe();
  }, [activeWorkspaceId, activeDestinationId, user]);

  // ========================================================
  // 5.8. LOCAL STORAGE SYNC: TYPING STATUS (EMULATOR MODE)
  // ========================================================
  useEffect(() => {
    if (isConfigured || !user || !activeWorkspaceId || !activeDestinationId) {
      setActiveTypers([]);
      return;
    }

    const loadTyping = () => {
      const localData = JSON.parse(localStorage.getItem('slack_typing_status') || '{}');
      const typers = [];
      const now = Date.now();
      Object.values(localData).forEach((data) => {
        const isChannelMatch = !data.isDestinationDm && data.destinationId === activeDestinationId;
        const isDmMatch = data.isDestinationDm && data.userId === activeDestinationId && data.destinationId === user.uid;

        if (
          data.workspaceId === activeWorkspaceId &&
          (isChannelMatch || isDmMatch) &&
          data.userId !== user.uid &&
          data.isTyping === true &&
          now - data.updatedAt < 10000
        ) {
          typers.push(data);
        }
      });
      setActiveTypers(typers);
    };

    loadTyping();

    const handleStorageChange = (e) => {
      if (e.key === 'slack_typing_status') {
        loadTyping();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('slack_local_typing_update', loadTyping);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('slack_local_typing_update', loadTyping);
    };
  }, [activeWorkspaceId, activeDestinationId, user]);

  // ========================================================
  // 5.7b. REACTIVE COMPUTATION: VOICE RECORDING STATUS
  // ========================================================
  const activeRecorders = useMemo(() => {
    if (!user || !activeWorkspaceId || !activeDestinationId || !allRegisteredUsers) return [];
    
    const recorders = [];
    
    allRegisteredUsers.forEach((member) => {
      const memberUid = member.uid || member.id;
      if (memberUid === user.uid) return;
      
      const rec = member.voiceRecording;
      if (!rec || !rec.isRecordingVoice) return;
      
      const isChannelMatch = !rec.isDestinationDm && rec.destinationId === activeDestinationId;
      const isDmMatchTarget = rec.isDestinationDm && 
                              memberUid === activeDestinationId && 
                              rec.destinationId === user.uid;

      if (
        rec.workspaceId === activeWorkspaceId &&
        (isChannelMatch || isDmMatchTarget)
      ) {
        recorders.push({
          userId: memberUid,
          userName: member.name
        });
      }
    });
    
    return recorders;
  }, [allRegisteredUsers, activeWorkspaceId, activeDestinationId, user]);

  // ========================================================
  // 5.8b. LOCAL STORAGE SYNC: REGISTERED USERS (EMULATOR MODE)
  // ========================================================
  useEffect(() => {
    if (isConfigured || !user) return;

    const loadLocalUsers = () => {
      const dbUsers = JSON.parse(localStorage.getItem('emulated_users_docs') || '[]');
      setAllRegisteredUsers(dbUsers.map(u => ({ id: u.uid, ...u })));
    };

    const handleStorage = (e) => {
      if (e.key === 'emulated_users_docs') {
        loadLocalUsers();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('slack_local_users_update', loadLocalUsers);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('slack_local_users_update', loadLocalUsers);
    };
  }, [user]);

  // ========================================================
  // 5.8c. REAL-TIME OBSERVERS & SCHEDULER: SCHEDULED MESSAGES & REMINDERS
  // ========================================================
  // 1. Firestore Observers
  useEffect(() => {
    if (!isConfigured || !activeWorkspaceId || !user) {
      setScheduledMessages([]);
      return;
    }
    const q = query(
      collection(db, 'scheduled_messages'),
      where('workspaceId', '==', activeWorkspaceId),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setScheduledMessages(list);
    }, (err) => {
      console.warn('Scheduled messages observer error:', err);
    });
    return () => unsubscribe();
  }, [isConfigured, activeWorkspaceId, user]);

  useEffect(() => {
    if (!isConfigured || !activeWorkspaceId || !user) {
      setReminders([]);
      return;
    }
    const q = query(
      collection(db, 'reminders'),
      where('workspaceId', '==', activeWorkspaceId),
      where('status', '==', 'pending'),
      where('createdBy', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
      setReminders(list);
    }, (err) => {
      console.warn('Reminders observer error:', err);
    });
    return () => unsubscribe();
  }, [isConfigured, activeWorkspaceId, user]);

  // 2. Emulator localStorage sync
  useEffect(() => {
    if (isConfigured || !user || !activeWorkspaceId) return;
    const loadEmulatorData = () => {
      const allSched = JSON.parse(localStorage.getItem('slack_scheduled_messages') || '[]');
      const pendingSched = allSched.filter(m => m.workspaceId === activeWorkspaceId && m.status === 'pending');
      setScheduledMessages(pendingSched);

      const allReminders = JSON.parse(localStorage.getItem('slack_reminders') || '[]');
      const pendingReminders = allReminders.filter(r => r.workspaceId === activeWorkspaceId && r.status === 'pending' && r.createdBy === user.uid);
      setReminders(pendingReminders);
    };

    loadEmulatorData();
    window.addEventListener('storage', loadEmulatorData);
    window.addEventListener('slack_local_scheduled_messages_update', loadEmulatorData);
    window.addEventListener('slack_local_reminders_update', loadEmulatorData);
    return () => {
      window.removeEventListener('storage', loadEmulatorData);
      window.removeEventListener('slack_local_scheduled_messages_update', loadEmulatorData);
      window.removeEventListener('slack_local_reminders_update', loadEmulatorData);
    };
  }, [isConfigured, activeWorkspaceId, user]);

  // 2b. Emulator localStorage messages sync
  useEffect(() => {
    if (isConfigured || !activeWorkspaceId || !activeDestinationId || !user) return;

    const loadLocalMessages = () => {
      const allMessages = JSON.parse(localStorage.getItem('slack_messages') || '[]');
      const channelKey = `${activeWorkspaceId}-${activeDestinationId}`;
      const sharedConversationId = dmConversationId(user.uid, activeDestinationId);
      
      const filtered = allMessages.filter(m => {
        if (m.workspaceId !== activeWorkspaceId) return false;
        if (isDestinationDm) {
          return m.conversationId === sharedConversationId;
        } else {
          return m.channelId === activeDestinationId;
        }
      }).sort((a, b) => {
        const timeA = a.createdAt?.seconds || (typeof a.createdAt === 'number' ? a.createdAt : 0);
        const timeB = b.createdAt?.seconds || (typeof b.createdAt === 'number' ? b.createdAt : 0);
        return timeA - timeB;
      });

      // Pinned messages come from the full set, independent of pagination.
      setPinnedMessages(filtered.filter(m => m.isPinned));

      // Mirror Firestore pagination: keep only the most recent `messageLimit`.
      setHasMoreMessages(filtered.length > messageLimit);
      const paged = filtered.slice(-messageLimit);

      setMessages(prev => ({
        ...prev,
        [channelKey]: paged
      }));
      setMessagesLoading(false);
      setLoadingMoreMessages(false);
    };

    loadLocalMessages();

    window.addEventListener('storage', loadLocalMessages);
    window.addEventListener('slack_local_messages_update', loadLocalMessages);

    return () => {
      window.removeEventListener('storage', loadLocalMessages);
      window.removeEventListener('slack_local_messages_update', loadLocalMessages);
    };
  }, [isConfigured, activeWorkspaceId, activeDestinationId, user, isDestinationDm, messageLimit]);

  // Grow the message window by one page (loads older messages).
  const handleLoadMoreMessages = () => {
    if (loadingMoreMessages || !hasMoreMessages) return;
    setLoadingMoreMessages(true);
    setMessageLimit(prev => prev + MESSAGE_PAGE_SIZE);
  };

  // 3. Heartbeat Scheduler Loop (runs every 5 seconds)
  useEffect(() => {
    if (!user || !activeWorkspaceId) return;

    const checkPendingJobs = async () => {
      const now = Date.now();

      // Process Missed or Pending Reminders
      const pendingReminders = reminders.filter(r => {
        let rTime = r.scheduledAt;
        if (rTime && typeof rTime.toDate === 'function') {
          rTime = rTime.toDate().getTime();
        } else if (typeof rTime === 'string' || typeof rTime === 'number') {
          rTime = new Date(rTime).getTime();
        }
        return rTime <= now && r.createdBy === user.uid;
      });

      for (const rem of pendingReminders) {
        console.log('⏰ Triggering reminder:', rem);
        if (isConfigured) {
          try {
            let triggerSuccess = false;
            // Atomic transaction to guarantee only ONE tab triggers the reminder
            await runTransaction(db, async (transaction) => {
              const remDoc = await transaction.get(doc(db, 'reminders', rem.id));
              if (remDoc.exists() && remDoc.data().status === 'pending') {
                transaction.update(doc(db, 'reminders', rem.id), { status: 'sent' });
                triggerSuccess = true;
              }
            });

            if (!triggerSuccess) {
              console.log('Reminder already triggered by another session/tab.');
              continue;
            }

            const notificationData = {
              workspaceId: activeWorkspaceId,
              userId: user.uid,
              senderId: 'slackbot',
              senderName: 'Slackbot',
              senderAvatar: 'SB',
              content: rem.text,
              type: 'reminder',
              destinationId: rem.destinationId,
              isDestinationDm: rem.isDestinationDm || false,
              messageId: rem.id,
              isRead: false,
              createdAt: serverTimestamp()
            };
            await addDoc(collection(db, 'notifications'), notificationData);

            // Find and update the Slackbot confirmation message in the messages collection
            const qMsg = query(
              collection(db, 'messages'),
              where('workspaceId', '==', activeWorkspaceId),
              where('reminderId', '==', rem.id)
            );
            const msgSnap = await getDocs(qMsg);
            msgSnap.forEach(async (mDoc) => {
              await updateDoc(mDoc.ref, { content: '✅ Reminder delivered' });
            });
          } catch (err) {
            console.error('Error triggering Firestore reminder:', err);
          }
        } else {
          try {
            let triggerSuccess = false;
            // Atomic check in synchronous localStorage block
            const allReminders = JSON.parse(localStorage.getItem('slack_reminders') || '[]');
            const updated = allReminders.map(r => {
              if (r.id === rem.id && r.status === 'pending') {
                triggerSuccess = true;
                return { ...r, status: 'sent' };
              }
              return r;
            });

            if (!triggerSuccess) {
              console.log('Reminder already triggered by another session/tab (local).');
              continue;
            }

            localStorage.setItem('slack_reminders', JSON.stringify(updated));

            const localKey = `slack_notifications_user_${user.uid}`;
            const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
            localData.push({
              id: `notif-${Date.now()}-${Math.random()}`,
              workspaceId: activeWorkspaceId,
              userId: user.uid,
              senderId: 'slackbot',
              senderName: 'Slackbot',
              senderAvatar: 'SB',
              content: rem.text,
              type: 'reminder',
              destinationId: rem.destinationId,
              isDestinationDm: rem.isDestinationDm || false,
              messageId: rem.id,
              isRead: false,
              createdAt: Date.now()
            });
            localStorage.setItem(localKey, JSON.stringify(localData));

            // Find and update the corresponding Slackbot confirmation card and update its content
            const allMessages = JSON.parse(localStorage.getItem('slack_messages') || '[]');
            const updatedMessages = allMessages.map(m => 
              m.reminderId === rem.id ? { ...m, content: '✅ Reminder delivered' } : m
            );
            localStorage.setItem('slack_messages', JSON.stringify(updatedMessages));

            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new Event('slack_local_messages_update'));
            window.dispatchEvent(new Event('slack_local_notifications_update'));
            window.dispatchEvent(new Event('slack_local_reminders_update'));
          } catch (e) {
            console.error('Error triggering local reminder:', e);
          }
        }
      }

      // Process Missed or Pending Scheduled Messages
      const pendingMessages = scheduledMessages.filter(m => {
        let mTime = m.scheduledAt;
        if (mTime && typeof mTime.toDate === 'function') {
          mTime = mTime.toDate().getTime();
        } else if (typeof mTime === 'string' || typeof mTime === 'number') {
          mTime = new Date(mTime).getTime();
        }
        return mTime <= now && m.createdBy === user.uid;
      });

      for (const sMsg of pendingMessages) {
        console.log('📅 Sending scheduled message:', sMsg);
        if (isConfigured) {
          try {
            await updateDoc(doc(db, 'scheduled_messages', sMsg.id), { status: 'sent' });
            await handleSendMessage(sMsg.content, sMsg.file || null, sMsg.parentMessageId || null, {
              destinationId: sMsg.destinationId,
              isDestinationDm: sMsg.isDestinationDm
            });
          } catch (err) {
            console.error('Error sending Firestore scheduled message:', err);
          }
        } else {
          try {
            const allSched = JSON.parse(localStorage.getItem('slack_scheduled_messages') || '[]');
            const updated = allSched.map(m => m.id === sMsg.id ? { ...m, status: 'sent' } : m);
            localStorage.setItem('slack_scheduled_messages', JSON.stringify(updated));

            await handleSendMessage(sMsg.content, sMsg.file || null, sMsg.parentMessageId || null, {
              destinationId: sMsg.destinationId,
              isDestinationDm: sMsg.isDestinationDm
            });
            window.dispatchEvent(new Event('slack_local_scheduled_messages_update'));
          } catch (e) {
            console.error('Error sending local scheduled message:', e);
          }
        }
      }
    };

    checkPendingJobs();
    // Poll every 15s instead of every 1s — scheduled messages/reminders fire
    // minutes-to-hours out, so up to 15s of delivery latency is fine and this
    // cuts the polling work ~15x. (Still client-side; see deferred Cloud Functions.)
    const interval = setInterval(checkPendingJobs, 15000);
    return () => clearInterval(interval);
  }, [user, activeWorkspaceId, scheduledMessages, reminders, isConfigured]);

  // ========================================================
  // 5.9. TYPING & RECORDING STATUS CLEANUP ON UNLOAD / LOGOUT / UNMOUNT
  // ========================================================
  useEffect(() => {
    const cleanup = () => {
      if (user) {
        if (isConfigured) {
          try {
            const docRef = doc(db, 'typing_status', user.uid);
            deleteDoc(docRef).catch(() => {});
          } catch (e) {}
          try {
            const userDocRef = doc(db, 'users', user.uid);
            updateDoc(userDocRef, {
              voiceRecording: null
            }).catch(() => {});
          } catch (e) {}
        } else {
          try {
            const localData = JSON.parse(localStorage.getItem('slack_typing_status') || '{}');
            if (localData[user.uid]) {
              delete localData[user.uid];
              localStorage.setItem('slack_typing_status', JSON.stringify(localData));
              window.dispatchEvent(new Event('storage'));
              window.dispatchEvent(new Event('slack_local_typing_update'));
            }
          } catch (e) {}
          try {
            const localKey = 'emulated_users_docs';
            const dbUsers = JSON.parse(localStorage.getItem(localKey) || '[]');
            const updated = dbUsers.map(u => 
              u.uid === user.uid 
                ? { ...u, voiceRecording: null } 
                : u
            );
            localStorage.setItem(localKey, JSON.stringify(updated));
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new Event('slack_local_users_update'));
          } catch (e) {}
        }
      }
    };

    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup(); // runs immediately when user logs out or switches accounts!
    };
  }, [user]);

  // ========================================================
  // 6. DETECTOR: SYNC ACTIVE CHANNELS (avoids orphan views)
  // ========================================================
  useEffect(() => {
    if (activeWorkspace && user) {
      // 1. CRITICAL: Wait until channels, workspaces, and users are completely loaded from Firestore.
      // If channels are still loading or undefined, or if users are not yet synchronized, exit early
      // to prevent a race condition that incorrectly overwrites the saved selection to "#general".
      if (channelsLoading || activeWorkspace.channels === undefined || (isConfigured && allRegisteredUsers.length === 0)) {
        return;
      }

      const hasChannel = activeWorkspace.channels?.some(c => c.id === activeDestinationId);
      const hasDm = activeWorkspace.dms?.some(d => d.id === activeDestinationId);
      
      if (!hasChannel && !hasDm) {
        // Attempt to restore saved destination selection from localStorage
        const savedDestId = localStorage.getItem(`slack_active_destination_id_${user.uid}`);
        const savedIsDm = localStorage.getItem(`slack_is_destination_dm_${user.uid}`) === 'true';
        
        if (savedDestId) {
          if (savedIsDm) {
            const hasSavedDm = activeWorkspace.dms?.some(d => d.id === savedDestId);
            if (hasSavedDm) {
              setActiveDestinationId(savedDestId);
              setIsDestinationDm(true);
              return;
            }
          } else {
            const hasSavedChannel = activeWorkspace.channels?.some(c => c.id === savedDestId);
            if (hasSavedChannel) {
              setActiveDestinationId(savedDestId);
              setIsDestinationDm(false);
              return;
            }
          }
        }

        // Safe fallback to default general channel first if saved destination is deleted or invalid
        if (activeWorkspace.channels?.length > 0) {
          const generalChan = activeWorkspace.channels.find(c => c.name === 'general');
          if (generalChan) {
            setActiveDestinationId(generalChan.id);
          } else {
            setActiveDestinationId(activeWorkspace.channels[0].id);
          }
          setIsDestinationDm(false);
        } else if (activeWorkspace.dms?.length > 0) {
          setActiveDestinationId(activeWorkspace.dms[0].id);
          setIsDestinationDm(true);
        }
      }
    }
  }, [activeWorkspaceId, workspaces, activeDestinationId, user, allRegisteredUsers, channelsLoading]);

  // Adjust layouts based on screen size triggers
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setRightPanelOpen(false);
      } else {
        setRightPanelOpen(true);
      }
      
      if (window.innerWidth >= 768) {
        setMobileSidebarOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Switch workspace cleanly with membership validation
  const handleSelectWorkspace = (workspaceId) => {
    if (!user) return;
    const targetWs = workspaces.find(w => w.id === workspaceId);
    
    // Safety check: ensure user is a listed member of this workspace
    if (targetWs && !targetWs.members?.includes(user.uid)) {
      console.warn(`Access Denied: User ${user.uid} is not a member of workspace ${workspaceId}`);
      setSyncError("Access denied. You are not a member of this workspace.");
      return;
    }
    
    setActiveWorkspaceId(workspaceId);
    setHighlightedMessageId(null);
    setActiveThreadMessageId(null);
    setMobileSidebarOpen(false);
  };

  const handleOpenProfile = (uid) => {
    const member = activeWorkspace?.allWorkspaceMembers?.find(m => m.id === uid);
    if (member) {
      setSelectedProfileUser(member);
    } else {
      setSelectedProfileUser({
        id: uid,
        name: 'Unavailable User',
        email: 'N/A',
        role: 'N/A',
        isUnavailable: true
      });
    }
  };

  const handleUpdateUserProfile = async (uid, updatedFields) => {
    if (isConfigured) {
      try {
        const userDocRef = doc(db, 'users', uid);
        await updateDoc(userDocRef, updatedFields);
      } catch (err) {
        console.error('Error updating user profile:', err);
        throw err;
      }
    } else {
      // LocalStorage Emulator mode
      const dbUsers = JSON.parse(localStorage.getItem('emulated_users_docs') || '[]');
      const updated = dbUsers.map(u => u.uid === uid ? { ...u, ...updatedFields } : u);
      localStorage.setItem('emulated_users_docs', JSON.stringify(updated));
      
      // Force trigger state updates for allRegisteredUsers
      setAllRegisteredUsers(updated.map(u => ({ id: u.uid, ...u })));
      
      // Sync emulated workspaces state so that DM lists update instantly
      setWorkspaces(prev => prev.map(ws => {
        if (ws.dms) {
          const updatedDms = ws.dms.map(d => d.id === uid ? { 
            ...d, 
            ...updatedFields, 
            name: updatedFields.name || d.name, 
            status: updatedFields.presenceStatus || updatedFields.onlineStatus || d.status 
          } : d);
          return { ...ws, dms: updatedDms };
        }
        return ws;
      }));

      // Also update emulated session key if updating ourselves
      if (uid === user?.uid) {
        const session = JSON.parse(localStorage.getItem('emulated_session') || '{}');
        if (session.uid === uid) {
          const updatedSession = { ...session, ...updatedFields };
          localStorage.setItem('emulated_session', JSON.stringify(updatedSession));
        }
      }
    }
  };

  const handleStartDirectMessage = (targetUserId) => {
    if (isDestinationDm && activeDestinationId === targetUserId) {
      setSelectedProfileUser(null);
      return;
    }
    setActiveDestinationId(targetUserId);
    setIsDestinationDm(true);
    setHighlightedMessageId(null);
    setActiveThreadMessageId(null);
    setSelectedProfileUser(null);
  };

  const handleMarkAsRead = async (destinationId, workspaceId = activeWorkspaceId) => {
    if (!workspaceId || !destinationId || !user) return;

    if (isConfigured) {
      try {
        const targets = (unreadNotifications || []).filter(
          n => n.workspaceId === workspaceId && n.destinationId === destinationId
        );
        for (const notif of targets) {
          await updateDoc(doc(db, 'notifications', notif.id), { isRead: true });
        }
      } catch (err) {
        console.error('Error marking notifications as read:', err);
      }
    } else {
      // LocalStorage emulation
      const localKey = `slack_notifications_user_${user.uid}`;
      const localNotifications = JSON.parse(localStorage.getItem(localKey) || '[]');
      let updated = false;
      const updatedList = localNotifications.map(n => {
        if (n.workspaceId === workspaceId && n.destinationId === destinationId && !n.isRead) {
          updated = true;
          return { ...n, isRead: true };
        }
        return n;
      });

      if (updated) {
        localStorage.setItem(localKey, JSON.stringify(updatedList));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('slack_local_notifications_update'));
      }
    }
  };

  const handleMarkNotificationAsRead = async (notificationId) => {
    if (!notificationId || !user) return;

    if (isConfigured) {
      try {
        await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
      } catch (err) {
        console.error('Error marking specific notification as read:', err);
      }
    } else {
      // LocalStorage emulation
      const localKey = `slack_notifications_user_${user.uid}`;
      const localNotifications = JSON.parse(localStorage.getItem(localKey) || '[]');
      let updated = false;
      const updatedList = localNotifications.map(n => {
        if (n.id === notificationId && !n.isRead) {
          updated = true;
          return { ...n, isRead: true };
        }
        return n;
      });

      if (updated) {
        localStorage.setItem(localKey, JSON.stringify(updatedList));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('slack_local_notifications_update'));
      }
    }
  };

  // Auto-clear active destination notifications instantly
  useEffect(() => {
    if (activeWorkspaceId && activeDestinationId && unreadNotifications.length > 0) {
      const hasActiveUnreads = unreadNotifications.some(
        n => n.workspaceId === activeWorkspaceId && n.destinationId === activeDestinationId && n.type !== 'reminder'
      );
      if (hasActiveUnreads) {
        handleMarkAsRead(activeDestinationId, activeWorkspaceId);
      }
    }
  }, [activeWorkspaceId, activeDestinationId, unreadNotifications]);

  // Start typing status helper
  const handleTypingStart = async () => {
    if (!user || !activeWorkspaceId || !activeDestinationId) return;
    console.log('✍️ handleTypingStart triggered in App.jsx for user:', user.name);

    // Dispatch event to instantly trigger presence update to online
    window.dispatchEvent(new CustomEvent('user-started-typing'));

    if (isConfigured) {
      try {
        const docRef = doc(db, 'typing_status', user.uid);
        await setDoc(docRef, {
          workspaceId: activeWorkspaceId,
          destinationId: activeDestinationId,
          isDestinationDm: isDestinationDm,
          userId: user.uid,
          userName: user.name,
          isTyping: true,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('Error starting typing in Firestore:', err);
      }
    } else {
      try {
        const localKey = 'slack_typing_status';
        const localData = JSON.parse(localStorage.getItem(localKey) || '{}');
        localData[user.uid] = {
          workspaceId: activeWorkspaceId,
          destinationId: activeDestinationId,
          isDestinationDm: isDestinationDm,
          userId: user.uid,
          userName: user.name,
          isTyping: true,
          updatedAt: Date.now()
        };
        localStorage.setItem(localKey, JSON.stringify(localData));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('slack_local_typing_update'));
      } catch (err) {
        console.warn('Error starting typing locally:', err);
      }
    }
  };

  // Stop typing status helper
  const handleTypingStop = async () => {
    if (!user) return;
    console.log('🛑 handleTypingStop triggered in App.jsx for user:', user.name);

    if (isConfigured) {
      try {
        const docRef = doc(db, 'typing_status', user.uid);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Error stopping typing in Firestore:', err);
      }
    } else {
      try {
        const localKey = 'slack_typing_status';
        const localData = JSON.parse(localStorage.getItem(localKey) || '{}');
        if (localData[user.uid]) {
          delete localData[user.uid];
          localStorage.setItem(localKey, JSON.stringify(localData));
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new Event('slack_local_typing_update'));
        }
      } catch (err) {
        console.warn('Error stopping typing locally:', err);
      }
    }
  };

  // Start voice recording status helper
  const handleRecordingStart = async () => {
    if (!user || !activeWorkspaceId || !activeDestinationId) return;
    console.log('🎤 handleRecordingStart triggered in App.jsx for user:', user.name);

    const recordingPayload = {
      workspaceId: activeWorkspaceId,
      destinationId: activeDestinationId,
      isDestinationDm: isDestinationDm,
      userId: user.uid,
      userName: user.name,
      isRecordingVoice: true,
      updatedAt: new Date().toISOString()
    };

    if (isConfigured) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          voiceRecording: recordingPayload
        });
      } catch (err) {
        console.warn('Error starting recording in Firestore:', err);
      }
    } else {
      try {
        const localKey = 'emulated_users_docs';
        const dbUsers = JSON.parse(localStorage.getItem(localKey) || '[]');
        const updated = dbUsers.map(u => 
          u.uid === user.uid 
            ? { ...u, voiceRecording: recordingPayload } 
            : u
        );
        localStorage.setItem(localKey, JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('slack_local_users_update'));
      } catch (err) {
        console.warn('Error starting recording locally:', err);
      }
    }
  };

  // Stop voice recording status helper
  const handleRecordingStop = async () => {
    if (!user) return;
    console.log('🛑 handleRecordingStop triggered in App.jsx for user:', user.name);

    if (isConfigured) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          voiceRecording: null
        });
      } catch (err) {
        console.warn('Error stopping recording in Firestore:', err);
      }
    } else {
      try {
        const localKey = 'emulated_users_docs';
        const dbUsers = JSON.parse(localStorage.getItem(localKey) || '[]');
        const updated = dbUsers.map(u => 
          u.uid === user.uid 
            ? { ...u, voiceRecording: null } 
            : u
        );
        localStorage.setItem(localKey, JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('slack_local_users_update'));
      } catch (err) {
        console.warn('Error stopping recording locally:', err);
      }
    }
  };

  // Send Message write action
  const handleSendMessage = async (content, fileAttachment = null, parentMessageId = null, target = null) => {
    // Resolve the destination. Defaults to the currently-open conversation, but a
    // `target` override lets the scheduler deliver to the conversation a message was
    // scheduled FOR — not whatever happens to be open when the timer fires.
    const destId = target?.destinationId ?? activeDestinationId;
    const destIsDm = target?.isDestinationDm ?? isDestinationDm;

    if (!activeWorkspaceId || !destId || !user) return;

    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeString = `${hours}:${minutes} ${ampm}`;

    // Mapped channel or DM name for previewing notifications
    const activeWorkspaceRaw = workspaces.find(ws => ws.id === activeWorkspaceId);
    let destName = '';
    if (destIsDm) {
      destName = activeWorkspaceRaw?.dms?.find(d => d.id === destId)?.name || 'Direct Message';
    } else {
      destName = activeWorkspaceRaw?.channels?.find(c => c.id === destId)?.name || 'channel';
    }

    if (isConfigured) {
      // 1. Cloud Firestore write
      try {
        // Upload any attachment to Firebase Storage and keep only the hosted URL
        // in Firestore (base64 in-doc would blow past the 1MB document limit).
        const uploadedFile = await uploadAttachment(fileAttachment, user.uid);

        const messageData = {
          workspaceId: activeWorkspaceId,
          senderId: user.uid,
          senderName: user.name,
          avatar: user.avatarInitials,
          content: content,
          timestamp: timeString,
          createdAt: serverTimestamp()
        };

        if (parentMessageId) {
          messageData.parentMessageId = parentMessageId;
        }

        if (uploadedFile) {
          messageData.file = uploadedFile;
        }

        if (destIsDm) {
          const sharedConversationId = dmConversationId(user.uid, destId);
          messageData.conversationId = sharedConversationId;
          messageData.receiverId = destId;
          messageData.channelId = destId;
        } else {
          messageData.channelId = destId;
        }

        const msgDocRef = await addDoc(collection(db, 'messages'), messageData);

        // ========================================================
        // 1.1. GENERATE FIRESTORE REALTIME NOTIFICATIONS
        // ========================================================
        if (destIsDm) {
          // Direct Message: Create exactly 1 notification document for the recipient
          const notificationData = {
            workspaceId: activeWorkspaceId,
            userId: destId,
            senderId: user.uid,
            senderName: user.name,
            senderAvatar: user.avatarInitials,
            content: content || 'shared an attachment',
            type: 'dm',
            destinationId: user.uid, // mapped to sender UID so recipient sees it under sender's name
            destinationName: user.name,
            isDestinationDm: true,
            isRead: false,
            messageId: msgDocRef.id,
            createdAt: serverTimestamp()
          };
          console.log('✉️ Creating DM notification in Firestore for recipient:', destId, notificationData);
          await addDoc(collection(db, 'notifications'), notificationData);
        } else {
          // Channel Message or Thread Reply
          const membersList = activeWorkspaceRaw?.members || [];
          
          if (parentMessageId) {
            // Thread Reply: notify parent message sender and active thread members
            const parentDoc = await getDoc(doc(db, 'messages', parentMessageId));
            const parentSenderId = parentDoc.exists() ? parentDoc.data().senderId : null;

            const notifiedUids = new Set();
            if (parentSenderId && parentSenderId !== user.uid) {
              notifiedUids.add(parentSenderId);
            }

            const repliesSnap = await getDocs(query(collection(db, 'messages'), where('parentMessageId', '==', parentMessageId)));
            repliesSnap.forEach(replyDoc => {
              const rId = replyDoc.data().senderId;
              if (rId && rId !== user.uid) {
                notifiedUids.add(rId);
              }
            });

            for (const targetUid of notifiedUids) {
              const notificationData = {
                workspaceId: activeWorkspaceId,
                userId: targetUid,
                senderId: user.uid,
                senderName: user.name,
                senderAvatar: user.avatarInitials,
                content: content || 'shared an attachment',
                type: 'thread',
                destinationId: destId,
                destinationName: destName,
                isDestinationDm: false,
                isRead: false,
                parentMessageId: parentMessageId,
                messageId: msgDocRef.id,
                createdAt: serverTimestamp()
              };
              console.log('✉️ Creating Thread Reply notification in Firestore for:', targetUid, notificationData);
              await addDoc(collection(db, 'notifications'), notificationData);
            }
          } else {
            // Standard Channel Message: notify all workspace members except sender
            console.log('✉️ Message sent. Evaluating workspace members to notify:', membersList);
            for (const memberUid of membersList) {
              if (memberUid !== user.uid) {
                const memberUser = allRegisteredUsers.find(u => u.uid === memberUid);
                const isMentioned = memberUser && content && content.includes(`@${memberUser.name}`);
                const notificationType = isMentioned ? 'mention' : 'channel';

                const notificationData = {
                  workspaceId: activeWorkspaceId,
                  userId: memberUid,
                  senderId: user.uid,
                  senderName: user.name,
                  senderAvatar: user.avatarInitials,
                  content: content || 'shared an attachment',
                  type: notificationType,
                  destinationId: destId,
                  destinationName: destName,
                  isDestinationDm: false,
                  isRead: false,
                  messageId: msgDocRef.id,
                  createdAt: serverTimestamp()
                };
                console.log('✉️ Creating Channel Message notification in Firestore for:', memberUid, notificationData);
                await addDoc(collection(db, 'notifications'), notificationData);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error writing message:', err);
      }
    } else {
      // 2. Emulator LocalStorage write
      const newMsgId = `msg-${Date.now()}`;
      const newMessage = {
        id: newMsgId,
        workspaceId: activeWorkspaceId,
        senderId: user.uid,
        senderName: user.name,
        avatar: user.avatarInitials,
        content: content,
        timestamp: timeString,
        createdAt: Date.now()
      };

      if (parentMessageId) {
        newMessage.parentMessageId = parentMessageId;
      }

      if (fileAttachment) {
        newMessage.file = fileAttachment;
      }

      if (destIsDm) {
        const sharedConversationId = dmConversationId(user.uid, destId);
        newMessage.conversationId = sharedConversationId;
        newMessage.receiverId = destId;
        newMessage.channelId = destId;
      } else {
        newMessage.channelId = destId;
      }

      const allMessages = JSON.parse(localStorage.getItem('slack_messages') || '[]');
      allMessages.push(newMessage);
      localStorage.setItem('slack_messages', JSON.stringify(allMessages));
      window.dispatchEvent(new Event('slack_local_messages_update'));

      // ========================================================
      // 1.2. GENERATE EMULATOR REALTIME NOTIFICATIONS
      // ========================================================
      const membersList = activeWorkspaceRaw?.members || [];
      if (destIsDm) {
        const localNotifications = JSON.parse(localStorage.getItem(`slack_notifications_user_${destId}`) || '[]');
        localNotifications.push({
          id: `notif-${Date.now()}`,
          workspaceId: activeWorkspaceId,
          userId: destId,
          senderId: user.uid,
          senderName: user.name,
          senderAvatar: user.avatarInitials,
          content: content || 'shared an attachment',
          type: 'dm',
          destinationId: user.uid,
          destinationName: user.name,
          isDestinationDm: true,
          isRead: false,
          messageId: newMsgId,
          createdAt: Date.now()
        });
        localStorage.setItem(`slack_notifications_user_${destId}`, JSON.stringify(localNotifications));
      } else {
        for (const memberUid of membersList) {
          if (memberUid !== user.uid) {
            const memberUser = workspaceMembersRaw.find(u => (u.uid || u.id) === memberUid);
            const isMentioned = memberUser && content && content.includes(`@${memberUser.name}`);
            const notificationType = parentMessageId ? 'thread' : (isMentioned ? 'mention' : 'channel');

            const localNotifications = JSON.parse(localStorage.getItem(`slack_notifications_user_${memberUid}`) || '[]');
            localNotifications.push({
              id: `notif-${Date.now()}`,
              workspaceId: activeWorkspaceId,
              userId: memberUid,
              senderId: user.uid,
              senderName: user.name,
              senderAvatar: user.avatarInitials,
              content: content || 'shared an attachment',
              type: notificationType,
              destinationId: destId,
              destinationName: destName,
              isDestinationDm: false,
              isRead: false,
              messageId: newMsgId,
              parentMessageId: parentMessageId || null,
              createdAt: Date.now()
            });
            localStorage.setItem(`slack_notifications_user_${memberUid}`, JSON.stringify(localNotifications));
          }
        }
      }
      // Dispatch storage update
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('slack_local_notifications_update'));
    }
  };
  const handleScheduleMessage = async (content, fileAttachment = null, parentMessageId = null, scheduledAt) => {
    if (!activeWorkspaceId || !activeDestinationId || !user) return;

    const scheduledData = {
      workspaceId: activeWorkspaceId,
      destinationId: activeDestinationId,
      isDestinationDm: isDestinationDm,
      createdBy: user.uid,
      content: content || '',
      parentMessageId: parentMessageId || null,
      status: 'pending',
      scheduledAt: scheduledAt,
      createdAt: Date.now()
    };

    if (isConfigured) {
      try {
        // Upload attachment up-front so the scheduled_messages doc stores a hosted
        // URL, not base64. When the message later fires, handleSendMessage receives
        // the already-hosted URL and uploadAttachment passes it through unchanged.
        const uploadedFile = await uploadAttachment(fileAttachment, user.uid);
        if (uploadedFile) {
          scheduledData.file = uploadedFile;
        }

        await addDoc(collection(db, 'scheduled_messages'), {
          ...scheduledData,
          scheduledAt: new Date(scheduledAt),
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error('Error writing scheduled message to Firestore:', err);
      }
    } else {
      if (fileAttachment) {
        scheduledData.file = fileAttachment;
      }
      try {
        const allSched = JSON.parse(localStorage.getItem('slack_scheduled_messages') || '[]');
        const newItem = {
          id: `sched-${Date.now()}-${Math.random()}`,
          ...scheduledData
        };
        allSched.push(newItem);
        localStorage.setItem('slack_scheduled_messages', JSON.stringify(allSched));
        
        window.dispatchEvent(new Event('slack_local_scheduled_messages_update'));
      } catch (e) {
        console.error('Error writing local scheduled message:', e);
      }
    }
  };

  const handleCancelScheduledMessage = async (id) => {
    if (isConfigured) {
      try {
        await deleteDoc(doc(db, 'scheduled_messages', id));
      } catch (err) {
        console.error('Error deleting scheduled message from Firestore:', err);
      }
    } else {
      try {
        const allSched = JSON.parse(localStorage.getItem('slack_scheduled_messages') || '[]');
        const filtered = allSched.filter(m => m.id !== id);
        localStorage.setItem('slack_scheduled_messages', JSON.stringify(filtered));

        window.dispatchEvent(new Event('slack_local_scheduled_messages_update'));
      } catch (e) {
        console.error('Error deleting local scheduled message:', e);
      }
    }
  };

  const handleScheduleReminder = async (text, scheduledAt) => {
    if (!activeWorkspaceId || !activeDestinationId || !user) return;

    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeString = `${hours}:${minutes} ${ampm}`;

    const reminderData = {
      workspaceId: activeWorkspaceId,
      destinationId: activeDestinationId,
      isDestinationDm: isDestinationDm,
      createdBy: user.uid,
      text: text,
      status: 'pending',
      scheduledAt: scheduledAt,
      createdAt: Date.now()
    };

    if (isConfigured) {
      try {
        const reminderRef = await addDoc(collection(db, 'reminders'), {
          ...reminderData,
          scheduledAt: new Date(scheduledAt),
          createdAt: serverTimestamp()
        });

        // Write persistent Slackbot confirmation message
        const messageData = {
          workspaceId: activeWorkspaceId,
          senderId: 'slackbot',
          senderName: 'Slackbot',
          avatar: 'SB',
          content: `📅 Reminder set for ${formatReminderTime(scheduledAt)}: "${text}"`,
          timestamp: timeString,
          createdAt: serverTimestamp(),
          isEphemeral: true,
          createdBy: user.uid,
          reminderId: reminderRef.id
        };

        if (isDestinationDm) {
          const sharedConversationId = dmConversationId(user.uid, activeDestinationId);
          messageData.conversationId = sharedConversationId;
          messageData.receiverId = activeDestinationId;
          messageData.channelId = activeDestinationId;
        } else {
          messageData.channelId = activeDestinationId;
        }

        await addDoc(collection(db, 'messages'), messageData);
      } catch (err) {
        console.error('Error writing reminder to Firestore:', err);
      }
    } else {
      try {
        const allReminders = JSON.parse(localStorage.getItem('slack_reminders') || '[]');
        const newItem = {
          id: `rem-${Date.now()}-${Math.random()}`,
          ...reminderData
        };
        allReminders.push(newItem);
        localStorage.setItem('slack_reminders', JSON.stringify(allReminders));

        // Write persistent local emulator Slackbot confirmation message
        const allMessages = JSON.parse(localStorage.getItem('slack_messages') || '[]');
        const localMsg = {
          id: `msg-ephem-${Date.now()}-${Math.random()}`,
          workspaceId: activeWorkspaceId,
          senderId: 'slackbot',
          senderName: 'Slackbot',
          avatar: 'SB',
          content: `📅 Reminder set for ${formatReminderTime(scheduledAt)}: "${text}"`,
          timestamp: timeString,
          createdAt: Date.now(),
          isEphemeral: true,
          createdBy: user.uid,
          reminderId: newItem.id
        };

        if (isDestinationDm) {
          const sharedConversationId = dmConversationId(user.uid, activeDestinationId);
          localMsg.conversationId = sharedConversationId;
          localMsg.receiverId = activeDestinationId;
          localMsg.channelId = activeDestinationId;
        } else {
          localMsg.channelId = activeDestinationId;
        }

        allMessages.push(localMsg);
        localStorage.setItem('slack_messages', JSON.stringify(allMessages));

        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('slack_local_messages_update'));
        window.dispatchEvent(new Event('slack_local_reminders_update'));
      } catch (e) {
        console.error('Error writing local reminder:', e);
      }
    }
  };

  const handleDeleteMessage = async (messageId, deleteType = 'everyone') => {
    if (!activeWorkspaceId || !activeDestinationId || !user) return;

    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeString = `${hours}:${minutes} ${ampm}`;

    if (isConfigured) {
      try {
        const messageDocRef = doc(db, 'messages', messageId);
        
        if (deleteType === 'me') {
          await updateDoc(messageDocRef, {
            deletedFor: arrayUnion(user.uid)
          });
        } else {
          // Delete for everyone
          const msgSnap = await getDoc(messageDocRef);
          if (msgSnap.exists()) {
            const msgData = msgSnap.data();
            const isAdminDelete = msgData.senderId !== user.uid && activeWorkspace?.createdBy === user.uid;
            
            await updateDoc(messageDocRef, {
              deletedForEveryone: true,
              deletedByAdmin: isAdminDelete,
              reactions: {},
              file: null,
              voiceRecording: null,
              deletedAtTime: timeString
            });

            // Clean up unread notifications for this message
            try {
              const qNotif = query(collection(db, 'notifications'), where('messageId', '==', messageId));
              const notifSnap = await getDocs(qNotif);
              notifSnap.forEach(async (nDoc) => {
                await deleteDoc(nDoc.ref);
              });
            } catch (err) {}
          }
        }
      } catch (err) {
        console.error('Error deleting message in Firestore:', err);
        throw err;
      }
    } else {
      // Emulator LocalStorage deletion / update
      const allMessages = JSON.parse(localStorage.getItem('slack_messages') || '[]');
      const updated = allMessages.map(m => {
        if (m.id !== messageId) return m;
        
        if (deleteType === 'me') {
          const currentDeletedFor = m.deletedFor || [];
          return {
            ...m,
            deletedFor: [...currentDeletedFor, user.uid]
          };
        } else {
          const isAdminDelete = m.senderId !== user.uid && activeWorkspace?.createdBy === user.uid;
          return {
            ...m,
            deletedForEveryone: true,
            deletedByAdmin: isAdminDelete,
            reactions: {},
            file: null,
            voiceRecording: null,
            deletedAtTime: timeString
          };
        }
      });
      localStorage.setItem('slack_messages', JSON.stringify(updated));
      window.dispatchEvent(new Event('slack_local_messages_update'));

      // Emulator Notifications cleanup
      if (deleteType === 'everyone') {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('slack_notifications_user_')) {
              const localData = JSON.parse(localStorage.getItem(key) || '[]');
              const filtered = localData.filter(n => n.messageId !== messageId);
              localStorage.setItem(key, JSON.stringify(filtered));
            }
          }
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new Event('slack_local_notifications_update'));
        } catch (e) {}
      }
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    if (!activeWorkspaceId || !activeDestinationId || !user) return;

    if (isConfigured) {
      try {
        await updateDoc(doc(db, 'messages', messageId), {
          content: newContent,
          isEdited: true
        });
      } catch (err) {
        console.error('Error editing message:', err);
        throw err;
      }
    } else {
      // Emulator LocalStorage editing
      const allMessages = JSON.parse(localStorage.getItem('slack_messages') || '[]');
      const updated = allMessages.map(m => m.id === messageId ? { ...m, content: newContent, isEdited: true } : m);
      localStorage.setItem('slack_messages', JSON.stringify(updated));
      window.dispatchEvent(new Event('slack_local_messages_update'));
    }
  };

  const handleTogglePinMessage = async (messageId) => {
    if (!activeWorkspaceId || !activeDestinationId || !user) return;

    const channelKey = `${activeWorkspaceId}-${activeDestinationId}`;
    const activeMessages = messages[channelKey] || [];
    const msg = activeMessages.find(m => m.id === messageId);
    if (!msg) return;

    const isSender = msg.senderId === user.uid;
    const isCreator = activeWorkspace?.createdBy === user.uid;
    const isPinned = !!msg.isPinned;

    if (!isSender && !isCreator) {
      console.warn("Permission denied for toggle pin");
      return;
    }

    if (isConfigured) {
      try {
        await updateDoc(doc(db, 'messages', messageId), {
          isPinned: !isPinned
        });
      } catch (err) {
        console.error('Error toggling pin message:', err);
        throw err;
      }
    } else {
      // Emulator LocalStorage pinning
      const allMessages = JSON.parse(localStorage.getItem('slack_messages') || '[]');
      const updated = allMessages.map(m => m.id === messageId ? { ...m, isPinned: !isPinned } : m);
      localStorage.setItem('slack_messages', JSON.stringify(updated));
      window.dispatchEvent(new Event('slack_local_messages_update'));
    }
  };

  const handleToggleReaction = async (messageId, emoji) => {
    if (!activeWorkspaceId || !activeDestinationId || !user) return;

    if (isConfigured) {
      try {
        const docRef = doc(db, 'messages', messageId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const reactions = data.reactions || {};
          const users = reactions[emoji] || [];
          
          let newUsers;
          if (users.includes(user.uid)) {
            newUsers = users.filter(uid => uid !== user.uid);
          } else {
            newUsers = [...users, user.uid];
          }

          const newReactions = { ...reactions };
          if (newUsers.length === 0) {
            delete newReactions[emoji];
          } else {
            newReactions[emoji] = newUsers;
          }

          await updateDoc(docRef, { reactions: newReactions });
        }
      } catch (err) {
        console.error('Error toggling reaction:', err);
      }
    } else {
      // Emulator LocalStorage reaction toggling
      const allMessages = JSON.parse(localStorage.getItem('slack_messages') || '[]');
      const updated = allMessages.map(m => {
        if (m.id !== messageId) return m;
        const reactions = m.reactions || {};
        const users = reactions[emoji] || [];
        let newUsers;
        if (users.includes(user.uid)) {
          newUsers = users.filter(uid => uid !== user.uid);
        } else {
          newUsers = [...users, user.uid];
        }
        const newReactions = { ...reactions };
        if (newUsers.length === 0) {
          delete newReactions[emoji];
        } else {
          newReactions[emoji] = newUsers;
        }
        return { ...m, reactions: newReactions };
      });
      localStorage.setItem('slack_messages', JSON.stringify(updated));
      window.dispatchEvent(new Event('slack_local_messages_update'));
    }
  };

  // Create Channel write action
  const handleCreateChannel = async (name, description, isPrivate) => {
    if (!activeWorkspaceId || !user || !activeWorkspace) return;

    // Duplicate channel name protection check
    const isDuplicate = activeWorkspace.channels?.some(
      c => c.name.toLowerCase() === name.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`A channel named #${name} already exists in this workspace.`);
    }

    if (isConfigured) {
      try {
        const docRef = await addDoc(collection(db, 'channels'), {
          workspaceId: activeWorkspaceId,
          name: name,
          description: description || 'No description provided.',
          isPrivate: isPrivate,
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });

        // Switch directly into newly created channel
        setActiveDestinationId(docRef.id);
        setIsDestinationDm(false);
      } catch (err) {
        console.error('Error creating channel:', err);
        throw err;
      }
    } else {
      const newChannel = {
        id: `ch-${Date.now()}`,
        name: name,
        desc: description || 'No description provided.',
        isPrivate: isPrivate
      };

      setWorkspaces(prev => prev.map(ws => {
        if (ws.id === activeWorkspaceId) {
          return {
            ...ws,
            channels: [...ws.channels, newChannel]
          };
        }
        return ws;
      }));

      // Switch directly to the newly created channel
      setActiveDestinationId(newChannel.id);
      setIsDestinationDm(false);
    }
  };

  // Edit Channel write action
  const handleEditChannel = async (channelId, newName, newDescription) => {
    if (!activeWorkspaceId || !user) return;
    
    // Check for duplicate names (excluding itself)
    const activeWorkspaceRaw = workspaces.find(ws => ws.id === activeWorkspaceId);
    const isDuplicate = activeWorkspaceRaw?.channels?.some(
      c => c.id !== channelId && c.name.toLowerCase() === newName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`A channel named #${newName} already exists in this workspace.`);
    }

    if (isConfigured) {
      try {
        await updateDoc(doc(db, 'channels', channelId), {
          name: newName,
          description: newDescription || 'No description provided.'
        });
      } catch (err) {
        console.error('Error updating channel:', err);
        throw err;
      }
    } else {
      // Offline Emulation fallback
      setWorkspaces(prev => prev.map(ws => {
        if (ws.id === activeWorkspaceId) {
          return {
            ...ws,
            channels: (ws.channels || []).map(ch => {
              if (ch.id === channelId) {
                return { ...ch, name: newName, desc: newDescription };
              }
              return ch;
            })
          };
        }
        return ws;
      }));
    }
  };

  // Delete Channel write action
  const handleDeleteChannel = async (channelId) => {
    if (!activeWorkspaceId || !user) return;

    if (isConfigured) {
      try {
        await deleteDoc(doc(db, 'channels', channelId));
        
        // Automatically fallback to active workspace's default '#general' channel
        const activeWorkspaceRaw = workspaces.find(ws => ws.id === activeWorkspaceId);
        const generalChan = activeWorkspaceRaw?.channels?.find(c => c.name === 'general');
        if (generalChan) {
          setActiveDestinationId(generalChan.id);
          setIsDestinationDm(false);
        }
      } catch (err) {
        console.error('Error deleting channel:', err);
        throw err;
      }
    } else {
      // Offline Emulation fallback
      setWorkspaces(prev => prev.map(ws => {
        if (ws.id === activeWorkspaceId) {
          return {
            ...ws,
            channels: (ws.channels || []).filter(ch => ch.id !== channelId)
          };
        }
        return ws;
      }));

      // Switch to general fallback
      const activeWorkspaceRaw = workspaces.find(ws => ws.id === activeWorkspaceId);
      const generalChan = activeWorkspaceRaw?.channels?.find(c => c.name === 'general');
      if (generalChan) {
        setActiveDestinationId(generalChan.id);
        setIsDestinationDm(false);
      }
    }
  };

  // Create Workspace write action
  const handleCreateWorkspace = async (name) => {
    if (!user) return;

    // Duplicate workspace name protection check
    const isDuplicate = workspaces.some(
      w => w.name.toLowerCase() === name.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`A workspace named "${name}" already exists.`);
    }

    if (isConfigured) {
      try {
        // 1. Create workspace document
        const wsRef = await addDoc(collection(db, 'workspaces'), {
          name: name,
          iconText: name.substring(0, 2).toUpperCase(),
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          members: [user.uid]
        });

        // 2. Automatically create general and announcement channels inside it
        const genRef = await addDoc(collection(db, 'channels'), {
          workspaceId: wsRef.id,
          name: 'general',
          description: 'Company-wide announcements and work-based chat',
          isPrivate: false,
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });

        await addDoc(collection(db, 'channels'), {
          workspaceId: wsRef.id,
          name: 'announcement',
          description: 'Official workspace announcements and notifications',
          isPrivate: false,
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });

        // 3. Switch focus cleanly
        setActiveWorkspaceId(wsRef.id);
        setActiveDestinationId(genRef.id);
        setIsDestinationDm(false);
      } catch (err) {
        console.error('Error creating workspace:', err);
        throw err;
      }
    } else {
      const newId = `ws-${Date.now()}`;
      const newWorkspace = {
        id: newId,
        name: name,
        iconText: name.substring(0, 2).toUpperCase(),
        channels: [
          { id: 'general', name: 'general', desc: 'Company-wide announcements and work-based chat', isPrivate: false },
          { id: 'announcement', name: 'announcement', desc: 'Official workspace announcements and notifications', isPrivate: false }
        ],
        members: [user.uid],
        dms: []
      };

      setWorkspaces(prev => [...prev, newWorkspace]);

      setActiveWorkspaceId(newId);
      setActiveDestinationId('general');
      setIsDestinationDm(false);
    }
  };

  // Update Workspace write action
  const handleUpdateWorkspace = async (workspaceId, newName, newIconText) => {
    if (!user) return;
    if (isConfigured) {
      try {
        await updateDoc(doc(db, 'workspaces', workspaceId), {
          name: newName,
          iconText: newIconText
        });
      } catch (err) {
        console.error('Error updating workspace:', err);
        throw err;
      }
    } else {
      setWorkspaces(prev => prev.map(ws => {
        if (ws.id === workspaceId) {
          return { ...ws, name: newName, iconText: newIconText };
        }
        return ws;
      }));
    }
  };

  // Delete Workspace cascade write action
  const handleDeleteWorkspace = async (workspaceId) => {
    if (!user) return;
    if (isConfigured) {
      try {
        // 1. Delete associated messages
        const msgSnap = await getDocs(query(collection(db, 'messages'), where('workspaceId', '==', workspaceId)));
        for (const docRef of msgSnap.docs) {
          await deleteDoc(docRef.ref);
        }
        
        // 2. Delete associated channels
        const chanSnap = await getDocs(query(collection(db, 'channels'), where('workspaceId', '==', workspaceId)));
        for (const docRef of chanSnap.docs) {
          await deleteDoc(docRef.ref);
        }
        
        // 3. Delete workspace itself
        await deleteDoc(doc(db, 'workspaces', workspaceId));

        if (activeWorkspaceId === workspaceId) {
          setActiveWorkspaceId('');
          setActiveDestinationId('');
        }
      } catch (err) {
        console.error('Error deleting workspace:', err);
        throw err;
      }
    } else {
      setWorkspaces(prev => prev.filter(ws => ws.id !== workspaceId));
      if (activeWorkspaceId === workspaceId) {
        setActiveWorkspaceId('');
        setActiveDestinationId('');
      }
    }
  };

  // Join Workspace write action
  const handleJoinWorkspace = async (workspaceId) => {
    if (!user) return;
    const cleanId = workspaceId.trim();

    if (isConfigured) {
      try {
        const wsRef = doc(db, 'workspaces', cleanId);
        const wsSnap = await getDoc(wsRef);
        if (!wsSnap.exists()) {
          throw new Error(`Workspace with ID "${cleanId}" was not found.`);
        }

        const currentMembers = wsSnap.data().members || [];
        if (currentMembers.includes(user.uid)) {
          throw new Error(`You are already a member of "${wsSnap.data().name}" workspace.`);
        }

        // Add user UID to workspace members list in Firestore
        await updateDoc(wsRef, {
          members: arrayUnion(user.uid)
        });

        // Switch directly into the joined workspace
        setActiveWorkspaceId(cleanId);
      } catch (err) {
        console.error('Error joining workspace:', err);
        throw err;
      }
    } else {
      // Offline Emulation fallback
      const currentWorkspace = workspaces.find(w => w.id === cleanId);
      if (!currentWorkspace) {
        throw new Error(`Workspace with ID "${cleanId}" was not found.`);
      }

      const isAlreadyMember = currentWorkspace.members?.includes(user.uid) || currentWorkspace.dms?.some(d => d.id === user.uid);
      if (isAlreadyMember) {
        throw new Error(`You are already a member of "${currentWorkspace.name}" workspace.`);
      }

      setWorkspaces(prev => prev.map(ws => {
        if (ws.id === cleanId) {
          const currentDms = ws.dms || [];
          const members = ws.members || [];
          return {
            ...ws,
            members: [...members, user.uid],
            dms: [...currentDms, {
              id: user.uid,
              name: user.name,
              avatar: user.avatarInitials,
              status: 'online',
              role: 'Workspace Member'
            }]
          };
        }
        return ws;
      }));

      setActiveWorkspaceId(cleanId);
    }
  };

  const handleInviteUser = async (email) => {
    const cleanEmail = email.trim().toLowerCase();
    
    if (isConfigured) {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', cleanEmail));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          return { success: false, message: 'User with this email was not found.' };
        }
        
        let foundUser = null;
        querySnapshot.forEach((doc) => {
          foundUser = { uid: doc.id, ...doc.data() };
        });

        const activeWorkspaceRaw = workspaces.find(ws => ws.id === activeWorkspaceId);
        const currentMembers = activeWorkspaceRaw?.members || [];
        if (currentMembers.includes(foundUser.uid)) {
          return { success: false, message: 'This user is already a member of this workspace.' };
        }

        const wsRef = doc(db, 'workspaces', activeWorkspaceId);
        await updateDoc(wsRef, {
          members: arrayUnion(foundUser.uid)
        });

        // ========================================================
        // 1.3. GENERATE FIRESTORE REALTIME INVITE NOTIFICATION
        // ========================================================
        const inviteNotificationData = {
          workspaceId: activeWorkspaceId,
          userId: foundUser.uid,
          senderId: user.uid,
          senderName: user.name,
          senderAvatar: user.avatarInitials,
          content: `invited you to join the workspace "${activeWorkspaceRaw.name}"`,
          type: 'invite',
          destinationId: activeWorkspaceId,
          destinationName: activeWorkspaceRaw.name,
          isDestinationDm: false,
          isRead: false,
          createdAt: serverTimestamp()
        };
        await addDoc(collection(db, 'notifications'), inviteNotificationData);

        return { success: true, message: `${foundUser.name} has been invited successfully!` };
      } catch (err) {
        console.error('Error inviting user:', err);
        return { success: false, message: err.message || 'An unexpected error occurred.' };
      }
    } else {
      return new Promise((resolve) => {
        setTimeout(() => {
          const dbUsers = JSON.parse(localStorage.getItem('emulated_users_docs') || '[]');
          const mockProfiles = [
            { uid: 'alice', name: 'Alice Smith', email: 'alice@acme-corp.com', avatarInitials: 'AS', status: 'online', role: 'UI Designer' },
            { uid: 'bob', name: 'Bob Johnson', email: 'bob@acme-corp.com', avatarInitials: 'BJ', status: 'away', role: 'Staff Engineer' },
            { uid: 'charlie', name: 'Charlie Davis', email: 'charlie@acme-corp.com', avatarInitials: 'CD', status: 'offline', role: 'Product Manager' },
            { uid: 'dina', name: 'Dina Ross', email: 'dina@acme-corp.com', avatarInitials: 'DR', status: 'online', role: 'Senior Illustrator' },
            { uid: 'frank', name: 'Frank Carter', email: 'frank@acme-corp.com', avatarInitials: 'FC', status: 'online', role: 'DevOps Lead' }
          ];

          const allUsers = [...dbUsers, ...mockProfiles];
          const foundUser = allUsers.find(u => u.email.toLowerCase() === cleanEmail);

          if (!foundUser) {
            return resolve({ success: false, message: 'User with this email was not found.' });
          }

          const currentWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
          if (currentWorkspace) {
            const isAlreadyMember = currentWorkspace.dms?.some(d => d.id === foundUser.uid || d.id === foundUser.id) || foundUser.uid === user.uid;
            if (isAlreadyMember) {
              return resolve({ success: false, message: 'This user is already a member of this workspace.' });
            }
          }

          setWorkspaces(prev => prev.map(ws => {
            if (ws.id === activeWorkspaceId) {
              const currentDms = ws.dms || [];
              return {
                ...ws,
                dms: [...currentDms, {
                  id: foundUser.uid || foundUser.id,
                  name: foundUser.name,
                  avatar: foundUser.avatarInitials || 'US',
                  status: foundUser.status || 'offline',
                  role: foundUser.role || 'Workspace Member'
                }]
              };
            }
            return ws;
          }));

          // ========================================================
          // 1.4. GENERATE EMULATOR REALTIME INVITE NOTIFICATION
          // ========================================================
          const targetUid = foundUser.uid || foundUser.id;
          const localNotifications = JSON.parse(localStorage.getItem(`slack_notifications_user_${targetUid}`) || '[]');
          localNotifications.push({
            id: `notif-${Date.now()}`,
            workspaceId: activeWorkspaceId,
            userId: targetUid,
            senderId: user.uid,
            senderName: user.name,
            senderAvatar: user.avatarInitials,
            content: `invited you to join the workspace "${currentWorkspace.name}"`,
            type: 'invite',
            destinationId: activeWorkspaceId,
            destinationName: currentWorkspace.name,
            isDestinationDm: false,
            isRead: false,
            createdAt: Date.now()
          });
          localStorage.setItem(`slack_notifications_user_${targetUid}`, JSON.stringify(localNotifications));
          
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new Event('slack_local_notifications_update'));

          resolve({ success: true, message: `${foundUser.name} has been invited successfully (emulated)!` });
        }, 600);
      });
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!activeWorkspaceId || !user || !activeWorkspace) return;

    // Ownership protection: creator cannot remove themselves
    if (memberId === activeWorkspace.createdBy) {
      throw new Error("The workspace creator cannot be removed from the workspace.");
    }

    if (isConfigured) {
      try {
        const wsRef = doc(db, 'workspaces', activeWorkspaceId);
        const wsSnap = await getDoc(wsRef);
        if (wsSnap.exists()) {
          const currentMembers = wsSnap.data().members || [];
          const updatedMembers = currentMembers.filter(uid => uid !== memberId);
          await updateDoc(wsRef, {
            members: updatedMembers
          });
        }
      } catch (err) {
        console.error('Error removing member:', err);
        throw err;
      }
    } else {
      // Offline Emulation fallback
      setWorkspaces(prev => prev.map(ws => {
        if (ws.id === activeWorkspaceId) {
          const members = ws.members || [];
          const currentDms = ws.dms || [];
          return {
            ...ws,
            members: members.filter(uid => uid !== memberId),
            dms: currentDms.filter(d => d.id !== memberId)
          };
        }
        return ws;
      }));
    }
  };

  const handleSearchJumpTo = (destId, isDm, messageId = null, workspaceId = activeWorkspaceId, parentMessageId = null) => {
    if (workspaceId && workspaceId !== activeWorkspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
    
    setActiveDestinationId(destId);
    setIsDestinationDm(isDm);
    
    if (parentMessageId) {
      setActiveThreadMessageId(parentMessageId);
    } else {
      setActiveThreadMessageId(null);
    }
    
    if (messageId) {
      setHighlightedMessageId(messageId);
    } else {
      setHighlightedMessageId(null);
    }

    // Mark notifications for this destination as read instantly
    handleMarkAsRead(destId, workspaceId || activeWorkspaceId);
  };

  // ========================================================
  // 7. USER PROFILE FORMATTING & DYNAMIC MEMBERS PANEL PREPEND
  // ========================================================
  const activeWorkspaceRaw = workspaces.find(ws => ws.id === activeWorkspaceId);
  
  // Format DMs list:
  // - If Real Firebase: get all registered users who belong to activeWorkspaceRaw.members list
  // - If Emulated Mode: get activeWorkspaceRaw.dms list
  const workspaceMembersRaw = isConfigured
    ? allRegisteredUsers.filter(u => activeWorkspaceRaw?.members?.includes(u.uid))
    : activeWorkspaceRaw?.dms || [];

  const formattedDms = workspaceMembersRaw.map(u => {
    const memberId = u.uid || u.id;
    const isOwner = activeWorkspaceRaw?.createdBy === memberId;
    const isCurrentUser = memberId === user?.uid;
    
    let roleText = u.role || 'Workspace Member';
    if (isOwner) {
      roleText = isCurrentUser ? 'Workspace Owner (Me)' : 'Workspace Owner';
    } else if (isCurrentUser) {
      roleText = 'Workspace Member (Me)';
    }

    return {
      id: memberId,
      name: u.name,
      email: u.email,
      avatar: u.avatarInitials,
      status: u.presenceStatus || u.onlineStatus || 'offline',
      lastSeenAt: u.lastSeenAt || null,
      role: roleText
    };
  });

  const activeWorkspace = activeWorkspaceRaw ? {
    ...activeWorkspaceRaw,
    // List OTHER members in the Direct Messages sidebar list (filter out yourself)
    dms: formattedDms.filter(d => d.id !== user?.uid),
    // List ALL members (including yourself) inside the right Members Panel!
    allWorkspaceMembers: formattedDms
  } : null;


  if (workspacesLoading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-white font-sans select-none animate-in fade-in duration-200">
        <div className="flex items-center gap-2 mb-4 animate-pulse">
          <div className="w-8 h-8 flex flex-wrap gap-[2px] rotate-12 shrink-0">
            <div className="w-3.5 h-3.5 bg-[#36C5F0] rounded-tl-full rounded-r-full" />
            <div className="w-3.5 h-3.5 bg-[#2BAC76] rounded-tr-full rounded-b-full" />
            <div className="w-3.5 h-3.5 bg-[#ECB22E] rounded-bl-full rounded-t-full" />
            <div className="w-3.5 h-3.5 bg-[#E01E5A] rounded-br-full rounded-l-full" />
          </div>
          <span className="text-2xl font-black text-[#1D1C1D] tracking-tight">slack</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#616061] font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-[#522653] shrink-0" />
          <span>Synchronizing workspaces...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden h-full w-full bg-white select-none">
      
      {/* DESKTOP SIDEBARS */}
      <div className="hidden sm:flex shrink-0 h-full">
        <WorkspaceSidebar
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={handleSelectWorkspace}
          onAddWorkspaceClick={() => setActiveModal('create_workspace')}
          unreadNotifications={unreadNotifications}
        />
        
        {/* Pass dynamically scoped workspace parameters */}
        <ChannelNav
          activeWorkspace={activeWorkspace}
          activeDestinationId={activeDestinationId}
          isDestinationDm={isDestinationDm}
          onSelectDestination={(id, isDm) => {
            setActiveDestinationId(id);
            setIsDestinationDm(isDm);
            setHighlightedMessageId(null);
            setActiveThreadMessageId(null);
          }}
          onAddChannelClick={() => setActiveModal('create_channel')}
          onInviteClick={() => setActiveModal('invite_people')}
          currentUser={user}
          onLogout={logout}
          onSettingsClick={() => setActiveModal('workspace_settings')}
          onPreferencesClick={() => setActiveModal('preferences')}
          onHelpClick={() => setActiveModal('help_feedback')}
          compactMode={compactMode}
          unreadNotifications={unreadNotifications}
        />
      </div>

      {/* MOBILE DRAWER */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex sm:hidden">
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
            role="presentation"
          />

          <div className="relative flex h-full animate-in slide-in-from-left duration-200">
            <WorkspaceSidebar
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              onSelectWorkspace={handleSelectWorkspace}
              onAddWorkspaceClick={() => {
                setActiveModal('create_workspace');
                setMobileSidebarOpen(false);
              }}
              unreadNotifications={unreadNotifications}
            />
            
            <ChannelNav
              activeWorkspace={activeWorkspace}
              activeDestinationId={activeDestinationId}
              isDestinationDm={isDestinationDm}
              onSelectDestination={(id, isDm) => {
                setActiveDestinationId(id);
                setIsDestinationDm(isDm);
                setHighlightedMessageId(null);
                setActiveThreadMessageId(null);
              }}
              onAddChannelClick={() => {
                setActiveModal('create_channel');
                setMobileSidebarOpen(false);
              }}
              onInviteClick={() => {
                setActiveModal('invite_people');
                setMobileSidebarOpen(false);
              }}
              onCloseMobileDrawer={() => setMobileSidebarOpen(false)}
              currentUser={user}
              onLogout={logout}
              onSettingsClick={() => {
                setActiveModal('workspace_settings');
                setMobileSidebarOpen(false);
              }}
              onPreferencesClick={() => {
                setActiveModal('preferences');
                setMobileSidebarOpen(false);
              }}
              onHelpClick={() => {
                setActiveModal('help_feedback');
                setMobileSidebarOpen(false);
              }}
              compactMode={compactMode}
              unreadNotifications={unreadNotifications}
            />
          </div>
        </div>
      )}

      {/* CHAT PANE */}
      <main className="flex-1 flex min-w-0 h-full relative">
        <ChatArea
          activeWorkspace={activeWorkspace}
          activeDestinationId={activeDestinationId}
          isDestinationDm={isDestinationDm}
          messages={messages}
          messagesLoading={messagesLoading}
          hasMoreMessages={hasMoreMessages}
          loadingMoreMessages={loadingMoreMessages}
          onLoadMoreMessages={handleLoadMoreMessages}
          pinnedMessages={pinnedMessages}
          readReceipts={readReceipts}
          onSendMessage={handleSendMessage}
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
          onToggleReaction={handleToggleReaction}
          activeThreadMessageId={activeThreadMessageId}
          onOpenThread={(msgId) => {
            setActiveThreadMessageId(msgId);
            setRightPanelOpen(false);
            setPinnedPanelOpen(false);
          }}
          onOpenSearch={() => setActiveModal('search')}
          onToggleRightPanel={() => {
            setPinnedPanelOpen(false);
            if (activeThreadMessageId) {
              setActiveThreadMessageId(null);
            } else {
              setRightPanelOpen(!rightPanelOpen);
            }
          }}
          rightPanelOpen={rightPanelOpen || !!activeThreadMessageId || pinnedPanelOpen}
          onOpenMobileDrawer={() => setMobileSidebarOpen(true)}
          highlightedMessageId={highlightedMessageId}
          clearHighlight={() => setHighlightedMessageId(null)}
          onAddChannelClick={() => setActiveModal('create_channel')}
          onAddWorkspaceClick={() => setActiveModal('create_workspace')}
          onJoinWorkspaceClick={() => setActiveModal('join_workspace')}
          onChannelSettingsClick={() => {
            const ch = activeWorkspace?.channels?.find(c => c.id === activeDestinationId);
            if (ch) setChannelSettingsTarget(ch);
          }}
          unreadNotifications={unreadNotifications}
          onJumpTo={handleSearchJumpTo}
          onMarkAllAsRead={() => {
            unreadNotifications.forEach(n => {
              if (n.workspaceId === activeWorkspaceId) {
                handleMarkAsRead(n.destinationId, activeWorkspaceId);
              }
            });
          }}
          onMarkNotificationAsRead={handleMarkNotificationAsRead}
          activeTypers={activeTypers}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          activeRecorders={activeRecorders}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          onOpenProfile={handleOpenProfile}
          pinnedPanelOpen={pinnedPanelOpen}
          onTogglePinnedPanel={() => {
            setPinnedPanelOpen(!pinnedPanelOpen);
            setActiveThreadMessageId(null);
            setRightPanelOpen(false);
          }}
          onTogglePinMessage={handleTogglePinMessage}
          scheduledMessages={scheduledMessages}
          onScheduleMessage={handleScheduleMessage}
          onCancelScheduledMessage={handleCancelScheduledMessage}
          onScheduleReminder={handleScheduleReminder}
        />

        {/* Right side panels: either ThreadPanel, PinnedPanel, or MembersPanel */}
        {activeThreadMessageId && activeWorkspace ? (
          <ThreadPanel
            activeWorkspace={activeWorkspace}
            activeDestinationId={activeDestinationId}
            isDestinationDm={isDestinationDm}
            messages={messages}
            onSendMessage={handleSendMessage}
            onDeleteMessage={handleDeleteMessage}
            onEditMessage={handleEditMessage}
            onToggleReaction={handleToggleReaction}
            activeThreadMessageId={activeThreadMessageId}
            onClose={() => setActiveThreadMessageId(null)}
            currentUser={user}
            scheduledMessages={scheduledMessages}
            onScheduleMessage={handleScheduleMessage}
            onCancelScheduledMessage={handleCancelScheduledMessage}
          />
        ) : pinnedPanelOpen && activeWorkspace ? (
          <PinnedPanel
            activeWorkspace={activeWorkspace}
            activeDestinationId={activeDestinationId}
            isDestinationDm={isDestinationDm}
            pinnedMessages={pinnedMessages}
            onClose={() => setPinnedPanelOpen(false)}
            onJumpTo={handleSearchJumpTo}
            onTogglePinMessage={handleTogglePinMessage}
            currentUser={user}
          />
        ) : rightPanelOpen && activeWorkspace ? (
          <MembersPanel
            activeWorkspace={{
              ...activeWorkspace,
              // Overwrite direct messages mapping in Members Panel to show ALL workspace members (including yourself!)
              dms: activeWorkspace.allWorkspaceMembers
            }}
            onClose={() => setRightPanelOpen(false)}
            onInviteClick={() => setActiveModal('invite_people')}
            currentUser={user}
            onRemoveMember={handleRemoveMember}
            onOpenProfile={handleOpenProfile}
          />
        ) : null}
      </main>

      {/* MODAL DIALOGS */}
      <CreateChannelModal
        isOpen={activeModal === 'create_channel'}
        onClose={() => setActiveModal(null)}
        onCreate={handleCreateChannel}
      />

      <CreateWorkspaceModal
        isOpen={activeModal === 'create_workspace'}
        onClose={() => setActiveModal(null)}
        onCreate={handleCreateWorkspace}
      />

      <JoinWorkspaceModal
        isOpen={activeModal === 'join_workspace'}
        onClose={() => setActiveModal(null)}
        onJoin={handleJoinWorkspace}
      />

      <SearchModal
        isOpen={activeModal === 'search'}
        onClose={() => setActiveModal(null)}
        activeWorkspace={activeWorkspace}
        allMessages={messages}
        onJumpTo={handleSearchJumpTo}
        user={user}
      />

      <InviteWorkspaceModal
        isOpen={activeModal === 'invite_people' && activeWorkspace?.createdBy === user?.uid}
        onClose={() => setActiveModal(null)}
        onInvite={handleInviteUser}
        activeWorkspace={activeWorkspace}
      />

      <EditDeleteChannelModal
        isOpen={!!channelSettingsTarget}
        onClose={() => setChannelSettingsTarget(null)}
        channel={channelSettingsTarget}
        onEdit={handleEditChannel}
        onDelete={handleDeleteChannel}
      />

      <WorkspaceSettingsModal
        isOpen={activeModal === 'workspace_settings'}
        onClose={() => setActiveModal(null)}
        workspace={activeWorkspace}
        currentUser={user}
        onUpdate={handleUpdateWorkspace}
        onDelete={handleDeleteWorkspace}
      />

      <PreferencesModal
        isOpen={activeModal === 'preferences'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        setTheme={setTheme}
        notifications={notifications}
        setNotifications={setNotifications}
        compactMode={compactMode}
        setCompactMode={setCompactMode}
      />

      <HelpFeedbackModal
        isOpen={activeModal === 'help_feedback'}
        onClose={() => setActiveModal(null)}
      />

      <UserProfileModal
        isOpen={!!selectedProfileUser}
        onClose={() => setSelectedProfileUser(null)}
        user={selectedProfileUser}
        allMembers={activeWorkspace?.allWorkspaceMembers || []}
        workspaceName={activeWorkspace?.name || ''}
        onStartDM={handleStartDirectMessage}
        onUpdateProfile={handleUpdateUserProfile}
        onRemoveMember={handleRemoveMember}
        currentUser={user}
        isCreator={activeWorkspace?.createdBy === user?.uid}
      />

      {/* Floating Sync Error Notification Banner */}
      {syncError && (
        <div className="fixed bottom-4 left-4 z-[100] max-w-sm p-4 bg-red-50 border border-red-200 rounded-xl shadow-lg animate-in slide-in-from-bottom-4 duration-200 flex items-start gap-3 select-text">
          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5 select-none">
            <span className="text-xs font-bold text-red-600">!</span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-xs font-bold text-slate-800">Connection Sync Issue</span>
            <span className="block text-[11px] text-slate-600 mt-0.5 leading-relaxed">{syncError}</span>
          </div>
          <button 
            onClick={() => setSyncError(null)}
            className="p-0.5 text-slate-400 hover:text-slate-600 hover:bg-red-100/50 rounded shrink-0 transition-colors cursor-pointer select-none"
          >
            <span className="text-xs font-bold font-sans">✕</span>
          </button>
        </div>
      )}

    </div>
  );
}

function ConfigErrorScreen() {
  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-white font-sans px-6 text-center select-none">
      <div className="max-w-md">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
          <span className="text-2xl font-black text-red-600">!</span>
        </div>
        <h1 className="text-xl font-black text-[#1D1C1D] mb-2">App not configured</h1>
        <p className="text-sm text-[#616061] leading-relaxed">
          Firebase environment variables are missing for this production build.
          The app cannot start without a valid Firebase configuration.
        </p>
        <p className="text-xs text-slate-400 mt-4 leading-relaxed">
          Set the <code className="font-mono">VITE_FIREBASE_*</code> variables (see
          <code className="font-mono"> .env.example</code>) and rebuild.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();

  // Production safety: never silently fall back to the localStorage emulation in a
  // prod build — it persists plaintext passwords. A missing config here is a hard
  // misconfiguration, so surface it instead of degrading to emulation mode.
  if (import.meta.env.PROD && !isConfigured) {
    return <ConfigErrorScreen />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-white font-sans select-none">
        <div className="flex items-center gap-2 mb-4 animate-pulse">
          <div className="w-8 h-8 flex flex-wrap gap-[2px] rotate-12 shrink-0">
            <div className="w-3.5 h-3.5 bg-[#36C5F0] rounded-tl-full rounded-r-full" />
            <div className="w-3.5 h-3.5 bg-[#2BAC76] rounded-tr-full rounded-b-full" />
            <div className="w-3.5 h-3.5 bg-[#ECB22E] rounded-bl-full rounded-t-full" />
            <div className="w-3.5 h-3.5 bg-[#E01E5A] rounded-br-full rounded-l-full" />
          </div>
          <span className="text-2xl font-black text-[#1D1C1D] tracking-tight">slack</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#616061] font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-[#522653] shrink-0" />
          <span>Syncing workspace account session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreens />;
  }

  return <SlackDashboard user={user} logout={logout} />;
}
