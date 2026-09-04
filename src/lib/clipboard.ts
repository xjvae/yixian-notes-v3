// ============================================================
// 剪贴板工具函数
// 支持文本和图片的读取、写入、保存到本地文件
// 面向 Tauri 2.x + Web API（无需额外 npm 包）
// ============================================================

import { invoke } from '@tauri-apps/api/core';

// ============================================================
// 类型定义
// ============================================================

/** 剪贴板图片信息 */
export interface ClipboardImageInfo {
  /** Base64 编码的图片数据（不含 data: URI 前缀） */
  base64: string;
  /** MIME 类型，如 image/png, image/jpeg */
  mimeType: string;
  /** 文件大小（字节） */
  size: number;
}

/** 剪贴板中的图片 Blob */
export interface ClipboardImageBlob {
  blob: Blob;
  mimeType: string;
}

// ============================================================
// 文本剪贴板操作（通过 Tauri 命令）
// ============================================================

/**
 * 将文本写入系统剪贴板（通过 Tauri Rust 端）
 */
export async function writeTextToClipboard(text: string): Promise<void> {
  await invoke('clipboard_write_text', { text });
}

/**
 * 从系统剪贴板读取文本（通过 Tauri Rust 端）
 */
export async function readTextFromClipboard(): Promise<string> {
  return await invoke<string>('clipboard_read_text');
}

// ============================================================
// 图片剪贴板操作（通过 Tauri 命令）
// ============================================================

/**
 * 将图片写入系统剪贴板（通过 Tauri Rust 端）
 * @param base64Data Base64 编码的图片数据（不含 data: URI 前缀）
 */
export async function writeImageToClipboard(base64Data: string): Promise<void> {
  await invoke('clipboard_write_image', { base64Data });
}

/**
 * 从系统剪贴板读取图片（通过 Tauri Rust 端）
 * @returns Base64 编码的 PNG 图片数据
 */
export async function readImageFromClipboard(): Promise<string> {
  return await invoke<string>('clipboard_read_image');
}

// ============================================================
// 浏览器 Web API 剪贴板读取
// ============================================================

/**
 * 通过浏览器 Web API 读取剪贴板中的图片
 * 使用 navigator.clipboard.read() 和 ClipboardItem.getType()
 * @returns 图片信息或 null（如果剪贴板中没有图片）
 */
export async function readImageFromClipboardWeb(): Promise<ClipboardImageInfo | null> {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
    throw new Error('当前环境不支持 Clipboard API（navigator.clipboard.read）');
  }

  try {
    const clipboardItems = await navigator.clipboard.read();

    for (const item of clipboardItems) {
      const imageType = item.types.find((type) => type.startsWith('image/'));
      if (!imageType) continue;

      const blob = await item.getType(imageType);
      const base64 = await blobToBase64(blob);

      return {
        base64,
        mimeType: imageType,
        size: blob.size,
      };
    }

    return null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not allowed') || message.includes('permission')) {
      throw new Error('剪贴板读取权限被拒绝');
    }
    throw new Error(`读取剪贴板图片失败: ${message}`);
  }
}

/**
 * 通过浏览器 Web API 读取剪贴板中的文本
 */
export async function readTextFromClipboardWeb(): Promise<string | null> {
  if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
    return null;
  }
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

/**
 * 通过浏览器 Web API 读取剪贴板中的所有图片 Blob
 */
export async function readAllImagesFromClipboard(): Promise<ClipboardImageBlob[]> {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
    throw new Error('当前环境不支持 Clipboard API');
  }

  const results: ClipboardImageBlob[] = [];
  const clipboardItems = await navigator.clipboard.read();

  for (const item of clipboardItems) {
    for (const type of item.types) {
      if (type.startsWith('image/')) {
        const blob = await item.getType(type);
        results.push({ blob, mimeType: type });
      }
    }
  }

  return results;
}

// ============================================================
// 图片保存到本地文件系统
// ============================================================

/**
 * 将剪贴板图片保存到本地文件系统
 * 通过 Tauri 命令将 base64 数据写入 app_data_dir/clipboard_images/
 * @param imageInfo 图片信息（包含 base64 数据）
 * @param fileName 可选的文件名（不含扩展名）
 * @returns 保存后的本地文件绝对路径
 */
export async function saveClipboardImageToDisk(
  imageInfo: ClipboardImageInfo,
  fileName?: string,
): Promise<string> {
  return await invoke<string>('save_clipboard_image_to_file', {
    base64Data: imageInfo.base64,
    fileName,
  });
}

/**
 * 将剪贴板图片保存到本地（便捷函数：读取 + 保存一步到位）
 */
export async function captureAndSaveClipboardImage(fileName?: string): Promise<{
  path: string;
  mimeType: string;
  size: number;
}> {
  const imageInfo = await readImageFromClipboardWeb();
  if (!imageInfo) {
    throw new Error('剪贴板中没有图片');
  }

  const path = await saveClipboardImageToDisk(imageInfo, fileName);
  return {
    path,
    mimeType: imageInfo.mimeType,
    size: imageInfo.size,
  };
}

// ============================================================
// 剪贴板历史记录操作（通过 Tauri 命令）
// ============================================================

/** 获取剪贴板历史记录 */
export async function getClipboardHistory(limit?: number) {
  return await invoke<Array<{
    id: string;
    content: string;
    content_type: string;
    created_at: string;
  }>>('get_clipboard_history', { limit });
}

