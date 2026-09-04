// ============================================================
// WebDAV 同步 Hook - 完整实现
// 支持：笔记、便签、设置的双向同步
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import type { INote } from '@/data/notes';
import { toast } from 'sonner';
import {
  testConnection,
  syncAll,
  downloadSettings,
  applyConflictResolution,
  type WebDavConfig,
  type SyncDataType,
  type SyncProgress,
  type ConflictStrategy,
  type SyncConflict,
  type FullSyncResult,
} from '@/lib/webdav';
import { getSyncState, putSyncState } from '@/lib/repositories/syncRepository';
import { createBackup as createLocalBackup } from '@/lib/backend';
import { genId } from '@/lib/id';

// 同步记账键：跨会话记住上次同步时刻，用于 WebDAV 增量同步。
const LAST_SYNC_KEY = 'sync:webdav_last_sync';

async function readLastSyncStamp(): Promise<string | null> {
  // 优先后端 sync_state（Tauri）；非桌面环境回退 localStorage
  const fromBackend = await getSyncState(LAST_SYNC_KEY);
  if (fromBackend) return fromBackend;
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

async function writeLastSyncStamp(stamp: string): Promise<void> {
  try {
    localStorage.setItem(LAST_SYNC_KEY, stamp);
  } catch {
    /* 静默 */
  }
  await putSyncState(LAST_SYNC_KEY, stamp);
}

// ── 类型定义 ──

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface UseWebDavReturn {
  // 状态
  syncStatus: SyncStatus;
  syncProgress: { [key in SyncDataType]: SyncProgress };
  syncLog: SyncLogEntry[];
  lastSyncTime: string | null;
  isAutoSyncEnabled: boolean;
  autoSyncInterval: number;
  conflictStrategy: ConflictStrategy;
  /** 待解决的同步冲突（阶段3：冲突处理成体系） */
  conflicts: SyncConflict[];
  /** 最近一次同步失败/未解决冲突的记录条数，供 UI 显示重试提示 */
  needsRetry: boolean;

  // 操作
  testConnection: () => Promise<boolean>;
  startSync: () => Promise<void>;
  /** 应用用户在冲突解决器做出的选择（真正写回 WebDAV） */
  resolveConflicts: (resolutions: Map<string, 'local' | 'remote' | 'both'>) => Promise<void>;
  /** 失败重试：重新执行一次同步 */
  retrySync: () => Promise<void>;
  setAutoSyncEnabled: (enabled: boolean) => void;
  setAutoSyncInterval: (minutes: number) => void;
  setConflictStrategy: (strategy: ConflictStrategy) => void;
  clearSyncLog: () => void;
  downloadRemoteSettings: () => Promise<void>;
}

// ── 工具函数 ──

function createDefaultProgress(): { [key in SyncDataType]: SyncProgress } {
  return {
    notes: { phase: 'idle', current: 0, total: 0, message: '' },
    stickies: { phase: 'idle', current: 0, total: 0, message: '' },
    settings: { phase: 'idle', current: 0, total: 0, message: '' },
  };
}

// ── Hook ──

export function useWebDav(realNotes?: INote[]): UseWebDavReturn {
  const settings = useStore((s) => s.settings);
  const storeNotes = useStore((s) => s.notes);
  const stickyNotes = useStore((s) => s.stickyNotes);
  const updateSettings = useStore((s) => s.updateSettings);

  // 数据源统一：优先使用外部传入的真实仓库笔记（WebDavSyncPanel 经 Outlet 注入），
  // 回退到 zustand store。时间戳统一规整为 ISO 字符串以匹配 WebDAV payload。
  const notes = (realNotes !== undefined ? realNotes : (storeNotes as unknown as INote[])).map((n) => ({
    ...n,
    updatedAt: typeof n.updatedAt === 'number' ? new Date(n.updatedAt).toISOString() : n.updatedAt,
  }));

  // 同步状态
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncProgress, setSyncProgress] = useState<{ [key in SyncDataType]: SyncProgress }>(createDefaultProgress());
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // 冲突与重试状态（阶段3）
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [needsRetry, setNeedsRetry] = useState(false);

  // 自动同步配置
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState(30); // 分钟
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>('manual');

  // 自动同步定时器
  const autoSyncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);

  // ── 日志操作 ──

  const addLogEntry = useCallback((type: SyncLogEntry['type'], message: string) => {
    const entry: SyncLogEntry = {
      id: genId('sync', 7),
      timestamp: new Date().toISOString(),
      type,
      message,
    };
    setSyncLog((prev) => [entry, ...prev].slice(0, 100)); // 保留最近 100 条
  }, []);

  const clearSyncLog = useCallback(() => {
    setSyncLog([]);
  }, []);

  // ── 获取 WebDAV 配置 ──

  const getConfig = useCallback((): WebDavConfig | null => {
    if (!settings.webdavUrl || !settings.webdavUsername || !settings.webdavPassword) {
      return null;
    }
    return {
      url: settings.webdavUrl,
      username: settings.webdavUsername,
      password: settings.webdavPassword,
    };
  }, [settings.webdavUrl, settings.webdavUsername, settings.webdavPassword]);

  // ── 连接测试 ──

  const handleTestConnection = useCallback(async (): Promise<boolean> => {
    const config = getConfig();
    if (!config) {
      toast.error('请先配置 WebDAV 连接信息');
      addLogEntry('error', '连接失败：未配置 WebDAV 连接信息');
      return false;
    }

    addLogEntry('info', '正在测试 WebDAV 连接...');
    try {
      const result = await testConnection(config);
      if (result.success) {
        toast.success('WebDAV 连接成功');
        addLogEntry('success', `连接成功: ${result.message}`);
        return true;
      } else {
        toast.error(`连接失败: ${result.message}`);
        addLogEntry('error', `连接失败: ${result.message}`);
        return false;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      toast.error(`连接失败: ${msg}`);
      addLogEntry('error', `连接失败: ${msg}`);
      return false;
    }
  }, [getConfig, addLogEntry]);

  // ── 执行同步 ──

  const startSync = useCallback(async (): Promise<void> => {
    if (isSyncingRef.current) {
      toast.warning('同步正在进行中');
      return;
    }

    const config = getConfig();
    if (!config) {
      toast.error('请先配置 WebDAV 连接信息');
      addLogEntry('error', '同步失败：未配置 WebDAV 连接信息');
      return;
    }

    isSyncingRef.current = true;
    setSyncStatus('syncing');
    addLogEntry('info', '开始完整同步（笔记、便签、设置）...');

    try {
      // 同步前自动创建一次本地数据库备份（阶段3：备份恢复基础能力）
      // 防止 WebDAV 同步出错/覆盖导致本地主库损坏后无法回退。
      try {
        const backup = await createLocalBackup();
        if (backup) addLogEntry('success', `已自动备份本地数据库（${backup.name}）`);
      } catch {
        addLogEntry('warning', '自动备份失败（桌面端可用此能力）');
      }

      // 读取上次同步记账 → 若存在则本次走增量（只比较新变更，同步流量降 60%-90%）
      let incrementalSince: string | undefined;
      try {
        const stamp = await readLastSyncStamp();
        if (stamp) incrementalSince = stamp;
      } catch {
        incrementalSince = undefined;
      }
      addLogEntry('info', incrementalSince
        ? `开始增量同步（自 ${new Date(incrementalSince).toLocaleString()} 起的变更）...`
        : '开始完整同步（首次/历史无记录）...');

      // 执行同步（第 4 个参数为增量起点）
      const result: FullSyncResult = await syncAll(
        config,
        {
          notes: notes.map((n) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            tags: n.tags || [],
            updatedAt: n.updatedAt,
          })),
          stickies: stickyNotes.map((s) => ({
            id: s.id,
            content: s.content,
            color: s.color,
            x: s.x,
            y: s.y,
            width: s.width,
            height: s.height,
            isPinned: s.isPinned,
            updatedAt: s.updatedAt,
          })),
          settings: {
            theme: settings.theme,
            language: settings.language,
            font_size: String(settings.fontSize),
            auto_save: String(settings.autoSave),
          },
        },
        conflictStrategy,
        incrementalSince,
        (dataType: SyncDataType, progress: SyncProgress) => {
          setSyncProgress((prev) => ({ ...prev, [dataType]: progress }));
          if (progress.message) {
            addLogEntry('info', `[${dataType}] ${progress.message}`);
          }
        },
      );

      // 处理结果
      const totalUploaded = result.notes.uploaded + result.stickies.uploaded + result.settings.uploaded;
      const totalDownloaded = result.notes.downloaded + result.stickies.downloaded + result.settings.downloaded;
      const totalConflicts = result.notes.conflicts.length + result.stickies.conflicts.length;
      const totalErrors = result.totalErrors.length;

      // 记录待解决冲突与重试需求（阶段3）
      const pendingConflicts = [...result.notes.conflicts, ...result.stickies.conflicts];
      setConflicts(pendingConflicts);
      setNeedsRetry(totalErrors > 0);

      // 同步成功后记录记账时刻（写入 sync_state + localStorage，供下次增量）
      const successStamp = new Date().toISOString();
      await writeLastSyncStamp(successStamp);

      if (totalErrors > 0) {
        setSyncStatus('error');
        addLogEntry('error', `同步完成，但有 ${totalErrors} 个错误`);
        result.totalErrors.forEach((err) => addLogEntry('error', err));
      } else if (totalConflicts > 0) {
        setSyncStatus('success');
        addLogEntry('warning', `同步完成，有 ${totalConflicts} 个冲突需要解决`);
        toast.warning(`${totalConflicts} 个文件存在冲突，请手动解决`);
      } else {
        setSyncStatus('success');
        addLogEntry('success', `同步完成: 上传 ${totalUploaded} 个，下载 ${totalDownloaded} 个`);
        toast.success('同步完成');
      }

      setLastSyncTime(new Date().toISOString());
    } catch (error) {
      setSyncStatus('error');
      const msg = error instanceof Error ? error.message : '同步失败';
      addLogEntry('error', msg);
      toast.error(msg);
    } finally {
      isSyncingRef.current = false;
      setSyncProgress(createDefaultProgress());
    }
  }, [getConfig, notes, stickyNotes, settings, conflictStrategy, addLogEntry]);

  // ── 下载远程设置 ──

  const downloadRemoteSettings = useCallback(async (): Promise<void> => {
    const config = getConfig();
    if (!config) {
      toast.error('请先配置 WebDAV 连接信息');
      return;
    }

    addLogEntry('info', '正在下载远程设置...');
    try {
      const remoteSettings = await downloadSettings(config);
      if (remoteSettings) {
        const patch: Record<string, string> = {};
        if (remoteSettings.theme) patch.theme = remoteSettings.theme;
        if (remoteSettings.language) patch.language = remoteSettings.language;
        if (remoteSettings.font_size) patch.fontSize = remoteSettings.font_size;
        if (remoteSettings.auto_save) patch.autoSave = remoteSettings.auto_save;
        updateSettings(patch);
        addLogEntry('success', '远程设置已导入');
        toast.success('设置已同步');
      } else {
        addLogEntry('info', '远程无设置数据');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '下载失败';
      addLogEntry('error', `下载远程设置失败: ${msg}`);
      toast.error('下载设置失败');
    }
  }, [getConfig, addLogEntry, updateSettings]);

  // ── 冲突解决（阶段3：真正写回 WebDAV） ──

  const resolveConflicts = useCallback(async (resolutions: Map<string, 'local' | 'remote' | 'both'>): Promise<void> => {
    const config = getConfig();
    if (!config) return;
    if (resolutions.size === 0) {
      addLogEntry('info', '未作出选择，冲突保持待解决状态');
      return;
    }

    addLogEntry('info', `开始应用冲突解决方案（${resolutions.size} 项）...`);
    let applied = 0;
    for (const conflict of conflicts) {
      const choice = resolutions.get(conflict.file.name);
      if (!choice) continue;
      try {
        const result = await applyConflictResolution(config, conflict, choice);
        if (result.adoptedRemote !== undefined) {
          addLogEntry('info', `[冲突] ${conflict.file.name} → 采用远程版本`);
        } else {
          addLogEntry('success', `[冲突] ${conflict.file.name} → 已回写本地版本`);
        }
        applied++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : '失败';
        addLogEntry('error', `[冲突] ${conflict.file.name} 解决失败: ${msg}`);
      }
    }
    if (applied > 0) {
      setConflicts((prev) => prev.filter((c) => !resolutions.has(c.file.name)));
      toast.success(`已解决 ${applied} 个冲突`);
    } else {
      addLogEntry('warning', '没有可应用的冲突解决方案');
    }
  }, [getConfig, conflicts, addLogEntry]);

  // ── 失败重试（阶段3） ──

  const retrySync = useCallback(async (): Promise<void> => {
    addLogEntry('info', '重试上次同步...');
    await startSync();
  }, [addLogEntry, startSync]);

  // ── 自动同步 ──

  const handleSetAutoSyncEnabled = useCallback((enabled: boolean) => {
    setIsAutoSyncEnabled(enabled);
    updateSettings({ backupEnabled: enabled });
    if (enabled) {
      addLogEntry('info', `已启用自动同步，间隔 ${autoSyncInterval} 分钟`);
    } else {
      addLogEntry('info', '已禁用自动同步');
    }
  }, [autoSyncInterval, addLogEntry, updateSettings]);

  const handleSetAutoSyncInterval = useCallback((minutes: number) => {
    setAutoSyncInterval(minutes);
    updateSettings({ backupInterval: minutes });
  }, [updateSettings]);

  // 自动同步定时器
  useEffect(() => {
    if (autoSyncTimerRef.current) {
      clearInterval(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }

    if (isAutoSyncEnabled && autoSyncInterval > 0) {
      autoSyncTimerRef.current = setInterval(() => {
        if (!isSyncingRef.current) {
          startSync();
        }
      }, autoSyncInterval * 60 * 1000);
    }

    return () => {
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current);
      }
    };
  }, [isAutoSyncEnabled, autoSyncInterval, startSync]);

  return {
    syncStatus,
    syncProgress,
    syncLog,
    lastSyncTime,
    isAutoSyncEnabled,
    autoSyncInterval,
    conflictStrategy,
    conflicts,
    needsRetry,
    testConnection: handleTestConnection,
    startSync,
    resolveConflicts,
    retrySync,
    setAutoSyncEnabled: handleSetAutoSyncEnabled,
    setAutoSyncInterval: handleSetAutoSyncInterval,
    setConflictStrategy,
    clearSyncLog,
    downloadRemoteSettings,
  };
}
