import { doc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export async function purgeAllDemoData() {
  try {
    // 1. Delete workspaces
    const wsIds = ['acme-seed', 'design-seed', 'dev-seed'];
    for (const id of wsIds) {
      try {
        await deleteDoc(doc(db, 'workspaces', id));
      } catch (e) {
        console.warn(`Could not delete workspace ${id}:`, e);
      }
    }

    // 2. Delete channels
    const chIds = [
      'acme-general', 'acme-random', 'acme-announcements', 'acme-design-assets',
      'design-branding', 'design-inspiration', 'dev-bugs', 'dev-deploy'
    ];
    for (const id of chIds) {
      try {
        await deleteDoc(doc(db, 'channels', id));
      } catch (e) {
        console.warn(`Could not delete channel ${id}:`, e);
      }
    }

    // 3. Delete messages
    try {
      const msgCollection = collection(db, 'messages');
      const msgSnap = await getDocs(msgCollection);
      for (const msgDoc of msgSnap.docs) {
        const data = msgDoc.data();
        if (wsIds.includes(data.workspaceId) || data.createdBy === 'system' || data.senderId === 'alice' || data.senderId === 'bob' || data.senderId === 'charlie') {
          await deleteDoc(doc(db, 'messages', msgDoc.id));
        }
      }
    } catch (e) {
      console.warn('Could not clean messages:', e);
    }

    // 4. Delete demo users
    const demoUsers = ['alice', 'bob', 'charlie'];
    for (const id of demoUsers) {
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (e) {
        console.warn(`Could not delete user ${id}:`, e);
      }
    }
  } catch (error) {
    console.error('❌ Client-side database cleanup failed:', error);
  }
}
