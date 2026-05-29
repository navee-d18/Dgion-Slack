import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage, isConfigured } from '../firebase';

// Uploads a message attachment to Firebase Storage and returns the attachment
// with its `url` swapped from an inline base64 data URI to a hosted download URL.
//
// Idempotent and mode-aware:
// - Emulation mode (no Firebase): returns the attachment untouched so the base64
//   preview keeps working from localStorage.
// - Firebase mode: only uploads when `url` is still a `data:` URI. Already-hosted
//   attachments (e.g. a scheduled message firing after it was uploaded) pass through.
export async function uploadAttachment(attachment, uid) {
  if (!attachment || !attachment.url) return attachment;
  if (!isConfigured || !storage) return attachment;
  if (!attachment.url.startsWith('data:')) return attachment;

  const safeName = (attachment.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `attachments/${uid}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);

  const snapshot = await uploadString(storageRef, attachment.url, 'data_url');
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return { ...attachment, url: downloadUrl, storagePath: path };
}
