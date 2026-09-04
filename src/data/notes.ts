// EXPORTS（类型与示例数据）：
// 类型: INote, INotebook, ITag, IStickyNote, INoteVersion, ISettings, ITodo, ITemplate,
//       IClipboardItem, IPrivacySettings, IReminder, INotification, IDailyRecord,
//       IFlashThought, IFlashcard, IWorkspace, IWorkspaceQuickAction, IWorkspacePersonality
// 工作区: WORKSPACE_THEMES, WorkspaceTemplateKey, WorkspaceTemplate, WORKSPACE_TEMPLATES,
//         IWorkspacePersonality, WORKSPACE_PERSONALITY_MAP
// 示例数据: MOCK_*（NOTES/NOTEBOOKS/TAGS/STICKY_NOTES/INITIAL_SETTINGS/TODOS/TEMPLATES/
//           CLIPBOARD/INITIAL_PRIVACY/REMINDERS/NOTIFICATIONS/DAILY_RECORD/FLASH_THOUGHTS/
//           FLASHCARDS/WORKSPACES）
// 说明：云同步协作、自动化工作流、数据库、习惯、代码片段、知识库、时间线、手绘等模块已移除。

export interface INote {
  id: string
  title: string
  content: string
  excerpt: string
  notebookId: string
  tags: string[]
  isFavorite: boolean
  isDeleted: boolean
  isPinned: boolean
  /** 自定义排序权重（越小越靠前），用于"手动排序"模式 */
  sortOrder: number
  /** 记录笔记当天的天气（可选，如 'sunny' / 'cloudy' / 'rain' / 'snow' / 'foggy' …） */
  weather?: string
  /** 记录笔记时的心情（可选，如 'happy' / 'calm' / 'sad' / 'angry' / 'tired' …） */
  mood?: string
  /** 单笔记独立加密（与全局加密无关，使用独立口令） */
  encrypted?: boolean
  /** 加密后的内容密文（encryptText 产物；加密时明文标题/正文会被置空） */
  enc_data?: string
  /** 锁定：锁定后无法编辑/操作（仅展示解锁） */
  locked?: boolean
  /** 是否标记为私密：私密笔记正文默认隐藏遮罩，可点击临时查看 */
  isPrivate?: boolean
  createdAt: number
  updatedAt: number
}

export interface INotebook {
  id: string
  name: string
  icon: string
  color: string
  description?: string
  createdAt: number
  archived?: boolean
}

export interface ITag {
  id: string
  name: string
  color: string
}

export interface IStickyNote {
  id: string
  content: string
  color: string
  x: number
  y: number
  notebookId: string
  createdAt: number
  updatedAt: number
  /** 是否置顶（画布层级最高） */
  pinned?: boolean
  /** 便签宽度（px），默认 208 */
  width?: number
  /** 便签高度（px），默认 208 */
  height?: number
  /** 画布层叠顺序（越大越靠前） */
  zIndex?: number
}

export interface INoteVersion {
  id: string
  noteId: string
  title: string
  content: string
  excerpt: string
  timestamp: number
  label: string
}

export interface ISettings {
  theme: 'light' | 'dark' | 'system'
  fontSize: 'small' | 'medium' | 'large'
  density: 'compact' | 'comfortable' | 'spacious'
  editorFont: 'sans' | 'serif' | 'mono'
  autoSaveInterval: number
  spellCheck: boolean
  shortcuts: Record<string, string>
  clipboardMonitor: boolean
  defaultWorkspaceId?: string
  workspaceTransition: boolean
  themePack: string
  encryptionEnabled?: boolean
  // 精简模式：只显示系统托盘与浮动便签，隐藏完整主窗口
  liteMode?: boolean
  // AI 助手配置（可选）
  aiApiKey?: string
  aiModel?: string
  aiBaseUrl?: string
}

export interface ITodo {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'completed'
  dueDate: number | null
  notebookId: string
  tags: string[]
  relatedNoteId: string | null
  createdAt: number
  updatedAt: number
}

export interface ITemplate {
  id: string
  name: string
  description: string
  category: string
  preview: string
  content: string
  usageCount: number
  isFavorite: boolean
  isCustom: boolean
  createdAt: number
}

export interface IClipboardItem {
  id: string
  type: 'text' | 'image' | 'link'
  content: string
  preview: string
  sourceApp: string
  createdAt: number
  isPinned: boolean
  /** 复制次数（重复内容自动合并并累加） */
  copyCount?: number
}

export interface IPrivacySettings {
  enabled: boolean
  pinCode: string
  autoLockMinutes: number
  fingerprintEnabled: boolean
  privateNoteIds: string[]
}

// v4.0 新增接口
export interface IReminder {
  id: string
  targetId: string
  targetType: 'note' | 'todo'
  title: string
  time: number
  repeat: 'none' | 'daily' | 'weekly' | 'monthly'
  isRead: boolean
  createdAt: number
}

export interface INotification {
  id: string
  title: string
  content: string
  type: 'reminder' | 'info' | 'system'
  isRead: boolean
  createdAt: number
}

export interface IDailyRecord {
  date: string
  noteCount: number
  wordCount: number
  todoCompleted: number
  streakDays: number
}

export interface IFlashThought {
  id: string
  content: string
  status: 'pending' | 'organized'
  createdAt: number
  /** 置顶收藏（独立页一键置顶，可选） */
  pinned?: boolean
}

export interface ISharedLink {
  id: string
  noteId: string
  token: string
  createdAt: number
  expiresAt: number | null
  viewCount: number
}

const now = Date.now()
const day = 86400000

export const MOCK_NOTEBOOKS: INotebook[] = [
  { id: 'nb1', name: '工作笔记', icon: '💼', color: '#3F7F5F', description: '工作相关的笔记与项目文档', createdAt: now - 90 * day, archived: false },
  { id: 'nb2', name: '读书学习', icon: '📚', color: '#6B8AA8', description: '读书笔记、学习心得与知识卡片', createdAt: now - 60 * day, archived: false },
  { id: 'nb3', name: '生活日常', icon: '☕', color: '#C9A87C', description: '旅行、美食、生活记录', createdAt: now - 45 * day, archived: false },
  { id: 'nb4', name: '灵感收集', icon: '💡', color: '#A08BC7', description: '各种灵感碎片与创意想法', createdAt: now - 30 * day, archived: false },
  { id: 'nb5', name: '项目归档', icon: '📦', color: '#B08C7A', description: '已完成项目的文档归档', createdAt: now - 120 * day, archived: true },
]

