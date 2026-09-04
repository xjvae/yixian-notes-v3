/**
 * VirtualList 组件单元测试
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { VirtualList } from '@/components/ui/virtual-list'

// 模拟数据
interface TestItem {
  id: string
  title: string
}

function createItems(count: number): TestItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    title: `Item ${i}`,
  }))
}

describe('VirtualList 组件', () => {
  describe('正常列表渲染（未超过阈值）', () => {
    it('应该渲染所有项目（列表数量 <= 阈值）', () => {
      const items = createItems(10)

      render(
        <VirtualList
          items={items}
          estimatedItemHeight={50}
          threshold={50}
          overscan={5}
          getKey={(item) => item.id}
          renderItem={(item) => <div data-testid={`item-${item.id}`}>{item.title}</div>}
        />
      )

      // 所有 10 个项目都应该被渲染
      items.forEach((item) => {
        expect(screen.getByTestId(`item-${item.id}`)).toBeInTheDocument()
      })
    })

    it('应该正确传递 virtualItem 数据给 renderItem', () => {
      const items = createItems(5)
      const renderSpy = vi.fn((item: TestItem) => (
        <div data-testid={`item-${item.id}`}>{item.title}</div>
      ))

      render(
        <VirtualList
          items={items}
          estimatedItemHeight={50}
          threshold={50}
          overscan={5}
          getKey={(item) => item.id}
          renderItem={renderSpy}
        />
      )

      // renderItem 应该被调用 5 次
      expect(renderSpy).toHaveBeenCalledTimes(5)
    })
  })

  describe('虚拟化渲染（超过阈值）', () => {
    it('应该只渲染可视区+overscan 的项目', () => {
      const items = createItems(100)

      render(
        <VirtualList
          items={items}
          estimatedItemHeight={50}
          threshold={50}
          overscan={2}
          viewportHeight={200}
          getKey={(item) => item.id}
          renderItem={(item) => <div data-testid={`item-${item.id}`}>{item.title}</div>}
        />
      )

      // 视口 200 / 50 = 4 项可见 + 上方 2 + 下方 2 = 最多 8 项
      // 但初始滚动位置为 0，上方 overscan 为 0
      // 所以应该是 4 + 2 = 6 项
      const renderedItems = screen.getAllByTestId(/item-item-/)
      expect(renderedItems.length).toBeLessThan(items.length)
      // 视口 200/50=4 项可见，加上下方 overscan 2 = items[0..6] = 7 项
      expect(renderedItems.length).toBeLessThanOrEqual(7)
    })

    it('应该为虚拟滚动项目设置绝对定位样式', () => {
      const items = createItems(100)

      const { container } = render(
        <VirtualList
          items={items}
          estimatedItemHeight={50}
          threshold={50}
          overscan={0}
          viewportHeight={200}
          getKey={(item) => item.id}
          renderItem={(item) => <div>{item.title}</div>}
        />
      )

      // 查找绝对定位的元素
      const absoluteElements = container.querySelectorAll('div[style*="position: absolute"]')
      expect(absoluteElements.length).toBeGreaterThan(0)
    })

    it('应该设置正确的总高度', () => {
      const items = createItems(100)

      const { container } = render(
        <VirtualList
          items={items}
          estimatedItemHeight={50}
          threshold={50}
          overscan={0}
          viewportHeight={200}
          getKey={(item) => item.id}
          renderItem={(item) => <div>{item.title}</div>}
        />
      )

      // 总高度应为 100 * 50 = 5000
      const innerDiv = container.querySelector('div[style*="height: 5000px"]')
      expect(innerDiv).toBeInTheDocument()
    })

    it('滚动后应该更新渲染的项目', () => {
      const items = createItems(100)

      const { container } = render(
        <VirtualList
          items={items}
          estimatedItemHeight={50}
          threshold={50}
          overscan={0}
          viewportHeight={200}
          getKey={(item) => item.id}
          renderItem={(item) => <div data-testid={`item-${item.id}`}>{item.title}</div>}
        />
      )

      // 查找滚动容器（使用 class 选择器，因为 overflow-y-auto 是 Tailwind 类）
      const scrollContainer = container.querySelector('.overflow-y-auto') as HTMLElement
      expect(scrollContainer).not.toBeNull()

      // 模拟滚动到 1000px
      fireEvent.scroll(scrollContainer!, { target: { scrollTop: 1000 } })

      // 1000 / 50 = 第 20 项开始，overscan=0
      // 可见：offsets[20]=1000 到 offsets[24]=1200，endIdx=24，items=[20..24] = 5 项
      const renderedItems = screen.getAllByTestId(/item-item-/)
      expect(renderedItems.length).toBe(5)
    })
  })

  describe('空列表状态', () => {
    it('应该在空列表时渲染 renderEmpty 内容', () => {
      render(
        <VirtualList
          items={[]}
          estimatedItemHeight={50}
          threshold={50}
          overscan={5}
          getKey={(item) => item.id}
          renderItem={(item) => <div>{item.title}</div>}
          renderEmpty={() => <div data-testid="empty-state">暂无数据</div>}
        />
      )

      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
      expect(screen.getByText('暂无数据')).toBeInTheDocument()
    })

    it('空列表时不应该调用 renderItem', () => {
      const renderSpy = vi.fn((item: TestItem) => <div>{item.title}</div>)

      render(
        <VirtualList
          items={[]}
          estimatedItemHeight={50}
          threshold={50}
          overscan={5}
          getKey={(item) => item.id}
          renderItem={renderSpy}
          renderEmpty={() => <div>Empty</div>}
        />
      )

      expect(renderSpy).not.toHaveBeenCalled()
    })

    it('没有 renderEmpty 时不渲染特殊空状态', () => {
      const { container } = render(
        <VirtualList
          items={[]}
          estimatedItemHeight={50}
          threshold={50}
          overscan={5}
          getKey={(item) => item.id}
          renderItem={(item) => <div>{item.title}</div>}
        />
      )

      // 应该渲染一个空的滚动容器（overflow-y-auto 是 Tailwind 类）
      expect(container.querySelector('.overflow-y-auto')).toBeInTheDocument()
    })
  })

  describe('自定义样式和类名', () => {
    it('应该应用自定义 className', () => {
      const items = createItems(5)

      const { container } = render(
        <VirtualList
          items={items}
          estimatedItemHeight={50}
          threshold={50}
          overscan={5}
          getKey={(item) => item.id}
          renderItem={(item) => <div>{item.title}</div>}
          className="custom-class"
        />
      )

      expect(container.querySelector('.custom-class')).toBeInTheDocument()
    })

    it('应该应用自定义 style', () => {
      const items = createItems(5)

      const { container } = render(
        <VirtualList
          items={items}
          estimatedItemHeight={50}
          threshold={50}
          overscan={5}
          getKey={(item) => item.id}
          renderItem={(item) => <div>{item.title}</div>}
          style={{ backgroundColor: 'red' }}
        />
      )

      const styledElement = container.querySelector('div[style*="background-color: red"]')
      expect(styledElement).toBeInTheDocument()
    })

    it('应该应用 contentClassName', () => {
      const items = createItems(100)

      const { container } = render(
        <VirtualList
          items={items}
          estimatedItemHeight={50}
          threshold={50}
          overscan={0}
          viewportHeight={200}
          getKey={(item) => item.id}
          renderItem={(item) => <div>{item.title}</div>}
          contentClassName="custom-content"
        />
      )

      expect(container.querySelector('.custom-content')).toBeInTheDocument()
    })
  })

  describe('gap 支持', () => {
    it('应该在虚拟化模式下将 gap 加入项目高度', () => {
      const items = createItems(100)

      const { container } = render(
        <VirtualList
          items={items}
          estimatedItemHeight={50}
          threshold={50}
          overscan={0}
          viewportHeight={200}
          gap={8}
          getKey={(item) => item.id}
          renderItem={(item) => <div>{item.title}</div>}
        />
      )

      // 总高度应为 100 * (50 + 8) = 5800
      const innerDiv = container.querySelector('div[style*="height: 5800px"]')
      expect(innerDiv).toBeInTheDocument()
    })
  })

  describe('getKey 功能', () => {
    it('应该使用 getKey 返回的值作为 key', () => {
      const items = createItems(5)

      const { container } = render(
        <VirtualList
          items={items}
          estimatedItemHeight={50}
          threshold={50}
          overscan={5}
          getKey={(item) => `key-${item.id}`}
          renderItem={(item) => <div data-testid={`item-${item.id}`}>{item.title}</div>}
        />
      )

      // 验证所有项目都正确渲染
      items.forEach((item) => {
        expect(screen.getByTestId(`item-${item.id}`)).toBeInTheDocument()
      })
    })
  })
})
