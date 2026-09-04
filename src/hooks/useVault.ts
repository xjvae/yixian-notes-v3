import { useState, useCallback, useRef, useEffect } from 'react';
import { useStore, type VaultItem } from '@/store/useStore';
import { toast } from 'sonner';

const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes
// 新保险库 PBKDF2 迭代次数（对齐行业主流 ~60 万次）
const PBKDF2_ITERATIONS = 600000;
// 历史保险库（未记录迭代次数）默认 20 万次，用于向后兼容解密旧数据
const LEGACY_PBKDF2_ITER = 200000;

interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  salt: string;
}

interface VaultKey {
  key: CryptoKey;
  salt: Uint8Array;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(data: string, vaultKey: VaultKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    vaultKey.key,
    encoder.encode(data)
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(vaultKey.salt.buffer as ArrayBuffer),
  };
}

async function decryptData(payload: EncryptedPayload, vaultKey: VaultKey): Promise<string> {
  try {
    const ciphertext = base64ToArrayBuffer(payload.ciphertext);
    const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));

    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
      },
      vaultKey.key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  } catch {
    throw new Error('解密失败，密码可能不正确');
  }
}

// 口令明文不落盘（不写入任何存储），仅在内存以派生 CryptoKey 持有；
// localStorage 仅存非机密派生参数（salt、迭代次数），供跨重启后重新派生并识别是否已初始化。
function getStoredIterations(): number | null {
  const raw = localStorage.getItem('vault_iterations');
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function setStoredIterations(iterations: number): void {
  localStorage.setItem('vault_iterations', String(iterations));
}

function getStoredSalt(): string | null {
  return localStorage.getItem('vault_salt');
}

function setStoredSalt(salt: string): void {
  localStorage.setItem('vault_salt', salt);
}

export function clearStoredSalt(): void {
  localStorage.removeItem('vault_salt');
  localStorage.removeItem('vault_iterations');
}

export function useVault() {
  const { vaultItems, addVaultItem, deleteVaultItem } = useStore();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isInitialized, setIsInitialized] = useState(!!getStoredSalt());
  const [decryptedItems, setDecryptedItems] = useState<Array<{
    id: string;
    name: string;
    itemType: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const vaultKeyRef = useRef<VaultKey | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetActivityTimer = useCallback(() => {
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
    }
    activityTimerRef.current = setTimeout(() => {
      setIsUnlocked(false);
      setDecryptedItems([]);
      vaultKeyRef.current = null;
    }, AUTO_LOCK_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current);
      }
    };
  }, []);

  const initializeVault = useCallback(async (password: string): Promise<boolean> => {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
      vaultKeyRef.current = { key, salt };
      setStoredIterations(PBKDF2_ITERATIONS);
      setStoredSalt(arrayBufferToBase64(salt.buffer));
      setIsInitialized(true);
      setIsUnlocked(true);
      setDecryptedItems([]);
      resetActivityTimer();
      toast.success('保险库初始化成功');
      return true;
    } catch {
      toast.error('初始化保险库失败');
      return false;
    }
  }, [resetActivityTimer]);

  const unlockVault = useCallback(async (password: string): Promise<boolean> => {
    try {
      const saltBase64 = getStoredSalt();
      if (!saltBase64) {
        toast.error('保险库尚未初始化');
        return false;
      }

      const salt = new Uint8Array(base64ToArrayBuffer(saltBase64));
      // 历史保险库未记录迭代次数时按旧值 20 万次派生，兼容解密旧数据
      const iterations = getStoredIterations() ?? LEGACY_PBKDF2_ITER;
      const key = await deriveKey(password, salt, iterations);

      const testItem = vaultItems.find((item: VaultItem) => item.encryptedData);
      if (testItem && vaultItems.length > 0) {
        const payload: EncryptedPayload = JSON.parse(testItem.encryptedData);
        await decryptData(payload, { key, salt });
      }

      vaultKeyRef.current = { key, salt };
      setIsUnlocked(true);
      toast.success('保险库已解锁');
      resetActivityTimer();
      return true;
    } catch {
      toast.error('密码解锁失败');
      return false;
    }
  }, [vaultItems, resetActivityTimer]);

  const lockVault = useCallback(() => {
    setIsUnlocked(false);
    setDecryptedItems([]);
    vaultKeyRef.current = null;
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
    }
    toast.info('保险库已锁定');
  }, []);

  const addItem = useCallback(async (
    name: string,
    itemType: string,
    content: string
  ): Promise<boolean> => {
    if (!vaultKeyRef.current || !isUnlocked) {
      toast.error('请先解锁保险库');
      return false;
    }

    try {
      const payload = await encryptData(content, vaultKeyRef.current);
      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      addVaultItem({
        id,
        name,
        itemType,
        encryptedData: JSON.stringify(payload),
        createdAt: now,
        updatedAt: now,
      });

      toast.success(`已添加「${name}」`);
      resetActivityTimer();
      return true;
    } catch {
      toast.error('加密并保存项目失败');
      return false;
    }
  }, [isUnlocked, addVaultItem, resetActivityTimer]);

  const removeItem = useCallback((id: string) => {
    deleteVaultItem(id);
    setDecryptedItems((prev) => prev.filter((item) => item.id !== id));
    toast.success('已删除项目');
  }, [deleteVaultItem]);

  const decryptItem = useCallback(async (itemId: string): Promise<string | null> => {
    if (!vaultKeyRef.current || !isUnlocked) {
      toast.error('请先解锁保险库');
      return null;
    }

    try {
      const item = vaultItems.find((v: VaultItem) => v.id === itemId);
      if (!item) return null;

      const payload: EncryptedPayload = JSON.parse(item.encryptedData);
      const content = await decryptData(payload, vaultKeyRef.current);
      resetActivityTimer();
      return content;
    } catch {
      toast.error('解密项目失败');
      return null;
    }
  }, [vaultItems, isUnlocked, resetActivityTimer]);

  const validatePassword = useCallback(async (password: string): Promise<boolean> => {
    if (!isInitialized) {
      return initializeVault(password);
    }
    return unlockVault(password);
  }, [isInitialized, initializeVault, unlockVault]);

  return {
    isUnlocked,
    isInitialized,
    vaultItems,
    decryptedItems,
    initializeVault,
    unlockVault,
    lockVault,
    validatePassword,
    addItem,
    removeItem,
    decryptItem,
  };
}