export const MOCK_TAGS: ITag[] = [
  { id: 't1', name: '重要', color: '#ef4444' },
  { id: 't2', name: '灵感', color: '#8b5cf6' },
  { id: 't3', name: '待办', color: '#f59e0b' },
  { id: 't4', name: '知识', color: '#06b6d4' },
  { id: 't5', name: '随想', color: '#ec4899' },
]

export const MOCK_NOTES: INote[] = [
  {
    id: 'n1',
    title: '产品设计评审纪要',
    content: '<h1>产品设计评审纪要</h1><p>本次评审围绕新版首页展开讨论，核心结论如下：</p><ul><li>首屏信息密度需降低，突出核心价值</li><li>增加用户案例模块，提升信任感</li><li>导航结构简化为 4 个主入口</li></ul><p><strong>下一步行动：</strong>设计师在本周五前输出高保真稿。</p>',
    excerpt: '本次评审围绕新版首页展开讨论，核心结论包括首屏信息密度优化、用户案例模块新增、导航结构简化等...',
    notebookId: 'nb1',
    tags: ['t1', 't3'],
    isFavorite: true,
    isDeleted: false,
    isPinned: false,
    sortOrder: 0,
    createdAt: now - 3 * day,
    updatedAt: now - 1 * day,
  },
  {
    id: 'n2',
    title: '《原子习惯》读书笔记',
    content: '<h1>《原子习惯》读书笔记</h1><blockquote>习惯是自我提升的复利。</blockquote><h2>核心观点</h2><p>1% 的进步看似微不足道，但一年后你会进步 37 倍。关键不在于单次改变的大小，而在于是否持续。</p><h2>四大法则</h2><ol><li>让它显而易见</li><li>让它有吸引力</li><li>让它简便易行</li><li>让它令人满足</li></ol>',
    excerpt: '习惯是自我提升的复利。1% 的进步看似微不足道，但一年后你会进步 37 倍...',
    notebookId: 'nb2',
    tags: ['t4', 't2'],
    isFavorite: false,
    isDeleted: false,
    isPinned: false,
    sortOrder: 1,
    createdAt: now - 7 * day,
    updatedAt: now - 2 * day,
  },
  {
    id: 'n3',
    title: '周末旅行计划',
    content: '<h1>周末杭州两日游</h1><h2>Day 1</h2><ul><li>上午：西湖骑行</li><li>下午：灵隐寺</li><li>晚上：河坊街小吃</li></ul><h2>Day 2</h2><ul><li>上午：龙井村品茶</li><li>下午：宋城</li></ul><p><em>备注：提前订好高铁票和酒店。</em></p>',
    excerpt: '周末杭州两日游计划，包含西湖骑行、灵隐寺、河坊街、龙井村等行程安排...',
    notebookId: 'nb3',
    tags: ['t3', 't5'],
    isFavorite: true,
    isDeleted: false,
    isPinned: false,
    sortOrder: 2,
    createdAt: now - 5 * day,
    updatedAt: now - 4 * day,
  },
  {
    id: 'n4',
    title: '前端性能优化清单',
    content: '<h1>前端性能优化清单</h1><h2>加载性能</h2><ul><li>图片懒加载 + WebP 格式</li><li>代码分割与路由懒加载</li><li>CDN 加速静态资源</li></ul><h2>运行性能</h2><ul><li>虚拟列表处理大数据</li><li>防抖节流优化频繁操作</li><li>减少重排重绘</li></ul><h2>缓存策略</h2><p>合理设置 HTTP 缓存头，利用 Service Worker 实现离线访问。</p>',
    excerpt: '前端性能优化清单，涵盖加载性能、运行性能、缓存策略三大方向...',
    notebookId: 'nb1',
    tags: ['t4'],
    isFavorite: false,
    isDeleted: false,
    isPinned: false,
    sortOrder: 3,
    createdAt: now - 10 * day,
    updatedAt: now - 6 * day,
  },
  {
    id: 'n5',
    title: '关于时间管理的几点思考',
    content: '<h1>关于时间管理的几点思考</h1><p>时间管理的本质不是管理时间，而是管理自己的注意力。</p><p>我们每天真正高效的时间其实只有 2-3 小时，把它用在最重要的事情上，远比堆砌时长更有价值。</p><p><strong>我的实践：</strong>每天早上确定 3 件最重要的事，完成它们就等于赢了这一天。</p>',
    excerpt: '时间管理的本质不是管理时间，而是管理自己的注意力。每天真正高效的时间只有 2-3 小时...',
    notebookId: 'nb2',
    tags: ['t2', 't5'],
    isFavorite: false,
    isDeleted: false,
    isPinned: false,
    sortOrder: 4,
    createdAt: now - 14 * day,
    updatedAt: now - 8 * day,
  },
  {
    id: 'n6',
    title: '新项目启动会议备忘',
    content: '<h1>新项目启动会议</h1><p><strong>时间：</strong>2024年1月15日 10:00</p><p><strong>参会人：</strong>产品、设计、前端、后端</p><h2>项目目标</h2><p>Q1 结束前完成 MVP 版本上线，验证核心假设。</p><h2>里程碑</h2><ul><li>1月底：需求评审完成</li><li>2月中：设计稿交付</li><li>3月底：开发完成上线</li></ul>',
    excerpt: '新项目启动会议备忘，项目目标为 Q1 结束前完成 MVP 版本上线，验证核心假设...',
    notebookId: 'nb1',
    tags: ['t1', 't3'],
    isFavorite: false,
    isDeleted: false,
    isPinned: false,
    sortOrder: 5,
    createdAt: now - 1 * day,
    updatedAt: now,
  },
  {
    id: 'n7',
    title: '咖啡冲泡心得',
    content: '<h1>手冲咖啡小记</h1><p>最近迷上了手冲咖啡，分享一下心得：</p><ol><li><strong>研磨度：</strong>中粗研磨，类似细砂糖</li><li><strong>水温：</strong>90-92℃，浅烘豆水温稍高</li><li><strong>粉水比：</strong>1:15，15g 粉配 225g 水</li><li><strong>萃取时间：</strong>2分30秒左右</li></ol><p>享受慢下来的过程 ☕️</p>',
    excerpt: '手冲咖啡心得分享，包括研磨度、水温、粉水比、萃取时间等要点...',
    notebookId: 'nb3',
    tags: ['t5'],
    isFavorite: true,
    isDeleted: false,
    isPinned: false,
    sortOrder: 6,
    createdAt: now - 20 * day,
    updatedAt: now - 12 * day,
  },
  {
    id: 'n8',
    title: '已删除的笔记示例',
    content: '<p>这是一条在回收站中的笔记。</p>',
    excerpt: '这是一条在回收站中的笔记...',
    notebookId: 'nb3',
    tags: [],
    isFavorite: false,
    isDeleted: true,
    isPinned: false,
    sortOrder: 7,
    createdAt: now - 30 * day,
    updatedAt: now - 25 * day,
  },
]

