// ============================================================
// 真实加密工具：AES-256-GCM 加密文本，口令经 PBKDF2 派生密钥
// 供“安全 / 笔记加密”功能使用。
// ============================================================

const enc = new TextEncoder();
const dec = new TextDecoder();

// 输出格式：前缀 + base64(16B盐 + 12B IV + 密文)
// v1 旧格式：`en:`，PBKDF2 迭代 100000（历史数据，仅解密兼容，不再用于新加密）
// v2 新格式：`en2:`，PBKDF2 迭代 ITERS_V2（更高，提升暴力破解成本）
const PREFIX_V1 = 'en:';
const PREFIX_V2 = 'en2:';
const ITERS_V1 = 100000;
const ITERS_V2 = 310000;

const SALT_LEN = 16;
const IV_LEN = 12;

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Uint8Array -> ArrayBuffer（满足 WebCrypto BufferSource 类型要求）
function toAB(a: Uint8Array): ArrayBuffer {
  return a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength) as ArrayBuffer;
}

async function deriveKey(secret: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toAB(salt), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** 解析密文前缀，返回 { prefix, iterations }；未知返回 null */
function detectVersion(payload: string): { prefix: string; iterations: number } | null {
  if (payload.startsWith(PREFIX_V2)) return { prefix: PREFIX_V2, iterations: ITERS_V2 };
  if (payload.startsWith(PREFIX_V1)) return { prefix: PREFIX_V1, iterations: ITERS_V1 };
  return null;
}

export function isEncrypted(text: string): boolean {
  return typeof text === 'string' && (text.startsWith(PREFIX_V1) || text.startsWith(PREFIX_V2));
}

export async function encryptText(password: string, plain: string): Promise<string> {
  if (!plain) return '';
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt, ITERS_V2);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toAB(iv) }, key, enc.encode(plain));
  const combined = new Uint8Array(salt.length + iv.length + cipher.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(cipher), salt.length + iv.length);
  return PREFIX_V2 + toBase64(combined);
}

export async function decryptText(password: string, payload: string): Promise<string> {
  if (!payload) return payload;
  const version = detectVersion(payload);
  if (!version) return payload; // 非加密文本，原样返回
  const combined = fromBase64(payload.slice(version.prefix.length));
  const salt = combined.slice(0, SALT_LEN);
  const iv = combined.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const data = combined.slice(SALT_LEN + IV_LEN);
  const key = await deriveKey(password, salt, version.iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toAB(iv) }, key, toAB(data));
    return dec.decode(plain);
  } catch {
    return ''; // 口令错误或数据损坏
  }
}