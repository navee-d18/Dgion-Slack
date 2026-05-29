import { createContext, useContext, useState, useEffect } from 'react';
import { isConfigured, auth, db } from '../firebase';

// Real Firebase Auth dependencies
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode] = useState(isConfigured ? 'firebase' : 'emulated');

  // Helper: extract initials from user full name
  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // ========================================================
  // SESSION PERSISTENCE & LISTENER
  // ========================================================
  useEffect(() => {
    if (isConfigured && auth) {
      // 1. Real Firebase Auth Observer
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        try {
          if (firebaseUser) {
            // Retrieve additional user fields from Firestore users document
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            let mergedUser = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Slack User',
              email: firebaseUser.email,
              avatarInitials: getInitials(firebaseUser.displayName || 'Slack User'),
              role: 'Workspace Member',
              status: 'online'
            };

            if (userDocSnap.exists()) {
              const data = userDocSnap.data();
              mergedUser = { ...mergedUser, ...data };
              
              // Proactively set user online on session load
              try {
                await updateDoc(userDocRef, { 
                  presenceStatus: 'online',
                  onlineStatus: 'online',
                  lastSeenAt: new Date().toISOString()
                });
              } catch (e) {
                console.warn('Error updating presence on load:', e);
              }
            }
            
            setUser(mergedUser);
          } else {
            setUser(null);
          }
        } catch (error) {
          console.error('Error synchronizing Firebase user document:', error);
          setUser(null);
        } finally {
          setLoading(false);
        }
      });
      return () => unsubscribe();
    } else {
      // 2. Emulated LocalStorage Session Observer (Offline Developer fallback)
      const checkEmulatedSession = () => {
        try {
          const session = localStorage.getItem('emulated_session');
          if (session) {
            const sessionUser = JSON.parse(session);
            // Fetch fresh database state
            const localUsers = JSON.parse(localStorage.getItem('emulated_users_docs') || '[]');
            const freshUser = localUsers.find(u => u.uid === sessionUser.uid);
            setUser(freshUser || sessionUser);
          } else {
            setUser(null);
          }
        } catch (e) {
          console.error('Error parsing emulated session:', e);
          setUser(null);
        } finally {
          setLoading(false);
        }
      };

      checkEmulatedSession();
    }
  }, []);

  // ========================================================
  // AUTH ACTION: SIGN UP
  // ========================================================
  const signUp = async (name, email, password) => {
    setLoading(true);
    const cleanEmail = email.trim();
    const initials = getInitials(name);

    if (isConfigured) {
      try {
        // 1. Create credential
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const firebaseUser = userCredential.user;

        // 2. Update Auth profile display name
        await updateProfile(firebaseUser, { displayName: name });

        // 3. Create Firestore record
        const userDocData = {
          uid: firebaseUser.uid,
          name: name,
          email: cleanEmail,
          avatarInitials: initials,
          role: 'Workspace Member',
          presenceStatus: 'online',
          onlineStatus: 'online',
          lastSeenAt: new Date().toISOString(),
          statusText: 'Available',
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), userDocData);
        
        setUser(userDocData);
        return { success: true };
      } catch (error) {
        setLoading(false);
        throw error;
      }
    } else {
      // 2. Emulation Sign Up
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const dbUsers = JSON.parse(localStorage.getItem('emulated_users_docs') || '[]');
          
          if (dbUsers.some(u => u.email.toLowerCase() === cleanEmail.toLowerCase())) {
            setLoading(false);
            const err = new Error('The email address is already in use by another account.');
            err.code = 'auth/email-already-in-use';
            return reject(err);
          }

          const emulatedUid = `mock-${Date.now()}`;
          const newUserData = {
            uid: emulatedUid,
            name: name,
            email: cleanEmail,
            avatarInitials: initials,
            role: 'Workspace Member',
            presenceStatus: 'online',
            onlineStatus: 'online',
            lastSeenAt: new Date().toISOString(),
            statusText: 'Available',
            createdAt: new Date().toISOString()
          };

          // Save credential password record
          const credentialDb = JSON.parse(localStorage.getItem('emulated_credentials') || '[]');
          credentialDb.push({ uid: emulatedUid, email: cleanEmail, password });
          localStorage.setItem('emulated_credentials', JSON.stringify(credentialDb));

          // Save Firestore emulated collection document
          dbUsers.push(newUserData);
          localStorage.setItem('emulated_users_docs', JSON.stringify(dbUsers));

          // Log in session
          localStorage.setItem('emulated_session', JSON.stringify(newUserData));
          setUser(newUserData);
          setLoading(false);
          resolve({ success: true });
        }, 800); // Realistic 800ms API response delay
      });
    }
  };

  // ========================================================
  // AUTH ACTION: SIGN IN / LOG IN
  // ========================================================
  const signIn = async (email, password) => {
    setLoading(true);
    const cleanEmail = email.trim();

    if (isConfigured) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const firebaseUser = userCredential.user;

        // Fetch Firestore record
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let mergedUser = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Slack User',
          email: firebaseUser.email,
          avatarInitials: getInitials(firebaseUser.displayName || 'Slack User'),
          role: 'Workspace Member',
          presenceStatus: 'online',
          onlineStatus: 'online',
          lastSeenAt: new Date().toISOString()
        };

        if (userDocSnap.exists()) {
          mergedUser = { 
            ...mergedUser, 
            ...userDocSnap.data(), 
            presenceStatus: 'online',
            onlineStatus: 'online',
            lastSeenAt: new Date().toISOString()
          };
          await updateDoc(userDocRef, { 
            presenceStatus: 'online',
            onlineStatus: 'online',
            lastSeenAt: new Date().toISOString()
          });
        }
        
        setUser(mergedUser);
        return { success: true };
      } catch (error) {
        setLoading(false);
        throw error;
      }
    } else {
      // Emulation Sign In
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const credentialDb = JSON.parse(localStorage.getItem('emulated_credentials') || '[]');
          const match = credentialDb.find(c => c.email.toLowerCase() === cleanEmail.toLowerCase());
          
          if (!match) {
            setLoading(false);
            const err = new Error('User account not found.');
            err.code = 'auth/user-not-found';
            return reject(err);
          }

          if (match.password !== password) {
            setLoading(false);
            const err = new Error('Invalid account password.');
            err.code = 'auth/wrong-password';
            return reject(err);
          }

          // Fetch local users document
          const localUsers = JSON.parse(localStorage.getItem('emulated_users_docs') || '[]');
          const matchedUser = localUsers.find(u => u.uid === match.uid);
          
          if (matchedUser) {
            matchedUser.presenceStatus = 'online';
            matchedUser.onlineStatus = 'online';
            matchedUser.lastSeenAt = new Date().toISOString();
            // Save online update back
            localStorage.setItem('emulated_users_docs', JSON.stringify(localUsers));
          }

          const loggedInUser = matchedUser || {
            uid: match.uid,
            name: cleanEmail.split('@')[0],
            email: cleanEmail,
            avatarInitials: getInitials(cleanEmail.split('@')[0]),
            role: 'Workspace Member',
            presenceStatus: 'online',
            onlineStatus: 'online',
            lastSeenAt: new Date().toISOString()
          };

          localStorage.setItem('emulated_session', JSON.stringify(loggedInUser));
          setUser(loggedInUser);
          setLoading(false);
          resolve({ success: true });
        }, 800);
      });
    }
  };

  // ========================================================
  // AUTH ACTION: GOOGLE SIGN IN
  // ========================================================
  const signInWithGoogle = async () => {
    setLoading(true);

    if (isConfigured) {
      try {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        const firebaseUser = userCredential.user;

        // Fetch or create Firestore user profile record
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let mergedUser = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Slack User',
          email: firebaseUser.email,
          avatarInitials: getInitials(firebaseUser.displayName || 'Slack User'),
          role: 'Workspace Member',
          presenceStatus: 'online',
          onlineStatus: 'online',
          lastSeenAt: new Date().toISOString()
        };

        if (userDocSnap.exists()) {
          mergedUser = { 
            ...mergedUser, 
            ...userDocSnap.data(), 
            presenceStatus: 'online',
            onlineStatus: 'online',
            lastSeenAt: new Date().toISOString()
          };
          await updateDoc(userDocRef, { 
            presenceStatus: 'online',
            onlineStatus: 'online',
            lastSeenAt: new Date().toISOString()
          });
        } else {
          const userDocData = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Slack User',
            email: firebaseUser.email,
            avatarInitials: getInitials(firebaseUser.displayName || 'Slack User'),
            role: 'Workspace Member',
            presenceStatus: 'online',
            onlineStatus: 'online',
            lastSeenAt: new Date().toISOString(),
            statusText: 'Available',
            createdAt: new Date().toISOString()
          };
          await setDoc(userDocRef, userDocData);
          mergedUser = { ...mergedUser, ...userDocData };
        }
        
        setUser(mergedUser);
        return { success: true };
      } catch (error) {
        setLoading(false);
        throw error;
      }
    } else {
      // Emulation Google Sign-In
      return new Promise((resolve) => {
        setTimeout(() => {
          const emulatedUid = 'mock-google-user';
          const newUserData = {
            uid: emulatedUid,
            name: 'Google User',
            email: 'google.user@gmail.com',
            avatarInitials: 'GU',
            role: 'Workspace Member',
            presenceStatus: 'online',
            onlineStatus: 'online',
            lastSeenAt: new Date().toISOString(),
            statusText: 'Available',
            createdAt: new Date().toISOString()
          };

          const dbUsers = JSON.parse(localStorage.getItem('emulated_users_docs') || '[]');
          if (!dbUsers.some(u => u.uid === emulatedUid)) {
            dbUsers.push(newUserData);
            localStorage.setItem('emulated_users_docs', JSON.stringify(dbUsers));
          }

          localStorage.setItem('emulated_session', JSON.stringify(newUserData));
          setUser(newUserData);
          setLoading(false);
          resolve({ success: true });
        }, 800);
      });
    }
  };

  // ========================================================
  // AUTH ACTION: LOG OUT
  // ========================================================
  const logout = async () => {
    setLoading(true);

    if (isConfigured) {
      try {
        if (user?.uid) {
          // Set user status to offline in Firestore before logging out
          try {
            await updateDoc(doc(db, 'users', user.uid), { 
              presenceStatus: 'offline',
              onlineStatus: 'offline',
              lastSeenAt: new Date().toISOString()
            });
          } catch (e) {
            console.warn('Could not set presenceStatus to offline on logout:', e);
          }
        }
        await signOut(auth);
        setUser(null);
      } catch (error) {
        console.error('Error logging out of Firebase:', error);
      } finally {
        setLoading(false);
      }
    } else {
      // Emulation Log out
      if (user?.uid) {
        const localUsers = JSON.parse(localStorage.getItem('emulated_users_docs') || '[]');
        const updated = localUsers.map(u => {
          if (u.uid === user.uid) {
            return { 
              ...u, 
              presenceStatus: 'offline',
              onlineStatus: 'offline',
              lastSeenAt: new Date().toISOString()
            };
          }
          return u;
        });
        localStorage.setItem('emulated_users_docs', JSON.stringify(updated));
      }
      localStorage.removeItem('emulated_session');
      setUser(null);
      setLoading(false);
    }
  };

  const contextValue = {
    user,
    loading,
    mode,
    signUp,
    signIn,
    signInWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