export const MOCK_STICKY_NOTES: IStickyNote[] = [
  {
    id: 's1',
    content: '本周目标：完成设计系统 v2.0 交付\n- [ ] 组件规范\n- [ ] 交互文档\n- [ ] 设计走查',
    color: '#fef3c7',
    x: 20,
    y: 20,
    notebookId: 'nb1',
    createdAt: now - 2 * 86400000,
    updatedAt: now - 1 * 86400000,
  },
  {
    id: 's2',
    content: '读书清单：\n1. 《深度工作》\n2. 《卡片笔记写作法》\n3. 《认知觉醒》',
    color: '#dcfce7',
    x: 280,
    y: 40,
    notebookId: 'nb2',
    createdAt: now - 5 * 86400000,
    updatedAt: now - 3 * 86400000,
  },
  {
    id: 's3',
    content: '灵感：晨间日记模板\n- 今日三件事\n- 感恩记录\n- 心情指数',
    color: '#fce7f3',
    x: 540,
    y: 20,
    notebookId: 'nb3',
    createdAt: now - 1 * 86400000,
    updatedAt: now - 12 * 3600000,
  },
  {
    id: 's4',
    content: '待买清单：\n• 咖啡豆\n• 笔记本\n• 鲜花 💐',
    color: '#dbeafe',
    x: 150,
    y: 260,
    notebookId: 'nb3',
    createdAt: now - 7 * 86400000,
    updatedAt: now - 4 * 86400000,
  },
  {
    id: 's5',
    content: '产品 idea：\nAI 自动摘要 + 知识图谱关联\n让笔记之间产生连接',
    color: '#ede9fe',
    x: 420,
    y: 280,
    notebookId: 'nb1',
    createdAt: now - 3 * 86400000,
    updatedAt: now - 2 * 86400000,
  },
  {
    id: 's6',
    content: '健康提醒 💪\n每天喝水 2L\n久坐一小时起身活动\n23:30 前睡觉',
    color: '#ccfbf1',
    x: 680,
    y: 240,
    notebookId: 'nb3',
    createdAt: now - 10 * 86400000,
    updatedAt: now - 6 * 86400000,
  },
]

export const MOCK_INITIAL_SETTINGS: ISettings = {
  theme: 'light',
  fontSize: 'medium',
  density: 'comfortable',
  editorFont: 'sans',
  autoSaveInterval: 400,
  spellCheck: true,
  clipboardMonitor: true,
  shortcuts: {
    newNote: 'Ctrl+N',
    search: 'Ctrl+K',
    save: 'Ctrl+S',
    bold: 'Ctrl+B',
    italic: 'Ctrl+I',
    underline: 'Ctrl+U',
    toggleSidebar: 'Ctrl+\\',
    quickSwitch: 'Ctrl+Tab',
  },
  workspaceTransition: true,
  themePack: 'bamboo',
  liteMode: false,
}

export const MOCK_TODOS: ITodo[] = [
  { id: 'td1', title: '完成产品设计评审稿', description: '整理评审会议记录，输出最终版设计方案', priority: 'high', status: 'pending', dueDate: now + day, notebookId: 'nb1', tags: ['t1', 't3'], relatedNoteId: 'n1', createdAt: now - 3 * day, updatedAt: now - day },
  { id: 'td2', title: '读完《原子习惯》第 5-8 章', description: '做好读书笔记，整理核心观点', priority: 'medium', status: 'pending', dueDate: now + 2 * day, notebookId: 'nb2', tags: ['t4'], relatedNoteId: 'n2', createdAt: now - 5 * day, updatedAt: now - 2 * day },
  { id: 'td3', title: '预订杭州高铁票和酒店', description: '周末出行计划准备', priority: 'medium', status: 'completed', dueDate: now - day, notebookId: 'nb3', tags: ['t3'], relatedNoteId: 'n3', createdAt: now - 6 * day, updatedAt: now - 3 * day },
  { id: 'td4', title: '优化首页加载性能', description: '图片懒加载 + 代码分割 + CDN', priority: 'high', status: 'pending', dueDate: now + 3 * day, notebookId: 'nb1', tags: ['t4'], relatedNoteId: 'n4', createdAt: now - 2 * day, updatedAt: now - day },
  { id: 'td5', title: '写一篇关于时间管理的博客', description: '基于近期思考整理成文', priority: 'low', status: 'pending', dueDate: null, notebookId: 'nb2', tags: ['t2', 't5'], relatedNoteId: 'n5', createdAt: now - 7 * day, updatedAt: now - 5 * day },
  { id: 'td6', title: '采购手冲咖啡豆', description: '埃塞俄比亚耶加雪菲，浅烘', priority: 'low', status: 'completed', dueDate: now - 5 * day, notebookId: 'nb3', tags: [], relatedNoteId: null, createdAt: now - 10 * day, updatedAt: now - 8 * day },
  { id: 'td7', title: '准备新项目启动 PPT', description: '项目目标、里程碑、团队分工', priority: 'high', status: 'pending', dueDate: now - 2 * day, notebookId: 'nb1', tags: ['t1'], relatedNoteId: 'n6', createdAt: now - day, updatedAt: now / 1000 * 1000 - 3600000 },
  { id: 'td8', title: '研究卡片笔记法', description: '学习卢曼卡片盒笔记法的核心原理', priority: 'medium', status: 'pending', dueDate: now + 5 * day, notebookId: 'nb2', tags: ['t4', 't2'], relatedNoteId: null, createdAt: now - 4 * day, updatedAt: now - 2 * day },
]

