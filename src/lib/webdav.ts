// ============================================================
// WebDAV 客户端 - 完整实现
// 支持：笔记、便签、设置的同步
// ============================================================

export interface WebDavConfig {
  url: string;
  username: string;
  password: string;
}

export interface WebDavFile {
  href: string;
  name: string;
  isDirectory: boolean;
  size: number;
  lastModified: string;
  contentType?: string;
  etag?: string;
}

export interface SyncConflict {
  file: WebDavFile;
  localContent: string;
  remoteContent: string;
  localModified: string;
  remoteModified: string;
}

export type ConflictStrategy = 'local' | 'remote' | 'manual' | 'both';

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  conflicts: SyncConflict[];
  deleted: number;
  errors: string[];
}

export interface SyncProgress {
  phase: 'idle' | 'connecting' | 'listing' | 'comparing' | 'uploading' | 'downloading' | 'done' | 'error';
  current: number;
  total: number;
  message: string;
}

// 同步数据类型
export type SyncDataType = 'notes' | 'stickies' | 'settings';

export interface FullSyncResult {
  notes: SyncResult;
  stickies: SyncResult;
  settings: SyncResult;
  totalErrors: string[];
}

function getAuthHeader(config: WebDavConfig): string {
  const token = btoa(config.username + ':' + config.password);
  return 'Basic ' + token;
}

function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url : url + '/';
}

/** 判定远端修改时间是否晚于增量起点（兼容 HTTP 日期与 ISO 时间戳） */
function isRemoteNewer(remoteModified: string, since: string): boolean {
  const rm = Date.parse(remoteModified);
  const ref = Date.parse(since);
  if (Number.isNaN(rm) || Number.isNaN(ref)) return true; // 无法解析时保守下载
  return rm > ref;
}

const PROP_FIND_BODY = '<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:prop><D:resourcetype/></D:prop></D:propfind>';
const PROP_FIND_ALL_BODY = '<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:prop><D:resourcetype/><D:getcontentlength/><D:getlastmodified/><D:getcontenttype/><D:getetag/><D:displayname/></D:prop></D:propfind>';

function parsePropfindXml(xmlText: string): WebDavFile[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const responses = doc.querySelectorAll('response');
  const files: WebDavFile[] = [];

  responses.forEach((resp, index) => {
    if (index === 0) return;
    const href = resp.querySelector('href')?.textContent ?? '';
    const propstat = resp.querySelector('propstat');
    if (!propstat) return;
    const prop = propstat.querySelector('prop');
    if (!prop) return;

    const isCollection = prop.querySelector('resourcetype collection') !== null;
    const displayName = prop.querySelector('displayname')?.textContent || '';
    const contentLength = prop.querySelector('getcontentlength')?.textContent || '0';
    const lastModified = prop.querySelector('getlastmodified')?.textContent || '';
    const contentType = prop.querySelector('getcontenttype')?.textContent || undefined;
    const etag = prop.querySelector('getetag')?.textContent || undefined;
    const name = displayName || href.split('/').filter(Boolean).pop() || '';

    files.push({
      href,
      name,
      isDirectory: isCollection,
      size: parseInt(contentLength, 10) || 0,
      lastModified,
      contentType,
      etag,
    });
  });

  return files;
}

async function webdavRequest(
  config: WebDavConfig,
  method: string,
  path: string,
  options: {
    body?: string | ArrayBuffer;
    headers?: Record<string, string>;
    responseType?: 'text' | 'arraybuffer';
  } = {},
): Promise<{ status: number; headers: Headers; data: string | ArrayBuffer }> {
  const url = normalizeUrl(config.url) + path.replace(/^\//, '');
  const authHeader = getAuthHeader(config);
  const headers: Record<string, string> = {
    Authorization: authHeader,
    ...options.headers,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: options.body,
  });

  if (!response.ok && response.status !== 404) {
    throw new Error('WebDAV ' + method + ' failed: ' + response.status + ' ' + response.statusText);
  }

  const data = options.responseType === 'arraybuffer'
    ? await response.arrayBuffer()
    : await response.text();

  return {
    status: response.status,
    headers: response.headers,
    data,
  };
}

// ── 基础操作 ──

export async function testConnection(config: WebDavConfig): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const result = await webdavRequest(config, 'PROPFIND', '/', {
      headers: {
        Depth: '0',
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body: PROP_FIND_BODY,
    });

    if (result.status === 200 || result.status === 207) {
      return { success: true, message: '连接成功' };
    }
    return { success: false, message: '服务器返回 ' + result.status };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '连接失败',
    };
  }
}

