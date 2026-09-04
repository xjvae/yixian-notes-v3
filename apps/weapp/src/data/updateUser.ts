import type { UpdateUserInput } from '@/types/auth';
import loginMock from './login';

export default async function updateUserMock(input: UpdateUserInput) {
  const base = await loginMock();
  return {
    ...base.user,
    nickname: input.nickname ?? base.user.nickname,
    avatar: input.avatar ?? base.user.avatar
  };
}