export const MOCK_TEMPLATES: ITemplate[] = [
  { id: 'tpl1', name: '晨间日记', description: '每日反思模板：心情、感恩、今日目标与昨日回顾', category: '日记', preview: '🌅', content: '<h1>{{日期}} 晨间日记</h1><h3>🌤 今日心情</h3><p>（开心 / 平静 / 焦虑 / 充实…）</p><h3>🙏 三件感恩</h3><ol><li></li><li></li><li></li></ol><h3>🎯 今日目标</h3><ul><li>最重要的一件事：</li><li>次要事项：</li></ul><h3>📝 昨日回顾</h3><p>{{昨日日期}}</p><blockquote>昨天做得好的一件事：</blockquote>', usageCount: 328, isFavorite: true, isCustom: false, createdAt: now - 120 * day },
  { id: 'tpl2', name: '会议纪要', description: '结构化记录会议议题、参会人、决议与待办', category: '会议', preview: '💼', content: '<h1>{{会议主题}}</h1><p><strong>时间：</strong>{{日期}} {{时间}}</p><p><strong>参会人：</strong>{{参会人}}</p><p><strong>主持人：</strong>{{主持人}}</p><hr /><h2>📋 议题</h2><ol><li></li><li></li></ol><h2>✅ 决议事项</h2><ul><li></li></ul><h2>📌 待办事项</h2><table><tr><th>事项</th><th>负责人</th><th>截止时间</th></tr><tr><td></td><td></td><td></td></tr></table><h2>📎 附件 / 链接</h2><p></p>', usageCount: 512, isFavorite: true, isCustom: false, createdAt: now - 100 * day },
  { id: 'tpl3', name: '读书笔记', description: '系统整理核心观点、金句摘抄与行动清单', category: '学习', preview: '📚', content: '<h1>{{书名}}</h1><p><strong>作者：</strong>{{作者}}</p><p><strong>阅读日期：</strong>{{日期}}</p><blockquote>💡 书中最打动你的一句话</blockquote><hr /><h2>🎯 核心观点</h2><h3>观点一</h3><p></p><h3>观点二</h3><p></p><h3>观点三</h3><p></p><h2>💭 我的思考</h2><p></p><h2>✅ 行动清单</h2><ul><li>（把书中方法应用到实际生活）</li></ul><h2>📑 金句摘抄</h2><p></p>', usageCount: 276, isFavorite: false, isCustom: false, createdAt: now - 90 * day },
  { id: 'tpl4', name: '项目计划', description: '项目目标、里程碑、任务分解与风险评估', category: '项目', preview: '🚀', content: '<h1>{{项目名称}} · 项目计划</h1><p><strong>启动日期：</strong>{{日期}}</p><p><strong>负责人：</strong>{{负责人}}</p><hr /><h2>🎯 项目目标</h2><p></p><h2>📅 里程碑</h2><ol><li>里程碑一 - 完成日期：</li><li>里程碑二 - 完成日期：</li><li>里程碑三 - 完成日期：</li></ol><h2>📋 任务分解</h2><h3>阶段一</h3><ul><li>[ ] 任务 1</li><li>[ ] 任务 2</li></ul><h3>阶段二</h3><ul><li>[ ] 任务 3</li><li>[ ] 任务 4</li></ul><h2>⚠️ 风险与应对</h2><table><tr><th>风险</th><th>概率</th><th>应对措施</th></tr><tr><td></td><td></td><td></td></tr></table>', usageCount: 189, isFavorite: false, isCustom: false, createdAt: now - 75 * day },
  { id: 'tpl5', name: '旅行计划', description: '目的地规划、行程安排、预算与行李清单', category: '旅行', preview: '✈️', content: '<h1>{{目的地}} · 旅行计划</h1><p><strong>出行日期：</strong>{{出发日期}} - {{返回日期}}</p><p><strong>同行人：</strong>{{同行人}}</p><hr /><h2>🗺 行程安排</h2><h3>Day 1 · {{日期}}</h3><ul><li>上午：</li><li>下午：</li><li>晚上：</li><li>住宿：</li></ul><h3>Day 2 · {{日期}}</h3><ul><li>上午：</li><li>下午：</li><li>晚上：</li><li>住宿：</li></ul><h2>💰 预算</h2><ul><li>交通：</li><li>住宿：</li><li>餐饮：</li><li>门票 / 活动：</li><li>购物 / 其他：</li><li><strong>合计：</strong></li></ul><h2>🧳 行李清单</h2><ul><li>[ ] 证件（身份证、护照）</li><li>[ ] 充电器 / 充电宝</li><li>[ ] 换洗衣物</li><li>[ ] 洗漱用品</li><li>[ ] 常用药品</li></ul>', usageCount: 215, isFavorite: true, isCustom: false, createdAt: now - 60 * day },
  { id: 'tpl6', name: '工作周报', description: '本周完成、下周计划、问题与风险汇总', category: '周报', preview: '📊', content: '<h1>工作周报 · 第{{周数}}周</h1><p><strong>日期：</strong>{{开始日期}} - {{结束日期}}</p><p><strong>汇报人：</strong>{{姓名}}</p><hr /><h2>✅ 本周完成</h2><ul><li></li><li></li><li></li></ul><h2>📈 关键成果（KPI / 数据）</h2><p></p><h2>📅 下周计划</h2><ul><li></li><li></li></ul><h2>⚠️ 问题与风险</h2><ul><li>问题：</li><li>风险：</li><li>所需支持：</li></ul><h2>💡 思考与建议</h2><p></p>', usageCount: 367, isFavorite: false, isCustom: false, createdAt: now - 45 * day },
  { id: 'tpl7', name: '灵感捕捉', description: '快速记录闪念：标题、时间、标签与灵感内容', category: '写作', preview: '💡', content: '<h1>{{灵感标题}}</h1><p><strong>时间：</strong>{{日期}} {{时间}}</p><p><strong>标签：</strong>#灵感 #{{分类}}</p><hr /><blockquote>💫 一句话概括这个灵感</blockquote><h2>📝 详细描述</h2><p></p><h2>🔗 相关参考</h2><ul><li></li></ul><h2>🎯 后续行动</h2><ul><li>下一步要做什么：</li></ul>', usageCount: 148, isFavorite: false, isCustom: false, createdAt: now - 30 * day },
  { id: 'tpl8', name: '待办清单', description: '按优先级管理任务：高/中/低优先级 + 截止日期 + 进度', category: '效率', preview: '✅', content: '<h1>待办清单 · {{日期}}</h1><hr /><h2>🔥 高优先级（今天必须完成）</h2><ul><li>[ ] </li><li>[ ] </li><li>[ ] </li></ul><h2>⚡ 中优先级（本周内完成）</h2><ul><li>[ ] </li><li>[ ] </li></ul><h2>📌 低优先级（有空再做）</h2><ul><li>[ ] </li><li>[ ] </li></ul><h2>✅ 已完成</h2><ul><li>[x] </li></ul><h2>📊 今日进度</h2><p>完成 / 总计 = </p>', usageCount: 402, isFavorite: true, isCustom: false, createdAt: now - 15 * day },
]

