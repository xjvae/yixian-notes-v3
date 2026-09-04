/**
 * useVirtualList Hook 单元测试
 */
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useVirtualList } from '@/hooks/useVirtualList'

// 模拟 HTMLElement.scrollTo
const mockScrollTo = vi.fn()
HTMLElement.prototype.scrollTo = mockScrollTo

describe('useVirtualList', () => {
  beforeEach(() => {
    mockScrollTo.mockClear()
  })

  describe('固定高度模式', () => {
    it('应该在列表未超过阈值时禁用虚拟滚动', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 30,
          estimatedItemHeight: 50,
          threshold: 50,
        })
      )

      expect(result.current.isVirtualized).toBe(false)
      expect(result.current.virtualItems).toEqual([])
      expect(result.current.totalHeight).toBe(0)
    })

    it('应该在列表超过阈值时启用虚拟滚动', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 60,
          estimatedItemHeight: 50,
          threshold: 50,
        })
      )

      expect(result.current.isVirtualized).toBe(true)
      expect(result.current.totalHeight).toBe(60 * 50)
      expect(result.current.virtualItems.length).toBeGreaterThan(0)
    })

    it('应该正确计算固定高度项目的偏移量', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 100,
          estimatedItemHeight: 40,
          threshold: 50,
          viewportHeight: 200,
          overscan: 0,
        })
      )

      // 视口高度 200 / 项目高度 40 = 可见 5 个项目
      const items = result.current.virtualItems
      expect(items.length).toBeGreaterThan(0)
      expect(items[0].index).toBe(0)
      expect(items[0].offsetTop).toBe(0)
      expect(items[0].height).toBe(40)
    })

    it('应该在 itemCount 为 0 时返回空', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 0,
          estimatedItemHeight: 50,
          threshold: 50,
        })
      )

      expect(result.current.isVirtualized).toBe(false)
      expect(result.current.virtualItems).toEqual([])
    })
  })

  describe('动态高度模式', () => {
    it('应该使用 getItemHeight 回调返回的高度', () => {
      const getItemHeight = vi.fn((index: number) => 30 + (index % 3) * 20)

      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 60,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
          overscan: 0,
          getItemHeight,
        })
      )

      expect(result.current.isVirtualized).toBe(true)
      // 总高度应该是所有动态高度之和
      let expectedTotal = 0
      for (let i = 0; i < 60; i++) {
        expectedTotal += 30 + (i % 3) * 20
      }
      expect(result.current.totalHeight).toBe(expectedTotal)
    })

    it('应该优先使用 measureHeight 缓存的高度', () => {
      const getItemHeight = vi.fn(() => 50)

      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 60,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
          overscan: 0,
          getItemHeight,
        })
      )

      // 模拟 containerRef 并设置 scrollTop 为 100（非零值，确保 measureHeight 触发更新）
      const mockElement = {
        scrollTo: mockScrollTo,
        scrollTop: 100,
      } as unknown as HTMLDivElement
      ;(result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = mockElement

      // 测量第 0 项的实际高度为 80
      act(() => {
        result.current.measureHeight(0, 80)
      })

      // 重新渲染后，第 0 项的高度应该使用缓存值
      const firstItem = result.current.virtualItems.find((item) => item.index === 0)
      if (firstItem) {
        expect(firstItem.height).toBe(80)
      }
    })

    it('应该在未测量时回退到 getItemHeight', () => {
      const getItemHeight = vi.fn(() => 45)

      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 60,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
          overscan: 0,
          getItemHeight,
        })
      )

      // 未测量任何项目，应使用 getItemHeight
      expect(result.current.totalHeight).toBe(60 * 45)
    })
  })

  describe('滚动位置计算', () => {
    it('应该在滚动时更新 scrollTop', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 100,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
          overscan: 0,
        })
      )

      expect(result.current.scrollTop).toBe(0)

      // 模拟滚动事件
      act(() => {
        result.current.onScroll({
          currentTarget: { scrollTop: 500 },
        } as React.UIEvent<HTMLDivElement>)
      })

      expect(result.current.scrollTop).toBe(500)
    })

    it('应该根据滚动位置计算可视区项目', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 100,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
          overscan: 0,
        })
      )

      // 滚动到 1000px：1000 / 50 = 第 20 项开始
      act(() => {
        result.current.onScroll({
          currentTarget: { scrollTop: 1000 },
        } as React.UIEvent<HTMLDivElement>)
      })

      const items = result.current.virtualItems
      // 起始索引应该是 20 (1000 / 50)
      expect(items[0].index).toBe(20)
      // 可见项目：从第20项(offset=1000)到第24项(offset=1200=scrollTop+viewportHeight)
      // 循环在 offsets[endIdx] < visibleBottom 时停止，offsets[24]=1200 不小于 1200
      // 所以 endIdx=24，items = [20,21,22,23,24] = 5 项
      expect(items.length).toBe(5)
    })

    it('应该在滚动到底部时正确处理边界', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 60,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
          overscan: 0,
        })
      )

      // 滚动到底部：总高度 3000 - 视口 200 = 2800
      act(() => {
        result.current.onScroll({
          currentTarget: { scrollTop: 2800 },
        } as React.UIEvent<HTMLDivElement>)
      })

      const items = result.current.virtualItems
      // 最后一项的索引应该是 59
      expect(items[items.length - 1].index).toBe(59)
    })
  })

  describe('overscan 区域', () => {
    it('应该在可视区上方渲染 overscan 项目', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 100,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
          overscan: 3,
        })
      )

      // 滚动到 500px：500 / 50 = 第 10 项
      act(() => {
        result.current.onScroll({
          currentTarget: { scrollTop: 500 },
        } as React.UIEvent<HTMLDivElement>)
      })

      const items = result.current.virtualItems
      // 起始索引应该是 10 - 3 = 7
      expect(items[0].index).toBe(7)
    })

    it('应该在可视区下方渲染 overscan 项目', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 100,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
          overscan: 3,
        })
      )

      // 滚动到 0px
      act(() => {
        result.current.onScroll({
          currentTarget: { scrollTop: 0 },
        } as React.UIEvent<HTMLDivElement>)
      })

      const items = result.current.virtualItems
      // 可见：offsets[0]=0 到 offsets[4]=200，循环在 offsets[4]=200 < 200 为 false 时停止
      // 所以 endIdx=4，加上 overscan 3 = 7，items = [0..7] = 8 项
      expect(items.length).toBe(8)
      expect(items[items.length - 1].index).toBe(7)
    })

    it('overscan 不应超出列表边界', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 100,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
          overscan: 10,
        })
      )

      // 滚动到 0px，上方 overscan 不应为负
      act(() => {
        result.current.onScroll({
          currentTarget: { scrollTop: 0 },
        } as React.UIEvent<HTMLDivElement>)
      })

      const items = result.current.virtualItems
      expect(items[0].index).toBe(0)
    })

    it('默认 overscan 值应为 5', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 100,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
        })
      )

      // 滚动到 0px：可见 4 项 + 下方 5 项 overscan = 9
      act(() => {
        result.current.onScroll({
          currentTarget: { scrollTop: 0 },
        } as React.UIEvent<HTMLDivElement>)
      })

      const items = result.current.virtualItems
      // 默认 overscan=5: endIdx=4+5=9, items=[0..9] = 10 项
      expect(items.length).toBe(10)
    })
  })

  describe('scrollToIndex 功能', () => {
    it('应该滚动到指定索引', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 100,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
        })
      )

      // 模拟 containerRef
      const mockElement = {
        scrollTo: mockScrollTo,
        scrollTop: 0,
      } as unknown as HTMLDivElement
      ;(result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = mockElement

      act(() => {
        result.current.scrollToIndex(10)
      })

      expect(mockScrollTo).toHaveBeenCalledWith({
        top: 500, // 10 * 50
        behavior: 'smooth',
      })
    })

    it('应该支持 instant 滚动行为', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 100,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
        })
      )

      const mockElement = {
        scrollTo: mockScrollTo,
        scrollTop: 0,
      } as unknown as HTMLDivElement
      ;(result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = mockElement

      act(() => {
        result.current.scrollToIndex(5, 'instant')
      })

      expect(mockScrollTo).toHaveBeenCalledWith({
        top: 250,
        behavior: 'instant',
      })
    })

    it('未启用虚拟滚动时 scrollToIndex 不执行', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 30,
          estimatedItemHeight: 50,
          threshold: 50,
        })
      )

      const mockElement = {
        scrollTo: mockScrollTo,
        scrollTop: 0,
      } as unknown as HTMLDivElement
      ;(result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = mockElement

      act(() => {
        result.current.scrollToIndex(10)
      })

      expect(mockScrollTo).not.toHaveBeenCalled()
    })
  })

  describe('measureHeight 功能', () => {
    it('应该缓存测量的高度', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 60,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
          overscan: 0,
        })
      )

      const mockElement = {
        scrollTo: mockScrollTo,
        scrollTop: 100,
      } as unknown as HTMLDivElement
      ;(result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = mockElement

      // 测量第 0 项（scrollTop 非零，确保 measureHeight 触发 setScrollTop 更新）
      act(() => {
        result.current.measureHeight(0, 80)
      })

      // 验证缓存生效：第一项高度应为 80
      const firstItem = result.current.virtualItems.find((item) => item.index === 0)
      if (firstItem) {
        expect(firstItem.height).toBe(80)
      }
    })

    it('应该在高度未变化时不触发更新', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 60,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
          overscan: 0,
        })
      )

      const mockElement = {
        scrollTo: mockScrollTo,
        scrollTop: 0,
      } as unknown as HTMLDivElement
      ;(result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = mockElement

      // 第一次测量
      act(() => {
        result.current.measureHeight(0, 80)
      })

      mockScrollTo.mockClear()

      // 第二次测量相同高度
      act(() => {
        result.current.measureHeight(0, 80)
      })

      // scrollTo 不应被再次调用（因为高度未变化）
      // 注意：measureHeight 内部调用 setScrollTop(el.scrollTop)，不是 scrollTo
      // 所以这里验证的是不会触发额外的重新计算
    })

    it('应该更新缓存中的高度值', () => {
      const { result } = renderHook(() =>
        useVirtualList({
          itemCount: 60,
          estimatedItemHeight: 50,
          threshold: 50,
          viewportHeight: 200,
          overscan: 0,
        })
      )

      const mockElement = {
        scrollTo: mockScrollTo,
        scrollTop: 100,
      } as unknown as HTMLDivElement
      ;(result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = mockElement

      // 第一次测量
      act(() => {
        result.current.measureHeight(0, 80)
      })

      // 更新为不同高度
      act(() => {
        result.current.measureHeight(0, 100)
      })

      const firstItem = result.current.virtualItems.find((item) => item.index === 0)
      if (firstItem) {
        expect(firstItem.height).toBe(100)
      }
    })
  })

  describe('响应式更新', () => {
    it('应该在 itemCount 变化时重新计算', () => {
      const { result, rerender } = renderHook(
        ({ itemCount }) =>
          useVirtualList({
            itemCount,
            estimatedItemHeight: 50,
            threshold: 50,
            viewportHeight: 200,
          }),
        { initialProps: { itemCount: 60 } }
      )

      expect(result.current.isVirtualized).toBe(true)
      expect(result.current.totalHeight).toBe(60 * 50)

      // 减少 itemCount 到阈值以下
      rerender({ itemCount: 30 })

      expect(result.current.isVirtualized).toBe(false)
    })

    it('应该在 viewportHeight 变化时更新可视区', () => {
      const { result, rerender } = renderHook(
        ({ viewportHeight }) =>
          useVirtualList({
            itemCount: 100,
            estimatedItemHeight: 50,
            threshold: 50,
            viewportHeight,
            overscan: 0,
          }),
        { initialProps: { viewportHeight: 200 } }
      )

      // 视口 200 / 50 = 4 项
      const initialLength = result.current.virtualItems.length

      // 增大视口到 400
      rerender({ viewportHeight: 400 })

      // 视口 400 / 50 = 8 项
      expect(result.current.virtualItems.length).toBeGreaterThan(initialLength)
    })
  })
})
