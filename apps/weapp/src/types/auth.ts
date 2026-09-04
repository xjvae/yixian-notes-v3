// 用户鉴权相关类型
export interface UserProfile {
  _id: string;
  nickname: string;
  avatar: string;
  createdAt: number;
  lastLoginAt: number;
}

export interface SessionState {
  user: UserProfile | null;
  token: string;
  isLoggedIn: boolean;
}

export interface LoginResult {
  user: UserProfile;
  isNew: boolean;
}

export interface UpdateUserInput {
  nickname?: string;
  avatar?: string;
}