export const MOCK_CLIPBOARD: IClipboardItem[] = [
  { id: 'cb1', type: 'text', content: '一闲笔记 v3.0 - 让记录成为一种享受', preview: '一闲笔记 v3.0 - 让记录成为一种享受', sourceApp: '浏览器', createdAt: now - 120000, isPinned: true },
  { id: 'cb2', type: 'link', content: 'https://example.com/article/design-systems', preview: '设计系统入门：从零构建可扩展的组件库', sourceApp: 'Chrome', createdAt: now - 600000, isPinned: false },
  { id: 'cb3', type: 'text', content: 'const debounce = (fn, delay) => {\n  let timer = null\n  return (...args) => {\n    clearTimeout(timer)\n    timer = setTimeout(() => fn(...args), delay)\n  }\n}', preview: 'const debounce = (fn, delay) => { let timer = null ...', sourceApp: 'VS Code', createdAt: now - 1800000, isPinned: false },
  { id: 'cb4', type: 'image', content: 'screenshot.png', preview: '屏幕截图 - 产品原型设计稿', sourceApp: '系统截图', createdAt: now - 3600000, isPinned: false },
  { id: 'cb5', type: 'text', content: '竹青色传递「闲静、自然、专注」的品牌语义，用于主行动与激活态', preview: '竹青色传递「闲静、自然、专注」的品牌语义...', sourceApp: '一闲笔记', createdAt: now - 7200000, isPinned: false },
  { id: 'cb6', type: 'link', content: 'https://example.com/docs/atom-habits', preview: '《原子习惯》核心观点总结 - 四大法则详解', sourceApp: '微信', createdAt: now - 86400000, isPinned: false },
  { id: 'cb7', type: 'text', content: '产品 idea：AI 自动摘要 + 知识图谱关联，让笔记之间产生连接', preview: '产品 idea：AI 自动摘要 + 知识图谱关联...', sourceApp: '便签', createdAt: now - 2 * 86400000, isPinned: true },
  { id: 'cb8', type: 'image', content: 'architecture.png', preview: '系统架构图 v2 - 微服务设计', sourceApp: 'Figma', createdAt: now - 3 * 86400000, isPinned: false },
]

export const MOCK_INITIAL_PRIVACY: IPrivacySettings = {
  enabled: false,
  pinCode: '',
  autoLockMinutes: 5,
  fingerprintEnabled: false,
  privateNoteIds: [],
}

// v4.0 Mock Data
export const MOCK_REMINDERS: IReminder[] = [
  { id: 'rm1', targetId: 'td1', targetType: 'todo', title: '完成产品设计评审稿', time: now + day, repeat: 'none', isRead: false, createdAt: now - 2 * day },
  { id: 'rm2', targetId: 'td7', targetType: 'todo', title: '准备新项目启动 PPT', time: now - 2 * day, repeat: 'none', isRead: true, createdAt: now - 3 * day },
  { id: 'rm3', targetId: 'n1', targetType: 'note', title: '产品需求文档复审', time: now + 2 * day, repeat: 'weekly', isRead: false, createdAt: now - day },
  { id: 'rm4', targetId: 'td4', targetType: 'todo', title: '优化首页加载性能', time: now + 3 * day, repeat: 'none', isRead: false, createdAt: now - day },
  { id: 'rm5', targetId: 'n5', targetType: 'note', title: '每日回顾', time: now - 3600000, repeat: 'daily', isRead: false, createdAt: now - 7 * day },
]

export const MOCK_NOTIFICATIONS: INotification[] = [
  { id: 'nf1', title: '待办即将到期', content: '「完成产品设计评审稿」将于今天到期', type: 'reminder', isRead: false, createdAt: now - 1800000 },
  { id: 'nf2', title: '每日回顾提醒', content: '今天你创建了 3 篇笔记，写了 1200 字', type: 'info', isRead: false, createdAt: now - 7200000 },
  { id: 'nf3', title: '便签已同步', content: '便签墙 5 条便签已成功同步到云端', type: 'system', isRead: true, createdAt: now - 86400000 },
  { id: 'nf4', title: '模板收藏成功', content: '你收藏了「周复盘」模板', type: 'info', isRead: true, createdAt: now - 2 * 86400000 },
  { id: 'nf5', title: '待办逾期提醒', content: '「准备新项目启动 PPT」已逾期 2 天', type: 'reminder', isRead: false, createdAt: now - 3600000 },
]