export async function listFiles(
  config: WebDavConfig,
  path: string = '/',
): Promise<WebDavFile[]> {
  const result = await webdavRequest(config, 'PROPFIND', path, {
    headers: {
      Depth: 'infinity',
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body: PROP_FIND_ALL_BODY,
  });

  if (result.status !== 207) {
    throw new Error('PROPFIND failed: ' + result.status);
  }

  return parsePropfindXml(result.data as string);
}

export async function downloadFile(
  config: WebDavConfig,
  path: string,
): Promise<string> {
  const result = await webdavRequest(config, 'GET', path);
  return result.data as string;
}

export async function uploadFile(
  config: WebDavConfig,
  path: string,
  content: string,
  contentType: string = 'text/markdown; charset=utf-8',
): Promise<void> {
  await webdavRequest(config, 'PUT', path, {
    body: content,
    headers: {
      'Content-Type': contentType,
    },
  });
}

export async function deleteFile(
  config: WebDavConfig,
  path: string,
): Promise<void> {
  await webdavRequest(config, 'DELETE', path);
}

export async function createDirectory(
  config: WebDavConfig,
  path: string,
): Promise<void> {
  await webdavRequest(config, 'MKCOL', path);
}

export async function fileExists(
  config: WebDavConfig,
  path: string,
): Promise<boolean> {
  try {
    const result = await webdavRequest(config, 'PROPFIND', path, {
      headers: {
        Depth: '0',
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body: PROP_FIND_BODY,
    });
    return result.status === 207;
  } catch {
    return false;
  }
}

// ── 笔记序列化 ──

function serializeNote(note: { id: string; title: string; content: string; tags: string[]; updatedAt: string }): string {
  const frontmatter = [
    '---',
    'id: ' + note.id,
    'title: ' + note.title,
    'tags: [' + note.tags.join(', ') + ']',
    'updated: ' + note.updatedAt,
    '---',
    '',
  ].join('\n');
  return frontmatter + note.content;
}

function deserializeNote(content: string, fileName: string): { id: string; title: string; content: string; tags: string[] } {
  let id = '';
  let title = fileName.replace(/\.md$/, '');
  let tags: string[] = [];
  let body = content;

  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end !== -1) {
      const fm = content.substring(3, end);
      body = content.substring(end + 4).trim();
      const lines = fm.split('\n');
      for (const line of lines) {
        if (line.startsWith('id:')) id = line.substring(3).trim();
        else if (line.startsWith('title:')) title = line.substring(6).trim();
        else if (line.startsWith('tags:')) {
          const tagStr = line.substring(5).trim();
          tags = tagStr.replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(Boolean);
        }
      }
    }
  }

  return { id, title, content: body, tags };
}

// ── 便签序列化 ──

function serializeSticky(sticky: { id: string; content: string; color: string; x: number; y: number; width: number; height: number; isPinned: boolean; updatedAt: string }): string {
  return JSON.stringify({
    id: sticky.id,
    content: sticky.content,
    color: sticky.color,
    x: sticky.x,
    y: sticky.y,
    width: sticky.width,
    height: sticky.height,
    is_pinned: sticky.isPinned,
    updated_at: sticky.updatedAt,
  }, null, 2);
}

function deserializeSticky(json: string, fileName: string): { id: string; content: string; color: string; x: number; y: number; width: number; height: number; isPinned: boolean; updatedAt: string } {
  try {
    const data = JSON.parse(json);
    return {
      id: data.id || fileName.replace(/\.json$/, ''),
      content: data.content || '',
      color: data.color || '#FEF08A',
      x: data.x ?? 100,
      y: data.y ?? 100,
      width: data.width ?? 200,
      height: data.height ?? 200,
      isPinned: data.is_pinned ?? false,
      updatedAt: data.updated_at || new Date().toISOString(),
    };
  } catch {
    return {
      id: fileName.replace(/\.json$/, ''),
      content: '',
      color: '#FEF08A',
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      isPinned: false,
      updatedAt: new Date().toISOString(),
    };
  }
}

// ── 设置序列化 ──

function serializeSettings(settings: Record<string, string>): string {
  return JSON.stringify(settings, null, 2);
}

function deserializeSettings(json: string): Record<string, string> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

// ── 笔记同步 ──

