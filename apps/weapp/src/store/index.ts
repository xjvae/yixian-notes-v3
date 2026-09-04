import { create } from 'zustand';
import Taro from '@tarojs/taro';
import type { UserProfile } from '@/types/auth';
import * as authService from '@/services/auth';

const SESSION_KEY = 'yixian_session';

interface AppState {
  user: UserProfile | null;
  isLoggedIn: boolean;
  loading: boolean;
  setUser: (user: UserProfile | null) => void;
  login: (nickname?: string, avatar?: string) => Promise<boolean>;
  logout: () => void;
}

function readSession(): UserProfile | null {
  try {
    const raw = Taro.getStorageSync(SESSION_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch (err) {
    console.error('[Store] read session failed:', err);
    return null;
  }
}

function writeSession(user: UserProfile | null) {
  try {
    if (user) {
      Taro.setStorageSync(SESSION_KEY, JSON.stringify(user));
    } else {
      Taro.removeStorageSync(SESSION_KEY);
    }
  } catch (err) {
    console.error('[Store] write session failed:', err);
  }
}

export const useAppStore = create<AppState>((set) => ({
  user: readSession(),
  isLoggedIn: !!readSession(),
  loading: false,
  setUser: (user) => {
    writeSession(user);
    set({ user, isLoggedIn: !!user });
  },
  login: async (nickname?: string, avatar?: string) => {
    set({ loading: true });
    try {
      const res = await authService.login(nickname, avatar);
      writeSession(res.user);
      set({ user: res.user, isLoggedIn: true, loading: false });
      return true;
    } catch (err) {
      console.error('[Auth] login failed:', err);
      set({ loading: false });
      return false;
    }
  },
  logout: () => {
    writeSession(null);
    set({ user: null, isLoggedIn: false });
  }
}));

// 应用启动时恢复会话（供 app.tsx 调用）
export function restoreSession(): Promise<void> {
  return Promise.resolve();
}

// 便捷取 store
export function useUser() {
  return useAppStore((s) => s.user);
}
export function useIsLoggedIn() {
  return useAppStore((s) => s.isLoggedIn);
}