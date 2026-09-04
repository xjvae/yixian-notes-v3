/**
 * Settings Slice 单元测试
 * 包含：应用设置、自定义快捷键、标签颜色、过滤器
 * 注意：项目中没有独立的 tagsSlice，标签颜色管理在 settingsSlice 中
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createSettingsSlice } from '@/store/slices/settingsSlice'
import type { AppSettings, ShortcutBinding, TagColor } from '@/types'

function createMockSetGet() {
  let state: Record<string, unknown> = {}
  const set = (partial: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => {
    if (typeof partial === 'function') {
      state = { ...state, ...partial(state) }
    } else {
      state = { ...state, ...partial }
    }
  }
  const get = () => state
  return { set, get, state }
}

describe('settingsSlice', () => {
  let set: (partial: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => void
  let get: () => Record<string, unknown>
  let state: Record<string, unknown>

  beforeEach(() => {
    const mock = createMockSetGet()
    set = mock.set
    get = mock.get
    state = mock.state
    Object.assign(state, createSettingsSlice(set as never, get as never))
  })

  describe('初始状态', () => {
    it('应该有正确的默认设置', () => {
      const settings = get().settings as AppSettings
      expect(settings.theme).toBe('system')
      expect(settings.language).toBe('zh-CN')
      expect(settings.fontSize).toBe(14)
      expect(settings.autoSave).toBe(true)
      expect(settings.autoSaveInterval).toBe(30)
      expect(settings.backupEnabled).toBe(false)
      expect(settings.backupInterval).toBe(24)
      expect(settings.encryptionEnabled).toBe(false)
      expect(settings.globalShortcut).toBe('CmdOrCtrl+Shift+N')
    })

    it('应该初始化空的快捷键列表', () => {
      expect(get().customShortcuts).toEqual([])
    })

    it('应该初始化空的标签颜色列表', () => {
      expect(get().tagColors).toEqual([])
    })

    it('应该初始化默认过滤器为 all', () => {
      expect(get().activeFilter).toBe('all')
    })
  })

  describe('updateSettings', () => {
    it('应该更新部分设置', () => {
      get().updateSettings({ theme: 'dark', fontSize: 16 })

      const settings = get().settings as AppSettings
      expect(settings.theme).toBe('dark')
      expect(settings.fontSize).toBe(16)
      // 未修改的设置应保持不变
      expect(settings.language).toBe('zh-CN')
      expect(settings.autoSave).toBe(true)
    })

    it('应该能更新所有设置字段', () => {
      const newSettings: Partial<AppSettings> = {
        theme: 'light',
        language: 'en-US',
        fontSize: 18,
        autoSave: false,
        autoSaveInterval: 60,
        backupEnabled: true,
        backupInterval: 12,
        encryptionEnabled: true,
        globalShortcut: 'CmdOrCtrl+Shift+M',
      }

      get().updateSettings(newSettings)

      const settings = get().settings as AppSettings
      expect(settings.theme).toBe('light')
      expect(settings.language).toBe('en-US')
      expect(settings.fontSize).toBe(18)
      expect(settings.autoSave).toBe(false)
      expect(settings.autoSaveInterval).toBe(60)
      expect(settings.backupEnabled).toBe(true)
      expect(settings.backupInterval).toBe(12)
      expect(settings.encryptionEnabled).toBe(true)
      expect(settings.globalShortcut).toBe('CmdOrCtrl+Shift+M')
    })

    it('应该能更新可选的 webdav 设置', () => {
      get().updateSettings({
        webdavUrl: 'https://example.com/dav',
        webdavUsername: 'user',
        webdavPassword: 'pass',
      })

      const settings = get().settings as AppSettings
      expect(settings.webdavUrl).toBe('https://example.com/dav')
      expect(settings.webdavUsername).toBe('user')
      expect(settings.webdavPassword).toBe('pass')
    })

    it('空更新不应改变任何设置', () => {
      const originalSettings = { ...(get().settings as AppSettings) }

      get().updateSettings({})

      const settings = get().settings as AppSettings
      expect(settings).toEqual(originalSettings)
    })
  })

  describe('快捷键管理', () => {
    it('应该设置快捷键列表', () => {
      const shortcuts: ShortcutBinding[] = [
        { action: 'newNote', keys: 'CmdOrCtrl+N', enabled: true },
        { action: 'saveNote', keys: 'CmdOrCtrl+S', enabled: true },
      ]

      get().setCustomShortcuts(shortcuts)

      expect(get().customShortcuts).toEqual(shortcuts)
    })

    it('应该添加新的快捷键', () => {
      get().setCustomShortcut('newNote', 'CmdOrCtrl+N')

      const shortcuts = get().customShortcuts as ShortcutBinding[]
      expect(shortcuts).toHaveLength(1)
      expect(shortcuts[0]).toEqual({
        action: 'newNote',
        keys: 'CmdOrCtrl+N',
        enabled: true,
      })
    })

    it('应该更新已存在的快捷键', () => {
      get().setCustomShortcut('newNote', 'CmdOrCtrl+N')
      get().setCustomShortcut('newNote', 'CmdOrCtrl+Shift+N')

      const shortcuts = get().customShortcuts as ShortcutBinding[]
      expect(shortcuts).toHaveLength(1)
      expect(shortcuts[0].keys).toBe('CmdOrCtrl+Shift+N')
    })

    it('应该能添加多个不同的快捷键', () => {
      get().setCustomShortcut('newNote', 'CmdOrCtrl+N')
      get().setCustomShortcut('saveNote', 'CmdOrCtrl+S')
      get().setCustomShortcut('deleteNote', 'CmdOrCtrl+D')

      const shortcuts = get().customShortcuts as ShortcutBinding[]
      expect(shortcuts).toHaveLength(3)
    })

    it('应该切换快捷键启用状态', () => {
      get().setCustomShortcut('newNote', 'CmdOrCtrl+N')

      // 默认启用
      expect((get().customShortcuts as ShortcutBinding[])[0].enabled).toBe(true)

      // 禁用
      get().toggleShortcut('newNote', false)
      expect((get().customShortcuts as ShortcutBinding[])[0].enabled).toBe(false)

      // 重新启用
      get().toggleShortcut('newNote', true)
      expect((get().customShortcuts as ShortcutBinding[])[0].enabled).toBe(true)
    })

    it('切换不存在的快捷键不应报错', () => {
      // 不应抛出错误
      expect(() => {
        get().toggleShortcut('nonExistent', true)
      }).not.toThrow()
    })

    it('设置空快捷键列表应该清空', () => {
      get().setCustomShortcut('newNote', 'CmdOrCtrl+N')
      get().setCustomShortcuts([])

      expect(get().customShortcuts).toEqual([])
    })
  })

  describe('标签颜色管理', () => {
    it('应该设置标签颜色列表', () => {
      const colors: TagColor[] = [
        { tag: '工作', color: '#ff0000' },
        { tag: '学习', color: '#00ff00' },
        { tag: '生活', color: '#0000ff' },
      ]

      get().setTagColors(colors)

      expect(get().tagColors).toEqual(colors)
    })

    it('应该添加新的标签颜色', () => {
      get().setTagColor('工作', '#ff0000')

      const colors = get().tagColors as TagColor[]
      expect(colors).toHaveLength(1)
      expect(colors[0]).toEqual({ tag: '工作', color: '#ff0000' })
    })

    it('应该更新已存在的标签颜色', () => {
      get().setTagColor('工作', '#ff0000')
      get().setTagColor('工作', '#00ff00')

      const colors = get().tagColors as TagColor[]
      expect(colors).toHaveLength(1)
      expect(colors[0].color).toBe('#00ff00')
    })

    it('应该能添加多个不同的标签颜色', () => {
      get().setTagColor('工作', '#ff0000')
      get().setTagColor('学习', '#00ff00')
      get().setTagColor('生活', '#0000ff')

      const colors = get().tagColors as TagColor[]
      expect(colors).toHaveLength(3)
    })

    it('设置空标签颜色列表应该清空', () => {
      get().setTagColor('工作', '#ff0000')
      get().setTagColors([])

      expect(get().tagColors).toEqual([])
    })

    it('应该支持各种颜色格式', () => {
      get().setTagColor('red', '#ff0000')
      get().setTagColor('blue', 'rgb(0, 0, 255)')
      get().setTagColor('green', 'green')

      const colors = get().tagColors as TagColor[]
      expect(colors).toHaveLength(3)
      expect(colors[0].color).toBe('#ff0000')
      expect(colors[1].color).toBe('rgb(0, 0, 255)')
      expect(colors[2].color).toBe('green')
    })
  })

  describe('过滤器管理', () => {
    it('应该设置活动过滤器', () => {
      get().setActiveFilter('favorites')
      expect(get().activeFilter).toBe('favorites')

      get().setActiveFilter('recent')
      expect(get().activeFilter).toBe('recent')

      get().setActiveFilter('all')
      expect(get().activeFilter).toBe('all')
    })

    it('应该支持自定义过滤器名称', () => {
      get().setActiveFilter('tag:工作')
      expect(get().activeFilter).toBe('tag:工作')
    })

    it('应该支持空字符串过滤器', () => {
      get().setActiveFilter('')
      expect(get().activeFilter).toBe('')
    })
  })

  describe('状态独立性', () => {
    it('更新设置不应影响快捷键', () => {
      get().setCustomShortcut('newNote', 'CmdOrCtrl+N')
      get().updateSettings({ theme: 'dark' })

      expect(get().customShortcuts).toHaveLength(1)
    })

    it('更新快捷键不应影响标签颜色', () => {
      get().setTagColor('工作', '#ff0000')
      get().setCustomShortcut('newNote', 'CmdOrCtrl+N')

      expect(get().tagColors).toHaveLength(1)
    })

    it('更新过滤器不应影响其他状态', () => {
      get().updateSettings({ theme: 'dark' })
      get().setCustomShortcut('newNote', 'CmdOrCtrl+N')
      get().setTagColor('工作', '#ff0000')

      get().setActiveFilter('favorites')

      expect((get().settings as AppSettings).theme).toBe('dark')
      expect(get().customShortcuts).toHaveLength(1)
      expect(get().tagColors).toHaveLength(1)
    })
  })
})
