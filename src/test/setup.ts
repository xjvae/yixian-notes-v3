/**
 * 测试环境配置
 */
import '@testing-library/jest-dom'

// 模拟 matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// 模拟 IntersectionObserver
class MockIntersectionObserver {
  observe = () => null
  unobserve = () => null
  disconnect = () => null
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
})

Object.defineProperty(global, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
})

// 模拟 ResizeObserver
class MockResizeObserver {
  observe = () => null
  unobserve = () => null
  disconnect = () => null
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
})

Object.defineProperty(global, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
})

// 模拟 crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    ...global.crypto,
    randomUUID: () => 'test-' + Math.random().toString(36).substring(2, 15),
  },
})
