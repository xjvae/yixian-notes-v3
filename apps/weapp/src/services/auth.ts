import { callFunction } from './cloud';
import type { LoginResult, UpdateUserInput } from '@/types/auth';

export async function login(nickname?: string, avatar?: string): Promise<LoginResult> {
  return callFunction<LoginResult>('login', { nickname, avatar });
}

export async function updateUser(input: UpdateUserInput): Promise<LoginResult['user']> {
  return callFunction<LoginResult['user']>('updateUser', input);
}