export const MOCK_DAILY_RECORD: IDailyRecord = {
  date: new Date(now).toISOString().split('T')[0],
  noteCount: 3,
  wordCount: 1258,
  todoCompleted: 2,
  streakDays: 15,
}

export const MOCK_FLASH_THOUGHTS: IFlashThought[] = [
  { id: 'ft1', content: '产品 idea：AI 自动摘要 + 知识图谱关联', status: 'pending', createdAt: now - 3600000 },
  { id: 'ft2', content: '周末去尝试新开的那家手冲咖啡店', status: 'pending', createdAt: now - 7200000 },
  { id: 'ft3', content: '设计原则：克制不冷淡，温润不喧闹', status: 'organized', createdAt: now - day },
  { id: 'ft4', content: '读书计划：本月读完《卡片笔记法》', status: 'pending', createdAt: now - 2 * day },
  { id: 'ft5', content: 'UI 优化点：编辑器增加打字机模式', status: 'organized', createdAt: now - 3 * day },
]

// ========== v5.0 学习卡片 ==========
export interface IFlashcard {
  id: string
  deck: string
  front: string
  back: string
  tags: string[]
  ease: number
  interval: number
  repetitions: number
  dueDate: string
  lastReviewedAt?: number
  createdAt: number
  status: 'new' | 'learning' | 'review' | 'mastered'
}

export const MOCK_FLASHCARDS: IFlashcard[] = [
  { id: 'fc1', deck: '心理学', front: '什么是锚定效应？', back: '人们在做决策时，过度依赖第一个获取的信息（锚点）进行判断的认知偏差。', tags: ['认知偏差'], ease: 2.5, interval: 1, repetitions: 3, dueDate: new Date(now).toISOString().split('T')[0], lastReviewedAt: now - day, createdAt: now - 10 * day, status: 'learning' },
  { id: 'fc2', deck: '心理学', front: 'SM-2 算法的核心是什么？', back: '根据学习者对卡片的记忆程度反馈，动态调整下次复习间隔的间隔重复算法。', tags: ['学习方法'], ease: 2.3, interval: 3, repetitions: 5, dueDate: new Date(now + day).toISOString().split('T')[0], lastReviewedAt: now - 2 * day, createdAt: now - 15 * day, status: 'review' },
  { id: 'fc3', deck: '编程', front: 'React 中 useEffect 的依赖数组为空数组时表示什么？', back: '表示该 effect 只在组件挂载时执行一次，卸载时执行清理函数。', tags: ['React', '前端'], ease: 2.8, interval: 7, repetitions: 8, dueDate: new Date(now + 5 * day).toISOString().split('T')[0], lastReviewedAt: now - 3 * day, createdAt: now - 30 * day, status: 'mastered' },
  { id: 'fc4', deck: '编程', front: '什么是闭包？', back: '闭包是指函数能够访问其词法作用域中的变量，即使该函数在其词法作用域之外执行。', tags: ['JavaScript', '前端'], ease: 2.5, interval: 1, repetitions: 2, dueDate: new Date(now).toISOString().split('T')[0], lastReviewedAt: now - 2 * day, createdAt: now - 8 * day, status: 'learning' },
  { id: 'fc5', deck: '设计', front: '什么是格式塔原则？', back: '人们倾向于将视觉元素组织成有意义的整体，包括接近性、相似性、连续性、闭合性等原则。', tags: ['设计理论'], ease: 2.4, interval: 2, repetitions: 4, dueDate: new Date(now).toISOString().split('T')[0], lastReviewedAt: now - day, createdAt: now - 12 * day, status: 'review' },
  { id: 'fc6', deck: '心理学', front: '什么是蔡格尼克效应？', back: '人们对未完成的任务比已完成的任务记忆更深刻的心理学现象。', tags: ['认知偏差'], ease: 2.6, interval: 4, repetitions: 6, dueDate: new Date(now + 2 * day).toISOString().split('T')[0], lastReviewedAt: now - 4 * day, createdAt: now - 20 * day, status: 'review' },
]

// ========== v5.0 多工作区 ==========
export interface IWorkspace {
  id: string
  name: string
  icon: string
  color: string
  description?: string
  createdAt: number
  archived: boolean
  /** 主题色 key（对应预设主题，用于影响全局 UI 主色） */
  themeKey?: string
  /** 主题包 id（每个工作区独立） */
  themePack?: string
  /** 排序权重（越小越靠前） */
  order?: number
  /** 最后活动时间戳 */
  lastActivityAt?: number
  /** 自定义封面图 URL（可选） */
  coverImage?: string
}

// ========== v5.0 网址导航 ==========
export interface IWebsite {
  id: string
  /** 站点名称 */
  name: string
  /** 站点地址（访问时自动补齐 http(s)://） */
  url: string
  /** 分类 */
  category?: string
  /** 网页登录用户名 */
  username?: string
  /** 网页登录密码 */
  password?: string
  /** 备注 */
  note?: string
  /** 图标来源：可填 https 图标地址，留空则用首字母 */
  icon?: string
  /** 访问次数（用于常用优先排序） */
  visitCount?: number
  /** 是否收藏（置顶展示） */
  favorite?: boolean
  /** 手动排序权重（数字越小越靠前，用于“手动”排序模式） */
  order?: number
  createdAt: number
  updatedAt: number
}

