import { describe, it, expect } from 'vitest';
import {
  getReceiptMillis, dmSeenState, isScheduleTimeInvalid,
  getMessageDate, isSameDay, formatDateHeader, formatReminderTime
} from './datetime';

describe('getReceiptMillis', () => {
  it('returns 0 for missing input', () => {
    expect(getReceiptMillis(null)).toBe(0);
    expect(getReceiptMillis(undefined)).toBe(0);
    expect(getReceiptMillis(0)).toBe(0);
  });

  it('passes through a raw epoch number', () => {
    expect(getReceiptMillis(1700000000000)).toBe(1700000000000);
  });

  it('uses toMillis() on a Firestore Timestamp', () => {
    const ts = { toMillis: () => 1700000000000, seconds: 999 };
    expect(getReceiptMillis(ts)).toBe(1700000000000);
  });

  it('falls back to seconds*1000 when only seconds is present', () => {
    expect(getReceiptMillis({ seconds: 1700000000 })).toBe(1700000000000);
  });

  it('parses a date string / Date instance', () => {
    expect(getReceiptMillis('2026-01-01T00:00:00.000Z')).toBe(Date.UTC(2026, 0, 1));
    const d = new Date(Date.UTC(2026, 0, 1));
    expect(getReceiptMillis(d)).toBe(Date.UTC(2026, 0, 1));
  });

  it('returns 0 for an unparseable value', () => {
    expect(getReceiptMillis('not-a-date')).toBe(0);
    expect(getReceiptMillis({})).toBe(0);
  });
});

describe('dmSeenState', () => {
  const msgMs = 1000;

  it('is "seen" when the recipient read at or after the message time', () => {
    expect(dmSeenState({ msgMs, recipientReadMs: 1000, recipientOnline: false, recipientPresenceMs: 0 })).toBe('seen');
    expect(dmSeenState({ msgMs, recipientReadMs: 2000, recipientOnline: false, recipientPresenceMs: 0 })).toBe('seen');
  });

  it('"seen" takes priority over online/presence', () => {
    expect(dmSeenState({ msgMs, recipientReadMs: 1500, recipientOnline: true, recipientPresenceMs: 9999 })).toBe('seen');
  });

  it('is "delivered" when the recipient is currently online but has not read', () => {
    expect(dmSeenState({ msgMs, recipientReadMs: 0, recipientOnline: true, recipientPresenceMs: 0 })).toBe('delivered');
  });

  it('is "delivered" when last-seen presence is after the message', () => {
    expect(dmSeenState({ msgMs, recipientReadMs: 0, recipientOnline: false, recipientPresenceMs: 1200 })).toBe('delivered');
  });

  it('is "sent" when read is before the message and recipient offline/stale', () => {
    expect(dmSeenState({ msgMs, recipientReadMs: 500, recipientOnline: false, recipientPresenceMs: 500 })).toBe('sent');
    expect(dmSeenState({ msgMs, recipientReadMs: 0, recipientOnline: false, recipientPresenceMs: 0 })).toBe('sent');
  });

  it('does not count a read strictly before the message as seen', () => {
    expect(dmSeenState({ msgMs, recipientReadMs: 999, recipientOnline: false, recipientPresenceMs: 0 })).toBe('sent');
  });
});

describe('isScheduleTimeInvalid', () => {
  const now = new Date(2026, 5, 1, 12, 0, 0, 0).getTime(); // 2026-06-01 12:00 local

  it('is not invalid when date or time is empty (nothing chosen yet)', () => {
    expect(isScheduleTimeInvalid('', '13:00', now)).toBe(false);
    expect(isScheduleTimeInvalid('2026-06-01', '', now)).toBe(false);
  });

  it('is invalid for a time in the past', () => {
    expect(isScheduleTimeInvalid('2026-06-01', '11:59', now)).toBe(true);
  });

  it('is invalid for exactly now (must be strictly future)', () => {
    expect(isScheduleTimeInvalid('2026-06-01', '12:00', now)).toBe(true);
  });

  it('is valid for a future time', () => {
    expect(isScheduleTimeInvalid('2026-06-01', '12:01', now)).toBe(false);
    expect(isScheduleTimeInvalid('2026-12-31', '23:59', now)).toBe(false);
  });

  it('is invalid for an unparseable date', () => {
    expect(isScheduleTimeInvalid('not-a-date', 'nope', now)).toBe(true);
  });
});

