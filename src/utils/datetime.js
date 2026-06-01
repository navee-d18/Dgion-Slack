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

// getMessageDate resolves a message's calendar Date from the many shapes its
// `createdAt` can take (Firestore Timestamp via toDate()/{seconds}, a raw value
// new Date() accepts) or, as a last resort, an "msg-<epoch>" optimistic id.
// Falls back to "now" so callers always get a Date. Used for day-separator
// grouping in ChatArea and ThreadPanel.
export function getMessageDate(msg) {
  if (msg.createdAt) {
    if (typeof msg.createdAt.toDate === 'function') {
      return msg.createdAt.toDate();
    }
    if (msg.createdAt.seconds) {
      return new Date(msg.createdAt.seconds * 1000);
    }
    return new Date(msg.createdAt);
  }
  if (msg.id && msg.id.startsWith('msg-')) {
    const ts = parseInt(msg.id.replace('msg-', ''), 10);
    if (!isNaN(ts)) {
      return new Date(ts);
    }
  }
  return new Date(); // fallback
}

// isSameDay returns true when two Dates fall on the same calendar day.
export function isSameDay(date1, date2) {
  if (!date1 || !date2) return false;
  return date1.toDateString() === date2.toDateString();
}

// formatDateHeader renders a day-separator label: "Today", "Yesterday", or an
// absolute "Month D, YYYY". Relative to the current date (uses new Date()).
export function formatDateHeader(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }
}

// formatReminderTime renders a scheduled/reminder timestamp as a short, friendly
// label: "Today 3:00 PM", "Tomorrow 9:30 AM", or "Jun 5 at 3:00 PM". Accepts a
// Firestore Timestamp (toDate()) or anything new Date() accepts; '' for missing.
// Relative to the current date (uses new Date()).
export function formatReminderTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);

  const timeString = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) {
    return `Today ${timeString}`;
  } else if (d.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${timeString}`;
  } else {
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    return `${month} ${day} at ${timeString}`;
  }
}
