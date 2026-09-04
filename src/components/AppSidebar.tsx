import { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import AppLogo from '@/components/AppLogo';
import {
  FileText,
  Star,
  BookOpen,
  Briefcase,
  Coffee,
  Plus,
  ChevronDown,
  StickyNote,
  Settings,
  FolderTree,
  BarChart3,
  ClipboardList,
  LayoutTemplate,
  Layers,
  Wrench,
  Trash2,
  ShieldCheck,
  ArrowRightLeft,
  Sparkles,
  CalendarClock,
  HardDrive,
  Zap,
  Grid2x2,
  Timer,
  Globe,
  Sun,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroupLabel,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { MOCK_NOTEBOOKS, MOCK_TAGS, type INotebook, type ITag } from '@/data/notes';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppSidebarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  noteCounts: Record<string, number>;
  onNewNote: () => void;
  stickyCount: number;
  todoCount: number;
  favoriteCount: number;
  workspaces: { id: string; name: string; icon: string; color: string }[];
  activeWorkspaceId: string;
  workspaceSlogan?: string;
  onSwitchWorkspace: (id: string) => void;
  floatingStickyCount: number;
  onCreateFloating: () => void;
  /** 启用的功能模块 id 集合，控制侧边栏导航项显示 */
  enabledFeatures?: Set<string>;
}

const iconMap: Record<string, typeof FileText> = {
  Briefcase,
  BookOpen,
  Coffee,
  FileText,
};

export default function AppSidebar({
  activeFilter,
  onFilterChange,
  noteCounts,
  onNewNote,
  stickyCount,
  favoriteCount,
  workspaces,
  activeWorkspaceId,
  workspaceSlogan,
  onSwitchWorkspace,
  enabledFeatures,
}: AppSidebarProps) {

  // 功能模块 id -> 侧边栏导航项定位（label 或 path）
  // key 必须与 FEATURE_MODULES[].id 完全一致
  const FEATURE_NAV_MAP: Record<string, { path?: string; label?: string }> = {
    // 核心创作
    notebooks: { label: '笔记本管理' },
    templates: { path: '/templates' },
    // 规划管理
    todos: { label: '待办' },
    calendar: { label: '日历' },
    'daily-review': { path: '/daily-review' },
    // 工具增强
    'floating-notes': { label: '浮动便签' },
    'sticky-wall': { label: '便签墙' },
    clipboard: { path: '/clipboard' },
    dashboard: { path: '/dashboard' },
    'ai-assistant': { label: 'AI 写作助手' },
    notifications: { label: '通知中心' },
    flashcards: { path: '/flashcards' },
  };

  // 判断某个导航项是否应该显示
  const isNavVisible = useCallback(
    (opts: { path?: string; label?: string }) => {
      if (!enabledFeatures) return true;
      const featureId = Object.entries(FEATURE_NAV_MAP).find(([, v]) => {
        if (opts.path && v.path === opts.path) return true;
        if (opts.label && v.label === opts.label) return true;
        return false;
      })?.[0];
      if (!featureId) return true; // 没在映射表里的始终显示（基础功能，如全部笔记/设置/设计说明）
      return enabledFeatures.has(featureId);
    },
    [enabledFeatures],
  );
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const currentWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  const navItems = [
    { path: '/', label: '全部笔记', icon: FileText, filter: 'all' },
    { path: '/', label: '收藏', icon: Star, filter: 'favorite' },
  ];

  // 扩展功能（跨工作区通用）：对应程序内新接入的独立路由页。
  const moreNavItems = [
    { path: '/vault', label: '安全保险库', icon: ShieldCheck },
    { path: '/websites', label: '网址导航', icon: Globe },
    { path: '/import-export', label: '导入导出', icon: ArrowRightLeft },
    { path: '/trash', label: '回收站', icon: Trash2 },
    { path: '/ai', label: 'AI 写作助手', icon: Sparkles },
  ];

  const isWorkspace = pathname === '/notes';
  const isToolsGroup =
    pathname === '/clipboard' ||
    pathname === '/flash' ||
    pathname === '/templates' ||
    pathname === '/search';

  const [toolsGroupOpen, setToolsGroupOpen] = useState(isToolsGroup);
  const isMoreGroup = moreNavItems.some((item) => pathname === item.path);
  const [moreGroupOpen, setMoreGroupOpen] = useState(isMoreGroup);

  // 进入分组内的页面时自动展开对应分组
  useEffect(() => {
    if (isToolsGroup) setToolsGroupOpen(true);
  }, [isToolsGroup]);
  useEffect(() => {
    if (isMoreGroup) setMoreGroupOpen(true);
  }, [isMoreGroup]);

  const handleToolsGroupToggle = () => setToolsGroupOpen((prev) => !prev);
  const handleMoreGroupToggle = () => setMoreGroupOpen((prev) => !prev);

  const handleToolsGroupTitleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // 点击分组标题仅展开/收起，不再默认跳转到剪贴板
    setToolsGroupOpen((prev) => !prev);
  };

  const handleNavClick = (filter: string) => {
    if (!isWorkspace) {
      navigate('/notes');
      requestAnimationFrame(() => onFilterChange(filter));
    } else {
      onFilterChange(filter);
    }
  };

  const getIcon = (iconName: string) => {
    return iconMap[iconName] ?? FileText;
  };

// 领域一级导航（笔记/本地搜索/今日/四象限/番茄钟/剪贴板/闪念）
  // 剪贴板、闪念各自独立整页，不再聚合到一个「采集中心」。
  const PRIMARY_DOMAINS = [
    { path: '/notes', label: '笔记', icon: FileText, isActive: (p: string) => p === '/notes' || p.startsWith('/notes/') },
    { path: '/local-search', label: '本地搜索', icon: HardDrive, isActive: (p: string) => p === '/local-search' },
    { path: '/calendar', label: '今日', icon: CalendarClock, isActive: (p: string) => ['/calendar', '/todos', '/reminders', '/daily-review'].includes(p) },
    { path: '/quadrant', label: '四象限', icon: Grid2x2, isActive: (p: string) => p === '/quadrant' },
    { path: '/pomodoro', label: '番茄钟', icon: Timer, isActive: (p: string) => p === '/pomodoro' },
    { path: '/clipboard', label: '剪贴板', icon: ClipboardList, isActive: (p: string) => ['/clipboard', '/ocr'].includes(p) },
    { path: '/flash', label: '闪念', icon: Zap, isActive: (p: string) => p === '/flash' },
  ];

  // 工作区专属导航配置：切换工作区时左侧导航栏功能自动适配
  const workspaceNavConfig = useMemo(() => {
    switch (activeWorkspaceId) {
      case 'ws1': // 个人笔记
        return {
          dataLabel: '灵感库',
          dataDefaultPath: '/flashcards',
          dataItems: [
            { path: '/flashcards', label: '灵感卡片', icon: Layers },
          ],
          toolLabel: '常用工具',
          toolDefaultPath: '/clipboard',
          toolItems: [
            { path: '/clipboard', label: '剪贴板', icon: ClipboardList },
            { path: '/flash', label: '闪念', icon: Zap },
            { path: '/templates', label: '模板库', icon: LayoutTemplate },
          ],
          planLabel: '日常规划',
          createLabel: '生活创作',
          extraPlanItems: [
            { path: '/quadrant', label: '四象限', icon: Grid2x2 },
            { path: '/pomodoro', label: '番茄钟', icon: Timer },
          ],
        };
      case 'ws2': // 工作项目
        return {
          dataLabel: '项目资料',
          dataDefaultPath: '/flashcards',
          dataItems: [
            { path: '/flashcards', label: '学习卡片', icon: Layers },
          ],
          toolLabel: '效率工具',
          toolDefaultPath: '/clipboard',
          toolItems: [
            { path: '/clipboard', label: '剪贴板', icon: ClipboardList },
            { path: '/flash', label: '闪念', icon: Zap },
            { path: '/templates', label: '模板库', icon: LayoutTemplate },
          ],
          planLabel: '任务管理',
          createLabel: '工作创作',
          extraPlanItems: [
            { path: '/quadrant', label: '四象限', icon: Grid2x2 },
            { path: '/pomodoro', label: '番茄钟', icon: Timer },
          ],
        };
      case 'ws3': // 学习成长
        return {
          dataLabel: '学习资源',
          dataDefaultPath: '/flashcards',
          dataItems: [
            { path: '/flashcards', label: '学习卡片', icon: Layers },
          ],
          toolLabel: '学习工具',
          toolDefaultPath: '/clipboard',
          toolItems: [
            { path: '/clipboard', label: '剪贴板', icon: ClipboardList },
            { path: '/flash', label: '闪念', icon: Zap },
            { path: '/templates', label: '模板库', icon: LayoutTemplate },
          ],
          planLabel: '学习规划',
          createLabel: '学习创作',
          extraPlanItems: [
            { path: '/quadrant', label: '四象限', icon: Grid2x2 },
            { path: '/pomodoro', label: '番茄钟', icon: Timer },
          ],
        };
      default:
        return {
          dataLabel: '学习卡片',
          dataDefaultPath: '/flashcards',
          dataItems: [
            { path: '/flashcards', label: '学习卡片', icon: Layers },
          ],
          toolLabel: '工具箱',
          toolDefaultPath: '/clipboard',
          toolItems: [
            { path: '/clipboard', label: '剪贴板', icon: ClipboardList },
            { path: '/flash', label: '闪念', icon: Zap },
            { path: '/templates', label: '模板库', icon: LayoutTemplate },
          ],
          planLabel: '规划执行',
          createLabel: '创作',
        };
    }
  }, [activeWorkspaceId]);

  const toolItems = workspaceNavConfig.toolItems;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3 gap-2.5">
        <div className="flex items-center gap-2.5 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0">
          <AppLogo size={32} />
          <div className="flex-1 min-w-0 leading-tight group-data-[state=collapsed]:hidden">
            <div className="text-sm font-semibold text-sidebar-foreground truncate">一闲笔记</div>
            <div className="text-[11px] text-muted-foreground truncate">v3.1.0</div>
          </div>
        </div>

        <div className="group-data-[state=collapsed]:hidden space-y-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-auto justify-between gap-2 rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 px-2.5 py-2 hover:bg-sidebar-accent/70"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="size-6 shrink-0 rounded-md flex items-center justify-center text-sm"
                    style={{ backgroundColor: currentWorkspace?.color + '20', color: currentWorkspace?.color }}
                  >
                    {currentWorkspace?.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-sidebar-foreground truncate">
                      {currentWorkspace?.name}
                    </span>
                    <span className="block text-[10px] text-muted-foreground truncate">切换工作区</span>
                  </span>
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-56">
              <DropdownMenuLabel>切换工作区</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => onSwitchWorkspace(ws.id)}
                  className="gap-2"
                >
                  <span
                    className="size-5 rounded flex items-center justify-center text-xs"
                    style={{ backgroundColor: ws.color + '20', color: ws.color }}
                  >
                    {ws.icon}
                  </span>
                  <span className="flex-1">{ws.name}</span>
                  {ws.id === activeWorkspaceId && (
                    <span className="size-1.5 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-muted-foreground">
                <Plus className="size-4" />
                新建工作区
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 工作区专属标语 */}
          {workspaceSlogan && (
            <div className="flex items-center gap-1.5 px-2.5 py-1">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: currentWorkspace?.color }}
              />
              <span
                className="min-w-0 truncate text-[11px] font-medium"
                style={{ color: currentWorkspace?.color }}
              >
                {workspaceSlogan}
              </span>
            </div>
          )}
        </div>

        <div className="group-data-[state=collapsed]:hidden">
          <Button
            size="sm"
            className="w-full justify-start gap-2 h-9"
            onClick={() => {
              if (!isWorkspace) navigate('/notes');
              onNewNote();
              if (!isWorkspace) {
                setTimeout(onNewNote, 50);
              }
              toast.success('已创建新笔记');
            }}
          >
            <Plus className="size-4" />
            新建笔记
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* 统计仪表盘（一级独立导航） */}
        {isNavVisible({ path: '/dashboard' }) && (
          <SidebarGroup className="p-2 pb-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="统计仪表盘"
                  isActive={pathname === '/dashboard' || pathname === '/'}
                >
                  <NavLink to="/dashboard" className="flex items-center gap-2">
                    <BarChart3 className="size-4 shrink-0" />
                    <span className="flex-1 group-data-[state=collapsed]:hidden">
                      统计仪表盘
                    </span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* 领域一级导航 */}
        <SidebarGroup className="p-2">
          <SidebarGroupLabel className="group-data-[state=collapsed]:hidden px-2">
            工作台导航
          </SidebarGroupLabel>
          <SidebarMenu>
            {PRIMARY_DOMAINS.map((d) => {
              const Icon = d.icon;
              const active = d.isActive(pathname);
              return (
                <SidebarMenuItem key={d.path}>
                  <SidebarMenuButton
                    asChild
                    tooltip={d.label}
                    isActive={active}
                  >
                    <NavLink to={d.path} className="flex items-center gap-2">
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 group-data-[state=collapsed]:hidden">{d.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* 笔记工作区 */}
        <SidebarGroup className="p-2">
          <SidebarGroupLabel className="group-data-[state=collapsed]:hidden px-2">
            笔记工作区
          </SidebarGroupLabel>
           <SidebarMenu>
             {navItems.map((item) => {
               const Icon = item.icon;
               const isActive = isWorkspace && activeFilter === item.filter;
               if (!isNavVisible({ label: item.label })) return null;
              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.label}
                    isActive={isActive}
                  >
                    <button
                      type="button"
                      onClick={() => handleNavClick(item.filter)}
                      className="flex items-center gap-2 w-full text-left"
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 group-data-[state=collapsed]:hidden">
                        {item.label}
                      </span>
                      {!collapsed && item.filter === 'all' && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-4 px-1.5 font-normal"
                        >
                          {noteCounts.all ?? 0}
                        </Badge>
                      )}
                      {!collapsed && item.filter === 'favorite' && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-4 px-1.5 font-normal"
                        >
                          {favoriteCount ?? 0}
                        </Badge>
                      )}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* 笔记本折叠区 */}
        <SidebarGroup className="p-2 pt-0">
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroupLabel asChild className="group-data-[state=collapsed]:hidden">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1 hover:bg-sidebar-accent/50 rounded-md cursor-pointer">
                <span>笔记本</span>
                <ChevronDown className="size-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarMenu>
                {MOCK_NOTEBOOKS.map((nb: INotebook) => {
                  const Icon = getIcon(nb.icon);
                  const isActive = isWorkspace && activeFilter === `nb:${nb.id}`;
                  return (
                    <SidebarMenuItem key={nb.id}>
                      <SidebarMenuButton
                        asChild
                        tooltip={nb.name}
                        isActive={isActive}
                      >
                        <button
                          type="button"
                          onClick={() => handleNavClick(`nb:${nb.id}`)}
                          className="flex items-center gap-2 w-full text-left"
                        >
                          <span
                            className={cn(
                              'size-2 shrink-0 rounded-full',
                              isActive ? 'bg-primary' : 'opacity-70',
                            )}
                            style={{ backgroundColor: isActive ? undefined : nb.color }}
                          />
                          <Icon
                            className="size-4 shrink-0"
                            style={{ color: isActive ? undefined : nb.color }}
                          />
                          <span className="flex-1 group-data-[state=collapsed]:hidden truncate">
                            {nb.name}
                          </span>
                          {!collapsed && (
                            <span className="text-[10px] text-muted-foreground">
                              {noteCounts[`nb:${nb.id}`] ?? 0}
                            </span>
                          )}
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* 标签折叠区 */}
        <SidebarGroup className="p-2 pt-0">
          <Collapsible className="group/collapsible">
            <SidebarGroupLabel asChild className="group-data-[state=collapsed]:hidden">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1 hover:bg-sidebar-accent/50 rounded-md cursor-pointer">
                <span>标签</span>
                <ChevronDown className="size-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarMenu>
                {MOCK_TAGS.map((tag: ITag) => {
                  const isActive = isWorkspace && activeFilter === `tag:${tag.id}`;
                  return (
                    <SidebarMenuItem key={tag.id}>
                      <SidebarMenuButton
                        asChild
                        tooltip={tag.name}
                        isActive={isActive}
                      >
                        <button
                          type="button"
                          onClick={() => handleNavClick(`tag:${tag.id}`)}
                          className="flex items-center gap-2 w-full text-left"
                        >
                          <span
                            className="size-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="flex-1 group-data-[state=collapsed]:hidden truncate">
                            {tag.name}
                          </span>
                          {!collapsed && (
                            <span className="text-[10px] text-muted-foreground">
                              {noteCounts[`tag:${tag.id}`] ?? 0}
                            </span>
                          )}
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

         {/* 创作 */}
         {(isNavVisible({ label: '笔记本管理' }) || isNavVisible({ label: '便签墙' })) && (
           <SidebarGroup className="p-2 pt-0">
             <SidebarGroupLabel className="group-data-[state=collapsed]:hidden px-2">
               {workspaceNavConfig.createLabel}
             </SidebarGroupLabel>
             <SidebarMenu>
               {isNavVisible({ label: '笔记本管理' }) && (
                 <SidebarMenuItem>
                   <SidebarMenuButton
                     asChild
                     tooltip="笔记本管理"
                     isActive={pathname === '/notebooks'}
                   >
                     <NavLink to="/notebooks" className="flex items-center gap-2">
                       <FolderTree className="size-4 shrink-0" />
                       <span className="group-data-[state=collapsed]:hidden">笔记本管理</span>
                     </NavLink>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
               )}
               {isNavVisible({ label: '便签墙' }) && (
                 <SidebarMenuItem>
                   <SidebarMenuButton
                     asChild
                     tooltip="便签墙"
                     isActive={pathname === '/sticky-wall'}
                   >
                     <NavLink to="/sticky-wall" className="flex items-center gap-2">
                       <StickyNote className="size-4 shrink-0" />
                       <span className="flex-1 group-data-[state=collapsed]:hidden">便签墙</span>
                       {!collapsed && (
                         <span className="text-[10px] text-muted-foreground">{stickyCount}</span>
                       )}
                     </NavLink>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
               )}
             </SidebarMenu>
           </SidebarGroup>
         )}

         {/* 快捷工具区：数据空间 / 日常回顾（随工作区与功能开关显示） */}
         {workspaceNavConfig.dataItems.filter((item) => isNavVisible({ path: item.path })).length > 0 && (
            <SidebarGroup className="p-2 pt-0">
              <SidebarGroupLabel className="group-data-[state=collapsed]:hidden px-2">
                {workspaceNavConfig.dataLabel}
              </SidebarGroupLabel>
              <SidebarMenu>
                {workspaceNavConfig.dataItems
                  .filter((item) => isNavVisible({ path: item.path }))
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          tooltip={item.label}
                          isActive={pathname === item.path}
                        >
                          <NavLink to={item.path} className="flex items-center gap-2">
                            <Icon className="size-4 shrink-0" />
                            <span className="group-data-[state=collapsed]:hidden">{item.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroup>
          )}

         {isNavVisible({ path: '/daily-review' }) && (
           <SidebarGroup className="p-2 pt-0">
             <SidebarGroupLabel className="group-data-[state=collapsed]:hidden px-2">
               回顾
             </SidebarGroupLabel>
             <SidebarMenu>
               <SidebarMenuItem>
                 <SidebarMenuButton
                   asChild
                   tooltip="每日回顾"
                   isActive={pathname === '/daily-review'}
                 >
                   <NavLink to="/daily-review" className="flex items-center gap-2">
                     <Sun className="size-4 shrink-0" />
                     <span className="flex-1 group-data-[state=collapsed]:hidden">每日回顾</span>
                   </NavLink>
                 </SidebarMenuButton>
               </SidebarMenuItem>
             </SidebarMenu>
           </SidebarGroup>
         )}

         {/* 工具箱（可折叠） */}
         {(() => {
           // 工具箱内已被一级域聚合（剪贴板/闪念/今日等）的路由不再重复露出
           const coveredByPrimary = ['/clipboard', '/flash', '/ocr', '/flashcards', '/todos', '/reminders', '/daily-review'];
          const visible = toolItems.filter((item) => isNavVisible({ path: item.path }) && !coveredByPrimary.includes(item.path));
          if (visible.length === 0) return null;
           return (
             <SidebarGroup className="p-2 pt-0">
               <Collapsible open={toolsGroupOpen} onOpenChange={setToolsGroupOpen} className="group/collapsible">
                 <div className="flex items-center group-data-[state=collapsed]:hidden">
                   <button
                     type="button"
                     onClick={handleToolsGroupTitleClick}
                     className="flex-1 flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-md transition-colors text-left"
                   >
                     <Wrench className="size-3 shrink-0" />
                     <span>{workspaceNavConfig.toolLabel}</span>
                   </button>
                   <CollapsibleTrigger asChild>
                     <button
                       type="button"
                       onClick={handleToolsGroupToggle}
                       className="p-1 rounded-md hover:bg-sidebar-accent/50 transition-colors"
                       aria-label={toolsGroupOpen ? '收起工具箱' : '展开工具箱'}
                     >
                       <ChevronDown className="size-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                     </button>
                   </CollapsibleTrigger>
                 </div>
                 <CollapsibleContent className="overflow-hidden transition-all duration-200 data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
                   <SidebarMenu>
                     {visible.map((item) => {
                       const Icon = item.icon;
                       return (
                         <SidebarMenuItem key={item.path}>
                           <SidebarMenuButton
                             asChild
                             tooltip={item.label}
                             isActive={pathname === item.path}
                           >
                             <NavLink to={item.path} className="flex items-center gap-2">
                               <Icon className="size-4 shrink-0" />
                               <span className="group-data-[state=collapsed]:hidden">{item.label}</span>
                             </NavLink>
                           </SidebarMenuButton>
                         </SidebarMenuItem>
                       );
                     })}
                   </SidebarMenu>
                 </CollapsibleContent>
               </Collapsible>
             </SidebarGroup>
           );
         })()}

        {/* 扩展（跨工作区通用） */}
         {(() => {
           const visible = moreNavItems.filter((item) => isNavVisible({ path: item.path }));
           if (visible.length === 0) return null;
           return (
             <SidebarGroup className="p-2 pt-0">
               <Collapsible open={moreGroupOpen} onOpenChange={setMoreGroupOpen} className="group/collapsible">
                 <div className="flex items-center group-data-[state=collapsed]:hidden">
                   <span className="flex-1 flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                     <Sparkles className="size-3 shrink-0" />
                     <span>扩展</span>
                   </span>
                   <CollapsibleTrigger asChild>
                     <button
                       type="button"
                       onClick={handleMoreGroupToggle}
                       className="p-1 rounded-md hover:bg-sidebar-accent/50 transition-colors"
                       aria-label={moreGroupOpen ? '收起扩展' : '展开扩展'}
                     >
                       <ChevronDown className="size-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                     </button>
                   </CollapsibleTrigger>
                 </div>
                 <CollapsibleContent className="overflow-hidden transition-all duration-200 data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
                   <SidebarMenu>
                     {visible.map((item) => {
                       const Icon = item.icon;
                       return (
                         <SidebarMenuItem key={item.path}>
                           <SidebarMenuButton
                             asChild
                             tooltip={item.label}
                             isActive={pathname === item.path}
                           >
                             <NavLink to={item.path} className="flex items-center gap-2">
                               <Icon className="size-4 shrink-0" />
                               <span className="group-data-[state=collapsed]:hidden">{item.label}</span>
                             </NavLink>
                           </SidebarMenuButton>
                         </SidebarMenuItem>
                       );
                     })}
                   </SidebarMenu>
                 </CollapsibleContent>
               </Collapsible>
             </SidebarGroup>
           );
         })()}

        {/* 弹性占位 */}
        <div className="flex-1" />

         {/* 系统 */}
         <SidebarGroup className="p-2 mt-auto">
           <SidebarGroupLabel className="group-data-[state=collapsed]:hidden px-2">
             系统
           </SidebarGroupLabel>
           <SidebarMenu>
            <SidebarMenuItem>
               <SidebarMenuButton
                 asChild
                 tooltip="设置"
                 isActive={pathname === '/settings' || pathname === '/privacy' || pathname === '/grammar'}
               >
                 <NavLink to="/settings" className="flex items-center gap-2">
                   <Settings className="size-4 shrink-0" />
                   <span className="group-data-[state=collapsed]:hidden">设置</span>
                 </NavLink>
               </SidebarMenuButton>
             </SidebarMenuItem>
           </SidebarMenu>
         </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[state=collapsed]:justify-center" />
    </Sidebar>
  );
}
