/**
 * Clipboard Slice 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createClipboardSlice } from '@/store/slices/clipboardSlice'
import type { ClipboardEntry } from '@/types'

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

describe('clipboardSlice', () => {
  let set: (partial: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => void
  let get: () => Record<string, unknown>
  let state: Record<string, unknown>

  beforeEach(() => {
    const mock = createMockSetGet()
    set = mock.set
    get = mock.get
    state = mock.state
    Object.assign(state, createClipboardSlice(set as never, get as never))
  })

  describe('clipboard operations', () => {
    it('should initialize with empty clipboard history', () => {
      expect(get().clipboardHistory).toEqual([])
    })

    it('should add a clipboard entry', () => {
      const entry: ClipboardEntry = {
        id: '1',
        content: 'Copied text',
        contentType: 'text',
        createdAt: '2024-01-01',
      }
      get().addClipboardEntry(entry)
      expect(get().clipboardHistory).toHaveLength(1)
      expect(get().clipboardHistory[0]).toEqual(entry)
    })

    it('should limit history to 100 entries', () => {
      // 添加 101 条记录
      for (let i = 0; i < 101; i++) {
        const entry: ClipboardEntry = {
          id: `entry-${i}`,
          content: `Content ${i}`,
          contentType: 'text',
          createdAt: '2024-01-01',
        }
        get().addClipboardEntry(entry)
      }
      expect(get().clipboardHistory).toHaveLength(100)
    })

    it('should remove duplicate entries', () => {
      const entry1: ClipboardEntry = {
        id: '1',
        content: 'Same content',
        contentType: 'text',
        createdAt: '2024-01-01',
      }
      const entry2: ClipboardEntry = {
        id: '2',
        content: 'Same content',
        contentType: 'text',
        createdAt: '2024-01-01',
      }
      get().addClipboardEntry(entry1)
      get().addClipboardEntry(entry2)
      // 应该只有一条记录（新的去重后替换旧的）
      expect(get().clipboardHistory).toHaveLength(1)
    })

    it('should delete a clipboard entry', () => {
      const entry: ClipboardEntry = {
        id: '1',
        content: 'Test',
        contentType: 'text',
        createdAt: '2024-01-01',
      }
      get().addClipboardEntry(entry)
      get().deleteClipboardEntry('1')
      expect(get().clipboardHistory).toHaveLength(0)
    })

    it('should pin an entry to top', () => {
      const entry1: ClipboardEntry = {
        id: '1',
        content: 'First',
        contentType: 'text',
        createdAt: '2024-01-01',
      }
      const entry2: ClipboardEntry = {
        id: '2',
        content: 'Second',
        contentType: 'text',
        createdAt: '2024-01-01',
      }
      const entry3: ClipboardEntry = {
        id: '3',
        content: 'Third',
        contentType: 'text',
        createdAt: '2024-01-01',
      }
      get().setClipboardHistory([entry1, entry2, entry3])
      get().pinClipboardEntry('3')
      // entry3 应该被移到最前面
      expect(get().clipboardHistory[0].id).toBe('3')
    })

    it('should clear clipboard history', () => {
      const entry: ClipboardEntry = {
        id: '1',
        content: 'Test',
        contentType: 'text',
        createdAt: '2024-01-01',
      }
      get().addClipboardEntry(entry)
      get().clearClipboardHistory()
      expect(get().clipboardHistory).toHaveLength(0)
    })

    it('should set clipboard history', () => {
      const entries: ClipboardEntry[] = [
        { id: '1', content: 'Test 1', contentType: 'text', createdAt: '2024-01-01' },
        { id: '2', content: 'Test 2', contentType: 'text', createdAt: '2024-01-01' },
      ]
      get().setClipboardHistory(entries)
      expect(get().clipboardHistory).toEqual(entries)
    })
  })
})
