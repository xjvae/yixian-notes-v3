import { useState, useCallback, useEffect, useRef } from 'react';
import type { IWebsite } from '@/data/notes';
import { toast } from 'sonner';

const STORAGE_KEY = 'yixian_websites';
const MASTER_KEY = 'yixian_websites_master'; // 主密码元信息（盐 + 验证密文）
const PBKDF2_ITERATIONS = 200000;
const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 分钟无操作自动锁定
const VERIFIER_PLAIN = 'yixian-websites-master-check';

interface MasterMeta {
  salt: string; // base64
  verifier: string; // 用主 key 加密的校验文本，用于解锁时验证
}

/**
 * 存储形态：
 * - 元信息（名称/网址/账号等）明文；
 * - 密码二选一：已加密 → enc_password（密文）；未加密 → plain_password（临时明文，待用户选择加密后再转密文）。
 */
type StoredWebsite = Omit<IWebsite, 'password'> & {
  enc_password?: string;
  plain_password?: string;
};

// ---- 基础工具 ----
function abToB64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function b64ToAb(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
async function aesEncrypt(plain: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, new TextEncoder().encode(plain),
  );
  return JSON.stringify({ c: abToB64(c), iv: abToB64(iv.buffer as ArrayBuffer) });
}
async function aesDecrypt(payload: string, key: CryptoKey): Promise<string> {
  const { c, iv } = JSON.parse(payload) as { c: string; iv: string };
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b64ToAb(iv)) as unknown as BufferSource }, key, b64ToAb(c),
  );
  return new TextDecoder().decode(plain);
}

// ---- 存储读写 ----
function loadStored(): StoredWebsite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function persistStored(items: StoredWebsite[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* 忽略存储异常 */
  }
}
function loadMaster(): MasterMeta | null {
  try {
    const raw = localStorage.getItem(MASTER_KEY);
    return raw ? (JSON.parse(raw) as MasterMeta) : null;
  } catch {
    return null;
  }
}
function persistMaster(meta: MasterMeta) {
  try {
    localStorage.setItem(MASTER_KEY, JSON.stringify(meta));
  } catch {
    /* 忽略存储异常 */
  }
}