// 8 种预设主题色（竹青为默认）
export const WORKSPACE_THEMES = [
  { key: 'bamboo',   name: '竹青', primary: '#3F7F5F', primaryLight: 'hsl(155 35% 38%)', ring: 'hsl(155 35% 38%)' },
  { key: 'indigo',   name: '靛蓝', primary: '#4F6BC7', primaryLight: 'hsl(226 50% 54%)', ring: 'hsl(226 50% 54%)' },
  { key: 'coral',    name: '珊瑚', primary: '#E07A6B', primaryLight: 'hsl(9  65% 65%)', ring: 'hsl(9  65% 55%)' },
  { key: 'amber',    name: '琥珀', primary: '#D6913C', primaryLight: 'hsl(36 65% 54%)', ring: 'hsl(36 65% 50%)' },
  { key: 'wisteria', name: '紫藤', primary: '#8B6BB5', primaryLight: 'hsl(264 35% 56%)', ring: 'hsl(264 35% 50%)' },
  { key: 'rose',     name: '玫瑰', primary: '#C96A88', primaryLight: 'hsl(340 45% 60%)', ring: 'hsl(340 45% 52%)' },
  { key: 'lime',     name: '青柠', primary: '#6BA357', primaryLight: 'hsl(105 35% 50%)', ring: 'hsl(105 35% 45%)' },
  { key: 'graphite', name: '石墨', primary: '#5A6470', primaryLight: 'hsl(213 12% 40%)', ring: 'hsl(213 12% 38%)' },
] as const;

export type WorkspaceThemeKey = typeof WORKSPACE_THEMES[number]['key'];

// 工作区模板类型
export type WorkspaceTemplateKey = 'blank' | 'personal' | 'project' | 'study' | 'travel';

export interface WorkspaceTemplate {
  key: WorkspaceTemplateKey
  name: string
  description: string
  icon: string
  color: string
  themeKey: WorkspaceThemeKey
  notebooks: { name: string; icon: string; color: string }[]
  tags: { name: string; color: string }[]
  sampleNotes: { title: string; content: string; notebookIndex: number; tags: string[] }[]
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    key: 'blank',
    name: '空白工作区',
    description: '从零开始，完全自由的工作空间',
    icon: '📄',
    color: '#5A6470',
    themeKey: 'graphite',
    notebooks: [{ name: '默认笔记本', icon: '📒', color: '#94a3b8' }],
    tags: [],
    sampleNotes: [],
  },
  {
    key: 'personal',
    name: '个人日记',
    description: '记录生活点滴与每日反思',
    icon: '📔',
    color: '#3F7F5F',
    themeKey: 'bamboo',
    notebooks: [
      { name: '日记', icon: '📔', color: '#3F7F5F' },
      { name: '每日回顾', icon: '🌙', color: '#6B8AA8' },
      { name: '习惯打卡', icon: '✅', color: '#C9A87C' },
    ],
    tags: [
      { name: '心情', color: '#C96A88' },
      { name: '感恩', color: '#D6913C' },
      { name: '灵感', color: '#8B6BB5' },
    ],
    sampleNotes: [
      { title: '欢迎来到个人日记', content: '这是你的第一篇日记，记录今天发生的有趣事情吧～', notebookIndex: 0, tags: ['心情'] },
      { title: '每日回顾模板', content: '## 今日三件好事\n1. \n2. \n3. \n\n## 反思与改进\n', notebookIndex: 1, tags: ['感恩'] },
    ],
  },
  {
    key: 'project',
    name: '项目管理',
    description: '追踪项目进度、会议记录和需求文档',
    icon: '💼',
    color: '#4F6BC7',
    themeKey: 'indigo',
    notebooks: [
      { name: '项目总览', icon: '📊', color: '#4F6BC7' },
      { name: '会议纪要', icon: '📝', color: '#6BA357' },
      { name: '需求文档', icon: '📋', color: '#E07A6B' },
    ],
    tags: [
      { name: '待办', color: '#E07A6B' },
      { name: '进行中', color: '#D6913C' },
      { name: '已完成', color: '#6BA357' },
      { name: '紧急', color: '#C96A88' },
    ],
    sampleNotes: [
      { title: '项目启动说明', content: '## 项目背景\n\n## 目标与里程碑\n\n## 团队成员\n', notebookIndex: 0, tags: ['待办'] },
      { title: '周会纪要模板', content: '## 会议信息\n- 日期：\n- 参会人：\n\n## 上周进展\n\n## 本周计划\n\n## 风险与问题\n', notebookIndex: 1, tags: [] },
    ],
  },
  {
    key: 'study',
    name: '学习笔记',
    description: '课程笔记、读书笔记与复习计划',
    icon: '📚',
    color: '#C9A87C',
    themeKey: 'amber',
    notebooks: [
      { name: '课程笔记', icon: '🎓', color: '#C9A87C' },
      { name: '读书笔记', icon: '📖', color: '#8B6BB5' },
      { name: '复习总结', icon: '🔄', color: '#6BA357' },
    ],
    tags: [
      { name: '重要', color: '#E07A6B' },
      { name: '待复习', color: '#D6913C' },
      { name: '已掌握', color: '#6BA357' },
      { name: '疑问', color: '#4F6BC7' },
    ],
    sampleNotes: [
      { title: '康奈尔笔记法', content: '## 记录区\n\n## 线索区（关键词/问题）\n\n## 总结区\n', notebookIndex: 0, tags: ['重要'] },
      { title: '读书笔记模板', content: '## 书名\n\n## 核心观点\n\n## 精彩摘录\n\n## 个人感悟\n', notebookIndex: 1, tags: ['待复习'] },
    ],
  },
  {
    key: 'travel',
    name: '旅行规划',
    description: '行程安排、住宿美食攻略与旅行记录',
    icon: '✈️',
    color: '#6BA357',
    themeKey: 'lime',
    notebooks: [
      { name: '行程规划', icon: '🗺️', color: '#4F6BC7' },
      { name: '住宿攻略', icon: '🏨', color: '#C9A87C' },
      { name: '美食探店', icon: '🍜', color: '#E07A6B' },
    ],
    tags: [
      { name: '必去', color: '#E07A6B' },
      { name: '备选', color: '#D6913C' },
      { name: '预算', color: '#6BA357' },
    ],
    sampleNotes: [
      { title: '行程清单模板', content: '## 目的地\n\n## 出行日期\n\n## 交通方式\n\n## 每日行程\n### Day 1\n\n### Day 2\n', notebookIndex: 0, tags: ['必去'] },
    ],
  },
];

