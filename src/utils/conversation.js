// Pure helpers for deriving the symmetric identifiers that group a conversation.
//
// Both participants of a DM must independently compute the SAME id, so the id is
// built from the sorted pair of user ids — order-independent by construction.
// These were previously inlined (`[a, b].sort().join('_')`) in ~8 places across
// App.jsx; centralising them removes the risk of one copy drifting from another.

// dmConversationId returns the shared `conversationId` for a direct message
// between two users. Symmetric: dmConversationId(a, b) === dmConversationId(b, a).
export function dmConversationId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

// conversationKey returns the symmetric grouping key used by read receipts and
// related per-conversation state. A DM uses the sorted uid pair; a channel uses
// its own id (already symmetric for everyone in the channel).
export function conversationKey({ selfUid, destinationId, isDm }) {
  return isDm ? dmConversationId(selfUid, destinationId) : destinationId;
}
