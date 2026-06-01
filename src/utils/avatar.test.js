import { describe, it, expect } from 'vitest';
import { getInitials, getAvatarColorClass } from './avatar';

describe('getInitials', () => {
  it('returns up to two uppercase initials', () => {
    expect(getInitials('Ada Lovelace')).toBe('AL');
    expect(getInitials('grace hopper')).toBe('GH');
  });

  it('uses only the first two words for longer names', () => {
    expect(getInitials('Alan Mathison Turing')).toBe('AM');
  });

  it('handles a single-word name', () => {
    expect(getInitials('Cher')).toBe('C');
  });

  it('falls back to "US" for an empty/missing name', () => {
    expect(getInitials('')).toBe('US');
    expect(getInitials(null)).toBe('US');
    expect(getInitials(undefined)).toBe('US');
  });
});

describe('getAvatarColorClass', () => {
  it('is deterministic — the same name always maps to the same colour', () => {
    expect(getAvatarColorClass('Ada Lovelace')).toBe(getAvatarColorClass('Ada Lovelace'));
  });

  it('always returns one of the known palette classes', () => {
    const palette = [
      'bg-[#E01E5A]', 'bg-[#36C5F0]', 'bg-[#2BAC76]',
      'bg-[#ECB22E]', 'bg-[#613064]', 'bg-[#1164A3]'
    ];
    for (const name of ['Ada', 'Grace Hopper', 'Z', 'a really long name here']) {
      expect(palette).toContain(getAvatarColorClass(name));
    }
  });

  it('falls back to the neutral colour for an empty/missing name', () => {
    expect(getAvatarColorClass('')).toBe('bg-[#522653]');
    expect(getAvatarColorClass(null)).toBe('bg-[#522653]');
    expect(getAvatarColorClass(undefined)).toBe('bg-[#522653]');
  });
});
