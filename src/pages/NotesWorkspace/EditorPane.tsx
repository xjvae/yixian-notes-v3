// 富文本 + Markdown 双模式笔记编辑器（主入口）
//
// 组合式结构，将工具栏、状态栏、标签管理、历史版本等功能拆分为独立子组件。
// 富文本编辑基于 TipTap（ProseMirror），提供稳定的文档模型与原生撤销/重做。
// 对外 Props 接口保持不变，外部调用方无需修改。

import {
  useState,
  useMemo,
  useCallback,
  memo,
  useRef,
  useEffect,
  lazy,
  Suspense,
} from 'react';
import {
  type LucideIcon,
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
  Lock,
  Unlock,
  KeyRound,
  RefreshCw,
  Bookmark,
  Trash2,
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
const AIAssistantPanel = lazy(() => import('@/components/AIAssistantPanel'));
import { MOCK_NOTEBOOKS, MOCK_TAGS, MOCK_NOTES } from '@/data/notes';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { exportAndDownload } from '@/lib/noteExport';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import NoteBreadcrumb from '@/components/NoteBreadcrumb';
import { EditorSkeleton } from '@/components/SkeletonLoaders';
import {
  listNoteVersions,
  saveNoteVersion,
  restoreNoteVersion,
  saveMilestoneVersion,
  deleteVersionRecord,
  clearVersionRecords,
} from '@/lib/noteVersions';
import { genId } from '@/lib/id';

// 子组件
import EditorToolbar from './EditorToolbar';
import EditorStatusBar from './EditorStatusBar';
import EditorTagsPanel from './EditorTagsPanel';
import MarkdownEditorPane from './MarkdownEditor';
import RichTextEditor from './RichTextEditor';
import EditorToc from './EditorToc';

// TipTap 编辑器
import { useEditor, type Editor } from '@tiptap/react';
import {
  buildExtensions,
  applyHtml,
  editorHtml,
  isEditorEmpty,
  htmlToMarkdownSource,
} from './editor/extensions';

// Hook
import { useEditorSync } from './hooks/useEditorSync';

// 工具函数
import { markdownToHtml, markdownToPlainText } from '@/lib/markdown';
import { stripHtmlToText, plainTextToExcerpt } from '@/lib/text';
import { WEATHER_OPTIONS, MOOD_OPTIONS } from '@/lib/noteMeta';
import { isNoteEncrypted, decryptNoteSec } from '@/lib/note-sec';

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

// 从 HTML 提取展示用纯文本（用于字数/摘要等）
function plainFromHtml(html: string): string {
  return stripHtmlToText(html).replace(/\s/g, '');
}

// AI 右键菜单项：行为、图标、文案
const AI_MENU_ITEMS: ReadonlyArray<[string, LucideIcon, string]> = [
  ['continue', Wand2, '续写'],
  ['polish', Sparkles, '润色'],
  ['shorten', Minimize2, '缩短'],
  ['expand', Maximize2, '扩写'],
  ['summarize', FileText, '总结'],
  ['translate', Languages, '翻译'],
];
const AI_MENU_HEADS: ReadonlyArray<[string, LucideIcon, string]> = [
  ['headline', FileEdit, '起标题'],
  ['outline', ListOrdered, '列大纲'],
];

// --- 主组件 ---

export default memo(function EditorPane({
  note,
  onUpdate,
  onEncrypt,
  onReEncrypt,
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
  // TipTap 编辑器实例引用（供命令/序列化读取）
  const editorRef = useRef<Editor | null>(null);
  const [title, setTitle] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  // 目录（TOC）显示开关与所在位置（左 / 右）
  const [showToc, setShowToc] = useState(false);
  const [tocPosition, setTocPosition] = useState<'left' | 'right'>('right');
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [rev, setRev] = useState(0); // 驱动撤销/重做状态刷新
  void rev;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [insertDialog, setInsertDialog] = useState<{ type: 'link' | 'image' } | null>(null);
  const [insertValue, setInsertValue] = useState('');
  // 编辑模式：富文本 / Markdown 源码
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [mdSource, setMdSource] = useState('');
  // 加密弹窗：mode 为 encrypt（设置口令加密）或 decrypt（输入口令访问）
  const [encryptDialog, setEncryptDialog] = useState<'encrypt' | 'decrypt' | null>(null);
  const [encryptPassword, setEncryptPassword] = useState('');
  const [encryptConfirm, setEncryptConfirm] = useState('');
  const [encryptBusy, setEncryptBusy] = useState(false);
  const [encryptError, setEncryptError] = useState('');
  // 会话内解密状态（明文仅驻留内存；保存通过重加密回写密文）
  const [decSession, setDecSession] = useState<{ noteId: string; pw: string; title: string; content: string } | null>(null);
  const decSessionRef = useRef(decSession);
  decSessionRef.current = decSession;
  // 私密笔记正文遮罩
  const [revealedPrivate, setRevealedPrivate] = useState(false);
  // 富文本正文是否为空（用于空状态占位提示）
  const [richEmpty, setRichEmpty] = useState(true);
  // 持久化历史版本（来自后端 SQLite note_versions 表）
  const [histVersions, setHistVersions] = useState<VersionInfo[]>([]);

  const isDeleted = note?.isDeleted ?? false;
  const isEncrypted = note ? isNoteEncrypted(note) : false;
  // 当前笔记在本会话内已用口令打开
  const decOpen = !!decSession && decSession.noteId === note?.id;

  // 读取编辑器当前 HTML / 纯文本（闭包读取 editorRef）
  const getEditorHtml = useCallback(() => (editorRef.current ? editorHtml(editorRef.current) : ''), []);
  const getEditorText = useCallback(() => (editorRef.current ? editorRef.current.getText().trim() : ''), []);

  // 便捷函数：决定当前明文（普通/解密后的）
  const contentFor = useCallback(
    (n: typeof note, ds: typeof decSession) => {
      if (!n) return '';
      if (ds && ds.noteId === n.id) return ds.content;
      return n.content ?? '';
    },
    [],
  );

  // 将指定 HTML 写入编辑器（content 由模型管控，非受控 DOM 直写）
  const setInternalHtml = useCallback((html: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    applyHtml(ed, html);
    if (typeof ed?.commands?.setTextSelection === 'function') {
      ed.commands.setTextSelection(0);
    }
  }, []);

  // --- 同步 Hook（自动保存） ---
  const {
    saved,
    lastSavedAt,
    wordCount,
    triggerSave,
    setWordCount,
    setSaved,
    setLastSavedAt,
    saveTimerRef,
    resetSaveState,
  } = useEditorSync({
    noteId: note?.id,
    onSave: (updates) => {
      if (!note) return;
      // 会话内解密：把改动用同一口令重加密写回密文，绝不把明文写回 content（保持加密态）
      const ds = decSessionRef.current;
      if (ds && ds.noteId === note.id && isNoteEncrypted(note)) {
        const nextTitle = updates.title ?? ds.title;
        void onReEncrypt?.(note.id, ds.pw, {
          title: nextTitle,
          content: updates.content,
          excerpt: updates.excerpt,
        });
        setDecSession({ ...ds, title: nextTitle, content: updates.content });
        return;
      }
      onUpdate(note.id, updates);
      saveSnapshot(updates.content);
    },
    getEditorHtml,
    getEditorText,
    title,
  });

  // 处理剪贴板粘贴：拖/粘贴图片文件时读取为 base64 data URL 并插入
  const pasteImagesFromClipboard = useCallback((event: ClipboardEvent): boolean => {
    const ed = editorRef.current;
    if (!ed) return false;
    const items = event.clipboardData?.items;
    if (!items) return false;
    const files: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
      // 只处理真正的图片文件（排除已复制为文本/HTML 的图片，避免重复插入）
      if (items[i].type.startsWith('image/') && items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length === 0) return false;
    event.preventDefault();
    // 记录粘贴时刻的光标位置，读取完成后回填覆盖选择，确保图片落在原位
    const at = ed.state.selection.from;
    // 逐一读取并插入，多图按顺序插入
    let pending = files.length;
    const frags: string[] = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        frags.push(src);
        pending -= 1;
        if (pending === 0 && ed && !ed.isDestroyed) {
          const chain = ed.chain().focus().setTextSelection(at);
          frags.forEach((s) => chain.setImage({ src: s }));
          chain.insertContent('<p></p>').run();
          triggerSave();
          setRev((r) => r + 1);
        }
      };
      reader.onerror = () => {
        pending -= 1;
      };
      reader.readAsDataURL(file);
    });
    return true;
  }, [triggerSave]);

  // editable：可编辑态（未删除、非 Markdown 模式时由 RichTextEditor 控制）
  const editable = !isDeleted && !isMarkdownMode && !!(note && ( !isNoteEncrypted(note) || decOpen ));

  // TipTap 编辑器实例
  const editor = useEditor({
    extensions: buildExtensions('开始写下你的第一篇内容…'),
    content: '',
    editable: editable || false,
    immediatelyRender: false,
    editorProps: {
      handlePaste: (_view, event) => pasteImagesFromClipboard(event),
      handleDrop: (_view, event, _slice, moved) => {
        // 支持从系统文件直接拖拽图片进编辑区
        const t = event as unknown as DragEvent;
        const dataTransfer = t.dataTransfer;
        if (dataTransfer && moved && dataTransfer.files.length > 0) {
          const imageFiles = Array.from(dataTransfer.files).filter((f) => f.type.startsWith('image/'));
          if (imageFiles.length > 0) {
            event.preventDefault();
            const ptEvt = { clipboardData: dataTransfer } as ClipboardEvent;
            return pasteImagesFromClipboard(ptEvt);
          }
        }
        return false;
      },
    },
    onCreate: ({ editor: ed }) => {
      editorRef.current = ed;
      if (note) setInternalHtml(contentFor(note, decSessionRef.current));
    },
    onUpdate: () => {
      const ed = editorRef.current;
      if (!ed) return;
      setRichEmpty(isEditorEmpty(ed));
      triggerSave();
      setRev((r) => r + 1);
    },
    onSelectionUpdate: () => {
      const ed = editorRef.current;
      if (ed) setWordCount(ed.getText().split('').length);
    },
  });
  editorRef.current = editor ?? null;

  // 撤销 / 重做（原生历史栈，remove 自定义 innerHTML 快照逻辑）
  const canUndo = !!editor?.can?.().undo();
  const canRedo = !!editor?.can?.().redo();
  const handleUndo = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.commands.undo();
    setRev((r) => r + 1);
  }, []);
  const handleRedo = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.commands.redo();
    setRev((r) => r + 1);
  }, []);

  // --- AI 助手 ---
  const getSelectedText = useCallback(() => {
    const ed = editorRef.current;
    if (ed && !ed.isDestroyed) {
      return ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to).trim();
    }
    const sel = window.getSelection();
    return sel && sel.rangeCount > 0 ? sel.toString().trim() : '';
  }, []);

  const handleAIClick = useCallback(() => {
    setSelectedText(getSelectedText());
    setAiPanelOpen(true);
  }, [getSelectedText]);

  // 点击空白关闭右键菜单
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // AI 接受替换（通过 editor 命令，避免 string replace 破坏文档合法性）
  const handleAIAccept = useCallback(
    (newText: string) => {
      const ed = editorRef.current;
      if (!ed || !selectedText) return;
      ed.chain().focus().insertContent(newText.replace(/\n/g, '<br/>')).run();
      const html = editorHtml(ed);
      const plain = stripHtmlToText(html);
      if (note) {
        onUpdate(note.id, { content: html, excerpt: plain.slice(0, 80), updatedAt: Date.now() });
      }
      setWordCount(plain.replace(/\s/g, '').length);
      setAiPanelOpen(false);
      setRev((r) => r + 1);
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
        window.dispatchEvent(new CustomEvent('ai-quick-action', { detail: { action } }));
      }, 50);
    },
    [],
  );

  // --- 版本历史 ---
  const lastSnapRef = useRef<{ noteId: string; content: string } | null>(null);
  const titleRef = useRef(title);
  titleRef.current = title;
  const noteIdRef = useRef<string | null>(null);
  noteIdRef.current = note?.id ?? null;
  const loadTokenRef = useRef(0);

  // 保存当前内容为一条历史快照（内容变化才保存，避免刷屏）
  const saveSnapshot = useCallback(
    (contentOverride?: string) => {
      if (!note) return;
      const noteId = note.id;
      const content = contentOverride ?? editorHtml(editorRef.current!);
      if (lastSnapRef.current && lastSnapRef.current.noteId === noteId && lastSnapRef.current.content === content) {
        return;
      }
      lastSnapRef.current = { noteId, content };
      const rec = {
        id: genId('ver'),
        noteId,
        title: titleRef.current || '无标题笔记',
        content,
        createdAt: Date.now(),
        label: '自动保存',
        milestone: false,
      };
      void saveNoteVersion(rec).then((saved) => {
        if (!saved || !noteIdRef.current || noteIdRef.current !== noteId) return;
        const v = saved.record;
        setHistVersions((prev) => {
          const next = prev.filter((x) => x.content !== v.content);
          return [
            {
              id: v.id,
              timestamp: v.createdAt,
              label: v.label,
              title: v.title,
              content: v.content,
              excerpt: plainFromHtml(v.content).slice(0, 80),
              isCurrent: false,
            },
            ...next,
          ];
        });
      });
    },
    [note, editorHtml],
  );

  // 切换笔记：清空内存态版本，异步加载该笔记历史版本（带竞态保护）
  useEffect(() => {
    setHistVersions([]);
    lastSnapRef.current = null;
    const noteId = note?.id;
    if (!noteId) return;
    const token = ++loadTokenRef.current;
    (async () => {
      const rows = await listNoteVersions(noteId);
      if (!rows) return;
      if (token !== loadTokenRef.current) return;
      setHistVersions(
        rows.map((v) => ({
          id: v.id,
          timestamp: v.createdAt,
          label: v.label,
          title: v.title,
          content: v.content,
          excerpt: plainFromHtml(v.content).slice(0, 80),
          isCurrent: false,
          milestone: v.milestone,
        })),
      );
    })();
  }, [note?.id]);

  // 展示顺序：当前版本置顶，其后历史（时间倒序）
  const versions = useMemo<VersionInfo[]>(() => {
    if (!note) return [];
    const ds = decSessionRef.current;
    const currentDec = ds && ds.noteId === note.id ? ds : null;
    const currentContent = currentDec ? currentDec.content : note.content;
    const currentExcerpt = currentDec
      ? currentDec.title + ' ' + plainFromHtml(currentContent).slice(0, 80)
      : note.excerpt;
    return [
      {
        id: 'current', timestamp: note.updatedAt, label: '当前版本',
        title: currentDec ? currentDec.title : note.title,
        content: currentContent, excerpt: currentExcerpt, isCurrent: true,
      },
      ...histVersions,
    ];
  }, [note?.id, note?.title, note?.content, note?.excerpt, note?.updatedAt, histVersions, decSession]);

  // 恢复历史版本
  const handleRestoreVersion = useCallback(
    async (v: VersionInfo) => {
      if (!note || v.isCurrent) return;
      const ok = await restoreNoteVersion(note.id, v.id);
      if (!ok) {
        toast.error('恢复失败');
        return;
      }
      onUpdate(note.id, {
        title: v.title,
        content: v.content,
        excerpt: plainFromHtml(v.content).slice(0, 80),
        updatedAt: Date.now(),
      });
      setTitle(v.title);
      const ed = editorRef.current;
      if (ed) {
        applyHtml(ed, v.content);
        const plain = plainFromHtml(v.content);
        setWordCount(plain.length);
        setRichEmpty(!plain);
      }
      lastSnapRef.current = { noteId: note.id, content: v.content };
      toast.success('已恢复到该版本');
    },
    [note, onUpdate],
  );

  // 当前内容保存为里程碑版本
  const handleSaveMilestone = useCallback(async () => {
    if (!note) return;
    const content = getEditorHtml();
    void saveMilestoneVersion({
      id: genId('ver'),
      noteId: note.id,
      title: titleRef.current || '无标题笔记',
      content,
      createdAt: Date.now(),
      label: `里程碑 ${format(Date.now(), 'MM-dd HH:mm')}`,
      milestone: true,
    }).then((v) => {
      setHistVersions((prev) => [
        {
          id: v.id,
          timestamp: v.createdAt,
          label: v.label,
          title: v.title,
          content: v.content,
          excerpt: plainFromHtml(v.content).slice(0, 80),
          isCurrent: false,
          milestone: true,
        },
        ...prev,
      ]);
      toast.success('已保存为里程碑版本');
    });
  }, [note, getEditorHtml]);

  const handleDeleteVersion = useCallback(
    (v: VersionInfo) => {
      if (!note || v.isCurrent) return;
      deleteVersionRecord(note.id, v.id);
      setHistVersions((prev) => prev.filter((x) => x.id !== v.id));
      toast.success('已删除该版本');
    },
    [note],
  );

  const handleClearVersions = useCallback(() => {
    if (!note) return;
    clearVersionRecords(note.id);
    setHistVersions([]);
    toast.success('已清空历史版本');
  }, [note]);

  // --- 切换笔记时重置编辑器内容 ---
  const enteredNoteRef = useRef<string | null>(null);
  const markdownBaseRef = useRef<string>('');
  useEffect(() => {
    const noteId = note?.id ?? null;
    if (noteId === enteredNoteRef.current) {
      return;
    }
    enteredNoteRef.current = noteId;
    markdownBaseRef.current = note ? note.content ?? '' : '';
    const ed = editorRef.current;
    if (note) {
      const content = contentFor(note, decSessionRef.current);
      if (ed) applyHtml(ed, content);
      setWordCount(plainFromHtml(content).length);
      setRichEmpty(!plainFromHtml(content));
    }
    resetSaveState();
    setRevealedPrivate(false);
    setIsMarkdownMode(false);
    // 同步标题
    if (note && note.id !== titleRef.current) {
      setTitle(note.title);
    }
  }, [note?.id]);

  // 会话内解密后用明文回填编辑器（仅同一笔记首次建立会话时）
  const decFillRef = useRef<{ noteId: string | null; done: boolean }>({ noteId: null, done: false });
  useEffect(() => {
    const ds = decSessionRef.current;
    const dsMatch = !!note && !!ds && ds.noteId === note.id;
    if (!dsMatch) {
      decFillRef.current = { noteId: note?.id ?? null, done: false };
      return;
    }
    const ed = editorRef.current;
    if (!ed || isMarkdownMode) return;
    if (decFillRef.current.done && decFillRef.current.noteId === note?.id) return;
    applyHtml(ed, ds.content ?? '');
    const plain = plainFromHtml(ds.content);
    setWordCount(plain.length);
    setRichEmpty(!plain);
    setTitle(ds.title);
    decFillRef.current = { noteId: note?.id ?? null, done: true };
  }, [decSession, note, isMarkdownMode]);

  // 私密笔记从遮罩揭示正文时，回填已保存内容
  useEffect(() => {
    if (!revealedPrivate || isMarkdownMode || !note) return;
    const ed = editorRef.current;
    if (!ed) return;
    const content = contentFor(note, decSessionRef.current);
    applyHtml(ed, content);
    const plain = plainFromHtml(content);
    setWordCount(plain.length);
    setRichEmpty(!plain);
  }, [revealedPrivate, isMarkdownMode, note?.id]);

  // 从 Markdown 切回富文本时：重新挂载后回填 HTML
  const enteredRichRef = useRef(false);
  useEffect(() => {
    if (isMarkdownMode) {
      enteredRichRef.current = true;
      return;
    }
    const justLeftMarkdown = enteredRichRef.current;
    enteredRichRef.current = false;
    if (justLeftMarkdown && note && editorRef.current) {
      const html = markdownBaseRef.current || (note.content ?? '');
      applyHtml(editorRef.current, html);
      const plain = plainFromHtml(html);
      setWordCount(plain.length);
    }
  }, [isMarkdownMode, note]);

  // --- Markdown 模式切换 ---
  const handleToggleMarkdownMode = useCallback(() => {
    if (isMarkdownMode) {
      // Markdown -> 富文本：源码已在编辑中通过 handleMarkdownChange 同步为 HTML 保存，
      // 直接以 note.content 作为回填 HTML。
      setIsMarkdownMode(false);
      if (note) {
        const plain = markdownToPlainText(mdSource);
        setWordCount(plain.replace(/\s/g, '').length);
        setSaved(false);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => { setSaved(true); setLastSavedAt(Date.now()); }, 500);
      }
    } else {
      // 富文本 -> Markdown：用当前 HTML 生成源码
      void toggleMarkdownSource(editorRef.current);
    }
  }, [isMarkdownMode, note, mdSource, setSaved, saveTimerRef, setLastSavedAt]);

  const toggleMarkdownSource = useCallback(async (ed: Editor | null) => {
    const html = ed ? editorHtml(ed) : (note?.content ?? '');
    const md = await htmlToMarkdownSource(html);
    setMdSource(md);
    setIsMarkdownMode(true);
  }, [note, editorHtml]);

  // --- Markdown 源码变更：同步转成 HTML 保存 ---
  const handleMarkdownChange = useCallback(
    (md: string) => {
      setMdSource(md);
      if (!note) return;
      const html = markdownToHtml(md);
      const plain = markdownToPlainText(md);
      onUpdate(note.id, { content: html, excerpt: plainTextToExcerpt(plain, 80), updatedAt: Date.now() });
      saveSnapshot(html);
      setWordCount(plain.replace(/\s/g, '').length);
      setSaved(false);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => { setSaved(true); setLastSavedAt(Date.now()); }, 500);
    },
    [note, onUpdate, saveSnapshot, setWordCount, setSaved, saveTimerRef, setLastSavedAt],
  );

  const getNotebookName = (nbId: string) => MOCK_NOTEBOOKS.find((n) => n.id === nbId)?.name ?? '未分类';

  const notebook = notebooks.find((n) => n.id === note?.notebookId);

  // --- 加密操作 ---
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
        if (note.enc_data) {
          const sec = await decryptNoteSec(password, note.enc_data);
          if (sec) {
            setDecSession({ noteId: note.id, pw: password, title: sec.title, content: sec.content });
            setTitle(sec.title);
            void htmlToMarkdownSource(sec.content).then(setMdSource);
            ok = true;
            toast.success('已解锁，可在本会话内编辑');
          } else {
            setEncryptError('口令错误，无法查看');
          }
        } else {
          setEncryptError('该笔记缺少密文数据');
        }
      }
      if (ok) { setEncryptDialog(null); setEncryptPassword(''); setEncryptConfirm(''); }
    } finally {
      setEncryptBusy(false);
    }
  }, [note, encryptDialog, encryptPassword, encryptConfirm, onEncrypt]);

  // 加密笔记切换到另一篇时关闭旧会话
  useEffect(() => {
    if (!note) return;
    if (decSessionRef.current && decSessionRef.current.noteId !== note.id) {
      setDecSession(null);
    }
  }, [note?.id]);

  // 插入链接 / 图片（TipTap 直接操作选区，不需要手动保存 Range，规避弹窗夺焦问题）
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
    const ed = editorRef.current;
    if (!ed) return;
    if (insertDialog.type === 'link') {
      ed.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      ed.chain().focus().setImage({ src: url }).run();
    }
    setInsertDialog(null);
  }, [insertValue, insertDialog]);

  const handleInsertTable = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, []);

  const handleInsertTodo = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.chain().focus().toggleTaskList().run();
  }, []);

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
        <p className="text-sm text-muted-foreground max-w-xs mb-5">从左侧列表中选择一篇笔记开始编辑，或创建一篇新的笔记</p>
        {onNewNote && (
          <Button size="sm" className="h-8 px-4 gap-1.5 text-xs mb-6" onClick={onNewNote}>
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
                  <span className="text-[10px] text-muted-foreground shrink-0">{format(n.updatedAt, 'MM-dd')}</span>
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
        <div className="px-4 pt-2 pb-1">
          <NoteBreadcrumb
            workspace={{ id: 'ws1', name: workspaceName, color: workspaceColor ?? '#4A7C59', icon: '📝', archived: false, createdAt: 0 }}
            notebook={notebook}
            note={note}
            sameNotebookNotes={notes.filter((n) => n.notebookId === note.notebookId && n.id !== note.id && !n.isDeleted)}
            onSelectNote={(id) => onNavigateNote?.(id)}
            onSelectNotebook={(id) => onNavigateNotebook?.(id)}
          />
        </div>
        <EditorToolbar
          editor={editorRef.current}
          canUndo={canUndo}
          canRedo={canRedo}
          showHistory={showHistory}
          showToc={showToc}
          isFavorite={note.isFavorite}
          isDeleted={isDeleted}
          isMarkdownMode={isMarkdownMode}
          isEncrypted={isEncrypted}
          isPrivate={!!note.isPrivate}
          onEncrypt={openEncryptDialog}
          onTogglePrivate={() => {
            const next = !note.isPrivate;
            if (next && note && editorRef.current) {
              const html = getEditorHtml();
              const plain = plainFromHtml(html);
              onUpdate(note.id, { content: html, excerpt: plain.slice(0, 80), updatedAt: Date.now() });
            }
            onUpdate(note.id, { isPrivate: next });
            setRevealedPrivate(false);
            toast.success(next ? '已标记私密，正文已隐藏' : '已取消私密');
          }}
          onToggleMarkdownMode={handleToggleMarkdownMode}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onToggleHistory={() => setShowHistory((s) => !s)}
          onToggleToc={() => setShowToc((s) => !s)}
          onToggleFavorite={() => { onToggleFavorite(note.id); toast.success(note.isFavorite ? '已取消收藏' : '已添加收藏'); }}
          onAIClick={handleAIClick}
          onInsertLink={handleInsertLink}
          onInsertImage={handleInsertImage}
          onInsertTable={handleInsertTable}
          onInsertTodo={handleInsertTodo}
          onDelete={() => { onDelete(note.id); toast.info('已移至回收站'); }}
          onRestore={() => onRestore(note.id)}
          notebooks={notebooks}
          onMoveNotebook={(nbId) => onUpdate(note.id, { notebookId: nbId })}
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
          onChange={(e) => { setTitle(e.target.value); triggerSave(); }}
          className="text-2xl font-bold border-none px-0 h-auto focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40"
          placeholder="无标题笔记"
          disabled={isDeleted || (isEncrypted && !decOpen)}
        />
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><FolderOpen className="size-3" />{getNotebookName(note.notebookId)}</span>
            <span className="flex items-center gap-1"><Clock className="size-3" />{format(note.updatedAt, 'yyyy-MM-dd HH:mm')}</span>
            <span className="flex items-center gap-1" aria-live="polite">
              {saved ? (
                lastSavedAt ? (<><Check className="size-3 text-success" /><span className="text-success/80">已保存 · {formatRelativeTime(lastSavedAt)}</span></>)
                : (<><Check className="size-3 text-success" /><span className="text-success/80">已保存</span></>)
              ) : (
                <><span className="size-1.5 rounded-full bg-warning animate-pulse" /><span>保存中...</span></>
              )}
            </span>
          </div>
          <EditorTagsPanel
            note={note}
            allTags={MOCK_TAGS}
            onAddTag={(tagId) => { onUpdate(note.id, { tags: [...note.tags, tagId] }); toast.success('已添加标签'); }}
            onRemoveTag={(tagId) => { onUpdate(note.id, { tags: note.tags.filter((t) => t !== tagId) }); }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">天气</span>
            <div className="flex items-center gap-0.5">
              {WEATHER_OPTIONS.map((w) => {
                const active = note.weather === w.value;
                return (
                  <button key={w.value} type="button" title={`${w.label}${active ? '（点击清除）' : ''}`} disabled={isDeleted}
                    onClick={() => onUpdate(note.id, { weather: active ? undefined : w.value })}
                    className={`size-7 rounded-md flex items-center justify-center text-base transition-all ${active ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-muted'}`}>
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
                  <button key={m.value} type="button" title={`${m.label}（${active ? '点击清除' : '点击选择'}）`} disabled={isDeleted}
                    onClick={() => onUpdate(note.id, { mood: active ? undefined : m.value })}
                    className={`size-7 rounded-md flex items-center justify-center text-base transition ${active ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-muted'}`}>
                    {m.icon}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 编辑区 + 历史侧边栏 */}
      {(isEncrypted || note.locked) && !decOpen ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-muted/20">
          <div className="size-16 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center mb-4">
            <Lock className="size-7 text-warning" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">此笔记已加密</h3>
          <p className="text-sm text-muted-foreground max-w-xs mb-5">需输入加密口令方可查看内容，口令不会保存在本地。</p>
          <Button size="sm" onClick={openEncryptDialog} disabled={isDeleted}><Unlock className="size-3.5 mr-1.5" />输入口令解锁</Button>
        </div>
      ) : note.isPrivate && !revealedPrivate ? (
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
          <Button size="sm" onClick={(e) => { e.stopPropagation(); setRevealedPrivate(true); }} disabled={isDeleted}><Eye className="size-3.5 mr-1.5" />点击查看正文</Button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          {note.isPrivate && (
            <button type="button" onClick={() => setRevealedPrivate(false)}
              className="absolute right-4 top-3 z-20 flex items-center gap-1 text-[11px] rounded-md px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors" title="重新隐藏正文">
              <EyeOff className="size-3.5" />重新隐藏
            </button>
          )}

          {showToc && !isMarkdownMode && tocPosition === 'left' && (
            <EditorToc
              editor={editorRef.current}
              position="left"
              onPositionChange={setTocPosition}
              onClose={() => setShowToc(false)}
            />
          )}

          {isMarkdownMode ? (
            <div className="flex-1 overflow-hidden">
              <MarkdownEditorPane value={mdSource} onChange={handleMarkdownChange} disabled={isDeleted} placeholder="在此输入 Markdown 语法…" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto relative">
                <RichTextEditor
                  editor={editor}
                  disabled={!editable}
                  placeholder="开始写下正文内容…"
                  emptyHint={
                    richEmpty && !isDeleted ? (
                      <div className="pointer-events-none select-none">
                        <p className="text-sm text-muted-foreground/60 leading-relaxed">
                          开始写下你的第一篇内容…
                          <br />支持 Markdown、图片、代码块、表格与 LaTeX 公式
                        </p>
                      </div>
                    ) : undefined
                  }
                />
              </div>
            </div>
          )}

          {showToc && !isMarkdownMode && tocPosition === 'right' && (
            <EditorToc
              editor={editorRef.current}
              position="right"
              onPositionChange={setTocPosition}
              onClose={() => setShowToc(false)}
            />
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
                  <h3 className="text-sm font-semibold flex items-center gap-1.5"><History className="size-4 text-primary" />版本历史</h3>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => void handleSaveMilestone()} title="将当前内容保存为一个命名里程碑版本"><Bookmark className="size-3.5" />标记</Button>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                      onClick={() => { if (versions.length <= 1) return; if (window.confirm('确定清空全部历史版本吗？此操作不可撤销。')) handleClearVersions(); }} title="清空全部历史版本">
                      <Trash2 className="size-3.5" />清空
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowHistory(false)}><X className="size-3.5" /></Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                  {versions.map((v, i) => (
                    <motion.div key={v.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: i * 0.04 }}>
                      <div className="flex items-start gap-2 group">
                        <div className="flex flex-col items-center pt-1.5">
                          <div className={cn('size-2.5 rounded-full shrink-0', v.isCurrent ? 'bg-primary' : v.milestone ? 'bg-amber-500' : 'bg-border')} />
                          {i < versions.length - 1 && <div className="w-px flex-1 bg-border/50 mt-1" style={{ minHeight: 36 }} />}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium flex items-center gap-1">{v.milestone && <Bookmark className="size-3 text-amber-500" />}{v.label}</span>
                            {v.milestone ? (
                              <Badge className="text-[10px] h-4 px-1.5 bg-amber-500/15 text-amber-600 border-amber-500/30">里程碑</Badge>
                            ) : v.isCurrent ? (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">当前</Badge>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] text-muted-foreground">{format(v.timestamp, 'MM-dd HH:mm')}</span>
                            <span className="text-[10px] text-muted-foreground">{plainFromHtml(v.content).length} 字</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-2 mb-2 bg-card/60 px-2 py-1.5 rounded">{v.excerpt}</div>
                          {!v.isCurrent && (
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => handleRestoreVersion(v)} className="flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 text-primary hover:bg-primary/10 transition-colors" title="恢复到当前笔记"><RefreshCw className="size-3" />恢复此版本</button>
                              <button type="button" onClick={() => handleDeleteVersion(v)} className="flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="删除此版本"><Trash2 className="size-3" />删除</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="shrink-0 px-3 py-2 border-t border-border/60 text-[11px] text-muted-foreground text-center">自动保存 · 点击「标记」可将当前内容保存为里程碑版本</div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 底部状态栏 */}
      <EditorStatusBar workspaceName={workspaceName} workspaceColor={workspaceColor} wordCount={wordCount} saved={saved} />

      {/* AI 助手面板 */}
      <Suspense fallback={null}>
        <AIAssistantPanel open={aiPanelOpen} onOpenChange={setAiPanelOpen} selectedText={selectedText} onAccept={handleAIAccept} />
      </Suspense>

      {/* 选中文本右键菜单 */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }}
            className="fixed z-50 rounded-lg border border-border/60 bg-popover shadow-lg p-1 w-56" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-b border-border/30 mb-1">AI 写作助手</div>
            {AI_MENU_ITEMS.map(([action, Icon, label]) => (
              <button key={action} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left" onClick={() => triggerAIAction(action, contextMenu.text)}>
                <Icon className="size-3.5 text-primary" />{label}
              </button>
            ))}
            <div className="border-t border-border/30 my-1" />
            {AI_MENU_HEADS.map(([action, Icon, label]) => (
              <button key={action} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left" onClick={() => triggerAIAction(action, contextMenu.text)}>
                <Icon className="size-3.5 text-primary" />{label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 插入链接 / 图片对话框 */}
      <Dialog open={!!insertDialog} onOpenChange={(open) => !open && setInsertDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>{insertDialog?.type === 'image' ? '插入图片' : '插入链接'}</DialogTitle></DialogHeader>
          <div className="py-2">
            <Input value={insertValue} onChange={(e) => setInsertValue(e.target.value)} placeholder="请输入地址，以 http:// 或 https:// 开头" className="h-9"
              onKeyDown={(e) => e.key === 'Enter' && confirmInsert()} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsertDialog(null)}>取消</Button>
            <Button disabled={!/^https?:\/\//i.test(insertValue.trim())} onClick={confirmInsert}><Check className="size-3.5 mr-1" />插入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 加密 / 解锁对话框 */}
      <Dialog open={!!encryptDialog} onOpenChange={(open) => !open && closeEncryptDialog()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>{encryptDialog === 'encrypt' ? '加密笔记' : '解锁笔记'}</DialogTitle></DialogHeader>
          <div className="py-2">
            {encryptDialog === 'encrypt' && (
              <p className="text-xs text-muted-foreground mb-3">设置独立口令加密此笔记。加密后内容仅存密文，口令不落盘，请务必牢记。</p>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">口令</label>
                <Input type="password" value={encryptPassword} onChange={(e) => setEncryptPassword(e.target.value)} placeholder="请输入口令" className="h-9"
                  onKeyDown={(e) => e.key === 'Enter' && !encryptBusy && submitEncrypt()} autoFocus />
              </div>
              {encryptDialog === 'encrypt' && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">确认口令</label>
                  <Input type="password" value={encryptConfirm} onChange={(e) => setEncryptConfirm(e.target.value)} placeholder="再次输入口令" className="h-9"
                    onKeyDown={(e) => e.key === 'Enter' && !encryptBusy && submitEncrypt()} />
                </div>
              )}
              {encryptError && <div className="text-xs text-destructive">{encryptError}</div>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEncryptDialog} disabled={encryptBusy}>取消</Button>
            <Button onClick={submitEncrypt} disabled={encryptBusy}><KeyRound className="size-3.5 mr-1" />{encryptBusy ? '处理中...' : encryptDialog === 'encrypt' ? '加密' : '解锁'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
});