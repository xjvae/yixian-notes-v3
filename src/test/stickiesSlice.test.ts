/**
 * Stickies Slice 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createStickiesSlice } from '@/store/slices/stickiesSlice'
import type { StickyNote } from '@/types'

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

describe('stickiesSlice', () => {
  let set: (partial: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => void
  let get: () => Record<string, unknown>
  let state: Record<string, unknown>

  beforeEach(() => {
    const mock = createMockSetGet()
    set = mock.set
    get = mock.get
    state = mock.state
    Object.assign(state, createStickiesSlice(set as never, get as never))
  })

  describe('sticky note CRUD', () => {
    it('should initialize with empty sticky notes', () => {
      expect(get().stickyNotes).toEqual([])
    })

    it('should add a sticky note', () => {
      const sticky: StickyNote = {
        id: 's1',
        content: 'Remember to buy milk',
        color: '#FFD700',
        x: 100,
        y: 100,
        width: 320,
        height: 280,
        isPinned: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }
      get().addSticky(sticky)
      expect(get().stickyNotes).toHaveLength(1)
      expect(get().stickyNotes[0]).toEqual(sticky)
    })

    it('should update a sticky note', () => {
      const sticky: StickyNote = {
        id: 's1',
        content: 'Original content',
        color: '#FFD700',
        x: 100,
        y: 100,
        width: 320,
        height: 280,
        isPinned: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }
      get().addSticky(sticky)
      get().updateSticky('s1', { content: 'Updated content' })
      expect(get().stickyNotes[0].content).toBe('Updated content')
      expect(get().stickyNotes[0].updatedAt).not.toBe('2024-01-01')
    })

    it('should delete a sticky note', () => {
      const sticky1: StickyNote = {
        id: 's1',
        content: 'Sticky 1',
        color: '#FFD700',
        x: 0, y: 0, width: 320, height: 280,
        isPinned: false, createdAt: '2024-01-01', updatedAt: '2024-01-01',
      }
      const sticky2: StickyNote = {
        id: 's2',
        content: 'Sticky 2',
        color: '#90EE90',
        x: 0, y: 0, width: 320, height: 280,
        isPinned: false, createdAt: '2024-01-01', updatedAt: '2024-01-01',
      }
      get().setStickyNotes([sticky1, sticky2])
      get().deleteSticky('s1')
      expect(get().stickyNotes).toHaveLength(1)
      expect(get().stickyNotes[0].id).toBe('s2')
    })
  })

  describe('position and size operations', () => {
    it('should update sticky position', () => {
      const sticky: StickyNote = {
        id: 's1',
        content: 'Test',
        color: '#FFD700',
        x: 0, y: 0, width: 320, height: 280,
        isPinned: false, createdAt: '2024-01-01', updatedAt: '2024-01-01',
      }
      get().addSticky(sticky)
      get().updateStickyPosition('s1', 200, 300)
      expect(get().stickyNotes[0].x).toBe(200)
      expect(get().stickyNotes[0].y).toBe(300)
    })

    it('should update sticky size', () => {
      const sticky: StickyNote = {
        id: 's1',
        content: 'Test',
        color: '#FFD700',
        x: 0, y: 0, width: 320, height: 280,
        isPinned: false, createdAt: '2024-01-01', updatedAt: '2024-01-01',
      }
      get().addSticky(sticky)
      get().updateStickySize('s1', 480, 360)
      expect(get().stickyNotes[0].width).toBe(480)
      expect(get().stickyNotes[0].height).toBe(360)
    })

    it('should toggle sticky pin state', () => {
      const sticky: StickyNote = {
        id: 's1',
        content: 'Test',
        color: '#FFD700',
        x: 0, y: 0, width: 320, height: 280,
        isPinned: false, createdAt: '2024-01-01', updatedAt: '2024-01-01',
      }
      get().addSticky(sticky)
      expect(get().stickyNotes[0].isPinned).toBe(false)
      get().toggleStickyPin('s1')
      expect(get().stickyNotes[0].isPinned).toBe(true)
      get().toggleStickyPin('s1')
      expect(get().stickyNotes[0].isPinned).toBe(false)
    })
  })
})
