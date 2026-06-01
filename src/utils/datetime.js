// Pure time / status helpers extracted from ChatArea so the trickiest logic
// (timestamp normalisation, the DM seen-state decision, and schedule validation)
// can be unit-tested without rendering a component or touching live Firebase.

// getReceiptMillis normalises the many shapes a timestamp can arrive in — a raw
// epoch number, a Firestore Timestamp (`toMillis()` / `{seconds}`), or anything
// `new Date()` accepts — into epoch milliseconds. Returns 0 for missing/invalid
// input so callers can treat 0 as "no timestamp".
export function getReceiptMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

// dmSeenState decides which status to show on the sender's own DM message.
// All inputs are epoch millis / booleans (already normalised by the caller):
//   - 'seen'      recipient has read up to (>=) this message
//   - 'delivered' recipient is online now, or was seen online after it was sent
//   - 'sent'      otherwise
export function dmSeenState({ msgMs, recipientReadMs, recipientOnline, recipientPresenceMs }) {
  if (recipientReadMs && recipientReadMs >= msgMs) return 'seen';
  if (recipientOnline || (recipientPresenceMs && recipientPresenceMs >= msgMs)) return 'delivered';
  return 'sent';
}

// isScheduleTimeInvalid returns true when a "schedule message" date/time pair is
// empty-safe-false, unparseable, or in the past relative to nowMs. `nowMs` is a
// parameter (not Date.now()) so the check is pure and deterministically testable.
export function isScheduleTimeInvalid(dateStr, timeStr, nowMs) {
  if (!dateStr || !timeStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, min] = timeStr.split(':').map(Number);
  const target = new Date(year, month - 1, day, hour, min, 0, 0);
  return isNaN(target.getTime()) || target.getTime() <= nowMs;
}
