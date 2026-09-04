/**
 * Reminder Slice 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createReminderSlice, defaultHolidayPopupConfig, computeNextTrigger } from '@/store/slices/reminderSlice'
import type { Reminder, ReminderHistoryEntry } from '@/types'

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

describe('reminderSlice', () => {
  let set: (partial: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => void
  let get: () => Record<string, unknown>
  let state: Record<string, unknown>

  beforeEach(() => {
    const mock = createMockSetGet()
    set = mock.set
    get = mock.get
    state = mock.state
    Object.assign(state, createReminderSlice(set as never, get as never))
  })

  describe('reminder CRUD', () => {
    it('should initialize with empty reminders', () => {
      expect(get().reminders).toEqual([])
    })

    it('should add a reminder', () => {
      const reminder: Reminder = {
        id: 'r1',
        title: 'Buy groceries',
        remindAt: '2024-01-15T10:00:00Z',
        isCompleted: false,
        createdAt: '2024-01-01',
      }
      get().addReminder(reminder)
      expect(get().reminders).toHaveLength(1)
      expect(get().reminders[0]).toEqual(reminder)
    })

    it('should update a reminder', () => {
      const reminder: Reminder = {
        id: 'r1',
        title: 'Original Title',
        remindAt: '2024-01-15T10:00:00Z',
        isCompleted: false,
        createdAt: '2024-01-01',
      }
      get().addReminder(reminder)
      get().updateReminder('r1', { title: 'Updated Title' })
      expect(get().reminders[0].title).toBe('Updated Title')
    })

    it('should complete a reminder', () => {
      const reminder: Reminder = {
        id: 'r1',
        title: 'Test Task',
        remindAt: '2024-01-15T10:00:00Z',
        isCompleted: false,
        createdAt: '2024-01-01',
      }
      get().addReminder(reminder)
      get().completeReminder('r1')
      expect(get().reminders[0].isCompleted).toBe(true)
    })

    it('should delete a reminder', () => {
      const reminder1: Reminder = {
        id: 'r1',
        title: 'Task 1',
        remindAt: '2024-01-15T10:00:00Z',
        isCompleted: false,
        createdAt: '2024-01-01',
      }
      const reminder2: Reminder = {
        id: 'r2',
        title: 'Task 2',
        remindAt: '2024-01-16T10:00:00Z',
        isCompleted: false,
        createdAt: '2024-01-01',
      }
      get().setReminders([reminder1, reminder2])
      get().deleteReminder('r1')
      expect(get().reminders).toHaveLength(1)
      expect(get().reminders[0].id).toBe('r2')
    })
  })

  describe('reminder history', () => {
    it('should record reminder trigger', () => {
      const entry: Omit<ReminderHistoryEntry, 'id'> = {
        reminderId: 'r1',
        triggeredAt: Date.now(),
        repeat: 'none',
      }
      get().recordReminderTrigger(entry)
      expect(get().reminderHistory).toHaveLength(1)
      expect(get().reminderHistory[0].reminderId).toBe('r1')
      expect(get().reminderHistory[0].id).toBeDefined()
    })

    it('should clear reminder history', () => {
      get().setReminderHistory([
        { id: 'h1', reminderId: 'r1', triggeredAt: Date.now(), repeat: 'none' },
      ])
      get().clearReminderHistory()
      expect(get().reminderHistory).toHaveLength(0)
    })
  })

  describe('holiday popup config', () => {
    it('should have default config', () => {
      expect(get().holidayPopupConfig).toEqual(defaultHolidayPopupConfig)
    })

    it('should update holiday popup config', () => {
      get().updateHolidayPopupConfig({ enabled: false })
      expect(get().holidayPopupConfig.enabled).toBe(false)
    })
  })
})

describe('computeNextTrigger', () => {
  it('should return 0 for none repeat', () => {
    const result = computeNextTrigger(1704067200000, 'none')
    expect(result).toBe(0)
  })

  it('should compute next daily trigger', () => {
    const baseTime = new Date('2024-01-01T00:00:00Z').getTime()
    const result = computeNextTrigger(baseTime, 'daily')
    expect(result).toBe(baseTime + 24 * 60 * 60 * 1000)
  })

  it('should compute next weekly trigger', () => {
    const baseTime = new Date('2024-01-01T00:00:00Z').getTime()
    const result = computeNextTrigger(baseTime, 'weekly')
    expect(result).toBe(baseTime + 7 * 24 * 60 * 60 * 1000)
  })

  it('should compute next monthly trigger', () => {
    const baseTime = new Date('2024-01-01T00:00:00Z').getTime()
    const result = computeNextTrigger(baseTime, 'monthly')
    const expectedDate = new Date(baseTime)
    expectedDate.setMonth(expectedDate.getMonth() + 1)
    expect(result).toBe(expectedDate.getTime())
  })
})