/** 添加剪贴板条目到历史记录 */
export async function addClipboardEntry(entry: {
  id: string;
  content: string;
  content_type: string;
  created_at: string;
}): Promise<void> {
  await invoke('add_clipboard_entry', { entry });
}

/** 清空剪贴板历史记录 */
export async function clearClipboardHistory(): Promise<void> {
  await invoke('clear_clipboard_history');
}

// ============================================================
// 本地剪贴板图片文件 & 打开文件（通过 Tauri 命令）
// ============================================================

/** 用系统默认程序打开文件 */
export async function clipboardOpenFile(path: string): Promise<void> {
  await invoke('clipboard_open_file', { path });
}

/** 在资源管理器中定位并选中文件 */
export async function clipboardOpenFileLocation(path: string): Promise<void> {
  await invoke('clipboard_open_file_location', { path });
}

/** 读取本地剪贴板图片文件为 base64 data URL（用于渲染缩略图） */
export async function readLocalClipboardImage(name: string): Promise<string> {
  return await invoke<string>('clipboard_read_local_image', { name });
}

/** 删除本地剪贴板图片文件 */
export async function deleteLocalClipboardImage(name: string): Promise<void> {
  await invoke('clipboard_delete_local_image', { name });
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 将 Blob 转换为 Base64 字符串（不含 data: URI 前缀）
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 将 Base64 字符串转为 data: URI
 */
export function base64ToDataUri(base64: string, mimeType: string = 'image/png'): string {
  return `data:${mimeType};base64,${base64}`;
}

/**
 * 检测剪贴板图片支持情况
 */
export function detectClipboardSupport(): {
  webClipboardRead: boolean;
  webClipboardWrite: boolean;
  tauriClipboard: boolean;
} {
  return {
    webClipboardRead: typeof navigator !== 'undefined'
      && 'clipboard' in navigator
      && typeof navigator.clipboard?.read === 'function',
    webClipboardWrite: typeof navigator !== 'undefined'
      && 'clipboard' in navigator
      && typeof navigator.clipboard?.write === 'function',
    tauriClipboard: typeof window !== 'undefined'
      && '__TAURI_INTERNALS__' in window,
  };
}

// ============================================================
// 进阶剪贴板能力：格式探测 / 监听 / OCR / 贴图浮动窗口 / 全局快捷键
// ============================================================

/** 剪贴板格式探测结果 */
export interface ClipboardInspect {
  seq: number;
  has_text: boolean;
  has_image: boolean;
  has_files: boolean;
  files: string[];
}

/** 一次 IPC 同时探测剪贴板当前格式（文本/图片/文件） */
export async function inspectClipboard(): Promise<ClipboardInspect> {
  return await invoke<ClipboardInspect>('clipboard_inspect');
}

/** 启动剪贴板事件监听，变化时后端 emit `yx-clipboard-changed` */
export async function startClipboardListener(): Promise<void> {
  await invoke('clipboard_start_listener');
}

/** 查询剪贴板监听是否已开启（供 UI 开关按钮/提示条实时反映状态） */
export async function isClipboardListening(): Promise<boolean> {
  return await invoke<boolean>('clipboard_listener_status');
}

/** 读取剪贴板图片为 PNG base64 data URL（clipboard-win 直接读 CF_DIB 更稳定） */
export async function readClipboardImagePng(): Promise<string | null> {
  return await invoke<string | null>('clipboard_read_image_png');
}

/** 对 base64 图片执行系统 OCR，返回识别文本 */
export async function ocrClipboardImage(base64Data: string): Promise<string> {
  return await invoke<string>('clipboard_ocr_image', { base64Data });
}

/** 创建桌面浮动图片贴图窗口（imageData 为 base64 或 data URL） */
export async function pinClipboardImage(params: {
  id: string;
  imageData: string;
  x: number;
  y: number;
  w: number;
  h: number;
}): Promise<void> {
  await invoke('clipboard_pin_image', {
    id: params.id,
    imageData: params.imageData,
    x: params.x,
    y: params.y,
    w: params.w,
    h: params.h,
  });
}

/** 创建桌面浮动文本贴图窗口 */
export async function pinClipboardText(params: {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}): Promise<void> {
  await invoke('clipboard_pin_text', {
    id: params.id,
    text: params.text,
    x: params.x,
    y: params.y,
    w: params.w,
    h: params.h,
  });
}

/** 取出贴图窗口注入数据（一次性） */
export async function getPinPath(label: string): Promise<string | null> {
  return await invoke<string | null>('clipboard_get_pin_path', { label });
}

/** 关闭贴图窗口（id 为窗口 id，非完整 label） */
export async function unpinClipboardImage(id: string): Promise<void> {
  await invoke('clipboard_unpin_image', { id });
}

/** 设置贴图窗口透明度（0.3 ~ 1.0），label 为窗口完整 label */
export async function setPinOpacity(label: string, opacity: number): Promise<void> {
  await invoke('clipboard_set_pin_opacity', { label, opacity });
}

/** 为剪贴板项注册全局快捷键（触发时 emit `yx-clipboard-shortcut`，payload 为 id） */
export async function registerClipboardShortcut(id: string, shortcut: string): Promise<void> {
  await invoke('clipboard_register_shortcut', { id, shortcutStr: shortcut });
}

/** 注销剪贴板项的全局快捷键 */
export async function unregisterClipboardShortcut(shortcut: string): Promise<void> {
  await invoke('clipboard_unregister_shortcut', { shortcutStr: shortcut });
}
