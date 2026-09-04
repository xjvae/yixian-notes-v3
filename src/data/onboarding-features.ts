// EXPORTS: FEATURE_MODULES, FEATURE_GROUPS, FeatureModule, FeatureGroup

import type { LucideIcon } from 'lucide-react';
import {
  StickyNote,
  Calendar,
  CheckSquare,
  BookOpen,
  ClipboardList,
  BarChart3,
  LayoutTemplate,
  Sparkles,
  Share2,
  Bell,
  Sun,
  Download,
  Layers,
  MessageSquarePlus,
} from 'lucide-react';

export interface FeatureModule {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  group: string;
  defaultEnabled?: boolean;
}

export interface FeatureGroup {
  id: string;
  name: string;
  description: string;
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  { id: 'core', name: '核心创作', description: '笔记与写作的基础能力' },
  { id: 'plan', name: '规划管理', description: '任务、日程与项目管理' },
  { id: 'tool', name: '工具增强', description: '提升效率的实用工具' },
  { id: 'advanced', name: '高级功能', description: '进阶能力与扩展模块' },
];

export const FEATURE_MODULES: FeatureModule[] = [
  // 核心创作
  { id: 'notebooks', name: '笔记本管理', description: '多层级笔记本与分类管理', icon: BookOpen, group: 'core', defaultEnabled: true },
  { id: 'templates', name: '模板库', description: '丰富的笔记模板与预设', icon: LayoutTemplate, group: 'core', defaultEnabled: true },

  // 规划管理
  { id: 'todos', name: '待办清单', description: '任务管理与进度追踪', icon: CheckSquare, group: 'plan', defaultEnabled: true },
  { id: 'calendar', name: '日历', description: '日历视图与日程安排', icon: Calendar, group: 'plan', defaultEnabled: true },
  { id: 'daily-review', name: '每日回顾', description: '每日笔记与反思总结', icon: Sun, group: 'plan', defaultEnabled: true },

  // 工具增强
  { id: 'floating-notes', name: '浮动便签', description: '桌面悬浮便签，随时记录', icon: StickyNote, group: 'tool', defaultEnabled: true },
  { id: 'sticky-wall', name: '便签墙', description: '创意灵感便签墙', icon: MessageSquarePlus, group: 'tool', defaultEnabled: false },
  { id: 'clipboard', name: '剪贴板历史', description: '剪贴板内容记录与管理', icon: ClipboardList, group: 'tool', defaultEnabled: true },
  { id: 'export', name: '导出分享', description: '多格式导出与分享', icon: Share2, group: 'tool', defaultEnabled: true },
  { id: 'import', name: '第三方导入', description: '从其他应用导入数据', icon: Download, group: 'tool', defaultEnabled: false },

  // 高级功能
  { id: 'dashboard', name: '统计仪表盘', description: '写作数据可视化统计', icon: BarChart3, group: 'advanced', defaultEnabled: true },
  { id: 'ai-assistant', name: 'AI 写作助手', description: 'AI 辅助写作与润色', icon: Sparkles, group: 'advanced', defaultEnabled: false },
  { id: 'notifications', name: '通知中心', description: '统一消息通知管理', icon: Bell, group: 'advanced', defaultEnabled: false },
  { id: 'flashcards', name: '学习卡片', description: '间隔重复记忆卡片', icon: Layers, group: 'advanced', defaultEnabled: true },
];