export function useWebsites() {
  const [websites, setWebsites] = useState<StoredWebsite[]>(() => loadStored());
  const [unlocked, setUnlocked] = useState(false);
  const [isInitialized, setIsInitialized] = useState(() => !!loadMaster());
  const [decryptedPasswords, setDecryptedPasswords] = useState<Record<string, string>>({});
  const keyRef = useRef<CryptoKey | null>(null);
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAutoLock = useCallback(() => {
    if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    autoLockTimerRef.current = setTimeout(() => {
      keyRef.current = null;
      setUnlocked(false);
      setDecryptedPasswords({});
    }, AUTO_LOCK_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    };
  }, []);

  /** 首次设置主密码（生成盐 + 验证密文，主密码本身不落盘） */
  const setupMaster = useCallback(async (password: string): Promise<boolean> => {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(password, salt);
      const verifier = await aesEncrypt(VERIFIER_PLAIN, key);
      persistMaster({ salt: abToB64(salt.buffer as ArrayBuffer), verifier });
      keyRef.current = key;
      setIsInitialized(true);
      setUnlocked(true);
      setDecryptedPasswords({});
      resetAutoLock();
      return true;
    } catch {
      toast.error('设置主密码失败');
      return false;
    }
  }, [resetAutoLock]);

  /** 用主密码解锁，通过验证密文校验密码是否正确 */
  const unlock = useCallback(async (password: string): Promise<boolean> => {
    try {
      const meta = loadMaster();
      if (!meta) return false;
      const salt = new Uint8Array(b64ToAb(meta.salt));
      const key = await deriveKey(password, salt);
      const decrypted = await aesDecrypt(meta.verifier, key);
      if (decrypted !== VERIFIER_PLAIN) return false; // 密码错误
      keyRef.current = key;
      setUnlocked(true);
      setDecryptedPasswords({});
      resetAutoLock();
      return true;
    } catch {
      return false;
    }
  }, [resetAutoLock]);

  const lock = useCallback(() => {
    keyRef.current = null;
    setUnlocked(false);
    setDecryptedPasswords({});
    if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
  }, []);

  /** 解锁状态下解密并缓存某站点密码；未加密的密码直接返回明文 */
  const decryptPassword = useCallback(async (id: string): Promise<string | null> => {
    const item = websites.find((w) => w.id === id);
    if (!item) return null;
    if (item.plain_password !== undefined) return item.plain_password;
    if (!item.enc_password || !keyRef.current) return null;
    try {
      const plain = await aesDecrypt(item.enc_password, keyRef.current);
      setDecryptedPasswords((prev) => ({ ...prev, [id]: plain }));
      resetAutoLock();
      return plain;
    } catch {
      return null;
    }
  }, [websites, resetAutoLock]);

  /** 将某站点未加密的明文密码转密文保存（需已解锁 / 已设置主密码） */
  const encryptPassword = useCallback(async (id: string): Promise<boolean> => {
    if (!keyRef.current) return false;
    const item = websites.find((w) => w.id === id);
    if (!item || item.plain_password === undefined) return false;
    try {
      const enc = await aesEncrypt(item.plain_password, keyRef.current);
      setWebsites((prev) => {
        const next = prev.map((w) =>
          w.id === id
            ? { ...w, enc_password: enc, plain_password: undefined, updatedAt: Date.now() }
            : w,
        );
        persistStored(next);
        return next;
      });
      setDecryptedPasswords((prev) => ({ ...prev, [id]: item.plain_password || '' }));
      resetAutoLock();
      return true;
    } catch {
      return false;
    }
  }, [websites, resetAutoLock]);

  const addWebsite = useCallback(async (data: IWebsite & { password?: string }) => {
    const now = Date.now();
    const id = data.id || crypto.randomUUID();
    const w: StoredWebsite = {
      id,
      name: data.name,
      url: data.url,
      category: data.category,
      username: data.username,
      note: data.note,
      icon: data.icon,
      visitCount: data.visitCount ?? 0,
      favorite: data.favorite ?? false,
      order: data.order ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    if (data.password) {
      // 已解锁 → 直接加密；未解锁 → 先明文保存，供添加后选择加密
      if (keyRef.current) {
        w.enc_password = await aesEncrypt(data.password, keyRef.current);
      } else {
        w.plain_password = data.password;
      }
    }
    setWebsites((prev) => {
      const next = [w, ...prev];
      persistStored(next);
      return next;
    });
    if (w.enc_password && data.password) {
      setDecryptedPasswords((prev) => ({ ...prev, [id]: data.password || '' }));
    }
    resetAutoLock();
    return w;
  }, [resetAutoLock]);

  const updateWebsite = useCallback(async (id: string, data: Partial<IWebsite & { password?: string }>) => {
    let nextEnc: StoredWebsite['enc_password'] | undefined;
    let nextPlain: StoredWebsite['plain_password'] | undefined;
    if (data.password !== undefined) {
      if (data.password === '') {
        // 清空密码
        nextPlain = '';
      } else if (keyRef.current) {
        nextEnc = await aesEncrypt(data.password, keyRef.current);
      } else {
        nextPlain = data.password;
      }
    }
    setWebsites((prev) => {
      const next = prev.map((w) => {
        if (w.id !== id) return w;
        const patch: Partial<StoredWebsite> = {
          name: data.name,
          url: data.url,
          category: data.category,
          username: data.username,
          note: data.note,
          icon: data.icon,
          visitCount: data.visitCount,
          favorite: data.favorite,
          order: data.order,
          updatedAt: Date.now(),
        };
        if (data.password !== undefined) {
          patch.enc_password = nextEnc;
          patch.plain_password = nextPlain;
        }
        return { ...w, ...patch };
      });
      persistStored(next);
      return next;
    });
    if (data.password !== undefined) {
      setDecryptedPasswords((prev) => ({ ...prev, [id]: data.password || '' }));
    }
    resetAutoLock();
  }, [resetAutoLock]);

  const removeWebsite = useCallback((id: string) => {
    setWebsites((prev) => {
      const next = prev.filter((w) => w.id !== id);
      persistStored(next);
      return next;
    });
    setDecryptedPasswords((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  /** 访问一次网址，累加常用排序权重 */
  const incrementVisit = useCallback((id: string) => {
    setWebsites((prev) => {
      const next = prev.map((w) =>
        w.id === id ? { ...w, visitCount: (w.visitCount || 0) + 1 } : w,
      );
      persistStored(next);
      return next;
    });
  }, []);

  /** 切换收藏（置顶）状态 */
  const toggleFavorite = useCallback((id: string) => {
    setWebsites((prev) => {
      const next = prev.map((w) =>
        w.id === id ? { ...w, favorite: !w.favorite, updatedAt: Date.now() } : w,
      );
      persistStored(next);
      return next;
    });
  }, []);

  /**
   * 手动排序：按传入的 id 顺序重写所有站点的 order 权重。
   * 仅调整 order，不改变数组本身；展示层按 order 排序即可。
   */
  const reorderWebsites = useCallback((orderedIds: string[]) => {
    const rank = new Map(orderedIds.map((id, i) => [id, i]));
    setWebsites((prev) => {
      const changed = prev.some((w) => (w.order ?? 0) !== (rank.get(w.id) ?? 0));
      if (!changed) return prev;
      const next = prev.map((w) => {
        const idx = rank.get(w.id);
        return idx === undefined
          ? w
          : { ...w, order: idx, updatedAt: Date.now() };
      });
      persistStored(next);
      return next;
    });
  }, []);

  const resetMaster = useCallback(() => {
    try {
      localStorage.removeItem(MASTER_KEY);
    } catch {
      /* 忽略 */
    }
    keyRef.current = null;
    setIsInitialized(false);
    setUnlocked(false);
    setDecryptedPasswords({});
  }, []);

  /** 导出备份：返回完整 JSON 字符串，密码以密文/明文原始形态保存，可原样重新导入 */
  const exportBackup = useCallback((): string => {
    return JSON.stringify(
      { app: 'yixian-websites', version: 1, exportedAt: Date.now(), items: websites },
      null,
      2,
    );
  }, [websites]);

  /** 导入备份：merge 追加 / replace 全量替换，按 id 去重返回 {added, updated} */
  const importWebsites = useCallback(
    async (text: string, mode: 'merge' | 'replace' = 'merge'): Promise<{ added: number; updated: number }> => {
      let data: { items?: StoredWebsite[] };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('备份文件格式错误');
      }
      const incoming = Array.isArray(data.items) ? (data.items as StoredWebsite[]) : Array.isArray(data) ? (data as StoredWebsite[]) : [];
      if (!incoming.length) throw new Error('备份文件中没有网址数据');

      const normalized: StoredWebsite[] = incoming.map((it, index) => ({
        id: it.id || crypto.randomUUID(),
        name: it.name || '',
        url: it.url || '',
        category: it.category,
        username: it.username,
        note: it.note,
        icon: it.icon,
        visitCount: it.visitCount ?? 0,
        favorite: it.favorite ?? false,
        order: it.order ?? index,
        createdAt: it.createdAt ?? Date.now(),
        updatedAt: it.updatedAt ?? Date.now(),
        enc_password: it.enc_password,
        plain_password: it.plain_password,
      }));

      let addedCount = 0;
      let updatedCount = 0;
      setWebsites((prev) => {
        const map = new Map(prev.map((w) => [w.id, w]));
        for (const it of normalized) {
          if (map.has(it.id)) {
            map.set(it.id, { ...map.get(it.id)!, ...it });
            updatedCount++;
          } else {
            map.set(it.id, it);
            addedCount++;
          }
        }
        let next = Array.from(map.values());
        if (mode === 'replace') {
          next = normalized;
          // 替换时全部按新增计数
          addedCount = normalized.length;
          updatedCount = 0;
        }
        persistStored(next);
        return next;
      });
      return { added: addedCount, updated: updatedCount };
    },
    [setWebsites],
  );

  // 供 UI 使用：合并已解密的密码（或未加密的明文），并暴露密码状态
  const viewWebsites: (IWebsite & { hasPassword?: boolean; isEncrypted?: boolean })[] = websites.map(
    (w) => {
      const plain = w.plain_password !== undefined ? w.plain_password : undefined;
      return {
        ...(w as Omit<IWebsite, 'password'>),
        password: decryptedPasswords[w.id] ?? plain,
        hasPassword: !!w.enc_password || !!w.plain_password,
        isEncrypted: !!w.enc_password,
      };
    },
  );

  return {
    websites: viewWebsites,
    unlocked,
    isInitialized,
    setupMaster,
    unlock,
    lock,
    decryptPassword,
    encryptPassword,
    addWebsite,
    updateWebsite,
    removeWebsite,
    incrementVisit,
    toggleFavorite,
    reorderWebsites,
    exportBackup,
    importWebsites,
    resetMaster,
  };
}

export type { StoredWebsite };