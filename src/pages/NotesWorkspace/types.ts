// EditorPane 子组件共享类型定义

import type { INote, INotebook, ITag } from '@/data/notes';

// --- 主组件 Props ---

export interface EditorPaneProps {
  note: INote | null;
  onUpdate: (id: string, updates: Partial<INote>) => void;
  /** 用独立口令加密笔记；成功返回 true */
  onEncrypt?: (id: string, password: string) => Promise<boolean>;
  /** 用独立口令解密并写回明文；口令错误返回 false */
  onDecrypt?: (id: string, password: string) => Promise<boolean>;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  workspaceName?: string;
  workspaceColor?: string;
  notes?: INote[];
  notebooks?: INotebook[];
  onNavigateNote?: (id: string) => void;
  onNavigateNotebook?: (id: string) => void;
  onNavigateAll?: () => void;
  isLoading?: boolean;
  workspace?: { id: string; name: string; color: string; icon: string };
  workspacePersonality?: any;
  tags?: any[];
  todos?: any[];
  flashcards?: any[];
  onNewNote?: () => void;
  onOpenNote?: (id: string) => void;
  onCreateSticky?: () => void;
  onCreateTodo?: () => void;
}

// --- 工具栏按钮 ---

export interface ToolButtonProps {
  icon: typeof import('lucide-react').Bold;
  label: string;
  command: string;
  value?: string;
}

// --- 工具栏组件 Props ---

export interface EditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  showHistory: boolean;
  isFavorite: boolean;
  isDeleted: boolean;
  /** 是否处于 Markdown 源码模式 */
  isMarkdownMode: boolean;
  /** 当前笔记是否已加密 */
  isEncrypted: boolean;
  /** 当前笔记是否已标记为私密 */
  isPrivate: boolean;
  /** 点击加密/解锁按钮 */
  onEncrypt: () => void;
  /** 点击标记/取消私密 */
  onTogglePrivate: () => void;
  onToggleMarkdownMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleHistory: () => void;
  onToggleFavorite: () => void;
  onAIClick: () => void;
  onInsertLink: () => void;
  onInsertImage: () => void;
  onInsertTable: () => void;
  onInsertCodeBlock: () => void;
  onInsertTodo: () => void;
  onDelete: () => void;
  onRestore: () => void;
  /** 当前笔记所属笔记本列表（用于“移动到…”） */
  notebooks?: INotebook[];
  /** 将当前笔记移动到指定笔记本 */
  onMoveNotebook?: (notebookId: string) => void;
  /** 导出当前笔记（如 markdown / html / txt） */
  onExportNote?: (format: 'markdown' | 'html' | 'txt') => void;
}

// --- 状态栏组件 Props ---

export interface EditorStatusBarProps {
  workspaceName?: string;
  workspaceColor?: string;
  wordCount: number;
  saved: boolean;
}

// --- 标签面板 Props ---

export interface EditorTagsPanelProps {
  note: INote;
  allTags: ITag[];
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
}

// --- 版本信息 ---

export interface VersionInfo {
  id: string;
  timestamp: number;
  label: string;
  title: string;
  content: string;
  excerpt: string;
  isCurrent?: boolean;
}