export async function syncNotes(
  config: WebDavConfig,
  localNotes: Array<{ id: string; title: string; content: string; tags: string[]; updatedAt: string }>,
  strategy: ConflictStrategy = 'manual',
  since?: string,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncResult> {
  const result: SyncResult = {
    uploaded: 0,
    downloaded: 0,
    conflicts: [],
    deleted: 0,
    errors: [],
  };

  onProgress?.({ phase: 'connecting', current: 0, total: 0, message: '正在连接...' });

  const testResult = await testConnection(config);
  if (!testResult.success) {
    result.errors.push(testResult.message);
    onProgress?.({ phase: 'error', current: 0, total: 0, message: testResult.message });
    return result;
  }

  onProgress?.({ phase: 'listing', current: 0, total: 0, message: '正在获取远程文件列表...' });

  // 确保目录存在
  const notesDirExists = await fileExists(config, '/notes');
  if (!notesDirExists) {
    try {
      await createDirectory(config, '/notes');
    } catch (e) {
      result.errors.push('创建笔记目录失败');
    }
  }

  const remoteFiles = await listFiles(config, '/notes');
  const remoteNotes = remoteFiles.filter(f => f.name.endsWith('.md'));

  onProgress?.({ phase: 'comparing', current: 0, total: localNotes.length, message: '正在比较...' });

  for (let i = 0; i < localNotes.length; i++) {
    const note = localNotes[i];
    const fileName = note.id + '.md';
    const remoteFile = remoteNotes.find(f => f.name === fileName);

    onProgress?.({ phase: 'comparing', current: i, total: localNotes.length, message: '正在处理: ' + note.title });

    // 增量：本地对象自上次同步后未变更，且远端已存在 → 跳过，避免无谓传比较
    if (since && remoteFile && note.updatedAt <= since) {
      continue;
    }

    if (!remoteFile) {
      try {
        await uploadFile(config, '/notes/' + fileName, serializeNote(note));
        result.uploaded++;
      } catch {
        result.errors.push('上传失败: ' + note.title);
      }
    } else {
      try {
        const remoteContent = await downloadFile(config, remoteFile.href);
        const remoteNote = deserializeNote(remoteContent, remoteFile.name);

        if (note.content !== remoteNote.content) {
          const conflict: SyncConflict = {
            file: remoteFile,
            localContent: note.content,
            remoteContent: remoteNote.content,
            localModified: note.updatedAt,
            remoteModified: remoteFile.lastModified,
          };
          result.conflicts.push(conflict);

          if (strategy === 'local') {
            await uploadFile(config, '/notes/' + fileName, serializeNote(note));
            result.uploaded++;
          } else if (strategy === 'remote') {
            // Remote wins, will be handled in download phase
          }
        }
      } catch {
        result.errors.push('比较失败: ' + note.title);
      }
    }
  }

  for (const remoteFile of remoteNotes) {
    const localExists = localNotes.some(n => n.id + '.md' === remoteFile.name);
    if (!localExists) {
      // 远端存在、本地无对应：
      //  - 若远端在增量窗口内被改过（比 since 新）→ 视为远端新增，下载合并
      //  - 若远端自上次同步后未变更（比 since 旧）→ 说明本地已删除，增量删掉远端孤儿
      if (since && remoteFile.lastModified && !isRemoteNewer(remoteFile.lastModified, since)) {
        try {
          await deleteFile(config, '/notes/' + remoteFile.name);
          result.deleted++;
          continue;
        } catch {
          result.errors.push('删除远端笔记失败: ' + remoteFile.name);
          continue;
        }
      }
      try {
        const content = await downloadFile(config, remoteFile.href);
        deserializeNote(content, remoteFile.name);
        result.downloaded++;
      } catch {
        result.errors.push('下载失败: ' + remoteFile.name);
      }
    }
  }

  onProgress?.({ phase: 'done', current: 0, total: 0, message: '同步完成' });
  return result;
}

// ── 便签同步 ──

export async function syncStickies(
  config: WebDavConfig,
  localStickies: Array<{ id: string; content: string; color: string; x: number; y: number; width: number; height: number; isPinned: boolean; updatedAt: string }>,
  strategy: ConflictStrategy = 'manual',
  since?: string,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncResult> {
  const result: SyncResult = {
    uploaded: 0,
    downloaded: 0,
    conflicts: [],
    deleted: 0,
    errors: [],
  };

  onProgress?.({ phase: 'connecting', current: 0, total: 0, message: '正在连接...' });

  const testResult = await testConnection(config);
  if (!testResult.success) {
    result.errors.push(testResult.message);
    onProgress?.({ phase: 'error', current: 0, total: 0, message: testResult.message });
    return result;
  }

  onProgress?.({ phase: 'listing', current: 0, total: 0, message: '正在获取便签列表...' });

  // 确保目录存在
  const stickiesDirExists = await fileExists(config, '/stickies');
  if (!stickiesDirExists) {
    try {
      await createDirectory(config, '/stickies');
    } catch {
      result.errors.push('创建便签目录失败');
    }
  }

  const remoteFiles = await listFiles(config, '/stickies');
  const remoteStickies = remoteFiles.filter(f => f.name.endsWith('.json'));

  onProgress?.({ phase: 'comparing', current: 0, total: localStickies.length, message: '正在比较便签...' });

  for (let i = 0; i < localStickies.length; i++) {
    const sticky = localStickies[i];
    const fileName = sticky.id + '.json';
    const remoteFile = remoteStickies.find(f => f.name === fileName);

    onProgress?.({ phase: 'comparing', current: i, total: localStickies.length, message: `便签 ${i + 1}/${localStickies.length}` });

    // 增量：本地未变更且远端已存在 → 跳过
    if (since && remoteFile && sticky.updatedAt <= since) {
      continue;
    }

    if (!remoteFile) {
      try {
        await uploadFile(config, '/stickies/' + fileName, serializeSticky(sticky), 'application/json; charset=utf-8');
        result.uploaded++;
      } catch {
        result.errors.push('上传便签失败: ' + sticky.id);
      }
    } else {
      try {
        const remoteContent = await downloadFile(config, remoteFile.href);
        const remoteSticky = deserializeSticky(remoteContent, remoteFile.name);

        if (sticky.updatedAt !== remoteSticky.updatedAt) {
          const conflict: SyncConflict = {
            file: remoteFile,
            localContent: sticky.content,
            remoteContent: remoteSticky.content,
            localModified: sticky.updatedAt,
            remoteModified: remoteFile.lastModified,
          };
          result.conflicts.push(conflict);

          if (strategy === 'local') {
            await uploadFile(config, '/stickies/' + fileName, serializeSticky(sticky), 'application/json; charset=utf-8');
            result.uploaded++;
          }
        }
      } catch {
        result.errors.push('比较便签失败: ' + sticky.id);
      }
    }
  }

  for (const remoteFile of remoteStickies) {
    const localExists = localStickies.some(s => s.id + '.json' === remoteFile.name);
    if (!localExists) {
      // 远端存在、本地无对应：
      //  - 远端比 since 新 → 远端新增，下载合并
      //  - 远端自上次同步未变更（比 since 旧）→ 本地已删除，增量删远端孤儿
      if (since && remoteFile.lastModified && !isRemoteNewer(remoteFile.lastModified, since)) {
        try {
          await deleteFile(config, '/stickies/' + remoteFile.name);
          result.deleted++;
          continue;
        } catch {
          result.errors.push('删除远端便签失败: ' + remoteFile.name);
          continue;
        }
      }
      try {
        await downloadFile(config, remoteFile.href);
        result.downloaded++;
      } catch {
        result.errors.push('下载便签失败: ' + remoteFile.name);
      }
    }
  }

  onProgress?.({ phase: 'done', current: 0, total: 0, message: '便签同步完成' });
  return result;
}

// ── 设置同步 ──

export async function syncSettings(
  config: WebDavConfig,
  localSettings: Record<string, string>,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncResult> {
  const result: SyncResult = {
    uploaded: 0,
    downloaded: 0,
    conflicts: [],
    deleted: 0,
    errors: [],
  };

  onProgress?.({ phase: 'connecting', current: 0, total: 0, message: '正在连接...' });

  const testResult = await testConnection(config);
  if (!testResult.success) {
    result.errors.push(testResult.message);
    onProgress?.({ phase: 'error', current: 0, total: 0, message: testResult.message });
    return result;
  }

  onProgress?.({ phase: 'comparing', current: 0, total: 1, message: '正在同步设置...' });

  const settingsPath = '/settings/app_settings.json';
  const settingsExists = await fileExists(config, settingsPath);

  if (settingsExists) {
    try {
      const remoteContent = await downloadFile(config, settingsPath);
      const remoteSettings = deserializeSettings(remoteContent);

      // 合并设置：本地优先
      const merged = { ...remoteSettings, ...localSettings };
      await uploadFile(config, settingsPath, serializeSettings(merged), 'application/json; charset=utf-8');
      result.uploaded = 1;
    } catch {
      result.errors.push('设置同步失败');
    }
  } else {
    try {
      await uploadFile(config, settingsPath, serializeSettings(localSettings), 'application/json; charset=utf-8');
      result.uploaded = 1;
    } catch {
      result.errors.push('上传设置失败');
    }
  }

  onProgress?.({ phase: 'done', current: 0, total: 0, message: '设置同步完成' });
  return result;
}

// ── 完整同步 ──

export async function syncAll(
  config: WebDavConfig,
  data: {
    notes: Array<{ id: string; title: string; content: string; tags: string[]; updatedAt: string }>;
    stickies: Array<{ id: string; content: string; color: string; x: number; y: number; width: number; height: number; isPinned: boolean; updatedAt: string }>;
    settings: Record<string, string>;
  },
  strategy: ConflictStrategy = 'manual',
  since?: string,
  onProgress?: (dataType: SyncDataType, progress: SyncProgress) => void,
): Promise<FullSyncResult> {
  const result: FullSyncResult = {
    notes: { uploaded: 0, downloaded: 0, conflicts: [], deleted: 0, errors: [] },
    stickies: { uploaded: 0, downloaded: 0, conflicts: [], deleted: 0, errors: [] },
    settings: { uploaded: 0, downloaded: 0, conflicts: [], deleted: 0, errors: [] },
    totalErrors: [],
  };

  // 同步笔记
  try {
    result.notes = await syncNotes(
      config,
      data.notes,
      strategy,
      since,
      (p) => onProgress?.('notes', p),
    );
  } catch (e) {
    result.notes.errors.push(e instanceof Error ? e.message : '笔记同步失败');
  }

  // 同步便签
  try {
    result.stickies = await syncStickies(
      config,
      data.stickies,
      strategy,
      since,
      (p) => onProgress?.('stickies', p),
    );
  } catch (e) {
    result.stickies.errors.push(e instanceof Error ? e.message : '便签同步失败');
  }

  // 同步设置
  try {
    result.settings = await syncSettings(
      config,
      data.settings,
      (p) => onProgress?.('settings', p),
    );
  } catch (e) {
    result.settings.errors.push(e instanceof Error ? e.message : '设置同步失败');
  }

  // 汇总错误
  result.totalErrors = [
    ...result.notes.errors,
    ...result.stickies.errors,
    ...result.settings.errors,
  ];

  return result;
}

// ── 远程设置导入 ──

export async function downloadSettings(config: WebDavConfig): Promise<Record<string, string> | null> {
  const settingsPath = '/settings/app_settings.json';
  try {
    const exists = await fileExists(config, settingsPath);
    if (!exists) return null;
    const content = await downloadFile(config, settingsPath);
    return deserializeSettings(content);
  } catch {
    return null;
  }
}

// ── 冲突写回执行（阶段3） ──

export interface ConflictResolutionResult {
  choice: ConflictStrategy;
  /** 远程版本内容（choice=remote 时用于覆盖本地；both 时用于本地归档） */
  adoptedRemote?: string;
  /** 是否已把本地内容回写到远端 */
  wroteRemote: boolean;
}

/** 根据冲突文件名判断所属目录（.md → notes，.json → stickies） */
function conflictDir(fileName: string): '/notes' | '/stickies' {
  return fileName.endsWith('.md') ? '/notes' : '/stickies';
}

/**
 * 将用户在冲突解决器里的选择真正写回 WebDAV：
 * - local  → 把本地内容 PUT 回远端（本地胜出）
 * - remote → 不写远端，返回远端内容供本地覆盖
 * - both   → 保留双方：把本地回写远端，同时返回远端内容供本地归档
 */
export async function applyConflictResolution(
  config: WebDavConfig,
  conflict: SyncConflict,
  choice: Exclude<ConflictStrategy, 'manual'>,
): Promise<ConflictResolutionResult> {
  const basePath = `${conflictDir(conflict.file.name)}/${conflict.file.name}`;

  if (choice === 'remote') {
    // 远端胜出：不写远端，把远端内容交给本地
    return { choice, adoptedRemote: conflict.remoteContent, wroteRemote: false };
  }

  if (choice === 'both') {
    // 双方保留：本地回写为远端主版本，同时返回远端内容供本地归档
    await uploadFile(
      config,
      basePath,
      conflict.localContent,
      conflict.file.contentType ?? 'text/markdown; charset=utf-8',
    );
    return { choice, adoptedRemote: conflict.remoteContent, wroteRemote: true };
  }

  // local：本地胜出，回写远端
  await uploadFile(
    config,
    basePath,
    conflict.localContent,
    conflict.file.contentType ?? 'text/markdown; charset=utf-8',
  );
  return { choice, wroteRemote: true };
}
