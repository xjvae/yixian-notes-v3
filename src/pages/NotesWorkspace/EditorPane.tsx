// 笔记编辑器面板组件（主入口）
//
// 组合式结构，将工具栏、状态栏、标签管理、附件等功能拆分为独立子组件。
// 对外 Props 接口保持不变，外部调用方无需修改。

import { useState, useMemo, useCallback, memo, useRef, useEffect, lazy, Suspense } from 'react';
import {
  FolderOpen,
  Check,
  X,
  Clock,
  History,
  Eye,
  EyeOff,
  Sparkles,
  Wand2,
  Minimize2,
  Maximize2,
  FileText,
  Languages,
  FileEdit,
  ListOrdered,
  Scissors,
  Clipboard,
  ClipboardPaste,
  Table,
  CheckSquare,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  Lock,
  Unlock,
  KeyRound,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from '@/components/ui/context-menu';
const AIAssistantPanel = lazy(() => import('@/components/AIAssistantPanel'));
import { MOCK_NOTEBOOKS, MOCK_TAGS, MOCK_NOTES } from '@/data/notes';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { exportAndDownload } from '@/lib/noteExport';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import NoteBreadcrumb from '@/components/NoteBreadcrumb';
import { EditorSkeleton } from '@/components/SkeletonLoaders';

// 子组件
import EditorToolbar from './EditorToolbar';
import EditorStatusBar from './EditorStatusBar';
import EditorTagsPanel from './EditorTagsPanel';
import MarkdownEditorPane from './MarkdownEditor';

// Hooks
import { useEditorSync } from './hooks/useEditorSync';
import { useEditorHistory } from './hooks/useEditorHistory';

// 工具函数
import { htmlToMarkdown, markdownToHtml, markdownToPlainText } from '@/lib/markdown';
import { stripHtmlToText, plainTextToExcerpt } from '@/lib/text';
import { WEATHER_OPTIONS, MOOD_OPTIONS } from '@/lib/noteMeta';
import { isNoteEncrypted } from '@/lib/note-sec';

// 类型
import type { EditorPaneProps, VersionInfo } from './types';

// --- 工具函数 ---

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 5000) return '刚刚';
  if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  return '今天';
}

// --- 主组件 ---