export const MOCK_WORKSPACES: IWorkspace[] = [
  { id: 'ws1', name: '个人笔记', icon: '🏠', color: '#3F7F5F', themeKey: 'bamboo', themePack: 'bamboo',   description: '个人生活与学习记录',     createdAt: now - 180 * day, order: 0, lastActivityAt: now - 1 * 3600 * 1000, archived: false },
  { id: 'ws2', name: '工作项目', icon: '💼', color: '#6B8AA8', themeKey: 'indigo', themePack: 'deep-blue',   description: '工作相关的项目笔记和文档', createdAt: now - 90 * day,  order: 1, lastActivityAt: now - 3 * 3600 * 1000, archived: false },
  { id: 'ws3', name: '学习成长', icon: '📚', color: '#C9A87C', themeKey: 'amber', themePack: 'forest-green',    description: '读书笔记和知识沉淀',     createdAt: now - 60 * day,  order: 2, lastActivityAt: now - 24 * 3600 * 1000, archived: false },
]

// ========== v5.0 工作区个性配置 ==========
export interface IWorkspaceQuickAction {
  id: string
  label: string
  icon: string
  description?: string
}

export interface IWorkspacePersonality {
  /** 工作区 Slogan / 标语（侧边栏顶部展示） */
  slogan: string
  /** 工作台首页标题（大标题） */
  dashboardTitle: string
  /** 工作台首页副标题（问候语类型说明） */
  dashboardSubtitleType: 'greeting' | 'progress' | 'streak'
  /** 快捷操作列表（工作台首页展示） */
  quickActions: IWorkspaceQuickAction[]
  /** 推荐模板类型（新建笔记时展示） */
  recommendedTemplates: string[]
  /** 空状态插画风格关键词（用于生成差异化插画文字） */
  emptyStateStyle: {
    iconEmoji: string
    title: string
    description: string
    actionLabel: string
  }
  /** 背景装饰 CSS 类名（纯 CSS/SVG，低透明度） */
  bgDecorationClass: string
  /** 仪表盘重点统计项 */
  dashboardStats: { key: string; label: string; icon: string }[]
  /** 仪表盘第二屏模块（展示顺序） */
  dashboardSections: ('recentActivity' | 'stats' | 'progress' | 'quotes' | 'randomNote' | 'upcoming' | 'review')[]
}

/** 每个工作区的个性配置，key 为 workspace.id */
export const WORKSPACE_PERSONALITY_MAP: Record<string, IWorkspacePersonality> = {
  ws1: {
    slogan: '记录生活点滴',
    dashboardTitle: '我的个人空间',
    dashboardSubtitleType: 'greeting',
    quickActions: [
      { id: 'diary', label: '写日记', icon: '📔', description: '记录今天的故事' },
      { id: 'sticky', label: '新建便签', icon: '📌', description: '随手记下灵感' },
      { id: 'calendar', label: '查看日历', icon: '📅', description: '浏览日程安排' },
      { id: 'habit', label: '习惯打卡', icon: '✅', description: '今日习惯完成情况' },
    ],
    recommendedTemplates: ['tpl1', 'tpl7', 'tpl3'],
    emptyStateStyle: {
      iconEmoji: '🌿',
      title: '还没有笔记呢',
      description: '打开你的日记本，写下今天的第一行文字吧',
      actionLabel: '开始记录',
    },
    bgDecorationClass: 'bg-deco-paper',
    dashboardStats: [
      { key: 'monthNotes', label: '本月笔记', icon: '📝' },
      { key: 'streakDays', label: '连续记录', icon: '🔥' },
      { key: 'moodAvg', label: '本周笔记', icon: '📝' },
      { key: 'lifeTags', label: '生活标签', icon: '🏷️' },
    ],
    dashboardSections: ['recentActivity', 'randomNote', 'stats'],
  },
  ws2: {
    slogan: '高效协作空间',
    dashboardTitle: '工作项目',
    dashboardSubtitleType: 'progress',
    quickActions: [
      { id: 'meeting', label: '会议纪要', icon: '📝', description: '快速记录会议要点' },
      { id: 'todos', label: '查看待办', icon: '✅', description: '本周任务进展' },
      { id: 'stats', label: '项目统计', icon: '📊', description: '数据概览与分析' },
    ],
    recommendedTemplates: ['tpl2', 'tpl4', 'tpl6'],
    emptyStateStyle: {
      iconEmoji: '💼',
      title: '工作区空空如也',
      description: '创建第一个项目文档，开启高效工作',
      actionLabel: '新建文档',
    },
    bgDecorationClass: 'bg-deco-geo',
    dashboardStats: [
      { key: 'todoDone', label: '本周完成', icon: '✅' },
      { key: 'focusHours', label: '本周待办', icon: '📝' },
      { key: 'meetings', label: '会议数量', icon: '📅' },
      { key: 'projectActive', label: '活跃项目', icon: '📁' },
    ],
    dashboardSections: ['progress', 'stats', 'upcoming', 'recentActivity'],
  },
  ws3: {
    slogan: '知识沉淀库',
    dashboardTitle: '学习成长',
    dashboardSubtitleType: 'streak',
    quickActions: [
      { id: 'study', label: '学习笔记', icon: '📚', description: '开始整理学习内容' },
      { id: 'review', label: '查看复习', icon: '🔄', description: '今日复习提醒' },
      { id: 'stats', label: '学习统计', icon: '📈', description: '学习数据概览' },
    ],
    recommendedTemplates: ['tpl3', 'tpl7', 'tpl8'],
    emptyStateStyle: {
      iconEmoji: '📖',
      title: '知识之旅即将开始',
      description: '创建你的第一篇学习笔记，踏上成长之路',
      actionLabel: '开始学习',
    },
    bgDecorationClass: 'bg-deco-books',
    dashboardStats: [
      { key: 'studyHours', label: '累计复习', icon: '🔄' },
      { key: 'booksRead', label: '阅读书籍', icon: '📚' },
      { key: 'noteCount', label: '知识笔记', icon: '📝' },
      { key: 'reviewRate', label: '复习完成率', icon: '🎯' },
    ],
    dashboardSections: ['progress', 'stats', 'review', 'quotes'],
  },
}