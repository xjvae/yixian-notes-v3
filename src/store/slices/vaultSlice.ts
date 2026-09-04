/**
 * Vault Slice - 私密库状态管理
 * 职责：私密库解锁状态、密码验证会话
 */
import { StateCreator } from 'zustand';
import type { VaultItem } from '@/types';

const NOTE_PASSWORD_SESSION_MS = 5 * 60 * 1000;

// 独立密码验证会话存储（内存中，不持久化）
const verifiedNotes = new Map<string, number>();

function purgeExpiredVerifications() {
  const now = Date.now();
  for (const [id, ts] of verifiedNotes) {
    if (now - ts > NOTE_PASSWORD_SESSION_MS) {
      verifiedNotes.delete(id);
    }
  }
}

export interface VaultSlice {
  // State
  vaultItems: VaultItem[];
  vaultUnlocked: boolean;
  vaultExpiresAt: number;

  // Vault item actions
  setVaultItems: (items: VaultItem[]) => void;
  addVaultItem: (item: VaultItem) => void;
  deleteVaultItem: (id: string) => void;

  // Vault session actions
  setVaultUnlocked: (unlocked: boolean, expiresAt?: number) => void;
  lockVault: () => void;
  tickVault: () => void;

  // Note password verification
  isNoteVerified: (noteId: string) => boolean;
  markNoteVerified: (noteId: string) => void;
  clearNoteVerified: (noteId: string) => void;
  getNoteVerifyRemaining: (noteId: string) => number;
}

export const createVaultSlice: StateCreator<VaultSlice> = (set, get) => ({
  // Initial state
  vaultItems: [],
  vaultUnlocked: false,
  vaultExpiresAt: 0,

  // Vault item actions
  setVaultItems: (items) => set({ vaultItems: items }),
  addVaultItem: (item) => set((state) => ({ vaultItems: [...state.vaultItems, item] })),
  deleteVaultItem: (id) =>
    set((state) => ({ vaultItems: state.vaultItems.filter((v) => v.id !== id) })),

  // Vault session actions
  setVaultUnlocked: (unlocked, expiresAt) =>
    set({ vaultUnlocked: unlocked, vaultExpiresAt: expiresAt || 0 }),

  lockVault: () => {
    verifiedNotes.clear();
    set({ vaultUnlocked: false, vaultExpiresAt: 0 });
  },

  tickVault: () => {
    const { vaultUnlocked, vaultExpiresAt } = get();
    if (!vaultUnlocked) return;
    if (Date.now() >= vaultExpiresAt) {
      verifiedNotes.clear();
      set({ vaultUnlocked: false, vaultExpiresAt: 0 });
    }
    purgeExpiredVerifications();
  },

  // Note password verification
  isNoteVerified: (noteId) => {
    const ts = verifiedNotes.get(noteId);
    if (!ts) return false;
    if (Date.now() - ts > NOTE_PASSWORD_SESSION_MS) {
      verifiedNotes.delete(noteId);
      return false;
    }
    return true;
  },

  markNoteVerified: (noteId) => {
    purgeExpiredVerifications();
    verifiedNotes.set(noteId, Date.now());
  },

  clearNoteVerified: (noteId) => {
    verifiedNotes.delete(noteId);
  },

  getNoteVerifyRemaining: (noteId) => {
    const ts = verifiedNotes.get(noteId);
    if (!ts) return 0;
    const remaining = NOTE_PASSWORD_SESSION_MS - (Date.now() - ts);
    if (remaining <= 0) {
      verifiedNotes.delete(noteId);
      return 0;
    }
    return remaining;
  },
});
