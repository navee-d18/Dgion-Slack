import React, { useState, useEffect } from 'react';
import WorkspaceSidebar from './components/WorkspaceSidebar';
import ChannelNav from './components/ChannelNav';
import ChatArea from './components/ChatArea';
import MembersPanel from './components/MembersPanel';
import ThreadPanel from './components/ThreadPanel';
import { 
  CreateChannelModal, CreateWorkspaceModal, SearchModal, InviteWorkspaceModal, 
  EditDeleteChannelModal, JoinWorkspaceModal, WorkspaceSettingsModal, 
  PreferencesModal, HelpFeedbackModal 
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
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc,
  getDocs,
  updateDoc, 
  arrayUnion,
  deleteDoc
} from 'firebase/firestore';
import { db, isConfigured } from './firebase';
import { purgeAllDemoData } from './utils/dbCleanup';

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

  const [workspacesLoading, setWorkspacesLoading] = useState(isConfigured);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [channelsLoading, setChannelsLoading] = useState(isConfigured);
  
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'create_channel' | 'create_workspace' | 'search' | null
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [channelSettingsTarget, setChannelSettingsTarget] = useState(null);
  const [activeThreadMessageId, setActiveThreadMessageId] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState([]);

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
      // Run once client-side under user's active authenticated session to delete demo logs
      purgeAllDemoData(user.uid);
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
    }
  }, [activeWorkspaceId, activeDestinationId, user]);

  // ========================================================
  // 5. REAL-TIME OBSERVER: MESSAGES
  // ========================================================
  useEffect(() => {
    if (!isConfigured || !activeWorkspaceId || !activeDestinationId || !user) return;

    let q;
    if (isDestinationDm) {
      // Direct message query: watch the shared conversation ID
      const sharedConversationId = [user.uid, activeDestinationId].sort().join('_');
      q = query(
        collection(db, 'messages'),
        where('workspaceId', '==', activeWorkspaceId),
        where('conversationId', '==', sharedConversationId)
      );
    } else {
      // Channel message query: watch the channel ID
      q = query(
        collection(db, 'messages'),
        where('workspaceId', '==', activeWorkspaceId),
        where('channelId', '==', activeDestinationId)
      );
    }

    let isInitial = true;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = [];
      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() });
      });

      // Client-side chronological sort to completely bypass compound index constraints
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
    });

    return () => unsubscribe();
  }, [activeWorkspaceId, activeDestinationId, user, isDestinationDm, notifications]);

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

  // Auto-clear active destination notifications instantly
  useEffect(() => {
    if (activeWorkspaceId && activeDestinationId && unreadNotifications.length > 0) {
      const hasActiveUnreads = unreadNotifications.some(
        n => n.workspaceId === activeWorkspaceId && n.destinationId === activeDestinationId
      );
      if (hasActiveUnreads) {
        handleMarkAsRead(activeDestinationId, activeWorkspaceId);
      }
    }
  }, [activeWorkspaceId, activeDestinationId, unreadNotifications]);

  // Send Message write action
  const handleSendMessage = async (content, fileAttachment = null, parentMessageId = null) => {
    if (!activeWorkspaceId || !activeDestinationId || !user) return;

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
    if (isDestinationDm) {
      destName = activeWorkspaceRaw?.dms?.find(d => d.id === activeDestinationId)?.name || 'Direct Message';
    } else {
      destName = activeWorkspaceRaw?.channels?.find(c => c.id === activeDestinationId)?.name || 'channel';
    }

    if (isConfigured) {
      // 1. Cloud Firestore write
      try {
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

        if (fileAttachment) {
          messageData.file = fileAttachment;
        }

        if (isDestinationDm) {
          const sharedConversationId = [user.uid, activeDestinationId].sort().join('_');
          messageData.conversationId = sharedConversationId;
          messageData.receiverId = activeDestinationId;
          messageData.channelId = activeDestinationId;
        } else {
          messageData.channelId = activeDestinationId;
        }

        const msgDocRef = await addDoc(collection(db, 'messages'), messageData);

        // ========================================================
        // 1.1. GENERATE FIRESTORE REALTIME NOTIFICATIONS
        // ========================================================
        if (isDestinationDm) {
          // Direct Message: Create exactly 1 notification document for the recipient
          const notificationData = {
            workspaceId: activeWorkspaceId,
            userId: activeDestinationId,
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
          console.log('✉️ Creating DM notification in Firestore for recipient:', activeDestinationId, notificationData);
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
                destinationId: activeDestinationId,
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
                const notificationData = {
                  workspaceId: activeWorkspaceId,
                  userId: memberUid,
                  senderId: user.uid,
                  senderName: user.name,
                  senderAvatar: user.avatarInitials,
                  content: content || 'shared an attachment',
                  type: 'channel',
                  destinationId: activeDestinationId,
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
      const channelKey = `${activeWorkspaceId}-${activeDestinationId}`;
      const newMsgId = `msg-${Date.now()}`;
      const newMessage = {
        id: newMsgId,
        senderId: user.uid,
        senderName: user.name,
        content: content,
        timestamp: timeString,
        avatar: user.avatarInitials
      };

      if (parentMessageId) {
        newMessage.parentMessageId = parentMessageId;
      }

      if (fileAttachment) {
        newMessage.file = fileAttachment;
      }

      setMessages(prev => ({
        ...prev,
        [channelKey]: [...(prev[channelKey] || []), newMessage]
      }));

      // ========================================================
      // 1.2. GENERATE EMULATOR REALTIME NOTIFICATIONS
      // ========================================================
      const membersList = activeWorkspaceRaw?.members || [];
      if (isDestinationDm) {
        const localNotifications = JSON.parse(localStorage.getItem(`slack_notifications_user_${activeDestinationId}`) || '[]');
        localNotifications.push({
          id: `notif-${Date.now()}`,
          workspaceId: activeWorkspaceId,
          userId: activeDestinationId,
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
        localStorage.setItem(`slack_notifications_user_${activeDestinationId}`, JSON.stringify(localNotifications));
      } else {
        for (const memberUid of membersList) {
          if (memberUid !== user.uid) {
            const localNotifications = JSON.parse(localStorage.getItem(`slack_notifications_user_${memberUid}`) || '[]');
            localNotifications.push({
              id: `notif-${Date.now()}`,
              workspaceId: activeWorkspaceId,
              userId: memberUid,
              senderId: user.uid,
              senderName: user.name,
              senderAvatar: user.avatarInitials,
              content: content || 'shared an attachment',
              type: parentMessageId ? 'thread' : 'channel',
              destinationId: activeDestinationId,
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

  const handleDeleteMessage = async (messageId) => {
    if (!activeWorkspaceId || !activeDestinationId || !user) return;

    if (isConfigured) {
      try {
        await deleteDoc(doc(db, 'messages', messageId));
      } catch (err) {
        console.error('Error deleting message:', err);
        throw err;
      }
    } else {
      // Emulator LocalStorage deletion
      const channelKey = `${activeWorkspaceId}-${activeDestinationId}`;
      setMessages(prev => {
        const list = prev[channelKey] || [];
        return {
          ...prev,
          [channelKey]: list.filter(m => m.id !== messageId)
        };
      });
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
      const channelKey = `${activeWorkspaceId}-${activeDestinationId}`;
      setMessages(prev => {
        const list = prev[channelKey] || [];
        return {
          ...prev,
          [channelKey]: list.map(m => m.id === messageId ? { ...m, content: newContent, isEdited: true } : m)
        };
      });
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
      const channelKey = `${activeWorkspaceId}-${activeDestinationId}`;
      setMessages(prev => {
        const list = prev[channelKey] || [];
        return {
          ...prev,
          [channelKey]: list.map(m => {
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
          })
        };
      });
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

  const formattedDms = workspaceMembersRaw.map(u => ({
    id: u.uid || u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatarInitials,
    status: u.onlineStatus || 'offline',
    role: u.role || 'Workspace Member'
  }));

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
          onSendMessage={handleSendMessage}
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
          onToggleReaction={handleToggleReaction}
          activeThreadMessageId={activeThreadMessageId}
          onOpenThread={(msgId) => {
            setActiveThreadMessageId(msgId);
            setRightPanelOpen(false);
          }}
          onOpenSearch={() => setActiveModal('search')}
          onToggleRightPanel={() => {
            if (activeThreadMessageId) {
              setActiveThreadMessageId(null);
            } else {
              setRightPanelOpen(!rightPanelOpen);
            }
          }}
          rightPanelOpen={rightPanelOpen || !!activeThreadMessageId}
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
        />

        {/* Right side panels: either ThreadPanel or MembersPanel */}
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

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();

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