describe('getMessageDate', () => {
  it('uses toDate() on a Firestore Timestamp', () => {
    const when = new Date(2026, 0, 2, 3, 4, 5);
    const msg = { createdAt: { toDate: () => when, seconds: 999 } };
    expect(getMessageDate(msg)).toBe(when);
  });

  it('falls back to seconds*1000 when only seconds is present', () => {
    const msg = { createdAt: { seconds: 1700000000 } };
    expect(getMessageDate(msg).getTime()).toBe(1700000000000);
  });

  it('parses a raw value new Date() accepts', () => {
    const msg = { createdAt: '2026-01-01T00:00:00.000Z' };
    expect(getMessageDate(msg).getTime()).toBe(Date.UTC(2026, 0, 1));
  });

  it('derives the date from an optimistic "msg-<epoch>" id', () => {
    const msg = { id: 'msg-1700000000000' };
    expect(getMessageDate(msg).getTime()).toBe(1700000000000);
  });

  it('falls back to a Date for a message with no usable timestamp', () => {
    expect(getMessageDate({ id: 'abc' })).toBeInstanceOf(Date);
    expect(getMessageDate({})).toBeInstanceOf(Date);
  });
});

describe('isSameDay', () => {
  it('is true for two times on the same calendar day', () => {
    expect(isSameDay(new Date(2026, 5, 1, 0, 1), new Date(2026, 5, 1, 23, 59))).toBe(true);
  });

  it('is false for different days', () => {
    expect(isSameDay(new Date(2026, 5, 1), new Date(2026, 5, 2))).toBe(false);
  });

  it('is false when either date is missing', () => {
    expect(isSameDay(null, new Date())).toBe(false);
    expect(isSameDay(new Date(), undefined)).toBe(false);
  });
});

describe('formatDateHeader', () => {
  it('returns "Today" for the current date', () => {
    expect(formatDateHeader(new Date())).toBe('Today');
  });

  it('returns "Yesterday" for the previous day', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDateHeader(yesterday)).toBe('Yesterday');
  });

  it('returns an absolute en-US label for an older date', () => {
    expect(formatDateHeader(new Date(2020, 2, 5))).toBe('March 5, 2020');
  });
});

describe('formatReminderTime', () => {
  // Build a Date at a fixed time-of-day so the time portion is deterministic.
  const at = (date, h, m) => { const d = new Date(date); d.setHours(h, m, 0, 0); return d; };

  it('returns "" for a missing timestamp', () => {
    expect(formatReminderTime(null)).toBe('');
    expect(formatReminderTime(undefined)).toBe('');
  });

  it('prefixes "Today" for a time later today', () => {
    expect(formatReminderTime(at(new Date(), 15, 0))).toBe('Today 3:00 PM');
  });

  it('prefixes "Tomorrow" for a time tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatReminderTime(at(tomorrow, 9, 30))).toBe('Tomorrow 9:30 AM');
  });

  it('uses "Mon D at <time>" for a date further out', () => {
    expect(formatReminderTime(at(new Date(2026, 5, 5), 15, 0))).toBe('Jun 5 at 3:00 PM');
  });

  it('accepts a Firestore-style Timestamp via toDate()', () => {
    const when = at(new Date(2026, 5, 5), 15, 0);
    expect(formatReminderTime({ toDate: () => when })).toBe('Jun 5 at 3:00 PM');
  });
});