export default memo(function EditorPane({
  note,
  onUpdate,
  onEncrypt,
  onDecrypt,
  onToggleFavorite,
  onDelete,
  onRestore,
  workspaceName = '我的工作区',
  workspaceColor,
  notes = MOCK_NOTES.filter((n) => !n.isDeleted),
  notebooks = MOCK_NOTEBOOKS,
  onNavigateNote,
  onNavigateNotebook,
  isLoading = false,
  onNewNote,
  onOpenNote,
}: EditorPaneProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [insertDialog, setInsertDialog] = useState<{ type: 'link' | 'image' } | null>(null);
  const [insertValue, setInsertValue] = useState('');
  // 编辑模式：富文本 / Markdown 源码
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [mdSource, setMdSource] = useState('');
  // 加密弹窗：mode 为 encrypt（设置口令加密）或 decrypt（输入口令解锁）
  const [encryptDialog, setEncryptDialog] = useState<'encrypt' | 'decrypt' | null>(null);
  const [encryptPassword, setEncryptPassword] = useState('');
  const [encryptConfirm, setEncryptConfirm] = useState('');
  const [encryptBusy, setEncryptBusy] = useState(false);
  const [encryptError, setEncryptError] = useState('');
  // 私密笔记正文遮罩：true=临时显示正文，false=遮罩隐藏
  const [revealedPrivate, setRevealedPrivate] = useState(false);
  // 富文本正文是否为空（用于空状态占位提示）
  const [richEmpty, setRichEmpty] = useState(true);

  // --- 同步 Hook ---
  const {
    saved,
    lastSavedAt,
    wordCount,
    triggerSave,
    handleContentInput,
    setWordCount,
    setSaved,
    setLastSavedAt,
    saveTimerRef,
    resetSaveState,
  } = useEditorSync({
    noteId: note?.id,
    onSave: (updates) => {
      if (note) {
        onUpdate(note.id, updates);
      }
    },
    getEditorHtml: () => editorRef.current?.innerHTML ?? '',
    getEditorText: () => editorRef.current?.innerText ?? '',
    title,
  });

  // --- 撤销重做 Hook ---
  const { canUndo, canRedo, record, undo, redo } = useEditorHistory({
    maxHistory: 50,
    mergeWindowMs: 2000,
    getSnapshot: () => editorRef.current?.innerHTML ?? '',
    applySnapshot: (snapshot) => {
      if (editorRef.current && note) {
        editorRef.current.innerHTML = snapshot;
        const plain = editorRef.current.innerText ?? '';
        const excerpt = plain.slice(0, 80);
        onUpdate(note.id, { content: snapshot, excerpt, updatedAt: Date.now() });
        setWordCount(plain.replace(/\s/g, '').length);
      }
    },
  });

  const handleUndo = useCallback(() => {
    undo();
    toast.info('已撤销');
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
    toast.info('已重做');
  }, [redo]);

  // --- AI 助手 ---
  const getSelectedText = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      return sel.toString().trim();
    }
    return '';
  }, []);

  const handleAIClick = useCallback(() => {
    const text = getSelectedText();
    setSelectedText(text);
    setAiPanelOpen(true);
  }, [getSelectedText]);

  // 点击空白关闭右键菜单
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // AI 接受替换
  const handleAIAccept = useCallback(
    (newText: string) => {
      if (!editorRef.current || !selectedText) return;
      const html = editorRef.current.innerHTML;
      const updated = html.replace(selectedText, newText.replace(/\n/g, '<br/>'));
      editorRef.current.innerHTML = updated;
      const plain = editorRef.current.innerText ?? '';
      const excerpt = plain.slice(0, 80);
      if (note) {
        onUpdate(note.id, { content: updated, excerpt, updatedAt: Date.now() });
      }
      setWordCount(plain.replace(/\s/g, '').length);
      setAiPanelOpen(false);
    },
    [note, onUpdate, selectedText],
  );

  // 右键触发 AI 操作
  const triggerAIAction = useCallback(
    (action: string, text: string) => {
      setSelectedText(text);
      setAiPanelOpen(true);
      setContextMenu(null);
      setTimeout(() => {
        const event = new CustomEvent('ai-quick-action', { detail: { action } });
        window.dispatchEvent(event);
      }, 50);
    },
    [],
  );

  // --- 版本历史 ---
  // 说明：当前没有持久化多版本存储，因此仅展示真实的“当前版本”，
  // 避免用伪造的旧版本误导用户去“恢复”不存在的快照。
  const versions = useMemo<VersionInfo[]>(() => {
    if (!note) return [];
    return [
      { id: 'current', timestamp: note.updatedAt, label: '当前版本', title: note.title, content: note.content, excerpt: note.excerpt, isCurrent: true },
    ];
  }, [note?.id, note?.title, note?.content, note?.excerpt, note?.updatedAt]);

  // --- 切换笔记时重置内容 ---
  useEffect(() => {
    if (note && editorRef.current) {
      editorRef.current.innerHTML = note.content;
    }
    // 切换笔记后回到富文本模式并清空 Markdown 源码
    setIsMarkdownMode(false);
    setMdSource('');
    resetSaveState();
    // 切换后重新同步标题与字数
    if (note) {
      setTitle(note.title);
      const text = note.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
      setWordCount(text.replace(/\s/g, '').length);
      setRichEmpty(!text.trim());
    }
    // 切换笔记后回到"默认遮罩隐藏"私密态
    setRevealedPrivate(false);
  }, [note?.id]);

  // --- 私密笔记从遮罩揭示正文时，富文本 DOM 为重新挂载的空节点，须以已保存内容填充 ---
  useEffect(() => {
    if (!revealedPrivate || isMarkdownMode || !note || !editorRef.current) return;
    editorRef.current.innerHTML = note.content ?? '';
    const text = (note.content ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    setWordCount(text.replace(/\s/g, '').length);
    setRichEmpty(!text.trim());
    // 仅在遮罩隐藏→揭示切换时填充一次，避免在输入过程中覆盖光标
  }, [revealedPrivate, isMarkdownMode, note?.id]);

  // --- 从 Markdown 切回富文本时：把已保存的 HTML 填回刚挂载的编辑 DOM ---
  // Markdown 模式下富文本 DOM 未挂载，切回时是新挂载的空 DOM，需据 note.content 重新填充；
  // 仅在“刚从 Markdown 切回”时填充，以免覆盖富文本模式下的正常输入与光标。
  const enteredRichRef = useRef(false);
  useEffect(() => {
    // isMarkdownMode 的 effect 在渲染后运行；这里在切回富文本后填充一次
    if (isMarkdownMode) {
      enteredRichRef.current = true;
      return;
    }
    const justLeftMarkdown = enteredRichRef.current;
    enteredRichRef.current = false;
    if (justLeftMarkdown && note && editorRef.current) {
      editorRef.current.innerHTML = note.content;
      const text = stripHtmlToText(note.content);
      setWordCount(text.replace(/\s/g, '').length);
    }
  }, [isMarkdownMode, note]);

  // --- 事件处理 ---
  const onContentInput = useCallback(() => {
    setRichEmpty(!editorRef.current?.textContent?.trim());
    handleContentInput(record);
  }, [handleContentInput, record]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
      triggerSave();
    },
    [triggerSave],
  );

  // --- Markdown 模式切换 ---
  const handleToggleMarkdownMode = useCallback(() => {
    if (isMarkdownMode) {
      // Markdown -> 富文本：把源码渲染回 HTML 并保存。
      // 注意：Markdown 模式下富文本编辑 DOM 未挂载（editorRef.current 为 null），
      // 因此必须直接基于 mdSource 生成 HTML 并写回 note.content，
      // 而不能依赖 editorRef.current.innerHTML 赋值。
      setIsMarkdownMode(false);
      if (note) {
        const html = markdownToHtml(mdSource);
        const plain = markdownToPlainText(mdSource);
        const excerpt =
          plainTextToExcerpt(plain, 80);
        onUpdate(note.id, { content: html, excerpt, updatedAt: Date.now() });
        setWordCount(plain.replace(/\s/g, '').length);
        setSaved(false);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          setSaved(true);
          setLastSavedAt(Date.now());
        }, 500);
      }
    } else {
      // 富文本 -> Markdown：用当前 HTML 生成源码
      const html = editorRef.current?.innerHTML ?? note?.content ?? '';
      setMdSource(htmlToMarkdown(html));
      setIsMarkdownMode(true);
    }
  }, [isMarkdownMode, note, mdSource, onUpdate, setWordCount, setSaved, saveTimerRef, setLastSavedAt]);

  // --- Markdown 源码变更：同步转成 HTML 保存，保证其它视图一致 ---
  const handleMarkdownChange = useCallback(
    (md: string) => {
      setMdSource(md);
      if (!note) return;
      const html = markdownToHtml(md);
      const plain = markdownToPlainText(md);
      const excerpt =
        plainTextToExcerpt(plain, 80);
      onUpdate(note.id, { content: html, excerpt, updatedAt: Date.now() });
      setWordCount(plain.replace(/\s/g, '').length);
      setSaved(false);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setSaved(true);
        setLastSavedAt(Date.now());
      }, 500);
    },
    [note, onUpdate, setWordCount, setSaved, saveTimerRef, setLastSavedAt],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  }, []);

  const getNotebookName = (nbId: string) => {
    const nb = MOCK_NOTEBOOKS.find((n) => n.id === nbId);
    return nb?.name ?? '未分类';
  };

  const siblingNotes = useMemo(() => {
    if (!note) return [];
    return notes.filter(
      (n) => n.notebookId === note.notebookId && n.id !== note.id && !n.isDeleted,
    );
  }, [note, notes]);

  const isDeleted = note?.isDeleted ?? false;
  const notebook = notebooks.find((n) => n.id === note?.notebookId);

  // --- 加密操作：为当前笔记设置口令加密 / 输入口令解锁 ---
  const isEncrypted = note ? isNoteEncrypted(note) : false;

  const openEncryptDialog = useCallback(() => {
    if (!note) return;
    setEncryptPassword('');
    setEncryptConfirm('');
    setEncryptError('');
    setEncryptDialog(isNoteEncrypted(note) ? 'decrypt' : 'encrypt');
  }, [note]);

  const closeEncryptDialog = useCallback(() => {
    if (encryptBusy) return;
    setEncryptDialog(null);
    setEncryptError('');
  }, [encryptBusy]);

  const submitEncrypt = useCallback(async () => {
    if (!note || !encryptDialog) return;
    const password = encryptPassword;
    if (!password) { setEncryptError('请输入口令'); return; }
    if (encryptDialog === 'encrypt' && password !== encryptConfirm) {
      setEncryptError('两次输入的口令不一致');
      return;
    }
    setEncryptBusy(true);
    setEncryptError('');
    let ok = false;
    try {
      if (encryptDialog === 'encrypt') {
        ok = (await onEncrypt?.(note.id, password)) || false;
        if (ok) toast.success('笔记已加密，请牢记口令');
        else setEncryptError('加密失败，请重试');
      } else {
        ok = (await onDecrypt?.(note.id, password)) || false;
        if (ok) toast.success('已解锁笔记');
        else setEncryptError('口令错误，无法解锁');
      }
      if (ok) { setEncryptDialog(null); setEncryptPassword(''); setEncryptConfirm(''); }
    } finally {
      setEncryptBusy(false);
    }
  }, [note, encryptDialog, encryptPassword, encryptConfirm, onEncrypt, onDecrypt]);

  // 加密笔记切换到另一篇未加密笔记时，关闭弹窗（避免残留旧状态）
  useEffect(() => {
    if (!note || !isNoteEncrypted(note)) {
      setEncryptDialog(null);
    }
  }, [note?.id]);

  // 编辑器右键命令执行
  const execCmd = useCallback(
    (cmd: string, value?: string) => {
      document.execCommand(cmd, false, value);
      if (editorRef.current && note) {
        const html = editorRef.current.innerHTML;
        const plain = editorRef.current.innerText ?? '';
        const excerpt = plain.slice(0, 80);
        onUpdate(note.id, { content: html, excerpt, updatedAt: Date.now() });
        record('format', html);
        setWordCount(plain.replace(/\s/g, '').length);
        setSaved(false);
        triggerSave();
      }
      setContextMenu(null);
    },
    [note, onUpdate, record, triggerSave],
  );

  const handleInsertLink = useCallback(() => {
    setInsertValue('https://');
    setInsertDialog({ type: 'link' });
  }, []);

  const handleInsertImage = useCallback(() => {
    setInsertValue('https://');
    setInsertDialog({ type: 'image' });
  }, []);

  const confirmInsert = useCallback(() => {
    const url = insertValue.trim();
    if (!url || !insertDialog) return;
    if (insertDialog.type === 'link') execCmd('createLink', url);
    else execCmd('insertImage', url);
    setInsertDialog(null);
  }, [insertValue, insertDialog, execCmd]);

  const handleInsertTable = useCallback(() => {
    const tableHtml = '<table style="border-collapse:collapse;width:100%;margin:8px 0;border:1px solid var(--border)"><tr><th style="border:1px solid var(--border);padding:6px">列1</th><th style="border:1px solid var(--border);padding:6px">列2</th><th style="border:1px solid var(--border);padding:6px">列3</th></tr><tr><td style="border:1px solid var(--border);padding:6px">&nbsp;</td><td style="border:1px solid var(--border);padding:6px">&nbsp;</td><td style="border:1px solid var(--border);padding:6px">&nbsp;</td></tr></table>';
    execCmd('insertHTML', tableHtml);
  }, [execCmd]);

  const handleInsertCodeBlock = useCallback(() => {
    const codeHtml = '<pre style="background:var(--muted);padding:12px;border-radius:6px;font-family:monospace;font-size:13px"><code>// 在此输入代码</code></pre>';
    execCmd('insertHTML', codeHtml);
  }, [execCmd]);

  const handleInsertTodo = useCallback(() => {
    const todoHtml = '<div style="display:flex;align-items:center;gap:6px"><input type="checkbox" /> <span>待办事项</span></div>';
    execCmd('insertHTML', todoHtml);
  }, [execCmd]);

  // --- 空状态 ---
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="shrink-0 border-b border-border/60 px-3 py-2 h-9" />
        <EditorSkeleton />
      </div>
    );
  }

  if (!note) {
    const recentNotes = [...notes]
      .filter((n) => !n.isDeleted)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 4);

    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="size-16 rounded-xl bg-muted flex items-center justify-center mb-4">
          <FolderOpen className="size-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">选择一篇笔记</h3>
        <p className="text-sm text-muted-foreground max-w-xs mb-5">
          从左侧列表中选择一篇笔记开始编辑，或创建一篇新的笔记
        </p>

        {onNewNote && (
          <Button
            size="sm"
            className="h-8 px-4 gap-1.5 text-xs mb-6"
            onClick={onNewNote}
          >
            <FileText className="size-3.5" />
            新建笔记
          </Button>
        )}

        {recentNotes.length > 0 && onOpenNote && (
          <div className="w-full max-w-xs">
            <div className="text-[11px] text-muted-foreground mb-2 text-left px-1">最近访问</div>
            <div className="space-y-1">
              {recentNotes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onOpenNote(n.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-foreground hover:bg-muted transition-colors flex items-center gap-2 group"
                >
                  <FileText className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="flex-1 truncate">{n.title || '无标题笔记'}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(n.updatedAt, 'MM-dd')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 主编辑界面 ---
  return (
    <motion.div
      key={note.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full bg-background"
    >
      {/* 顶部工具栏 */}
      <div className="shrink-0 border-b border-border/60">
        {/* 面包屑 */}
        <div className="px-4 pt-2 pb-1">
          <NoteBreadcrumb
            workspace={{ id: 'ws1', name: workspaceName, color: workspaceColor ?? '#4A7C59', icon: '📝', archived: false, createdAt: 0 }}
            notebook={notebook}
            note={note}
            sameNotebookNotes={siblingNotes}
            onSelectNote={(id) => onNavigateNote?.(id)}
            onSelectNotebook={(id) => onNavigateNotebook?.(id)}
          />
        </div>
        {/* 工具栏子组件 */}
        <EditorToolbar
          canUndo={canUndo}
          canRedo={canRedo}
          showHistory={showHistory}
          isFavorite={note.isFavorite}
          isDeleted={isDeleted}
          isMarkdownMode={isMarkdownMode}
          isEncrypted={isEncrypted}
          isPrivate={!!note.isPrivate}
          onEncrypt={openEncryptDialog}
          onTogglePrivate={() => {
            const next = !note.isPrivate;
            // 标记私密前立即保存当前编辑内容（编辑器即将被遮罩卸载，
            // debounce 的 triggerSave 在卸载后读不到 DOM，可能导致内容丢失）
            if (next && note && editorRef.current) {
              const html = editorRef.current.innerHTML;
              const plain = editorRef.current.innerText ?? '';
              onUpdate(note.id, { content: html, excerpt: plain.slice(0, 80), updatedAt: Date.now() });
            }
            onUpdate(note.id, { isPrivate: next });
            // 取消私密时退出临时查看态；标记私密时默认遮罩隐藏
            setRevealedPrivate(false);
            toast.success(next ? '已标记私密，正文已隐藏' : '已取消私密');
          }}
          onToggleMarkdownMode={handleToggleMarkdownMode}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onToggleHistory={() => setShowHistory((s) => !s)}
          onToggleFavorite={() => {
            onToggleFavorite(note.id);
            toast.success(note.isFavorite ? '已取消收藏' : '已添加收藏');
          }}
          onAIClick={handleAIClick}
          onInsertLink={handleInsertLink}
          onInsertImage={handleInsertImage}
          onInsertTable={handleInsertTable}
          onInsertCodeBlock={handleInsertCodeBlock}
          onInsertTodo={handleInsertTodo}
          onDelete={() => {
            onDelete(note.id);
            toast.info('已移至回收站');
          }}
          onRestore={() => onRestore(note.id)}
          notebooks={notebooks}
          onMoveNotebook={(nbId) => {
            onUpdate(note.id, { notebookId: nbId });
          }}
          onExportNote={(format) => {
            exportAndDownload(note, {
              format,
              includeFrontmatter: true,
              includeTags: true,
              includeCreatedAt: true,
              includeUpdatedAt: true,
            });
            toast.success('笔记已导出');
          }}
        />
      </div>

      {/* 标题和元信息 */}
      <div className="shrink-0 px-8 pt-6 pb-3 border-b border-border/40">
        <Input
          value={title}
          onChange={handleTitleChange}
          className="text-2xl font-bold border-none px-0 h-auto focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40"
          placeholder="无标题笔记"
          disabled={isDeleted || isEncrypted}
        />
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FolderOpen className="size-3" />
              {getNotebookName(note.notebookId)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {format(note.updatedAt, 'yyyy-MM-dd HH:mm')}
            </span>
            <span className="flex items-center gap-1" aria-live="polite">
              {saved ? (
                lastSavedAt ? (
                  <>
                    <Check className="size-3 text-success" />
                    <span className="text-success/80">已保存 · {formatRelativeTime(lastSavedAt)}</span>
                  </>
                ) : (
                  <>
                    <Check className="size-3 text-success" />
                    <span className="text-success/80">已保存</span>
                  </>
                )
              ) : (
                <>
                  <span className="size-1.5 rounded-full bg-warning animate-pulse" />
                  <span>保存中...</span>
                </>
              )}
            </span>
          </div>
          <EditorTagsPanel
            note={note}
            allTags={MOCK_TAGS}
            onAddTag={(tagId) => {
              onUpdate(note.id, { tags: [...note.tags, tagId] });
              toast.success('已添加标签');
            }}
            onRemoveTag={(tagId) => {
              onUpdate(note.id, { tags: note.tags.filter((t) => t !== tagId) });
            }}
          />
        </div>
        {/* 天气 + 心情（可选元信息） */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">天气</span>
            <div className="flex items-center gap-0.5">
              {WEATHER_OPTIONS.map((w) => {
                const active = note.weather === w.value;
                return (
                  <button
                    key={w.value}
                    type="button"
                    title={`${w.label}${active ? '（点击清除）' : ''}`}
                    disabled={isDeleted}
                    onClick={() => onUpdate(note.id, { weather: active ? undefined : w.value })}
                    className={`size-7 rounded-md flex items-center justify-center text-base transition-all ${
                      active ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-muted'
                    }`}
                  >
                    {w.icon}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">心情</span>
            <div className="flex items-center gap-0.5">
              {MOOD_OPTIONS.map((m) => {
                const active = note.mood === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    title={`${m.label}（${active ? '点击清除' : '点击选择'}）`}
                    disabled={isDeleted}
                    onClick={() => onUpdate(note.id, { mood: active ? undefined : m.value })}
                    className={`size-7 rounded-md flex items-center justify-center text-base transition ${
                      active ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-muted'
                    }`}
                  >
                    {m.icon}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 编辑区 + 历史侧边栏（加密笔记显示锁定遮罩，私密笔记默认正文遮罩，均避免明文泄露） */}
      {isEncrypted || note.locked ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-muted/20">
          <div className="size-16 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center mb-4">
            <Lock className="size-7 text-warning" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">此笔记已加密</h3>
          <p className="text-sm text-muted-foreground max-w-xs mb-5">
            需输入加密口令方可查看内容，口令不会保存在本地。
          </p>
          <Button size="sm" onClick={openEncryptDialog} disabled={isDeleted}>
            <Unlock className="size-3.5 mr-1.5" />
            输入口令解锁
          </Button>
        </div>
      ) : note.isPrivate && !revealedPrivate ? (
        // 私密遮罩：点击临时查看全部正文（可编辑），再次可在工具栏"取消私密"或按钮切换
        <div
          role="button"
          tabIndex={0}
          onClick={() => setRevealedPrivate(true)}
          onKeyDown={(e) => e.key === 'Enter' && setRevealedPrivate(true)}
          className="flex-1 flex flex-col items-center justify-center text-center p-8 cursor-pointer select-none bg-muted/20"
        >
          <div className="size-16 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center mb-4">
            <EyeOff className="size-7 text-warning" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">此笔记已标记为私密</h3>
          <p className="text-sm text-muted-foreground max-w-xs mb-5">正文已隐藏，点击下方按钮临时查看。</p>
          <Button size="sm" onClick={(e) => { e.stopPropagation(); setRevealedPrivate(true); }} disabled={isDeleted}>
            <Eye className="size-3.5 mr-1.5" />
            点击查看正文
          </Button>
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden relative">
        {note.isPrivate && (
          <button
            type="button"
            onClick={() => setRevealedPrivate(false)}
            className="absolute right-4 top-3 z-20 flex items-center gap-1 text-[11px] rounded-md px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
            title="重新隐藏正文"
          >
            <EyeOff className="size-3.5" />
            重新隐藏
          </button>
        )}
        {isMarkdownMode ? (
          <div className="flex-1 overflow-hidden">
            <MarkdownEditorPane
              value={mdSource}
              onChange={handleMarkdownChange}
              disabled={isDeleted}
              placeholder="在此输入 Markdown 语法…"
            />
          </div>
        ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="flex-1 overflow-y-auto">
              <div className="px-8 py-6 max-w-3xl mx-auto relative">
                {richEmpty && !isDeleted && (
                  <div
                    className="absolute top-[52px] left-8 right-8 pointer-events-none select-none"
                    onClick={() => editorRef.current?.focus()}
                  >
                    <p className="text-sm text-muted-foreground/60 leading-relaxed">
                      开始写下你的第一篇内容…
                      <br />
                      支持 Markdown、图片、代码块、表格与 LaTeX 公式
                    </p>
                  </div>
                )}
                <div
                  ref={editorRef}
                  contentEditable={!isDeleted}
                  suppressContentEditableWarning
                  onInput={onContentInput}
                  onKeyDown={handleKeyDown}
                  onContextMenu={(e) => {
                    const text = getSelectedText();
                    setContextMenu(text ? { x: e.clientX, y: e.clientY, text } : null);
                  }}
                  onMouseUp={() => setSelectedText(getSelectedText())}
                  className={cn(
                    'min-h-[400px] outline-none prose prose-sm max-w-none leading-relaxed',
                    'prose-headings:font-bold prose-headings:text-foreground',
                    'prose-p:text-foreground prose-p:my-3',
                    'prose-ul:my-3 prose-ol:my-3',
                    'prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground prose-blockquote:my-4',
                    'prose-pre:bg-muted prose-blockquote:bg-muted/30 prose-pre:rounded-lg prose-pre:p-3 prose-pre:text-xs',
                    'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
                    'prose-strong:text-foreground prose-em:text-foreground/80',
                    isDeleted ? 'opacity-60' : '',
                  )}
                  style={{ minHeight: 'calc(100vh - 280px)' }}
                />
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem onClick={() => execCmd('cut')} className="text-xs cursor-pointer">
              <Scissors className="size-3.5 mr-2" />
              剪切
              <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => execCmd('copy')} className="text-xs cursor-pointer">
              <Clipboard className="size-3.5 mr-2" />
              复制
              <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => execCmd('paste')} className="text-xs cursor-pointer">
              <ClipboardPaste className="size-3.5 mr-2" />
              粘贴
              <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => execCmd('selectAll')} className="text-xs cursor-pointer">
              <CheckSquare className="size-3.5 mr-2" />
              全选
              <ContextMenuShortcut>Ctrl+A</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleInsertLink} className="text-xs cursor-pointer">
              <LinkIcon className="size-3.5 mr-2" />
              插入链接
            </ContextMenuItem>
            <ContextMenuItem onClick={handleInsertImage} className="text-xs cursor-pointer">
              <ImageIcon className="size-3.5 mr-2" />
              插入图片
            </ContextMenuItem>
            <ContextMenuItem onClick={handleInsertTable} className="text-xs cursor-pointer">
              <Table className="size-3.5 mr-2" />
              插入表格
            </ContextMenuItem>
            <ContextMenuItem onClick={handleInsertCodeBlock} className="text-xs cursor-pointer">
              <Code className="size-3.5 mr-2" />
              插入代码块
            </ContextMenuItem>
            <ContextMenuItem onClick={handleInsertTodo} className="text-xs cursor-pointer">
              <CheckSquare className="size-3.5 mr-2" />
              插入待办
            </ContextMenuItem>
            {contextMenu && contextMenu.text && (
              <>
                <ContextMenuSeparator />
                <div className="px-2 py-1 text-[10px] text-muted-foreground">AI 写作</div>
                <ContextMenuItem onClick={() => triggerAIAction('polish', contextMenu.text)} className="text-xs cursor-pointer">
                  <Sparkles className="size-3.5 mr-2 text-primary" />
                  智能润色
                </ContextMenuItem>
                <ContextMenuItem onClick={() => triggerAIAction('translate', contextMenu.text)} className="text-xs cursor-pointer">
                  <Languages className="size-3.5 mr-2 text-primary" />
                  翻译
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
        )}

        {/* 版本历史侧边栏 */}
        <AnimatePresence>
          {showHistory && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="shrink-0 border-l border-border/60 bg-muted/20 overflow-hidden flex flex-col"
            >
              <div className="shrink-0 px-4 py-3 border-b border-border/60 flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <History className="size-4 text-primary" />
                  版本历史
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowHistory(false)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {versions.map((v, i) => (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                  >
                    <div className="flex items-start gap-2 group">
                      <div className="flex flex-col items-center pt-1.5">
                        <div
                          className={cn(
                            'size-2.5 rounded-full shrink-0',
                            v.isCurrent ? 'bg-primary' : 'bg-border',
                          )}
                        />
                        {i < versions.length - 1 && (
                          <div className="w-px flex-1 bg-border/50 mt-1" style={{ minHeight: 36 }} />
                        )}
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium">{v.label}</span>
                          {v.isCurrent && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              当前
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mb-1.5">
                          {format(v.timestamp, 'MM-dd HH:mm')}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-2 mb-2 bg-card/60 px-2 py-1.5 rounded">
                          {v.excerpt}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="shrink-0 px-3 py-2 border-t border-border/60 text-[11px] text-muted-foreground text-center">
                自动保存 · 编辑历史可通过 Ctrl+Z（撤销）追溯
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* 底部状态栏 */}
      <EditorStatusBar
        workspaceName={workspaceName}
        workspaceColor={workspaceColor}
        wordCount={wordCount}
        saved={saved}
      />

      {/* AI 助手面板 */}
      <Suspense fallback={null}>
        <AIAssistantPanel
          open={aiPanelOpen}
          onOpenChange={setAiPanelOpen}
          selectedText={selectedText}
          onAccept={handleAIAccept}
        />
      </Suspense>

      {/* 选中文本右键菜单 */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 rounded-lg border border-border/60 bg-popover shadow-lg p-1 w-56"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-b border-border/30 mb-1">
              AI 写作助手
            </div>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
              onClick={() => triggerAIAction('continue', contextMenu.text)}
            >
              <Wand2 className="size-3.5 text-primary" />
              续写
            </button>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
              onClick={() => triggerAIAction('polish', contextMenu.text)}
            >
              <Sparkles className="size-3.5 text-primary" />
              润色
            </button>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
              onClick={() => triggerAIAction('shorten', contextMenu.text)}
            >
              <Minimize2 className="size-3.5 text-primary" />
              缩短
            </button>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
              onClick={() => triggerAIAction('expand', contextMenu.text)}
            >
              <Maximize2 className="size-3.5 text-primary" />
              扩写
            </button>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
              onClick={() => triggerAIAction('summarize', contextMenu.text)}
            >
              <FileText className="size-3.5 text-primary" />
              总结
            </button>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
              onClick={() => triggerAIAction('translate', contextMenu.text)}
            >
              <Languages className="size-3.5 text-primary" />
              翻译
            </button>
            <div className="border-t border-border/30 my-1" />
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
              onClick={() => triggerAIAction('headline', contextMenu.text)}
            >
              <FileEdit className="size-3.5 text-primary" />
              起标题
            </button>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
              onClick={() => triggerAIAction('outline', contextMenu.text)}
            >
              <ListOrdered className="size-3.5 text-primary" />
              列大纲
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 插入链接 / 图片对话框（替代原生 prompt） */}
      <Dialog open={!!insertDialog} onOpenChange={(open) => !open && setInsertDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{insertDialog?.type === 'image' ? '插入图片' : '插入链接'}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={insertValue}
              onChange={(e) => setInsertValue(e.target.value)}
              placeholder="请输入地址，以 http:// 或 https:// 开头"
              className="h-9"
              onKeyDown={(e) => e.key === 'Enter' && confirmInsert()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsertDialog(null)}>
              取消
            </Button>
            <Button
              disabled={!/^https?:\/\//i.test(insertValue.trim())}
              onClick={confirmInsert}
            >
              <Check className="size-3.5 mr-1" />
              插入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 加密 / 解锁对话框 */}
      <Dialog
        open={!!encryptDialog}
        onOpenChange={(open) => !open && closeEncryptDialog()}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {encryptDialog === 'encrypt' ? '加密笔记' : '解锁笔记'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {encryptDialog === 'encrypt' && (
              <p className="text-xs text-muted-foreground mb-3">
                设置独立口令加密此笔记。加密后内容仅存密文，口令不落盘，请务必牢记。
              </p>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">口令</label>
                <Input
                  type="password"
                  value={encryptPassword}
                  onChange={(e) => setEncryptPassword(e.target.value)}
                  placeholder="请输入口令"
                  className="h-9"
                  onKeyDown={(e) => e.key === 'Enter' && !encryptBusy && submitEncrypt()}
                  autoFocus
                />
              </div>
              {encryptDialog === 'encrypt' && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">确认口令</label>
                  <Input
                    type="password"
                    value={encryptConfirm}
                    onChange={(e) => setEncryptConfirm(e.target.value)}
                    placeholder="再次输入口令"
                    className="h-9"
                    onKeyDown={(e) => e.key === 'Enter' && !encryptBusy && submitEncrypt()}
                  />
                </div>
              )}
              {encryptError && (
                <div className="text-xs text-destructive">{encryptError}</div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEncryptDialog} disabled={encryptBusy}>
              取消
            </Button>
            <Button onClick={submitEncrypt} disabled={encryptBusy}>
              <KeyRound className="size-3.5 mr-1" />
              {encryptBusy ? '处理中...' : encryptDialog === 'encrypt' ? '加密' : '解锁'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
});
