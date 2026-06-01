import { describe, it, expect } from 'vitest';
import { dmConversationId, conversationKey } from './conversation';

describe('dmConversationId', () => {
  it('is symmetric regardless of argument order', () => {
    expect(dmConversationId('alice', 'bob')).toBe(dmConversationId('bob', 'alice'));
  });

  it('joins the sorted uid pair with an underscore', () => {
    expect(dmConversationId('bob', 'alice')).toBe('alice_bob');
  });

  it('handles real Firebase-style uids deterministically', () => {
    const a = 'zX9aQ';
    const b = 'aB2cd';
    expect(dmConversationId(a, b)).toBe('aB2cd_zX9aQ');
    expect(dmConversationId(b, a)).toBe('aB2cd_zX9aQ');
  });

  it('produces a self-conversation id for a self DM', () => {
    expect(dmConversationId('me', 'me')).toBe('me_me');
  });
});

describe('conversationKey', () => {
  it('uses the sorted uid pair for a DM', () => {
    const key = conversationKey({ selfUid: 'bob', destinationId: 'alice', isDm: true });
    expect(key).toBe('alice_bob');
  });

  it('is identical for both DM participants', () => {
    const fromAlice = conversationKey({ selfUid: 'alice', destinationId: 'bob', isDm: true });
    const fromBob = conversationKey({ selfUid: 'bob', destinationId: 'alice', isDm: true });
    expect(fromAlice).toBe(fromBob);
  });

  it('uses the channel id directly for a channel', () => {
    const key = conversationKey({ selfUid: 'alice', destinationId: 'general-channel', isDm: false });
    expect(key).toBe('general-channel');
  });

  it('does not leak the self uid into a channel key', () => {
    const key = conversationKey({ selfUid: 'alice', destinationId: 'random', isDm: false });
    expect(key).not.toContain('alice');
  });
});
