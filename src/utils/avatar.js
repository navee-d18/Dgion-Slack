// Shared avatar helpers — initials + a deterministic background colour for a
// name. These were previously copy-pasted (with subtly different null-handling)
// across ChatArea, ThreadPanel, MembersPanel, PinnedPanel, Modals and
// AuthContext; consolidating here keeps the avatar look consistent everywhere.
// Both functions are null-safe so a missing name never throws.

const AVATAR_COLORS = [
  'bg-[#E01E5A]', 'bg-[#36C5F0]', 'bg-[#2BAC76]',
  'bg-[#ECB22E]', 'bg-[#613064]', 'bg-[#1164A3]'
];

// getAvatarColorClass picks a stable Tailwind bg-class from the name's char-code
// sum, so the same name always maps to the same colour. Falls back to a neutral
// purple for an empty/missing name.
export function getAvatarColorClass(name) {
  if (!name) return 'bg-[#522653]';
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

// getInitials returns up to two uppercase initials from a name ("Ada Lovelace"
// -> "AL"). Falls back to "US" for an empty/missing name.
export function getInitials(name) {
  if (!name) return 'US';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}
