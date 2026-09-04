import type { LoginResult } from '@/types/auth';

// 模拟登录，返回一个固定的游客用户
export default function loginMock(): Promise<LoginResult> {
  return Promise.resolve({
    user: {
      _id: 'mock-user-001',
      nickname: '随手记',
      avatar: 'https://picsum.photos/id/64/200/200',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
      lastLoginAt: Date.now()
    },
    isNew: false
  });
}